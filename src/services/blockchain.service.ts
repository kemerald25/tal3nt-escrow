import { ethers } from 'ethers';
import { ESCROW_CONTRACT_ADDRESS, USDC_ADDRESS } from '../contracts/addresses';
import EscrowABI from '../contracts/escrow.abi.json';

class BlockchainService {
    private provider: ethers.JsonRpcProvider;
    private wallet: ethers.Wallet;
    private escrowContract: ethers.Contract;
    
    constructor() {
        this.provider = new ethers.JsonRpcProvider(process.env.BASE_RPC_URL);
        this.wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, this.provider);
        this.escrowContract = new ethers.Contract(
            ESCROW_CONTRACT_ADDRESS,
            EscrowABI,
            this.wallet
        );
    }
    
    async createEscrow(
        buyerAddress: string,
        sellerAddress: string,
        amount: string // in USDC (6 decimals)
    ): Promise<{ escrowId: string; txHash: string }> {
        try {
            const amountInWei = ethers.parseUnits(amount, 6); // USDC has 6 decimals
            
            const tx = await this.escrowContract.createEscrow(
                buyerAddress,
                sellerAddress,
                amountInWei
            );
            
            const receipt = await tx.wait();
            
            // Extract escrow ID from event
            const event = receipt.logs.find((log: any) => 
                log.topics[0] === this.escrowContract.interface.getEvent('EscrowCreated').topicHash
            );
            
            const escrowId = event.topics[1]; // escrowId is the first indexed parameter
            
            return {
                escrowId,
                txHash: receipt.hash
            };
            
        } catch (error) {
            console.error('Blockchain error:', error);
            throw new Error('Failed to create escrow on blockchain');
        }
    }
    
    async checkEscrowStatus(escrowId: string): Promise<any> {
        try {
            const escrow = await this.escrowContract.getEscrow(escrowId);
            
            return {
                buyer: escrow.buyer,
                seller: escrow.seller,
                amount: ethers.formatUnits(escrow.amount, 6),
                status: this.getStatusString(escrow.status),
                autoReleaseTime: new Date(Number(escrow.autoReleaseTime) * 1000),
                disputeRaised: escrow.disputeRaised
            };
            
        } catch (error) {
            console.error('Status check error:', error);
            throw new Error('Failed to check escrow status');
        }
    }
    
    async releaseFunds(escrowId: string): Promise<string> {
        try {
            const tx = await this.escrowContract.releaseFunds(escrowId);
            const receipt = await tx.wait();
            return receipt.hash;
        } catch (error) {
            console.error('Release funds error:', error);
            throw new Error('Failed to release funds');
        }
    }
    
    async raiseDispute(escrowId: string): Promise<string> {
        try {
            const tx = await this.escrowContract.raiseDispute(escrowId);
            const receipt = await tx.wait();
            return receipt.hash;
        } catch (error) {
            console.error('Raise dispute error:', error);
            throw new Error('Failed to raise dispute');
        }
    }
    
    async resolveDispute(
        escrowId: string,
        buyerPercentage: number
    ): Promise<string> {
        try {
            const tx = await this.escrowContract.resolveDispute(escrowId, buyerPercentage);
            const receipt = await tx.wait();
            return receipt.hash;
        } catch (error) {
            console.error('Resolve dispute error:', error);
            throw new Error('Failed to resolve dispute');
        }
    }
    
    async checkAutoRelease(escrowId: string): Promise<boolean> {
        try {
            const escrow = await this.escrowContract.getEscrow(escrowId);
            const now = Math.floor(Date.now() / 1000);
            return Number(escrow.autoReleaseTime) <= now && escrow.status === 1; // FUNDED
        } catch (error) {
            return false;
        }
    }
    
    async executeAutoRelease(escrowId: string): Promise<string> {
        try {
            const tx = await this.escrowContract.autoRelease(escrowId);
            const receipt = await tx.wait();
            return receipt.hash;
        } catch (error) {
            console.error('Auto-release error:', error);
            throw new Error('Failed to execute auto-release');
        }
    }
    
    private getStatusString(status: number): string {
        const statuses = ['CREATED', 'FUNDED', 'COMPLETED', 'DISPUTED', 'REFUNDED', 'CANCELLED'];
        return statuses[status] || 'UNKNOWN';
    }
}

export default new BlockchainService();

