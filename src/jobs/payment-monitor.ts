import { createClient } from '@supabase/supabase-js';
import EscrowService from '../services/escrow.service';

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
);

export async function monitorPayments() {
    try {
        // Find created escrows that need payment monitoring
        const { data: escrows } = await supabase
            .from('escrows')
            .select('*')
            .eq('status', 'CREATED')
            .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()); // Last 24 hours
        
        if (!escrows || escrows.length === 0) return;
        
        console.log(`Monitoring ${escrows.length} pending payments`);
        
        for (const escrow of escrows) {
            try {
                await EscrowService.checkPaymentStatus(escrow.id);
            } catch (error) {
                console.error(`Failed to check payment for escrow ${escrow.id}:`, error);
            }
        }
        
    } catch (error) {
        console.error('Payment monitor error:', error);
    }
}

export default async function handler(req: any, res: any) {
    await monitorPayments();
    res.status(200).json({ success: true });
}

