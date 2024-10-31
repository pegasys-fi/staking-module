// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title IStakeUIHelper
 * @notice Interface for the StakeUIHelper contract that provides data for the staking UI
 * @author BGD Labs, modified by Pegasys
 */
interface IStakeUIHelper {
  /**
   * @dev Struct containing cooldown data for a user
   */
  struct CooldownData {
    uint40 timestamp;
    uint216 amount;
  }

  /**
   * @dev Struct containing all staking-related data
   */
  struct StakeData {
    // General data
    uint256 stakeTokenTotalSupply;
    uint256 stakeCooldownSeconds;
    uint256 stakeUnstakeWindow;
    uint256 rewardTokenPriceEth;
    uint256 stakeTokenPriceEth;
    uint256 rewardsPerSecond;
    uint256 exchangeRate;
    uint256 distributionEnd;
    uint256 stakeApy;
    
    // User specific data
    uint256 userStakeTokenBalance;
    uint256 userUnderlyingTokenBalance;
    uint256 userRewardsToClaim;
    uint256 maxSlashable;
    CooldownData userCooldown;
  }

  /**
   * @dev Returns all staking data for a specific user
   * @param user Address of the user
   * @return All staking data including general protocol data and user-specific data
   */
  function getUserStakeData(address user) external view returns (StakeData memory);
}