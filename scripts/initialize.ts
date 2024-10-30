import { ethers } from 'hardhat';

// Configuration parameters
const PARAMS = {
    GOVERNANCE: '0xaf399890A1b2affD25309D6b5c5Bcf8e917bD3BB',
    SLASHING_ADMIN: '0xaf399890A1b2affD25309D6b5c5Bcf8e917bD3BB',
    COOLDOWN_PAUSE_ADMIN: '0xaf399890A1b2affD25309D6b5c5Bcf8e917bD3BB',
    CLAIM_HELPER: '0xaf399890A1b2affD25309D6b5c5Bcf8e917bD3BB',
    MAX_SLASHABLE_PERCENTAGE: 2000,         // 20%
    COOLDOWN_SECONDS: 10 * 24 * 60 * 60     // 10 days
};

// Add your deployment addresses here
const DEPLOYMENT_ADDRESSES = {
    IMPLEMENTATION: '0x152708C13b429f5facFd5c980bF02A4422096ea8', // Add implementation address
    PROXY: '0x3C72568C296902Dc75c6BEfa113eF8dBfb015347'          // Add proxy address
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
        const implementation = await StakedPSYSV3.attach(DEPLOYMENT_ADDRESSES.IMPLEMENTATION);
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