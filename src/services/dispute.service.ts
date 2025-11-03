import { createClient } from '@supabase/supabase-js';
import BlockchainService from './blockchain.service';
import WhatsAppService from './whatsapp.service';
import UserService from './user.service';
import IPFSService from './ipfs.service';
import * as Sentry from '@sentry/node';

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
);

class DisputeService {
    
    async raiseDispute(params: {
        escrowId: string;
        raisedByPhone: string;
        reason: string;
        description?: string;
        evidenceFiles?: Array<{ data: Buffer; filename: string }>;
    }) {
        try {
            // Get escrow
            const { data: escrow } = await supabase
                .from('escrows')
                .select('*')
                .eq('id', params.escrowId)
                .single();
            
            if (!escrow) throw new Error('Escrow not found');
            if (escrow.status !== 'FUNDED') throw new Error('Escrow not funded');
            if (escrow.dispute_raised) throw new Error('Dispute already raised');
            
            // Verify caller is buyer or seller
            const isParty = escrow.buyer_phone === params.raisedByPhone || 
                           escrow.seller_phone === params.raisedByPhone;
            
            if (!isParty) throw new Error('Unauthorized');
            
            // Upload evidence to IPFS if provided
            let evidenceUrls: string[] = [];
            if (params.evidenceFiles && params.evidenceFiles.length > 0) {
                evidenceUrls = await Promise.all(
                    params.evidenceFiles.map(file => IPFSService.uploadFile(file.data, file.filename))
                );
            }
            
            // Get user ID
            const user = await UserService.getUserByPhone(params.raisedByPhone);
            if (!user) throw new Error('User not found');
            
            // Raise dispute on blockchain
            const txHash = await BlockchainService.raiseDispute(escrow.escrow_id);
            
            // Create dispute record
            const { data: dispute, error } = await supabase
                .from('disputes')
                .insert({
                    escrow_id: params.escrowId,
                    raised_by: user.id,
                    reason: params.reason,
                    description: params.description,
                    evidence_urls: evidenceUrls,
                    status: 'OPEN'
                })
                .select()
                .single();
            
            if (error) throw error;
            
            // Update escrow
            await supabase
                .from('escrows')
                .update({
                    status: 'DISPUTED',
                    dispute_raised: true,
                    dispute_raised_by: user.id,
                    dispute_raised_at: new Date().toISOString()
                })
                .eq('id', params.escrowId);
            
            // Increment user dispute count
            await UserService.incrementDisputeCount(user.id);
            
            // Notify both parties
            await WhatsAppService.sendDisputeRaised(escrow.buyer_phone, params.escrowId);
            await WhatsAppService.sendDisputeRaised(escrow.seller_phone, params.escrowId);
            
            return { success: true, disputeId: dispute.id, txHash };
            
        } catch (error) {
            Sentry.captureException(error);
            throw error;
        }
    }
    
    async resolveDispute(disputeId: string, buyerPercentage: number, resolvedBy: string) {
        try {
            // Get dispute and escrow
            const { data: dispute } = await supabase
                .from('disputes')
                .select('*, escrows(*)')
                .eq('id', disputeId)
                .single();
            
            if (!dispute) throw new Error('Dispute not found');
            if (dispute.status !== 'OPEN') throw new Error('Dispute already resolved');
            
            const escrow = (dispute as any).escrows;
            
            // Resolve on blockchain
            const txHash = await BlockchainService.resolveDispute(
                escrow.escrow_id,
                buyerPercentage
            );
            
            // Update dispute
            await supabase
                .from('disputes')
                .update({
                    status: 'RESOLVED',
                    buyer_percentage: buyerPercentage,
                    resolved_by: resolvedBy,
                    resolved_at: new Date().toISOString(),
                    resolution: `Buyer: ${buyerPercentage}%, Seller: ${100 - buyerPercentage}%`
                })
                .eq('id', disputeId);
            
            // Update escrow
            await supabase
                .from('escrows')
                .update({
                    status: 'COMPLETED',
                    completed_at: new Date().toISOString()
                })
                .eq('id', escrow.id);
            
            // Notify parties
            const buyerAmount = (escrow.amount * buyerPercentage) / 100;
            const sellerAmount = escrow.amount - buyerAmount;
            
            await WhatsAppService.sendMessage(
                escrow.buyer_phone,
                `✅ Dispute resolved! You received ${buyerAmount.toFixed(2)} (${buyerPercentage}% of escrow).`
            );
            
            await WhatsAppService.sendMessage(
                escrow.seller_phone,
                `✅ Dispute resolved! You received ${sellerAmount.toFixed(2)} (${100 - buyerPercentage}% of escrow).`
            );
            
            return { success: true, txHash };
            
        } catch (error) {
            Sentry.captureException(error);
            throw error;
        }
    }
}

export default new DisputeService();

