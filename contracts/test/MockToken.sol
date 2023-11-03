// SPDX-License-Identifier: Unlicensed
// Mock ERC20 contract for testing purpose

pragma solidity =0.8.21;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockToken is ERC20 {

    uint8 immutable decimals_;

    constructor(uint256 _initialSupply, uint8 _decimals) ERC20("Mock", "Mock") {
        decimals_ = _decimals;
        _mint(msg.sender, _initialSupply);
    }

    function decimals() public view virtual override returns (uint8) {
        return decimals_;
    }
}
