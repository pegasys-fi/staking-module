import { ethers } from 'hardhat';

// Configuration parameters
const PARAMS = {
    GOVERNANCE: '0x6055e657a2aA5319BEb3B9b4950E89D3aE30937A',
    SLASHING_ADMIN: '0x6055e657a2aA5319BEb3B9b4950E89D3aE30937A',
    COOLDOWN_PAUSE_ADMIN: '0x6055e657a2aA5319BEb3B9b4950E89D3aE30937A',
    CLAIM_HELPER: '0x6055e657a2aA5319BEb3B9b4950E89D3aE30937A',
    MAX_SLASHABLE_PERCENTAGE: 2000,         // 20%
    COOLDOWN_SECONDS: 10 * 24 * 60 * 60     // 10 days
};

// Add your deployment addresses here
const DEPLOYMENT_ADDRESSES = {
    IMPLEMENTATION: '0x37d6fadf27a710578D1cdE94126E0d39e29Dc7A7', // Add implementation address
    PROXY: '0xd05D3fD74a947bf6814dDdD141138Af92Cb07636'          // Add proxy address
};

async function main() {
    // Get deployer signer
    const [deployer] = await ethers.getSigners();
    console.log('Initializing contracts with the account:', deployer.address);

    if (!DEPLOYMENT_ADDRESSES.IMPLEMENTATION || !DEPLOYMENT_ADDRESSES.PROXY) {
        throw new Error('Please set the IMPLEMENTATION and PROXY addresses in the script');
    }

    try {
        // Get contract factories
        const StakedPSYSV3 = await ethers.getContractFactory('contracts/StakedPSYSV3.sol:StakedPSYSV3');
        const Proxy = await ethers.getContractFactory('contracts/lib/InitializableAdminUpgradeabilityProxy.sol:InitializableAdminUpgradeabilityProxy');

        // Get contract instances
        const proxy = await Proxy.attach(DEPLOYMENT_ADDRESSES.PROXY);

        // Prepare initialization data
        console.log('\nPreparing initialization data...');
        const initializeData = StakedPSYSV3.interface.encodeFunctionData('initialize', [
            PARAMS.SLASHING_ADMIN,
            PARAMS.COOLDOWN_PAUSE_ADMIN,
            PARAMS.CLAIM_HELPER,
            PARAMS.MAX_SLASHABLE_PERCENTAGE,
            PARAMS.COOLDOWN_SECONDS
        ]);

        // Initialize proxy with explicit gas limit
        console.log('Initializing proxy...');
        const tx = await proxy['initialize(address,address,bytes)'](
            DEPLOYMENT_ADDRESSES.IMPLEMENTATION,
            PARAMS.GOVERNANCE,
            initializeData,
            { gasLimit: 1000000 } // Add explicit gas limit
        );

        console.log('Waiting for transaction confirmation...');
        await tx.wait();

        console.log('\nInitialization completed successfully');
        console.log('Proxy address:', DEPLOYMENT_ADDRESSES.PROXY);
        console.log('Implementation address:', DEPLOYMENT_ADDRESSES.IMPLEMENTATION);

    } catch (error) {
        console.error('Error during initialization:', error);
        throw error;
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });