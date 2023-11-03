// SPDX-License-Identifier: MIT

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

pragma solidity ^0.8.0;

interface IAToken is IERC20Upgradeable {

    function decimals() external view returns (uint8);
    function UNDERLYING_ASSET_ADDRESS() external view returns (address);

}