import { createClient } from '@supabase/supabase-js';
import WhatsAppService from '../services/whatsapp.service';

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
);

export async function sendDeliveryReminders() {
    try {
        // Find funded escrows older than 2 days
        const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
        
        const { data: escrows } = await supabase
            .from('escrows')
            .select('*')
            .eq('status', 'FUNDED')
            .eq('dispute_raised', false)
            .lte('funded_at', twoDaysAgo.toISOString());
        
        if (!escrows || escrows.length === 0) return;
        
        console.log(`Sending ${escrows.length} delivery reminders`);
        
        for (const escrow of escrows) {
            try {
                const autoReleaseTime = new Date(escrow.auto_release_time);
                const now = new Date();
                const daysRemaining = Math.ceil((autoReleaseTime.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                
                await WhatsAppService.sendDeliveryConfirmationRequest(
                    escrow.buyer_phone,
                    escrow.id,
                    escrow.item_description,
                    daysRemaining
                );
                
                console.log(`Sent reminder for escrow ${escrow.id}`);
                
            } catch (error) {
                console.error(`Failed to send reminder for escrow ${escrow.id}:`, error);
            }
        }
        
    } catch (error) {
        console.error('Delivery reminder error:', error);
    }
}

export default async function handler(req: any, res: any) {
    await sendDeliveryReminders();
    res.status(200).json({ success: true });
}

