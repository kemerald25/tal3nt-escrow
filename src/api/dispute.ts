import { Request, Response } from 'express';
import DisputeService from '../services/dispute.service';
import * as Sentry from '@sentry/node';

export async function raiseDispute(req: Request, res: Response) {
    try {
        const { escrowId, raisedByPhone, reason, description } = req.body;
        
        if (!escrowId || !raisedByPhone || !reason) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        const result = await DisputeService.raiseDispute({
            escrowId,
            raisedByPhone,
            reason,
            description
        });
        
        res.json(result);
        
    } catch (error) {
        Sentry.captureException(error);
        res.status(500).json({ error: 'Failed to raise dispute' });
    }
}

// Vercel serverless function handler
export default async function handler(req: Request, res: Response) {
    if (req.method === 'POST') {
        await raiseDispute(req, res);
    } else {
        res.status(405).json({ error: 'Method not allowed' });
    }
}

