import { expect } from "chai";
import { ethers } from "hardhat";
import { BaseTest } from "./base-test";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("StakedPSYSV3 - Slashing and Admin", function () {
    let baseTest: BaseTest;
    let user: SignerWithAddress;
    let newAdmin: SignerWithAddress;

    beforeEach(async function () {
        baseTest = new BaseTest();
        await baseTest.initialize();
        [, , user, newAdmin] = await ethers.getSigners();
    });

    it("Should properly initialize admin roles", async function () {
        const slashingAdmin = await baseTest.stakedToken.getAdmin(baseTest.SLASHING_ADMIN);
        const cooldownAdmin = await baseTest.stakedToken.getAdmin(baseTest.COOLDOWN_ADMIN);
        const claimHelper = await baseTest.stakedToken.getAdmin(baseTest.CLAIM_HELPER_ROLE);

        expect(await baseTest.stakedToken.getCooldownSeconds()).to.not.equal(0);
        expect(slashingAdmin).to.equal(await baseTest.owner.getAddress());
        expect(cooldownAdmin).to.equal(await baseTest.owner.getAddress());
        expect(claimHelper).to.equal(await baseTest.owner.getAddress());
    });

    it("Should fail when staking zero amount", async function () {
        await expect(
            baseTest.stakedToken.stake(user.address, 0)
        ).to.be.revertedWith("INVALID_ZERO_AMOUNT");
    });

    it("Should maintain 1:1 exchange rate initially", async function () {
        const exchangeRate = await baseTest.stakedToken.getExchangeRate();
        expect(exchangeRate).to.equal(ethers.parseEther("1"));
    });

    it("Should maintain 1:1 exchange rate after deposit", async function () {
        await baseTest.stake(ethers.parseEther("10"), user);
        const exchangeRate = await baseTest.stakedToken.getExchangeRate();
        expect(exchangeRate).to.equal(ethers.parseEther("1"));
    });

    it("Should adjust exchange rate after slash", async function () {
        // Initial stake
        const amount = ethers.parseEther("10");
        await baseTest.stake(amount, user);

        // Initial exchange rate should be 1:1
        let exchangeRate = await baseTest.stakedToken.getExchangeRate();
        expect(exchangeRate).to.equal(ethers.parseEther("1"));

        // Slash 20%
        await baseTest.slash20Percent();

        // After 20% slash, exchange rate should be 1.25
        // Because: 100 tokens / 80 tokens = 1.25 exchange rate
        exchangeRate = await baseTest.stakedToken.getExchangeRate();
        expect(exchangeRate).to.equal(ethers.parseEther("1.25"));
    });

    it("Should fail when non-admin tries to slash", async function () {
        const nonAdminSlasher = baseTest.stakedToken.connect(user);
        const receiver = ethers.Wallet.createRandom().address;
        const amount = ethers.parseEther("1");

        await expect(
            nonAdminSlasher.slash(receiver, amount)
        ).to.be.reverted;
    });

    it("Should fail when non-admin tries to change slash admin", async function () {
        const nonAdmin = baseTest.stakedToken.connect(user);
        await expect(
            nonAdmin.setPendingAdmin(baseTest.SLASHING_ADMIN, newAdmin.address)
        ).to.be.reverted;
    });

    it("Should allow admin to change pending admin", async function () {
        const slashingAdmin = await baseTest.stakedToken.getAdmin(baseTest.SLASHING_ADMIN);
        await baseTest.stakedToken.connect(await ethers.getSigner(slashingAdmin))
            .setPendingAdmin(baseTest.SLASHING_ADMIN, newAdmin.address);

        expect(await baseTest.stakedToken.getPendingAdmin(baseTest.SLASHING_ADMIN))
            .to.equal(newAdmin.address);
    });

    it("Should allow pending admin to claim role", async function () {
        const slashingAdmin = await baseTest.stakedToken.getAdmin(baseTest.SLASHING_ADMIN);

        // Set pending admin
        await baseTest.stakedToken.connect(await ethers.getSigner(slashingAdmin))
            .setPendingAdmin(baseTest.SLASHING_ADMIN, newAdmin.address);

        // Claim admin role
        await baseTest.stakedToken.connect(newAdmin).claimRoleAdmin(baseTest.SLASHING_ADMIN);

        expect(await baseTest.stakedToken.getAdmin(baseTest.SLASHING_ADMIN))
            .to.equal(newAdmin.address);
    });

    it("Should fail when changing max slashing percentage without admin", async function () {
        await expect(
            baseTest.stakedToken.connect(user).setMaxSlashablePercentage(1000)
        ).to.be.reverted;
    });

    it("Should fail when setting too high max slashing percentage", async function () {
        const slashingAdmin = await baseTest.stakedToken.getAdmin(baseTest.SLASHING_ADMIN);
        await expect(
            baseTest.stakedToken.connect(await ethers.getSigner(slashingAdmin))
                .setMaxSlashablePercentage(10000)
        ).to.be.reverted;
    });

    it("Should cap slashing at max percentage", async function () {
        const amount = ethers.parseEther("100");
        await baseTest.stake(amount, user);

        const slashingAdmin = await baseTest.stakedToken.getAdmin(baseTest.SLASHING_ADMIN);
        const adminSigner = await ethers.getSigner(slashingAdmin);
        const receiver = ethers.Wallet.createRandom().address;

        // Get max slashable percentage
        const maxSlashablePercentage = await baseTest.stakedToken.getMaxSlashablePercentage();

        // Calculate expected slash amount (totalAssets * maxSlashablePercentage / 10000)
        const totalSupply = await baseTest.stakedToken.totalSupply();
        const totalAssets = await baseTest.stakedToken.previewRedeem(totalSupply);
        const expectedAmount = (totalAssets * BigInt(maxSlashablePercentage)) / 10000n;

        // Perform slash with max uint256 value
        const tx = await baseTest.stakedToken.connect(adminSigner)
            .slash(receiver, ethers.MaxUint256);

        // Wait for transaction and get the emitted event to confirm slashed amount
        const receipt = await tx.wait();
        const event = receipt?.logs.find(
            log => log.topics[0] === ethers.id("Slashed(address,uint256)")
        );

        if (!event) {
            throw new Error("Slash event not found");
        }

        // Decode the event data to get the actual slashed amount
        const iface = new ethers.Interface([
            "event Slashed(address indexed caller, uint256 amount)"
        ]);
        const decodedEvent = iface.parseLog(event);
        const actualSlashedAmount = decodedEvent?.args[1];

        expect(actualSlashedAmount).to.equal(expectedAmount);

        // Additional verification: check receiver's balance
        const receiverBalance = await baseTest.psysToken.balanceOf(receiver);
        expect(receiverBalance).to.equal(expectedAmount);
    });
});