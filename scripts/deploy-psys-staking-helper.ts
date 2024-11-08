import { ethers, network, run } from 'hardhat';

// Configuration parameters - replace with actual addresses for your deployment
const PARAMS = {
    STAKE_ADDRESS: '0xDaB687e5A425a9212bcA6b1153C39bfd0C7E87A3', // Replace with actual staked PSYS contract address
    PSYS_TOKEN: '0xd7e763C68d117d206fabA8df2383910c614cB93B'         // Replace with actual PSYS token address
};

async function main() {
    // Get deployer signer
    const [deployer] = await ethers.getSigners();
    console.log('Deploying contracts with the account:', deployer.address);
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log('Account balance:', ethers.formatEther(balance));

    // Deploy PegasysStakingHelper
    console.log('\nDeploying PegasysStakingHelper...');
    const PegasysStakingHelperFactory = await ethers.getContractFactory('PegasysStakingHelper');
    const pegasysStakingHelper = await PegasysStakingHelperFactory.deploy(
        PARAMS.STAKE_ADDRESS,
        PARAMS.PSYS_TOKEN
    );
    await pegasysStakingHelper.waitForDeployment();
    const pegasysStakingHelperAddress = await pegasysStakingHelper.getAddress();
    console.log('PegasysStakingHelperAddress deployed to:', pegasysStakingHelperAddress);

    // Verify contract if on a network that supports verification
    if (network.name === 'mainnet' || network.name === 'goerli' || network.name === 'sepolia') {
        await verifyContract(pegasysStakingHelperAddress);
    }

    console.log('\nDeployment Addresses:');
    console.log('PegasysStakingHelper:', pegasysStakingHelperAddress);

    // Additional deployment information
    console.log('\nDeployment Parameters:');
    console.log('STAKE_ADDRESS:', PARAMS.STAKE_ADDRESS);
    console.log('AAVE_TOKEN:', PARAMS.PSYS_TOKEN);
}

async function verifyContract(contractAddress: string) {
    console.log('\nWaiting for contract to be indexed...');
    // Wait for etherscan to index the contract
    await new Promise((resolve) => setTimeout(resolve, 60000));

    try {
        console.log('Verifying PegasysStakingHelper...');
        await run('verify:verify', {
            address: contractAddress,
            constructorArguments: [
                PARAMS.STAKE_ADDRESS,
                PARAMS.PSYS_TOKEN
            ],
            contract: 'contracts/PegasysStakingHelper.sol:PegasysStakingHelper'
        });
        console.log('PegasysStakingHelper verified successfully');
    } catch (error: any) {
        if (error.message.includes('Already Verified')) {
            console.log('Contract is already verified');
        } else {
            console.error('Error during verification:', error);
        }
    }
}

// Error handling wrapper
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('Error during deployment:', error);
        process.exit(1);
    });