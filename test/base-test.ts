import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import {
    StakedPSYSV3,
    IERC20,
    InitializableAdminUpgradeabilityProxy,
} from "../typechain-types";
import { HardhatEthersProvider } from "@nomicfoundation/hardhat-ethers/internal/hardhat-ethers-provider";
import { Signer } from "ethers";

export class BaseTest {
    public stakedToken: StakedPSYSV3 | undefined;
    public stakedTokenImpl: StakedPSYSV3 | undefined;
    public proxy: InitializableAdminUpgradeabilityProxy | undefined;
    public psysToken: IERC20 | undefined;
    public owner: Signer | undefined;
    public proxyAdmin: Signer | undefined;
    public emissionManager: Signer | undefined;
    public rewardsVault: Signer | undefined;
    public provider: HardhatEthersProvider | undefined;

    protected SLASHING_ADMIN = 0;
    protected COOLDOWN_ADMIN = 1;
    protected CLAIM_HELPER_ROLE = 2;
    protected ONE_YEAR = 365 * 24 * 60 * 60;
    protected EMISSION_PER_SECOND = ethers.parseEther("0.0001");

    constructor() {
        this.provider = ethers.provider;
    }

    async initialize() {
        [this.proxyAdmin, this.owner] = await ethers.getSigners();

        // Deploy mock ERC20 token
        const ERC20Factory = await ethers.getContractFactory("MockERC20");
        this.psysToken = await ERC20Factory.deploy();
        await this.psysToken.waitForDeployment();
        const psysAddress = await this.psysToken.getAddress();

        // Mint initial supply to owner
        await (this.psysToken as any).mint(
            await this.owner.getAddress(),
            ethers.parseEther("1000000000")
        );

        // Deploy implementation
        const StakedPSYSV3Factory = await ethers.getContractFactory("StakedPSYSV3");
        this.stakedTokenImpl = await StakedPSYSV3Factory.deploy(
            psysAddress,
            psysAddress,
            7 * 24 * 60 * 60,
            await this.owner.getAddress(),
            await this.owner.getAddress(),
            7 * 24 * 60 * 60
        );
        await this.stakedTokenImpl.waitForDeployment();

        // Deploy and initialize proxy
        const ProxyFactory = await ethers.getContractFactory("InitializableAdminUpgradeabilityProxy");
        this.proxy = await ProxyFactory.deploy();
        await this.proxy.waitForDeployment();

        const initializeData = this.stakedTokenImpl.interface.encodeFunctionData("initialize", [
            await this.owner.getAddress(),
            await this.owner.getAddress(),
            await this.owner.getAddress(),
            2000,
            10 * 24 * 60 * 60
        ]);

        await this.proxy.connect(this.proxyAdmin)['initialize(address,address,bytes)'](
            await this.stakedTokenImpl.getAddress(),
            await this.proxyAdmin.getAddress(),
            initializeData
        );

        // Get the proxied StakedPSYSV3 contract
        this.stakedToken = await ethers.getContractAt(
            "StakedPSYSV3",
            await this.proxy.getAddress(),
            this.owner
        );
    }

    async stake(amount: bigint, user?: Signer) {
        const staker = user || this.owner;
        const stakerAddress = await staker.getAddress();
        const ownerAddress = await this.owner.getAddress();

        // Only transfer if the staker is not the owner and hasn't received tokens yet
        if (staker !== this.owner) {
            const stakerBalance = await this.psysToken.balanceOf(stakerAddress);
            if (stakerBalance < amount) {
                // Check owner has enough balance
                const ownerBalance = await this.psysToken.balanceOf(ownerAddress);
                expect(ownerBalance).to.be.gte(amount, "Owner doesn't have enough tokens");

                // Transfer tokens from owner to staker
                await this.psysToken.connect(this.owner).transfer(stakerAddress, amount);
            }
        }

        // Get stakedToken instance connected to the staker
        const stakedTokenAsStaker = this.stakedToken.connect(staker);

        // Approve spending
        await this.psysToken.connect(staker).approve(await this.stakedToken.getAddress(), amount);

        // Stake tokens
        return await stakedTokenAsStaker.stake(stakerAddress, amount);
    }

    async redeem(amount: bigint, user?: Signer) {
        const redeemer = user || this.owner;
        const redeemerAddress = await redeemer.getAddress();

        // Get stakedToken instance connected to the redeemer
        const stakedTokenAsRedeemer = this.stakedToken.connect(redeemer);

        await stakedTokenAsRedeemer.redeem(redeemerAddress, amount);
        const balance = await this.psysToken.balanceOf(redeemerAddress);
        expect(balance).to.be.gte(amount);
    }
    async slash20Percent() {
        const receiver = ethers.Wallet.createRandom().address;
        const totalSupply = await this.stakedToken.totalSupply();
        const previewedAssets = await this.stakedToken.previewRedeem(totalSupply);
        const amountToSlash = (previewedAssets * 20n) / 100n; // 20%

        // Get slashing admin
        const slashingAdmin = await this.stakedToken.getAdmin(this.SLASHING_ADMIN);
        const adminSigner = await ethers.getSigner(slashingAdmin);

        // Perform slash
        await this.stakedToken.connect(adminSigner).slash(receiver, amountToSlash);

        return { receiver, amountToSlash };
    }

    async settleSlashing() {
        const slashingAdmin = await this.stakedToken.getAdmin(this.SLASHING_ADMIN);
        await this.stakedToken.connect(await ethers.getSigner(slashingAdmin)).settleSlashing();
    }
}