// scripts/deploy.ts

import { ethers, network, run } from 'hardhat';

async function main() {
    // Define constants for addresses (replace with your actual addresses)
    const governance = '0x8BffC896D42F07776561A5814D6E4240950d6D3a';        // Replace with your governance address
    const slashingAdmin = '0x8BffC896D42F07776561A5814D6E4240950d6D3a';                  // Replace with your owner address
    const emissionManagerAddress = '0x8BffC896D42F07776561A5814D6E4240950d6D3a'; // Replace with your emission manager address
    const rewardsVaultAddress = '0x8BffC896D42F07776561A5814D6E4240950d6D3a';    // Replace with your rewards vault address
    const psysTokenAddress = '0x48023b16c3e81AA7F6eFFbdEB35Bb83f4f31a8fd';               // Replace with your PSYS token address
    const cooldownPauseAdmin = '0x8BffC896D42F07776561A5814D6E4240950d6D3a';
    const claimHelper = '0x8BffC896D42F07776561A5814D6E4240950d6D3a';

    // Get deployer signer
    const [deployer] = await ethers.getSigners();

    console.log('Deploying contracts with the account:', deployer.address);
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log('Account balance:', ethers.formatEther(balance));

    // Deploy StakedPSYSV3 implementation
    console.log('\nDeploying StakedPSYSV3 implementation...');
    const StakedPSYSV3Factory = await ethers.getContractFactory('StakedPSYSV3');
    const stakedTokenImpl = await StakedPSYSV3Factory.deploy(
        psysTokenAddress,      // stakedToken
        psysTokenAddress,      // rewardToken
        7 * 24 * 60 * 60,       // unstakeWindow: 7 days
        rewardsVaultAddress,    // rewardsVault
        emissionManagerAddress, // emissionManager
        365 * 24 * 60 * 60,      // distributionDuration: 1 year
        { gasLimit: 30000000 } // or another appropriate limit
    );
    await stakedTokenImpl.waitForDeployment();
    const stakedTokenImplAddress = await stakedTokenImpl.getAddress();
    console.log('StakedPSYSV3 implementation deployed to:', stakedTokenImplAddress);

    // Verify contracts if on Rollux network
    if (network.name === 'rollux') {
        console.log('Waiting for Blockscout to index the contracts...');
        await new Promise((resolve) => setTimeout(resolve, 10000)); // Wait for 10 seconds

        try {
            console.log('Verifying StakedPSYSV3 implementation...');
            await run('verify:verify', {
                address: stakedTokenImplAddress,
                constructorArguments: [
                    psysTokenAddress,
                    psysTokenAddress,
                    7 * 24 * 60 * 60,
                    rewardsVaultAddress,
                    emissionManagerAddress,
                    365 * 24 * 60 * 60
                ],
                contract: 'contracts/StakedPSYSV3.sol:StakedPSYSV3',
            });
            console.log('StakedPSYSV3 implementation verified');
        } catch (error: any) {
            console.error('Error verifying StakedPSYSV3 implementation:', error.message);
        }
    }

    // Deploy the proxy contract
    console.log('\nDeploying InitializableAdminUpgradeabilityProxy...');
    const ProxyFactory = await ethers.getContractFactory('InitializableAdminUpgradeabilityProxy');
    const proxy = await ProxyFactory.deploy();
    await proxy.waitForDeployment();
    const proxyAddress = await proxy.getAddress();
    console.log('Proxy deployed to:', proxyAddress);

    // Verify Proxy contract if on Rollux network
    if (network.name === 'rollux') {
        console.log('Waiting for Blockscout to index the contracts...');
        await new Promise((resolve) => setTimeout(resolve, 10000)); // Wait for 10 seconds

        try {
            console.log('Verifying Proxy...');
            await run('verify:verify', {
                address: proxyAddress,
                constructorArguments: [],
                contract: 'contracts/InitializableAdminUpgradeabilityProxy.sol:InitializableAdminUpgradeabilityProxy',
            });
            console.log('Proxy verified');
        } catch (error: any) {
            console.error('Error verifying Proxy contract:', error.message);
        }
    }

    // Prepare initialize data
    const initializeData = stakedTokenImpl.interface.encodeFunctionData('initialize', [
        slashingAdmin,
        cooldownPauseAdmin,
        claimHelper,
        2000,         // maxSlashablePercentage (20%)
        10 * 24 * 60 * 60 // cooldownSeconds: 10 days
    ]);

    // Initialize proxy
    console.log('\nInitializing proxy...');

    await proxy['initialize(address,address,bytes)'](
        stakedTokenImplAddress,
        governance,
        initializeData
    );
    console.log('Proxy initialized');


    console.log('StakedPSYSV3 proxy contract at:', proxyAddress);
    console.log('StakedPSYSV3 implementation deployed to:', stakedTokenImplAddress);

    // Verify StakedPSYSV3 proxy contract (Note: this verifies the proxy itself)
    if (network.name === 'rollux') {
        console.log('Waiting for Blockscout to index the contracts...');
        await new Promise((resolve) => setTimeout(resolve, 10000)); // Wait for 10 seconds

        try {
            console.log('Verifying StakedPSYSV3 proxy contract...');
            await run('verify:verify', {
                address: proxyAddress,
                constructorArguments: [],
                contract: 'contracts/InitializableAdminUpgradeabilityProxy.sol:InitializableAdminUpgradeabilityProxy',
            });
            console.log('StakedPSYSV3 proxy verified');
        } catch (error: any) {
            console.error('Error verifying StakedPSYSV3 proxy contract:', error.message);
        }
    }

    console.log('\nDeployment script completed');
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
