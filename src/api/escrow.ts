import { Request, Response } from 'express';
import EscrowService from '../services/escrow.service';
import * as Sentry from '@sentry/node';

export async function createEscrowAPI(req: Request, res: Response) {
    try {
        const { sellerPhone, buyerPhone, amount, description, sellerWallet } = req.body;
        
        // Validate inputs
        if (!sellerPhone || !buyerPhone || !amount || !sellerWallet) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        const result = await EscrowService.createEscrow({
            sellerPhone,
            buyerPhone,
            amount,
            description: description || 'Item',
            sellerWallet
        });
        
        res.json(result);
        
    } catch (error) {
        Sentry.captureException(error);
        res.status(500).json({ error: 'Failed to create escrow' });
    }
}

export async function releaseFundsAPI(req: Request, res: Response) {
    try {
        const { escrowId, buyerPhone } = req.body;
        
        if (!escrowId || !buyerPhone) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        const result = await EscrowService.releaseFunds(escrowId, buyerPhone);
        
        res.json(result);
        
    } catch (error) {
        Sentry.captureException(error);
        res.status(500).json({ error: 'Failed to release funds' });
    }
}

// Vercel serverless function handler
export default async function handler(req: Request, res: Response) {
    if (req.method === 'POST') {
        const { pathname } = new URL(req.url || '/', 'http://localhost');
        
        if (pathname.includes('/create')) {
            await createEscrowAPI(req, res);
        } else if (pathname.includes('/release')) {
            await releaseFundsAPI(req, res);
        } else {
            res.status(404).json({ error: 'Endpoint not found' });
        }
    } else {
        res.status(405).json({ error: 'Method not allowed' });
    }
}

