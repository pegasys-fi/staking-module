import { ethers, network, run } from 'hardhat';

// Configuration parameters
const PARAMS = {
    PSYS_TOKEN_ADDRESS: '0x49D28d317E4d96A028FE63E5698d40BDEc20aAc5',
    REWARDS_VAULT_ADDRESS: '0x12F25DD17BC421E80f8372b54c0b1191283Fa293',
    EMISSION_MANAGER_ADDRESS: '0xA00d42c468B0c6fF1Bb994dc28c61f7Fb1cCb154',
    UNSTAKE_WINDOW: 7 * 24 * 60 * 60,       // 7 days
    DISTRIBUTION_DURATION: 90 * 24 * 60 * 60 // 90 days
};

async function main() {
    // Get deployer signer
    const [deployer] = await ethers.getSigners();
    console.log('Deploying contracts with the account:', deployer.address);
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log('Account balance:', ethers.formatEther(balance));

    // Deploy StakedPSYSV3 implementation
    console.log('\nDeploying StakedPSYSV3 implementation...');
    const StakedPSYSV3Factory = await ethers.getContractFactory('contracts/StakedPSYSV3.sol:StakedPSYSV3');
    const stakedTokenImpl = await StakedPSYSV3Factory.deploy(
        PARAMS.PSYS_TOKEN_ADDRESS,
        PARAMS.PSYS_TOKEN_ADDRESS,
        PARAMS.UNSTAKE_WINDOW,
        PARAMS.REWARDS_VAULT_ADDRESS,
        PARAMS.EMISSION_MANAGER_ADDRESS,
        PARAMS.DISTRIBUTION_DURATION
    );
    await stakedTokenImpl.waitForDeployment();
    const stakedTokenImplAddress = await stakedTokenImpl.getAddress();
    console.log('StakedPSYSV3 implementation deployed to:', stakedTokenImplAddress);

    // Deploy the proxy contract
    console.log('\nDeploying InitializableAdminUpgradeabilityProxy...');
    const ProxyFactory = await ethers.getContractFactory('contracts/lib/InitializableAdminUpgradeabilityProxy.sol:InitializableAdminUpgradeabilityProxy');
    const proxy = await ProxyFactory.deploy();
    await proxy.waitForDeployment();
    const proxyAddress = await proxy.getAddress();
    console.log('Proxy deployed to:', proxyAddress);

    // Verify contracts if on Rollux network
    if (network.name === 'rollux') {
        await verifyContracts(stakedTokenImplAddress, proxyAddress);
    }

    console.log('\nDeployment Addresses:');
    console.log('StakedPSYSV3 Implementation:', stakedTokenImplAddress);
    console.log('Proxy:', proxyAddress);
}

async function verifyContracts(implAddress: string, proxyAddress: string) {
    console.log('Waiting for Blockscout to index the contracts...');
    await new Promise((resolve) => setTimeout(resolve, 10000));

    try {
        console.log('Verifying StakedPSYSV3 implementation...');
        await run('verify:verify', {
            address: implAddress,
            constructorArguments: [
                PARAMS.PSYS_TOKEN_ADDRESS,
                PARAMS.PSYS_TOKEN_ADDRESS,
                PARAMS.UNSTAKE_WINDOW,
                PARAMS.REWARDS_VAULT_ADDRESS,
                PARAMS.EMISSION_MANAGER_ADDRESS,
                PARAMS.DISTRIBUTION_DURATION
            ],
            contract: 'contracts/StakedPSYSV3.sol:StakedPSYSV3',
        });
        console.log('StakedPSYSV3 implementation verified');

        console.log('Verifying Proxy...');
        await run('verify:verify', {
            address: proxyAddress,
            constructorArguments: [],
            contract: 'contracts/InitializableAdminUpgradeabilityProxy.sol:InitializableAdminUpgradeabilityProxy',
        });
        console.log('Proxy verified');
    } catch (error: any) {
        console.error('Error during verification:', error.message);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
