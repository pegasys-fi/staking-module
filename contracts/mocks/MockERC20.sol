// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { ERC20 } from "../lib/ERC20.sol";

contract MockERC20 is ERC20 {
    constructor() ERC20() {}

    // Internal mint function made public for testing
    function mint(address account, uint256 amount) external {
        _mint(account, amount);
    }
}