import { Request, Response } from 'express';
import WhatsAppService from '../services/whatsapp.service';
import EscrowService from '../services/escrow.service';
import UserService from '../services/user.service';
import DisputeService from '../services/dispute.service';
import * as Sentry from '@sentry/node';

export async function webhookHandler(req: Request, res: Response) {
    try {
        const { Body, From, MessageSid } = req.body;
        
        // Acknowledge receipt immediately
        res.status(200).send('OK');
        
        const phoneNumber = From.replace('whatsapp:', '');
        const message = Body.trim();
        
        // Get or create user
        const user = await UserService.getOrCreateUser(phoneNumber);
        
        // Parse command
        if (message.startsWith('+')) {
            // Create escrow: +2348123456789 50
            await handleCreateEscrow(phoneNumber, message);
        } else if (message.startsWith('pay ') || message.startsWith('Pay ')) {
            // Pay escrow: pay EP12345 or Pay EP12345
            await handlePayCommand(phoneNumber, message);
        } else if (message.startsWith('confirm ') || message.startsWith('Confirm ')) {
            // Confirm delivery: confirm EP12345
            await handleConfirmCommand(phoneNumber, message);
        } else if (message.startsWith('dispute ') || message.startsWith('Dispute ')) {
            // Raise dispute: dispute EP12345
            await handleDisputeCommand(phoneNumber, message);
        } else if (message.toLowerCase() === 'help') {
            await WhatsAppService.sendHelpMessage(phoneNumber);
        } else if (message.toLowerCase() === 'history') {
            await handleHistoryCommand(phoneNumber);
        } else if (message.startsWith('status ')) {
            await handleStatusCommand(phoneNumber, message);
        } else {
            await WhatsAppService.sendMessage(
                phoneNumber,
                "I didn't understand that command. Send 'help' for instructions."
            );
        }
        
    } catch (error) {
        Sentry.captureException(error);
        console.error('Webhook error:', error);
    }
}

async function handleCreateEscrow(sellerPhone: string, message: string) {
    try {
        // Parse: +2348123456789 50 [optional description]
        const parts = message.trim().split(' ');
        const buyerPhone = parts[0];
        const amount = parseFloat(parts[1]);
        const description = parts.slice(2).join(' ') || 'Item';
        
        if (!buyerPhone || isNaN(amount) || amount <= 0) {
            await WhatsAppService.sendMessage(
                sellerPhone,
                '❌ Invalid format. Use: +2348123456789 50 [item description]'
            );
            return;
        }
        
        // Create escrow
        const result = await EscrowService.createEscrow({
            sellerPhone,
            buyerPhone,
            amount,
            description
        });
        
        // Send confirmations
        await WhatsAppService.sendEscrowCreatedToSeller(sellerPhone, {
            ...result,
            buyerPhone
        });
        await WhatsAppService.sendPaymentRequestToBuyer(buyerPhone, result);
        
    } catch (error) {
        Sentry.captureException(error);
        await WhatsAppService.sendMessage(
            sellerPhone,
            '❌ Failed to create escrow. Please try again.'
        );
    }
}

async function handlePayCommand(buyerPhone: string, message: string) {
    try {
        const parts = message.split(' ');
        const escrowId = parts[1];
        
        if (!escrowId) {
            await WhatsAppService.sendMessage(
                buyerPhone,
                '❌ Please provide escrow ID. Usage: pay [escrow-id]'
            );
            return;
        }
        
        const escrow = await EscrowService.getEscrowByShortId(escrowId);
        
        if (!escrow) {
            await WhatsAppService.sendMessage(
                buyerPhone,
                '❌ Escrow not found. Please check the ID.'
            );
            return;
        }
        
        await WhatsAppService.sendPaymentRequestToBuyer(buyerPhone, {
            amount: escrow.amount,
            description: escrow.item_description,
            shortId: escrowId,
            paymentAddress: process.env.ESCROW_CONTRACT_ADDRESS,
            usdcAddress: process.env.USDC_CONTRACT_ADDRESS
        });
        
    } catch (error) {
        Sentry.captureException(error);
        await WhatsAppService.sendMessage(
            buyerPhone,
            '❌ Failed to process payment request.'
        );
    }
}

