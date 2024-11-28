import { Wallet, Provider } from "zksync-ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import { Contract } from "zksync-ethers";
import { Interface } from "ethers";

// Configuration parameters
const PARAMS = {
    GOVERNANCE: '0x5B024AfAaaed10bA2788fdDCd7b72Af60A854D2F',
    SLASHING_ADMIN: '0x5B024AfAaaed10bA2788fdDCd7b72Af60A854D2F',
    COOLDOWN_PAUSE_ADMIN: '0x5B024AfAaaed10bA2788fdDCd7b72Af60A854D2F',
    CLAIM_HELPER: '0x5B024AfAaaed10bA2788fdDCd7b72Af60A854D2F',
    MAX_SLASHABLE_PERCENTAGE: 2000,         // 20%
    COOLDOWN_SECONDS: 500                   // 10 * 24 * 60 * 60     // 10 days
};

// Add your deployment addresses here
const DEPLOYMENT_ADDRESSES = {
    IMPLEMENTATION: '0xa031B04811e94e9C888825650d373bA34a36dd26', // Add implementation address
    PROXY: '0xAdE3E5a2f4A6bA1cA176bEEc56eF36C3208CB7e8'          // Add proxy address
};

async function main(hre: HardhatRuntimeEnvironment) {
    console.log("Starting initialization process...");

    // Initialize the provider
    const provider = new Provider('https://sepolia.era.zksync.dev');

    // Initialize deployer with provider
    const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
    const wallet = new Wallet(PRIVATE_KEY, provider);
    const deployer = new Deployer(hre, wallet);

    if (!DEPLOYMENT_ADDRESSES.IMPLEMENTATION || !DEPLOYMENT_ADDRESSES.PROXY) {
        throw new Error('Please set the IMPLEMENTATION and PROXY addresses in the script');
    }

    try {
        // Load contract artifacts
        const StakedPSYSV3 = await deployer.loadArtifact("StakedPSYSV3");
        const Proxy = await deployer.loadArtifact("InitializableAdminUpgradeabilityProxy");

        // Create contract instances with connected wallet
        const proxyContract = new Contract(
            DEPLOYMENT_ADDRESSES.PROXY,
            Proxy.abi,
            wallet.connect(provider)
        );

        // Create initialization data using the artifact ABI
        console.log('\nPreparing initialization data...');
        const initializeInterface = new Interface(StakedPSYSV3.abi);
        const initializeData = initializeInterface.encodeFunctionData('initialize', [
            PARAMS.SLASHING_ADMIN,
            PARAMS.COOLDOWN_PAUSE_ADMIN,
            PARAMS.CLAIM_HELPER,
            PARAMS.MAX_SLASHABLE_PERCENTAGE,
            PARAMS.COOLDOWN_SECONDS
        ]);

        // Initialize proxy with explicit gas limit
        console.log('Initializing proxy...');
        const tx = await proxyContract['initialize(address,address,bytes)'](
            DEPLOYMENT_ADDRESSES.IMPLEMENTATION,
            PARAMS.GOVERNANCE,
            initializeData,
            {
                gasLimit: 1000000,
                customData: {
                    gasPerPubdata: 800
                }
            }
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

export default main;