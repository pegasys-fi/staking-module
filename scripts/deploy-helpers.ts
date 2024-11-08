import { ethers, network, run } from 'hardhat';

// Configuration parameters
const PARAMS = {
    SYS_USD_PRICE_FEED: '0x37C0ca6562B45Dbfa54c46595C3bd654C2Ee35DE',
    PSYS_USD_PRICE_FEED: '0x37C0ca6562B45Dbfa54c46595C3bd654C2Ee35DE',
    PRICE_ORACLE: '0xF8518f4D4b8B5B28903Cf6929E43C5eCb3aC3082',
    STAKED_PSYS: '0xDaB687e5A425a9212bcA6b1153C39bfd0C7E87A3',
    PSYS_TOKEN: '0xd7e763C68d117d206fabA8df2383910c614cB93B'
};

async function main() {
    // Get deployer signer
    const [deployer] = await ethers.getSigners();
    console.log('Deploying contracts with the account:', deployer.address);
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log('Account balance:', ethers.formatEther(balance));

    // Deploy StakedTokenDataProvider
    console.log('\nDeploying StakedTokenDataProvider...');
    const StakedTokenDataProviderFactory = await ethers.getContractFactory('contracts/misc/StakedTokenDataProvider.sol:StakedTokenDataProvider');
    const stakedTokenDataProvider = await StakedTokenDataProviderFactory.deploy(
        PARAMS.STAKED_PSYS,
        PARAMS.SYS_USD_PRICE_FEED,
        PARAMS.PSYS_USD_PRICE_FEED
    );
    await stakedTokenDataProvider.waitForDeployment();
    const stakedTokenDataProviderAddress = await stakedTokenDataProvider.getAddress();
    console.log('StakedTokenDataProvider deployed to:', stakedTokenDataProviderAddress);

    // // Deploy StakeUIHelper
    // console.log('\nDeploying StakeUIHelper...');
    // const StakeUIHelperFactory = await ethers.getContractFactory('contracts/misc/StakeUIHelper.sol:StakeUIHelper');
    // const stakeUIHelper = await StakeUIHelperFactory.deploy(
    //     PARAMS.PRICE_ORACLE,
    //     PARAMS.PSYS_TOKEN,
    //     PARAMS.STAKED_PSYS
    // );
    // await stakeUIHelper.waitForDeployment();
    // const stakeUIHelperAddress = await stakeUIHelper.getAddress();
    // console.log('StakeUIHelper deployed to:', stakeUIHelperAddress);

    // Verify contracts if on Rollux network
    if (network.name === 'rollux') {
        // await verifyContracts(stakedTokenDataProviderAddress, stakeUIHelperAddress);
        await verifyContracts(stakedTokenDataProviderAddress);
    }

    console.log('\nDeployment Addresses:');
    console.log('StakedTokenDataProvider:', stakedTokenDataProviderAddress);
    // console.log('StakeUIHelper:', stakeUIHelperAddress);
}

async function verifyContracts(dataProviderAddress: string) {
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
            contract: 'contracts/misc/StakedTokenDataProvider.sol:StakedTokenDataProvider',
        });
        console.log('StakedTokenDataProvider verified');

        // console.log('Verifying StakeUIHelper...');
        // await run('verify:verify', {
        //     address: uiHelperAddress,
        //     constructorArguments: [
        //         PARAMS.PRICE_ORACLE,
        //         PARAMS.PSYS_TOKEN,
        //         PARAMS.STAKED_PSYS
        //     ],
        //     contract: 'contracts/misc/StakeUIHelper.sol:StakeUIHelper',
        // });
        // console.log('StakeUIHelper verified');
    } catch (error: any) {
        console.error('Error during verification:', error.message);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});