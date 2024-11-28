import { Wallet, utils } from "zksync-ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import { ethers } from "ethers";

const PARAMS = {
    UNSTAKE_WINDOW: 60 * 60,       // 1 hour
    DISTRIBUTION_DURATION: 0        // 90 * 24 * 60 * 60 // 90 days
};

async function main(hre: HardhatRuntimeEnvironment) {
    console.log("Starting deployment process...");

    // Initialize deployer
    const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
    const wallet = new Wallet(PRIVATE_KEY);
    const deployer = new Deployer(hre, wallet);

    // Deploy MockERC20
    console.log("Deploying MockERC20...");
    const mockERC20Artifact = await deployer.loadArtifact("MockERC20");
    const mockERC20 = await deployer.deploy(mockERC20Artifact);
    console.log(`MockERC20 deployed to: ${await mockERC20.getAddress()}`);
    const mockERC20Address = await mockERC20.getAddress();


    // Deploy StakedPSYSV3 implementation
    console.log("Deploying StakedPSYSV3 implementation...");
    const stakedPSYSV3Artifact = await deployer.loadArtifact("StakedPSYSV3");
    const stakedTokenImpl = await deployer.deploy(stakedPSYSV3Artifact, [
        mockERC20Address,
        mockERC20Address,
        PARAMS.UNSTAKE_WINDOW,
        wallet.address, // Using deployer as rewards vault for testing
        wallet.address,   // Using deployer as emission manager
        PARAMS.DISTRIBUTION_DURATION
    ]);
    const stakedTokenImplAddress = await stakedTokenImpl.getAddress();
    console.log(`StakedPSYSV3 implementation deployed to: ${stakedTokenImplAddress}`);

    // Deploy Proxy
    console.log("Deploying Proxy...");
    const proxyArtifact = await deployer.loadArtifact("InitializableAdminUpgradeabilityProxy");
    const proxy = await deployer.deploy(proxyArtifact, []);
    const proxyAddress = await proxy.getAddress();
    console.log(`Proxy deployed to: ${proxyAddress}`);


    // // Add verification delay to ensure contracts are indexed
    // console.log("Waiting for contract propagation...");
    // await new Promise(resolve => setTimeout(resolve, 10000)); // 10 seconds delay

    // // Verify StakedPSYSV3
    // console.log("Verifying StakedPSYSV3...");
    // await hre.run("verify:verify", {
    //     address: stakedTokenImplAddress,
    //     contract: "contracts/StakedPSYSV3.sol:StakedPSYSV3",
    //     constructorArguments: [
    //         mockERC20Address,
    //         mockERC20Address,
    //         PARAMS.UNSTAKE_WINDOW,
    //         wallet.address,
    //         wallet.address,
    //         PARAMS.DISTRIBUTION_DURATION
    //     ],
    // });

    // // Verify MockERC20
    // console.log("Verifying MockERC20...");
    // await hre.run("verify:verify", {
    //     address: mockERC20Address,
    //     contract: "contracts/mocks/MockERC20.sol:MockERC20",
    //     constructorArguments: [],
    // });

    // // Verify Proxy
    // console.log("Verifying Proxy...");
    // await hre.run("verify:verify", {
    //     address: proxyAddress,
    //     contract: "contracts/lib/InitializableAdminUpgradeabilityProxy.sol:InitializableAdminUpgradeabilityProxy",
    //     constructorArguments: [],
    // });


    console.log("\nDeployment Addresses:");
    console.log("MockERC20:", mockERC20Address);
    console.log("StakedPSYSV3 Implementation:", stakedTokenImplAddress);
    console.log("Proxy:", proxyAddress);
}

export default main;