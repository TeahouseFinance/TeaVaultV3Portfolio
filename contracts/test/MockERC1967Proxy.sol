// SPDX-License-Identifier: Unlicensed
// Mock Proxy contract for testing purpose

pragma solidity =0.8.21;

import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract MockERC1967Proxy is ERC1967Proxy {
    constructor(address _logic, bytes memory _data) payable ERC1967Proxy(_logic, _data) {}
}