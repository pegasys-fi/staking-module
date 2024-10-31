// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {IERC20} from '../interfaces/IERC20.sol';
import {AggregatedStakedPSYSV3} from '../interfaces/AggregatedStakedPSYSV3.sol';
import {AggregatorInterface} from '../interfaces/AggregatorInterface.sol';
import {IStakedTokenDataProvider} from '../interfaces/IStakedTokenDataProvider.sol';

/**
 * @title StakedTokenDataProvider
 * @notice Data provider contract for Staked PSYS tokens of the Safety Module
 * @author BGD Labs, modified by Pegasys
 */
contract StakedTokenDataProvider is IStakedTokenDataProvider {
    address public immutable override ETH_USD_PRICE_FEED;
    address public immutable override PSYS_USD_PRICE_FEED;
    address public immutable override STAKED_PSYS;

    uint256 private constant SECONDS_PER_YEAR = 365 days;
    uint256 private constant APY_PRECISION = 10000;

    constructor(
        address stkPsys,
        address ethUsdPriceFeed,
        address psysUsdPriceFeed
    ) {
        STAKED_PSYS = stkPsys;
        ETH_USD_PRICE_FEED = ethUsdPriceFeed;
        PSYS_USD_PRICE_FEED = psysUsdPriceFeed;
    }

    /// @inheritdoc IStakedTokenDataProvider
    function getAllStakedTokenData()
        external
        view
        override
        returns (
            StakedTokenData memory stkPSYSData,
            StakedTokenData memory,  // Maintaining return structure for compatibility
            uint256 ethPrice
        )
    {
        stkPSYSData = _getStakedTokenData(STAKED_PSYS, ETH_USD_PRICE_FEED);
        ethPrice = uint256(AggregatorInterface(ETH_USD_PRICE_FEED).latestAnswer());
    }

    /// @inheritdoc IStakedTokenDataProvider
    function getAllStakedTokenUserData(
        address user
    )
        external
        view
        override
        returns (
            StakedTokenData memory stkPSYSData,
            StakedTokenUserData memory stkPSYSUserData,
            StakedTokenData memory,  // Empty for compatibility
            StakedTokenUserData memory,  // Empty for compatibility
            uint256 ethPrice
        )
    {
        stkPSYSData = _getStakedTokenData(STAKED_PSYS, ETH_USD_PRICE_FEED);
        stkPSYSUserData = _getStakedTokenUserData(STAKED_PSYS, user);
        ethPrice = uint256(AggregatorInterface(ETH_USD_PRICE_FEED).latestAnswer());
    }

    function getStakedAssetData(
        address stakedAsset,
        address oracle
    ) external view returns (StakedTokenData memory) {
        return _getStakedTokenData(stakedAsset, oracle);
    }

    function getStakedUserData(
        address stakedAsset,
        address oracle,
        address user
    ) external view returns (StakedTokenData memory, StakedTokenUserData memory) {
        return (_getStakedTokenData(stakedAsset, oracle), _getStakedTokenUserData(stakedAsset, user));
    }

    function getStakedAssetDataBatch(
        address[] calldata stakedAssets,
        address[] calldata oracles
    ) external view returns (StakedTokenData[] memory, uint256) {
        require(stakedAssets.length == oracles.length, 'Arrays must be of the same length');

        StakedTokenData[] memory stakedData = new StakedTokenData[](stakedAssets.length);
        uint256 ethPrice = uint256(AggregatorInterface(ETH_USD_PRICE_FEED).latestAnswer());
        for (uint256 i = 0; i < stakedAssets.length; i++) {
            stakedData[i] = _getStakedTokenData(stakedAssets[i], oracles[i]);
        }
        return (stakedData, ethPrice);
    }

    function getStakedUserDataBatch(
        address[] calldata stakedAssets,
        address[] calldata oracles,
        address user
    ) external view returns (StakedTokenData[] memory, StakedTokenUserData[] memory) {
        require(stakedAssets.length == oracles.length, 'Arrays must be of the same length');
        StakedTokenData[] memory stakedData = new StakedTokenData[](stakedAssets.length);
        StakedTokenUserData[] memory userData = new StakedTokenUserData[](stakedAssets.length);

        for (uint256 i = 0; i < stakedAssets.length; i++) {
            stakedData[i] = _getStakedTokenData(stakedAssets[i], oracles[i]);
            userData[i] = _getStakedTokenUserData(stakedAssets[i], user);
        }
        return (stakedData, userData);
    }

    function getstkPSYSUserData(
        address user
    )
        external
        view
        override
        returns (StakedTokenData memory stkPSYSData, StakedTokenUserData memory stkPSYSUserData)
    {
        stkPSYSData = _getStakedTokenData(STAKED_PSYS, ETH_USD_PRICE_FEED);
        stkPSYSUserData = _getStakedTokenUserData(STAKED_PSYS, user);
    }

    function _getStakedTokenData(
        address stakedToken,
        address oracle
    ) internal view returns (StakedTokenData memory data) {
        AggregatedStakedPSYSV3 stkToken = AggregatedStakedPSYSV3(stakedToken);
        
        data.stakedTokenTotalSupply = stkToken.totalSupply();
        data.stakedTokenTotalRedeemableAmount = stkToken.previewRedeem(data.stakedTokenTotalSupply);
        data.stakeCooldownSeconds = stkToken.getCooldownSeconds();
        data.stakeUnstakeWindow = stkToken.UNSTAKE_WINDOW();
        data.rewardTokenPriceEth = uint256(AggregatorInterface(PSYS_USD_PRICE_FEED).latestAnswer());
        data.distributionEnd = stkToken.DISTRIBUTION_END();
        
        if (block.timestamp < data.distributionEnd) {
            (uint256 emissionPerSecond, , ) = stkToken.assets(address(stakedToken));
            data.distributionPerSecond = emissionPerSecond;
        }

        data.stakedTokenPriceEth = data.rewardTokenPriceEth;
        data.currentExchangeRate = stkToken.getExchangeRate();
        data.maxSlashablePercentage = stkToken.getMaxSlashablePercentage();
        data.stakeApy = _calculateApy(
            data.distributionPerSecond,
            data.stakedTokenTotalSupply,
            data.currentExchangeRate
        );
    }

    function _getStakedTokenUserData(
        address stakedToken,
        address user
    ) internal view returns (StakedTokenUserData memory data) {
        AggregatedStakedPSYSV3 stkToken = AggregatedStakedPSYSV3(stakedToken);
        
        data.stakedTokenUserBalance = stkToken.balanceOf(user);
        data.underlyingTokenUserBalance = IERC20(stkToken.STAKED_TOKEN()).balanceOf(user);
        data.stakedTokenRedeemableAmount = stkToken.previewRedeem(data.stakedTokenUserBalance);
        data.rewardsToClaim = stkToken.getTotalRewardsBalance(user);
        
        // V3 cooldown structure
        (data.cooldownTimestamp, data.cooldownAmount) = stkToken.stakersCooldowns(user);
    }

    function _calculateApy(
        uint256 distributionPerSecond,
        uint256 totalSupply,
        uint256 exchangeRate
    ) internal pure returns (uint256) {
        if (totalSupply == 0) return 0;
        
        uint256 yearlyRewards = distributionPerSecond * SECONDS_PER_YEAR;
        uint256 adjustedRewards = (yearlyRewards * exchangeRate) / 1e18;
        
        return (adjustedRewards * APY_PRECISION) / totalSupply;
    }
}