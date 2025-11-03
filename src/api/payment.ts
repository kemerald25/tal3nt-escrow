import { Request, Response } from 'express';
import EscrowService from '../services/escrow.service';
import * as Sentry from '@sentry/node';

export async function initiatePayment(req: Request, res: Response) {
    try {
        const { escrowId, buyerPhone } = req.body;
        
        if (!escrowId) {
            return res.status(400).json({ error: 'Missing escrow ID' });
        }
        
        const escrow = await EscrowService.getEscrowByShortId(escrowId);
        
        if (!escrow) {
            return res.status(404).json({ error: 'Escrow not found' });
        }
        
        if (escrow.status !== 'CREATED') {
            return res.status(400).json({ error: 'Escrow already funded' });
        }
        
        // Return payment instructions
        res.json({
            escrowId: escrow.escrow_id,
            amount: escrow.amount,
            recipientAddress: process.env.ESCROW_CONTRACT_ADDRESS,
            usdcAddress: process.env.USDC_CONTRACT_ADDRESS,
            instructions: 'Send USDC to the contract address to fund this escrow'
        });
        
    } catch (error) {
        Sentry.captureException(error);
        res.status(500).json({ error: 'Failed to generate payment instructions' });
    }
}

// Vercel serverless function handler
export default async function handler(req: Request, res: Response) {
    if (req.method === 'POST') {
        await initiatePayment(req, res);
    } else {
        res.status(405).json({ error: 'Method not allowed' });
    }
}

