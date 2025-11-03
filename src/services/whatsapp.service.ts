import twilio from 'twilio';
import * as Sentry from '@sentry/node';

const client = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
);

class WhatsAppService {
    private botNumber = process.env.BOT_PHONE_NUMBER!;
    
    async sendMessage(to: string, body: string) {
        try {
            const message = await client.messages.create({
                from: this.botNumber,
                to: `whatsapp:${to}`,
                body
            });
            
            return message.sid;
        } catch (error) {
            Sentry.captureException(error);
            console.error('WhatsApp send error:', error);
            throw error;
        }
    }
    
    async sendEscrowCreatedToSeller(sellerPhone: string, escrowData: any) {
        const message = `✅ *Escrow Created!*



💰 Amount: ${escrowData.amount}

🛍️ Item: ${escrowData.description}

👤 Buyer: ${escrowData.buyerPhone}

🔐 Escrow ID: ${escrowData.shortId}



I've notified the buyer. You'll receive payment once they send USDC to the escrow address.



Payment will auto-release in 7 days after funding. 🔒`;
        
        return this.sendMessage(sellerPhone, message);
    }
    
    async sendPaymentRequestToBuyer(buyerPhone: string, escrowData: any) {
        const message = `💳 *Payment Request*



Seller is requesting payment:

💰 Amount: ${escrowData.amount} USDC

🛍️ Item: ${escrowData.description}

🔐 Escrow ID: ${escrowData.shortId}



*HOW TO PAY:*

1. Open your crypto wallet (MetaMask, Coinbase Wallet, etc.)

2. Send exactly ${escrowData.amount} USDC on Base network to:



📍 *Contract Address:*

\`${escrowData.paymentAddress}\`



📍 *USDC Token Address:*

\`${escrowData.usdcAddress}\`



⚠️ *IMPORTANT:*

• Network: Base (not Ethereum mainnet!)

• Token: USDC only

• Amount: Exactly ${escrowData.amount}



Your payment is protected! 🔒

Funds stay in escrow until you confirm delivery.



Need help? Reply "help"`;
        
        return this.sendMessage(buyerPhone, message);
    }
    
    async sendPaymentConfirmed(phone: string, role: 'buyer' | 'seller', amount: number) {
        const buyerMsg = `✅ *Payment Confirmed!*



${amount} is now secured in escrow! 🔒



The seller will deliver your item. When you receive it, reply:

"confirm [escrow-id]"



Funds will auto-release in 7 days if no issues.



Have a problem? Reply "dispute [escrow-id]"`;
        
        const sellerMsg = `✅ *Payment Received!*



${amount} is now in escrow! 🔒



Deliver the item to the buyer. They'll confirm receipt and funds will be released to you.



Funds auto-release in 7 days. 💰`;
        
        return this.sendMessage(phone, role === 'buyer' ? buyerMsg : sellerMsg);
    }
    
    async sendDeliveryConfirmationRequest(buyerPhone: string, escrowId: string, description: string, daysRemaining: number) {
        const message = `📦 *Delivery Check*



Did you receive your ${description}?



Reply "confirm ${escrowId}" to release payment to seller.



⚠️ Funds auto-release in ${daysRemaining} day(s) if no response.



Problem? Reply "dispute ${escrowId}"`;
        
        return this.sendMessage(buyerPhone, message);
    }
    
    async sendFundsReleased(sellerPhone: string, netAmount: number) {
        const message = `💰 *Funds Released!*



You received: ${netAmount.toFixed(2)} USDC



Check your wallet: ${process.env.PLATFORM_FEE_WALLET}



Transaction complete! 🎉



Thanks for using ProofPay! 🙏`;
        
        return this.sendMessage(sellerPhone, message);
    }
    
    async sendDisputeRaised(phone: string, escrowId: string) {
        const message = `⚠️ *Dispute Raised*



Escrow ID: ${escrowId}



An arbitrator will review this case within 24-48 hours.



Please be ready to provide:

• Photos/videos of the item

• Communication history

• Any other evidence



We'll contact you soon. 📞`;
        
        return this.sendMessage(phone, message);
    }
    
    async sendHelpMessage(phone: string) {
        const message = `🤖 *ProofPay Help*



*CREATE ESCROW (Seller):*

+[buyer-phone] [amount] [item]

Example: +2348123456789 50 iPhone case



*PAY (Buyer):*

Send USDC to the contract address provided



*CONFIRM DELIVERY (Buyer):*

confirm [escrow-id]



*RAISE DISPUTE:*

dispute [escrow-id]



*CHECK STATUS:*

status [escrow-id]



*MY TRANSACTIONS:*

history



Need more help? Visit: proofpay.io/help`;
        
        return this.sendMessage(phone, message);
    }
    
    async sendButtonMessage(to: string, body: string, buttons: Array<{ id: string; title: string }>) {
        // Note: Twilio WhatsApp has limited interactive message support
        // For MVP, we'll use text with reply instructions
        const buttonText = buttons.map((btn, i) => `${i + 1}. ${btn.title}`).join('\n');
        const fullMessage = `${body}\n\n${buttonText}\n\nReply with the number of your choice.`;
        
        return this.sendMessage(to, fullMessage);
    }
}

export default new WhatsAppService();

