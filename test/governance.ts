import { expect } from "chai";
import { ethers } from "hardhat";
import { BaseTest } from "./base-test";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("StakedPSYSV3 - Governance", function () {
    let baseTest: BaseTest;
    let user: SignerWithAddress;
    let delegatee: SignerWithAddress;

    beforeEach(async function () {
        baseTest = new BaseTest();
        await baseTest.initialize();
        [, , user, delegatee] = await ethers.getSigners();
    });

    it("Should have no voting power without stake", async function () {
        const blockNumber = await ethers.provider.getBlockNumber();
        const stakedTokenAsUser = baseTest.stakedToken.connect(user);

        // Check voting power
        const votingPower = await stakedTokenAsUser.getPowerAtBlock(
            user.address,
            blockNumber,
            0 // 0 for voting power
        );

        expect(votingPower).to.equal(0n);
    });

    it("Should adjust voting power after slash", async function () {
        const amount = ethers.parseEther("100");
        await baseTest.stake(amount, user);

        // Delegate power to self to activate it
        const stakedTokenAsUser = baseTest.stakedToken.connect(user);
        await stakedTokenAsUser.delegateByType(user.address, 0); // 0 for voting power

        // Get initial power
        const blockNumber = await ethers.provider.getBlockNumber();
        const initialPower = await stakedTokenAsUser.getPowerAtBlock(
            user.address,
            blockNumber,
            0 // 0 for voting power
        );
        expect(initialPower).to.equal(amount);

        // Slash 10%
        const slashAmount = amount * 10n / 100n;
        const slashingAdmin = await baseTest.stakedToken.getAdmin(baseTest.SLASHING_ADMIN);
        const receiver = ethers.Wallet.createRandom().address;

        await baseTest.stakedToken.connect(await ethers.getSigner(slashingAdmin))
            .slash(receiver, slashAmount);

        // Check power after slash
        const newBlockNumber = await ethers.provider.getBlockNumber();
        const powerAfterSlash = await stakedTokenAsUser.getPowerAtBlock(
            user.address,
            newBlockNumber,
            0 // 0 for voting power
        );

        const expectedPower = amount * 90n / 100n; // 90% of original power

        // Use BigInt comparison
        expect(powerAfterSlash).to.be.approximately(expectedPower, expectedPower / 1000n); // 0.1% tolerance
    });

    it("Should maintain delegated power after slash", async function () {
        const amount = ethers.parseEther("100");
        await baseTest.stake(amount, user);

        // Delegate both powers to delegatee
        const stakedTokenAsUser = baseTest.stakedToken.connect(user);
        await stakedTokenAsUser.delegateByType(delegatee.address, 0); // voting power
        await stakedTokenAsUser.delegateByType(delegatee.address, 1); // proposition power

        // Get initial delegated power
        const blockNumber = await ethers.provider.getBlockNumber();
        const initialPower = await baseTest.stakedToken.getPowerAtBlock(
            delegatee.address,
            blockNumber,
            0 // 0 for voting power
        );
        expect(initialPower).to.equal(amount);

        // Slash 10%
        const slashAmount = amount * 10n / 100n;
        const slashingAdmin = await baseTest.stakedToken.getAdmin(baseTest.SLASHING_ADMIN);
        const receiver = ethers.Wallet.createRandom().address;

        await baseTest.stakedToken.connect(await ethers.getSigner(slashingAdmin))
            .slash(receiver, slashAmount);

        // Check delegated power after slash
        const newBlockNumber = await ethers.provider.getBlockNumber();
        const powerAfterSlash = await baseTest.stakedToken.getPowerAtBlock(
            delegatee.address,
            newBlockNumber,
            0 // 0 for voting power
        );

        const expectedPower = amount * 90n / 100n; // 90% of original power

        // Use BigInt comparison
        expect(powerAfterSlash).to.be.approximately(expectedPower, expectedPower / 1000n); // 0.1% tolerance
    });

    it("Should handle both voting and proposition power delegation", async function () {
        const amount = ethers.parseEther("100");
        await baseTest.stake(amount, user);

        const stakedTokenAsUser = baseTest.stakedToken.connect(user);

        // Delegate voting power to one address and proposition power to another
        await stakedTokenAsUser.delegateByType(delegatee.address, 0); // voting power
        await stakedTokenAsUser.delegateByType(user.address, 1); // keep proposition power

        const blockNumber = await ethers.provider.getBlockNumber();

        // Check voting power went to delegatee
        const delegateeVotingPower = await baseTest.stakedToken.getPowerAtBlock(
            delegatee.address,
            blockNumber,
            0
        );
        expect(delegateeVotingPower).to.equal(amount);

        // Check proposition power stayed with user
        const userPropositionPower = await baseTest.stakedToken.getPowerAtBlock(
            user.address,
            blockNumber,
            1
        );
        expect(userPropositionPower).to.equal(amount);
    });
});