async function handleConfirmCommand(buyerPhone: string, message: string) {
    try {
        const parts = message.split(' ');
        const escrowId = parts[1];
        
        if (!escrowId) {
            await WhatsAppService.sendMessage(
                buyerPhone,
                '❌ Please provide escrow ID. Usage: confirm [escrow-id]'
            );
            return;
        }
        
        const result = await EscrowService.releaseFunds(escrowId, buyerPhone);
        
        if (result.success) {
            await WhatsAppService.sendMessage(
                buyerPhone,
                `✅ Funds released! Transaction complete. 🎉`
            );
        }
        
    } catch (error: any) {
        Sentry.captureException(error);
        await WhatsAppService.sendMessage(
            buyerPhone,
            `❌ ${error.message || 'Failed to release funds.'}`
        );
    }
}

async function handleDisputeCommand(phoneNumber: string, message: string) {
    try {
        const parts = message.split(' ');
        const escrowId = parts[1];
        const reason = parts[2] || 'OTHER';
        const description = parts.slice(3).join(' ') || 'No description provided';
        
        if (!escrowId) {
            await WhatsAppService.sendMessage(
                phoneNumber,
                '❌ Please provide escrow ID. Usage: dispute [escrow-id] [reason] [description]'
            );
            return;
        }
        
        const result = await DisputeService.raiseDispute({
            escrowId,
            raisedByPhone: phoneNumber,
            reason,
            description
        });
        
        if (result.success) {
            await WhatsAppService.sendMessage(
                phoneNumber,
                `✅ Dispute raised successfully. An arbitrator will review your case.`
            );
        }
        
    } catch (error: any) {
        Sentry.captureException(error);
        await WhatsAppService.sendMessage(
            phoneNumber,
            `❌ ${error.message || 'Failed to raise dispute.'}`
        );
    }
}

async function handleHistoryCommand(phoneNumber: string) {
    try {
        const user = await UserService.getUserByPhone(phoneNumber);
        if (!user) {
            await WhatsAppService.sendMessage(
                phoneNumber,
                '❌ User not found.'
            );
            return;
        }
        
        const buyerEscrows = await EscrowService.getUserEscrows(user.id, 'buyer');
        const sellerEscrows = await EscrowService.getUserEscrows(user.id, 'seller');
        
        const allEscrows = [...buyerEscrows, ...sellerEscrows].slice(0, 5);
        
        if (allEscrows.length === 0) {
            await WhatsAppService.sendMessage(
                phoneNumber,
                '📋 No transactions found.'
            );
            return;
        }
        
        const historyText = allEscrows.map(escrow => 
            `🔐 ${escrow.id}\n💰 ${escrow.amount} USDC\n📦 ${escrow.item_description}\n✅ ${escrow.status}\n`
        ).join('\n---\n\n');
        
        await WhatsAppService.sendMessage(
            phoneNumber,
            `📋 *Your Recent Transactions*\n\n${historyText}`
        );
        
    } catch (error) {
        Sentry.captureException(error);
        await WhatsAppService.sendMessage(
            phoneNumber,
            '❌ Failed to fetch transaction history.'
        );
    }
}

async function handleStatusCommand(phoneNumber: string, message: string) {
    try {
        const parts = message.split(' ');
        const escrowId = parts[1];
        
        if (!escrowId) {
            await WhatsAppService.sendMessage(
                phoneNumber,
                '❌ Please provide escrow ID. Usage: status [escrow-id]'
            );
            return;
        }
        
        const escrow = await EscrowService.getEscrowByShortId(escrowId);
        
        if (!escrow) {
            await WhatsAppService.sendMessage(
                phoneNumber,
                '❌ Escrow not found.'
            );
            return;
        }
        
        const status = await EscrowService.checkPaymentStatus(escrowId);
        
        await WhatsAppService.sendMessage(
            phoneNumber,
            `📊 *Escrow Status*\n\n🔐 ID: ${escrowId}\n💰 Amount: ${escrow.amount} USDC\n📦 Item: ${escrow.item_description}\n✅ Status: ${status.status || escrow.status}\n`
        );
        
    } catch (error) {
        Sentry.captureException(error);
        await WhatsAppService.sendMessage(
            phoneNumber,
            '❌ Failed to check escrow status.'
        );
    }
}

// Vercel serverless function handler
export default async function handler(req: Request, res: Response) {
    if (req.method === 'POST') {
        await webhookHandler(req, res);
    } else {
        res.status(405).json({ error: 'Method not allowed' });
    }
}

