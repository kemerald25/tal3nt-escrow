import { ethers } from 'hardhat';

async function main() {
    const [deployer] = await ethers.getSigners();
    
    console.log('Deploying contracts with account:', deployer.address);
    console.log('Account balance:', (await deployer.provider.getBalance(deployer.address)).toString());
    
    // USDC address on Base mainnet
    const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
    
    // Fee collector address (your wallet)
    const FEE_COLLECTOR = deployer.address;
    
    // Deploy Escrow contract
    const Escrow = await ethers.getContractFactory('ProofPayEscrow');
    const escrow = await Escrow.deploy(USDC_ADDRESS, FEE_COLLECTOR);
    
    await escrow.waitForDeployment();
    
    const escrowAddress = await escrow.getAddress();
    
    console.log('ProofPayEscrow deployed to:', escrowAddress);
    console.log('USDC address:', USDC_ADDRESS);
    console.log('Fee collector:', FEE_COLLECTOR);
    
    // Save deployment info
    const fs = require('fs');
    const deploymentInfo = {
        escrowAddress,
        usdcAddress: USDC_ADDRESS,
        feeCollector: FEE_COLLECTOR,
        network: 'base',
        deployedAt: new Date().toISOString()
    };
    
    fs.writeFileSync(
        './src/contracts/addresses.json',
        JSON.stringify(deploymentInfo, null, 2)
    );
    
    console.log('\nDeployment info saved to src/contracts/addresses.json');
    console.log('\n⚠️ IMPORTANT: Update your .env file with:');
    console.log(`ESCROW_CONTRACT_ADDRESS=${escrowAddress}`);
    console.log(`USDC_CONTRACT_ADDRESS=${USDC_ADDRESS}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

