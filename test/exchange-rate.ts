import { expect } from "chai";
import { ethers } from "hardhat";
import { BaseTest } from "./base-test";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("StakedPSYSV3 - Exchange Rate", function () {
    let baseTest: BaseTest;
    let user: SignerWithAddress;

    beforeEach(async function () {
        baseTest = new BaseTest();
        await baseTest.initialize();
        [, , user] = await ethers.getSigners();
    });

    async function simulateReturnFunds(amount: bigint, shares: bigint) {
        // Initial stake
        await baseTest.stake(shares, user);

        // Approve spending from owner to stakedTokenAddress
        await baseTest.psysToken
            .connect(baseTest.owner)
            .approve(await baseTest.stakedToken.getAddress(), amount);

        // Return funds with owner (who is slashing admin)
        await baseTest.stakedToken.connect(baseTest.owner).returnFunds(amount);

        const redeemAmount = await baseTest.stakedToken.previewRedeem(shares);
        expect(redeemAmount).to.be.lte(shares + amount);

        // Check precision
        const tolerance = (shares + amount) / 1000000000n; // 1 gwei precision
        expect(redeemAmount).to.be.closeTo(shares + amount, Number(tolerance));
    }


    it("Should handle first depositor edge case", async function () {
        // Use larger amounts to avoid minimum amount issues
        const initialAmount = ethers.parseEther("10");
        const refundAmount = ethers.parseEther("501");
        await simulateReturnFunds(refundAmount, initialAmount);
    });

    it("Should handle slashing with precision", async function () {
        const shares = ethers.parseEther("100");
        await baseTest.stake(shares, user);

        // Slash 20%
        await baseTest.slash20Percent();

        const redeemAmount = await baseTest.stakedToken.previewRedeem(shares);
        const expectedAmount = shares * 80n / 100n; // 80% of original
        const tolerance = expectedAmount / 1000000000n; // 1 gwei precision

        expect(redeemAmount).to.be.lte(expectedAmount);
        expect(redeemAmount).to.be.closeTo(expectedAmount, Number(tolerance));
    });

    // Test various scenarios with larger amounts to avoid minimum amount issues
    const testCases = [
        { shares: ethers.parseEther("10"), returnAmount: ethers.parseEther("1") },
        { shares: ethers.parseEther("100"), returnAmount: ethers.parseEther("10") },
        { shares: ethers.parseEther("1000"), returnAmount: ethers.parseEther("100") },
    ];

    testCases.forEach(({ shares, returnAmount }) => {
        it(`Should maintain precision for ${ethers.formatEther(shares)} shares with ${ethers.formatEther(returnAmount)} return`, async function () {
            await simulateReturnFunds(returnAmount, shares);
        });
    });

    // Additional test for minimum amount validation
    it("Should revert when returning amount below minimum", async function () {
        const shares = ethers.parseEther("1");
        const tooSmallAmount = ethers.parseEther("0.0001");

        await baseTest.stake(shares, user);

        const stakedTokenAddress = await baseTest.stakedToken.getAddress();
        await baseTest.psysToken.mint(user.address, tooSmallAmount);
        await baseTest.psysToken.connect(user).approve(stakedTokenAddress, tooSmallAmount);
        await baseTest.psysToken.connect(user).transfer(stakedTokenAddress, tooSmallAmount);

        await expect(
            baseTest.stakedToken.connect(baseTest.owner).returnFunds(tooSmallAmount)
        ).to.be.revertedWith("AMOUNT_LT_MINIMUM");
    });

    it("Should allow returning minimum valid amount", async function () {
        // Minimum amount that should work - adjust if needed based on contract requirements
        const minValidAmount = ethers.parseEther("1");
        const shares = ethers.parseEther("10");
        await simulateReturnFunds(minValidAmount, shares);
    });
});