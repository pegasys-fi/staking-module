import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { BaseTest } from "./base-test";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("StakedPSYSV3 - Cooldown", function () {
    let baseTest: BaseTest;
    let user: SignerWithAddress;

    beforeEach(async function () {
        baseTest = new BaseTest();
        await baseTest.initialize();
        [, , user] = await ethers.getSigners(); // Skip admin and owner, use third signer as user
    });

    it("Should allow cooldown and redeem after period", async function () {
        const amount = ethers.parseEther("10");
        await baseTest.stake(amount, user);

        // Get stakedToken instance connected to user
        const stakedTokenAsUser = baseTest.stakedToken.connect(user);

        // Start cooldown
        await stakedTokenAsUser.cooldown();

        // Advance time past cooldown period
        const cooldownSeconds = await stakedTokenAsUser.getCooldownSeconds();
        await time.increase(Number(cooldownSeconds) + 1);

        // Redeem
        await baseTest.redeem(amount, user);
    });

    it("Should not allow redeem if cooldown period not passed", async function () {
        const amount = ethers.parseEther("10");
        await baseTest.stake(amount, user);

        const stakedTokenAsUser = baseTest.stakedToken.connect(user);
        await stakedTokenAsUser.cooldown();

        await expect(
            baseTest.redeem(amount, user)
        ).to.be.revertedWith("INSUFFICIENT_COOLDOWN");
    });

    it("Should not allow redeem after unstake window", async function () {
        const amount = ethers.parseEther("10");
        await baseTest.stake(amount, user);

        const stakedTokenAsUser = baseTest.stakedToken.connect(user);
        await stakedTokenAsUser.cooldown();

        // Advance time past cooldown + unstake window
        const cooldownSeconds = await stakedTokenAsUser.getCooldownSeconds();
        const unstakeWindow = await stakedTokenAsUser.UNSTAKE_WINDOW();
        await time.increase(Number(cooldownSeconds) + Number(unstakeWindow) + 1);

        await expect(
            baseTest.redeem(amount, user)
        ).to.be.revertedWith("UNSTAKE_WINDOW_FINISHED");
    });

    it("Should maintain cooldown amount when staking more", async function () {
        const amount = ethers.parseEther("10");
        await baseTest.stake(amount, user);

        const stakedTokenAsUser = baseTest.stakedToken.connect(user);
        await stakedTokenAsUser.cooldown();

        // Get cooldown data before additional stake
        const [cooldownBefore, amountBefore] = await stakedTokenAsUser.stakersCooldowns(
            await user.getAddress()
        );

        // Stake more
        await baseTest.stake(amount, user);

        // Check cooldown data hasn't changed
        const [cooldownAfter, amountAfter] = await stakedTokenAsUser.stakersCooldowns(
            await user.getAddress()
        );

        expect(cooldownAfter).to.equal(cooldownBefore);
        expect(amountAfter).to.equal(amountBefore);
    });

    it("Should maintain cooldown when receiving transfer while in cooldown", async function () {
        const amount = ethers.parseEther("10");
        const [, , , secondUser] = await ethers.getSigners();

        // First user stakes and starts cooldown
        await baseTest.stake(amount, user);
        const stakedTokenAsUser = baseTest.stakedToken.connect(user);
        await stakedTokenAsUser.cooldown();

        // Get initial cooldown data
        const [cooldownBefore, amountBefore] = await stakedTokenAsUser.stakersCooldowns(
            await user.getAddress()
        );

        // Second user stakes and transfers
        await baseTest.stake(amount, secondUser);
        const stakedTokenAsSecondUser = baseTest.stakedToken.connect(secondUser);
        await stakedTokenAsSecondUser.transfer(
            await user.getAddress(),
            amount
        );

        // Check cooldown data hasn't changed
        const [cooldownAfter, amountAfter] = await stakedTokenAsUser.stakersCooldowns(
            await user.getAddress()
        );

        expect(cooldownAfter).to.equal(cooldownBefore);
        expect(amountAfter).to.equal(amountBefore);
    });
});