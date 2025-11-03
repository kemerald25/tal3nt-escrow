import { createClient } from '@supabase/supabase-js';
import BlockchainService from '../services/blockchain.service';
import WhatsAppService from '../services/whatsapp.service';

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
);

export async function checkAutoReleases() {
    try {
        // Find escrows that should auto-release
        const { data: escrows } = await supabase
            .from('escrows')
            .select('*')
            .eq('status', 'FUNDED')
            .eq('dispute_raised', false)
            .lte('auto_release_time', new Date().toISOString());
        
        if (!escrows || escrows.length === 0) return;
        
        console.log(`Found ${escrows.length} escrows ready for auto-release`);
        
        for (const escrow of escrows) {
            try {
                // Execute auto-release on blockchain
                const txHash = await BlockchainService.executeAutoRelease(escrow.escrow_id);
                
                // Update database
                await supabase
                    .from('escrows')
                    .update({
                        status: 'COMPLETED',
                        completed_at: new Date().toISOString(),
                        release_tx_hash: txHash
                    })
                    .eq('id', escrow.id);
                
                // Notify parties
                const netAmount = escrow.amount * 0.995;
                
                await WhatsAppService.sendMessage(
                    escrow.seller_phone,
                    `💰 Auto-release executed! You received ${netAmount.toFixed(2)}. Transaction complete!`
                );
                
                await WhatsAppService.sendMessage(
                    escrow.buyer_phone,
                    `✅ Escrow auto-released (7 days passed). Transaction complete!`
                );
                
                console.log(`Auto-released escrow ${escrow.id}`);
                
            } catch (error) {
                console.error(`Failed to auto-release escrow ${escrow.id}:`, error);
            }
        }
        
    } catch (error) {
        console.error('Auto-release checker error:', error);
    }
}

// Export for Vercel cron job
export default async function handler(req: any, res: any) {
    await checkAutoReleases();
    res.status(200).json({ success: true });
}

