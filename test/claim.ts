import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { BaseTest } from "./base-test";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { DistributionTypes } from "../typechain-types/contracts/lib/DistributionTypes";

describe("StakedPSYSV3 - Claim Rewards", function () {
    let baseTest: BaseTest;
    let user: SignerWithAddress;
    let emissionManager: SignerWithAddress;
    let rewardsVault: SignerWithAddress;
    const ONE_DAY = 24 * 60 * 60;
    const EMISSION_PER_SECOND = ethers.parseEther("0.0001"); // 0.0001 tokens per second

    beforeEach(async function () {
        [, emissionManager, user, rewardsVault] = await ethers.getSigners();

        // Create new BaseTest instance
        baseTest = new BaseTest();

        // Modify BaseTest's initialize to use our rewardsVault
        baseTest.initialize.bind(baseTest);
        baseTest.initialize = async function () {
            const [proxyAdmin, owner] = await ethers.getSigners();
            this.proxyAdmin = proxyAdmin;
            this.owner = owner;

            // Deploy mock ERC20 token
            const ERC20Factory = await ethers.getContractFactory("MockERC20");
            this.psysToken = await ERC20Factory.deploy();
            await this.psysToken.waitForDeployment();
            const psysAddress = await this.psysToken.getAddress();

            // Mint initial supply to owner
            await (this.psysToken as any).mint(
                await owner.getAddress(),
                ethers.parseEther("1000000000")
            );

            // Transfer reward tokens to the rewards vault
            await this.psysToken.connect(owner).transfer(
                rewardsVault.address,
                ethers.parseEther("1000000")
            );

            // Deploy implementation with rewardsVault address
            const StakedPSYSV3Factory = await ethers.getContractFactory("StakedPSYSV3");
            this.stakedTokenImpl = await StakedPSYSV3Factory.deploy(
                psysAddress,
                psysAddress,
                7 * 24 * 60 * 60,
                rewardsVault.address,  // Use our rewardsVault address
                emissionManager.address, // Use our emission manager
                7 * 24 * 60 * 60
            );
            await this.stakedTokenImpl.waitForDeployment();

            // Deploy and initialize proxy
            const ProxyFactory = await ethers.getContractFactory("InitializableAdminUpgradeabilityProxy");
            this.proxy = await ProxyFactory.deploy();
            await this.proxy.waitForDeployment();

            const initializeData = this.stakedTokenImpl.interface.encodeFunctionData("initialize", [
                await owner.getAddress(),
                await owner.getAddress(),
                await owner.getAddress(),
                2000,
                10 * 24 * 60 * 60
            ]);

            await this.proxy.connect(proxyAdmin)['initialize(address,address,bytes)'](
                await this.stakedTokenImpl.getAddress(),
                await proxyAdmin.getAddress(),
                initializeData
            );

            // Get the proxied StakedPSYSV3 contract
            this.stakedToken = await ethers.getContractAt(
                "StakedPSYSV3",
                await this.proxy.getAddress(),
                owner
            );
        };

        // Initialize with modified setup
        await baseTest.initialize();

        // Approve rewards vault to spend tokens
        await baseTest.psysToken
            .connect(rewardsVault)
            .approve(await baseTest.stakedToken.getAddress(), ethers.MaxUint256);

        // Configure rewards distribution
        const stakedTokenAddress = await baseTest.stakedToken.getAddress();
        const assetConfig: DistributionTypes.AssetConfigInput = {
            emissionPerSecond: EMISSION_PER_SECOND,
            totalStaked: 0n,
            underlyingAsset: stakedTokenAddress
        };

        // Set up rewards distribution
        await baseTest.stakedToken
            .connect(emissionManager)
            .configureAssets([assetConfig]);
    });

    it("Should have zero rewards initially after stake", async function () {
        const amount = ethers.parseEther("10");
        await baseTest.stake(amount, user);

        const rewards = await baseTest.stakedToken.getTotalRewardsBalance(user.address);
        expect(rewards).to.equal(0);
    });

    it("Should allow claiming half of rewards", async function () {
        const amount = ethers.parseEther("10");
        await baseTest.stake(amount, user);

        // Move 100 days forward
        await time.increase(100 * ONE_DAY);

        const stakedTokenAsUser = baseTest.stakedToken.connect(user);
        const balanceToClaim = await stakedTokenAsUser.getTotalRewardsBalance(user.address);
        expect(balanceToClaim).to.be.gt(0);

        const halfClaim = balanceToClaim / 2n;
        const initialBalance = await baseTest.psysToken.balanceOf(user.address);

        await stakedTokenAsUser.claimRewards(user.address, halfClaim);

        const rewardBalance = await baseTest.psysToken.balanceOf(user.address);
        expect(rewardBalance - initialBalance).to.equal(halfClaim);

        const remainingRewards = await stakedTokenAsUser.getTotalRewardsBalance(user.address);
        expect(remainingRewards).to.be.closeTo(balanceToClaim - halfClaim, 1000n); // Allow small rounding difference
    });

    it("Should handle claiming more than available rewards", async function () {
        const amount = ethers.parseEther("10");
        await baseTest.stake(amount, user);

        await time.increase(100 * ONE_DAY);

        const stakedTokenAsUser = baseTest.stakedToken.connect(user);
        const balanceToClaim = await stakedTokenAsUser.getTotalRewardsBalance(user.address);
        expect(balanceToClaim).to.be.gt(0);

        const initialBalance = await baseTest.psysToken.balanceOf(user.address);

        await stakedTokenAsUser.claimRewards(user.address, balanceToClaim * 2n);

        const rewardBalance = await baseTest.psysToken.balanceOf(user.address);
        expect(rewardBalance - initialBalance).to.equal(balanceToClaim);

        const remainingRewards = await stakedTokenAsUser.getTotalRewardsBalance(user.address);
        expect(remainingRewards).to.be.closeTo(0n, 1000n); // Allow small rounding difference
    });

    it("Should allow claiming all rewards", async function () {
        const amount = ethers.parseEther("10");
        await baseTest.stake(amount, user);

        await time.increase(100 * ONE_DAY);

        const stakedTokenAsUser = baseTest.stakedToken.connect(user);
        const balanceToClaim = await stakedTokenAsUser.getTotalRewardsBalance(user.address);
        expect(balanceToClaim).to.be.gt(0);

        const initialBalance = await baseTest.psysToken.balanceOf(user.address);

        await stakedTokenAsUser.claimRewards(user.address, balanceToClaim);

        const rewardBalance = await baseTest.psysToken.balanceOf(user.address);
        expect(rewardBalance - initialBalance).to.equal(balanceToClaim);

        const remainingRewards = await stakedTokenAsUser.getTotalRewardsBalance(user.address);
        expect(remainingRewards).to.be.closeTo(0n, 1000n); // Allow small rounding difference
    });

    it("Should allow claiming rewards and stake", async function () {
        const amount = ethers.parseEther("10");
        await baseTest.stake(amount, user);

        await time.increase(100 * ONE_DAY);

        const stakedTokenAsUser = baseTest.stakedToken.connect(user);
        const balanceBefore = await stakedTokenAsUser.balanceOf(user.address);
        const balanceToClaim = await stakedTokenAsUser.getTotalRewardsBalance(user.address);
        expect(balanceToClaim).to.be.gt(0);

        await stakedTokenAsUser.claimRewardsAndStake(user.address, balanceToClaim);

        const balanceAfter = await stakedTokenAsUser.balanceOf(user.address);
        expect(balanceAfter).to.be.closeTo(balanceBefore + balanceToClaim, 1000n); // Allow small rounding difference
    });
});