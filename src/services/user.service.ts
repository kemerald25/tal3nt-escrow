import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
);

class UserService {
    
    async getOrCreateUser(phoneNumber: string) {
        // Try to find existing user
        const { data: existing } = await supabase
            .from('users')
            .select('*')
            .eq('phone_number', phoneNumber)
            .single();
        
        if (existing) return existing;
        
        // Create new user
        const { data: newUser, error } = await supabase
            .from('users')
            .insert({
                phone_number: phoneNumber,
                username: `user_${phoneNumber.slice(-4)}`
            })
            .select()
            .single();
        
        if (error) throw error;
        
        return newUser;
    }
    
    async updateWalletAddress(userId: string, walletAddress: string) {
        await supabase
            .from('users')
            .update({ wallet_address: walletAddress })
            .eq('id', userId);
    }
    
    async incrementTransactionCount(userId: string, successful: boolean = true) {
        const { data: user } = await supabase
            .from('users')
            .select('total_transactions, successful_transactions')
            .eq('id', userId)
            .single();
        
        if (!user) return;
        
        await supabase
            .from('users')
            .update({
                total_transactions: user.total_transactions + 1,
                successful_transactions: successful ? user.successful_transactions + 1 : user.successful_transactions
            })
            .eq('id', userId);
    }
    
    async incrementDisputeCount(userId: string) {
        const { data: user } = await supabase
            .from('users')
            .select('dispute_count')
            .eq('id', userId)
            .single();
        
        if (!user) return;
        
        await supabase
            .from('users')
            .update({
                dispute_count: user.dispute_count + 1
            })
            .eq('id', userId);
    }
    
    async getUserByPhone(phoneNumber: string) {
        const { data } = await supabase
            .from('users')
            .select('*')
            .eq('phone_number', phoneNumber)
            .single();
        
        return data;
    }
}

export default new UserService();

