import { ethers } from 'hardhat';

// Configuration parameters
const PARAMS = {
    GOVERNANCE: '0x5B024AfAaaed10bA2788fdDCd7b72Af60A854D2F',
    SLASHING_ADMIN: '0x5B024AfAaaed10bA2788fdDCd7b72Af60A854D2F',
    COOLDOWN_PAUSE_ADMIN: '0x5B024AfAaaed10bA2788fdDCd7b72Af60A854D2F',
    CLAIM_HELPER: '0x5B024AfAaaed10bA2788fdDCd7b72Af60A854D2F',
    MAX_SLASHABLE_PERCENTAGE: 2000,         // 20%
    COOLDOWN_SECONDS: 10 * 24 * 60 * 60     // 10 days
};

// Add your deployment addresses here
const DEPLOYMENT_ADDRESSES = {
    IMPLEMENTATION: '0xf7588bB02065A998aC6f2f8b82E539Bb42e43b0a', // Add implementation address
    PROXY: '0xae48aEF49132EE4BCFcAb1a84E60f03210c4a2cE'          // Add proxy address
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