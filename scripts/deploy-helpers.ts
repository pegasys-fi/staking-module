import { ethers, network, run } from 'hardhat';

// Configuration parameters
const PARAMS = {
    SYS_USD_PRICE_FEED: '0x93fFce52f5776ad8465669b5C52548b92ed6678F',
    PSYS_USD_PRICE_FEED: '0x93fFce52f5776ad8465669b5C52548b92ed6678F',
    PRICE_ORACLE: '0xbd7c4CA28dCCd4774c65e25529F50B75b14da459',
    STAKED_PSYS: '0xd05D3fD74a947bf6814dDdD141138Af92Cb07636',
    PSYS_TOKEN: '0x49D28d317E4d96A028FE63E5698d40BDEc20aAc5'
};

async function main() {
    // Get deployer signer
    const [deployer] = await ethers.getSigners();
    console.log('Deploying contracts with the account:', deployer.address);
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log('Account balance:', ethers.formatEther(balance));

    // Deploy StakedTokenDataProvider
    console.log('\nDeploying StakedTokenDataProvider...');
    const StakedTokenDataProviderFactory = await ethers.getContractFactory('StakedTokenDataProvider');
    const stakedTokenDataProvider = await StakedTokenDataProviderFactory.deploy(
        PARAMS.STAKED_PSYS,
        PARAMS.SYS_USD_PRICE_FEED,
        PARAMS.PSYS_USD_PRICE_FEED
    );
    await stakedTokenDataProvider.waitForDeployment();
    const stakedTokenDataProviderAddress = await stakedTokenDataProvider.getAddress();
    console.log('StakedTokenDataProvider deployed to:', stakedTokenDataProviderAddress);

    // Deploy StakeUIHelper
    console.log('\nDeploying StakeUIHelper...');
    const StakeUIHelperFactory = await ethers.getContractFactory('StakeUIHelper');
    const stakeUIHelper = await StakeUIHelperFactory.deploy(
        PARAMS.PRICE_ORACLE,
        PARAMS.PSYS_TOKEN,
        PARAMS.STAKED_PSYS
    );
    await stakeUIHelper.waitForDeployment();
    const stakeUIHelperAddress = await stakeUIHelper.getAddress();
    console.log('StakeUIHelper deployed to:', stakeUIHelperAddress);

    // Verify contracts if on Rollux network
    if (network.name === 'rollux') {
        await verifyContracts(stakedTokenDataProviderAddress, stakeUIHelperAddress);
    }

    console.log('\nDeployment Addresses:');
    console.log('StakedTokenDataProvider:', stakedTokenDataProviderAddress);
    console.log('StakeUIHelper:', stakeUIHelperAddress);
}

async function verifyContracts(dataProviderAddress: string, uiHelperAddress: string) {
    console.log('Waiting for Blockscout to index the contracts...');
    await new Promise((resolve) => setTimeout(resolve, 10000));

    try {
        console.log('Verifying StakedTokenDataProvider...');
        await run('verify:verify', {
            address: dataProviderAddress,
            constructorArguments: [
                PARAMS.STAKED_PSYS,
                PARAMS.SYS_USD_PRICE_FEED,
                PARAMS.PSYS_USD_PRICE_FEED
            ],
            contract: 'StakedTokenDataProvider',
        });
        console.log('StakedTokenDataProvider verified');

        console.log('Verifying StakeUIHelper...');
        await run('verify:verify', {
            address: uiHelperAddress,
            constructorArguments: [
                PARAMS.PRICE_ORACLE,
                PARAMS.PSYS_TOKEN,
                PARAMS.STAKED_PSYS
            ],
            contract: 'StakeUIHelper',
        });
        console.log('StakeUIHelper verified');
    } catch (error: any) {
        console.error('Error during verification:', error.message);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});