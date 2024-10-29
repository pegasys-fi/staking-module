// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {AggregatedStakedPSYSV3} from '../interfaces/AggregatedStakedPSYSV3.sol';
import {IStakeUIHelper} from '../interfaces/IStakeUIHelper.sol';
import {IERC20} from '../interfaces/IERC20.sol';
import {IPriceOracle} from '../interfaces/IPriceOracle.sol';

/**
 * @title StakeUIHelper
 * @notice Helper contract to fetch staking data for UI
 * @author BGD Labs, modified by Pegasys
 */
contract StakeUIHelper is IStakeUIHelper {
  IPriceOracle public immutable PRICE_ORACLE;

  address public immutable PSYS;
  AggregatedStakedPSYSV3 public immutable STAKED_PSYS;

  uint256 constant SECONDS_PER_YEAR = 365 * 24 * 60 * 60;
  uint256 constant APY_PRECISION = 10000;
  uint256 constant EXCHANGE_RATE_UNIT = 1e18;

  constructor(
    IPriceOracle priceOracle,
    address psys,
    AggregatedStakedPSYSV3 stkPSYS
  ) {
    PRICE_ORACLE = priceOracle;
    PSYS = psys;
    STAKED_PSYS = stkPSYS;
  }

  /**
   * @dev Fetches all relevant staking data for a user
   * @param user Address of the user
   */
  function getUserStakeData(address user) external view returns (StakeData memory) {
    StakeData memory data;

    // General staking data
    data.stakeTokenTotalSupply = STAKED_PSYS.totalSupply();
    data.stakeCooldownSeconds = STAKED_PSYS.getCooldownSeconds();
    data.stakeUnstakeWindow = STAKED_PSYS.UNSTAKE_WINDOW();
    data.rewardTokenPriceEth = PRICE_ORACLE.getAssetPrice(PSYS);
    data.stakeTokenPriceEth = data.rewardTokenPriceEth;
    data.exchangeRate = STAKED_PSYS.getExchangeRate();
    data.maxSlashable = STAKED_PSYS.getMaxSlashablePercentage();
    
    // Get rewards distribution data
    (uint256 rewardsPerSecond, uint256 distributionEnd) = _getRewardsData();
    data.rewardsPerSecond = rewardsPerSecond;
    data.distributionEnd = distributionEnd;
    
    // Calculate APY considering exchange rate
    data.stakeApy = _calculateApy(
      rewardsPerSecond,
      data.stakeTokenTotalSupply,
      data.exchangeRate
    );

    // User specific data
    if (user != address(0)) {
      data.userStakeTokenBalance = STAKED_PSYS.balanceOf(user);
      data.userUnderlyingTokenBalance = IERC20(PSYS).balanceOf(user);
      data.userRewardsToClaim = STAKED_PSYS.getTotalRewardsBalance(user);
      (uint40 cooldownTimestamp, uint216 cooldownAmount) = STAKED_PSYS.stakersCooldowns(user);
      data.userCooldown = CooldownData(cooldownTimestamp, cooldownAmount);
    }

    return data;
  }

  /**
   * @dev Calculates the APY considering exchange rate changes
   */
  function _calculateApy(
    uint256 rewardsPerSecond,
    uint256 totalSupply,
    uint256 exchangeRate
  ) internal pure returns (uint256) {
    if (totalSupply == 0) return 0;
    
    // Adjust for exchange rate
    uint256 adjustedRewardsPerYear = rewardsPerSecond * SECONDS_PER_YEAR * exchangeRate / EXCHANGE_RATE_UNIT;
    return (adjustedRewardsPerYear * APY_PRECISION) / totalSupply;
  }

  /**
   * @dev Gets current rewards distribution data
   */
  function _getRewardsData() internal view returns (uint256, uint256) {
    address stakingAddress = address(STAKED_PSYS);
    uint256 distributionEnd = STAKED_PSYS.DISTRIBUTION_END();
    
    if (block.timestamp >= distributionEnd) {
      return (0, distributionEnd);
    }

    (uint256 emissionPerSecond, , ) = STAKED_PSYS.assets(stakingAddress);
    return (emissionPerSecond, distributionEnd);
  }
}