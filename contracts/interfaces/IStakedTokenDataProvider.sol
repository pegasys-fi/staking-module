// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IStakedTokenDataProvider {
    struct StakedTokenData {
        uint256 stakedTokenTotalSupply;
        uint256 stakedTokenTotalRedeemableAmount;
        uint256 stakeCooldownSeconds;
        uint256 stakeUnstakeWindow;
        uint256 stakedTokenPriceEth;
        uint256 rewardTokenPriceEth;
        uint256 distributionPerSecond;
        uint256 distributionEnd;
        uint256 stakeApy;
        uint256 currentExchangeRate;
        uint256 maxSlashablePercentage;
    }

    struct StakedTokenUserData {
        uint256 stakedTokenUserBalance;
        uint256 underlyingTokenUserBalance;
        uint256 stakedTokenRedeemableAmount;
        uint256 rewardsToClaim;
        uint40 cooldownTimestamp;
        uint216 cooldownAmount;
    }

    function ETH_USD_PRICE_FEED() external view returns (address);
    function PSYS_USD_PRICE_FEED() external view returns (address);
    function STAKED_PSYS() external view returns (address);

    function getAllStakedTokenData() external view returns (
        StakedTokenData memory stkPSYSData,
        StakedTokenData memory stkBptData,
        uint256 ethPrice
    );

    function getAllStakedTokenUserData(address user) external view returns (
        StakedTokenData memory stkPSYSData,
        StakedTokenUserData memory stkPSYSUserData,
        StakedTokenData memory stkBptData,
        StakedTokenUserData memory stkBptUserData,
        uint256 ethPrice
    );

    function getstkPSYSUserData(address user) external view returns (
        StakedTokenData memory stkPSYSData,
        StakedTokenUserData memory stkPSYSUserData
    );
}