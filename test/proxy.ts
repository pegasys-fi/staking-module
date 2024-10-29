import { expect } from "chai";
import { ethers } from "hardhat";
import { BaseTest } from "./base-test";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("StakedPSYSV3 - Proxy", function () {
    let baseTest: BaseTest;
    let admin: SignerWithAddress;
    let nonAdmin: SignerWithAddress;
    let user: SignerWithAddress;

    beforeEach(async function () {
        [admin, nonAdmin, user] = await ethers.getSigners();
        baseTest = new BaseTest();
        await baseTest.initialize();
    });

    describe("Proxy Setup", function () {
        it("Should have correct implementation", async function () {
            const proxy = baseTest.proxy;
            const implStorageSlot = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
            const implAddress = await ethers.provider.getStorage(
                await proxy.getAddress(),
                implStorageSlot
            );
            expect(ethers.getAddress("0x" + implAddress.slice(-40))).to.equal(
                await baseTest.stakedTokenImpl.getAddress()
            );
        });

        it("Should have correct admin", async function () {
            const proxy = baseTest.proxy;
            const adminStorageSlot = "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103";
            const adminAddress = await ethers.provider.getStorage(
                await proxy.getAddress(),
                adminStorageSlot
            );
            expect(ethers.getAddress("0x" + adminAddress.slice(-40))).to.equal(
                await baseTest.proxyAdmin.getAddress()
            );
        });

        it("Should maintain state after upgrade", async function () {
            const amount = ethers.parseEther("10");
            const userAddress = await user.getAddress();

            // First stake some tokens using user
            await baseTest.stake(amount, user);

            // Get staked token contract through proxy address
            const stakedTokenAsUser = baseTest.stakedToken.connect(user);
            const balanceBefore = await stakedTokenAsUser.balanceOf(userAddress);

            // Deploy new implementation
            const StakedPSYSV3Factory = await ethers.getContractFactory("StakedPSYSV3");
            const newImpl = await StakedPSYSV3Factory.deploy(
                await baseTest.psysToken.getAddress(),
                await baseTest.psysToken.getAddress(),
                7 * 24 * 60 * 60,
                await admin.getAddress(),
                await admin.getAddress(),
                7 * 24 * 60 * 60
            );
            await newImpl.waitForDeployment();

            // Upgrade using proxyAdmin
            await baseTest.proxy.connect(baseTest.proxyAdmin)["upgradeTo(address)"](await newImpl.getAddress());

            // Check if state is maintained
            const balanceAfter = await stakedTokenAsUser.balanceOf(userAddress);
            expect(balanceAfter).to.equal(balanceBefore);
        });

        it("Should not allow non-admin to upgrade", async function () {
            const newImplAddress = ethers.Wallet.createRandom().address;

            // Try to upgrade with non-admin
            await expect(
                baseTest.proxy.connect(nonAdmin)["upgradeTo(address)"](newImplAddress)
            ).to.be.revertedWithoutReason();
        });

        it("Should not allow initialization after deployment", async function () {
            await expect(
                baseTest.proxy["initialize(address,address,bytes)"](
                    await baseTest.stakedTokenImpl.getAddress(),
                    await admin.getAddress(),
                    "0x"
                )
            ).to.be.revertedWithoutReason();
        });
    });

    describe("Proxy Functionality", function () {
        it("Should properly delegate calls", async function () {
            const amount = ethers.parseEther("10");
            const userAddress = await user.getAddress();

            // Stake tokens using the user
            await baseTest.stake(amount, user);

            // Verify balance through proxied contract
            const stakedTokenAsUser = baseTest.stakedToken.connect(user);
            expect(await stakedTokenAsUser.balanceOf(userAddress)).to.equal(amount);
        });

        it("Should not allow direct calls to implementation", async function () {
            const amount = ethers.parseEther("10");
            await expect(
                baseTest.stakedTokenImpl.stake(await admin.getAddress(), amount)
            ).to.be.reverted;
        });
    });
});