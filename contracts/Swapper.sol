// SPDX-License-Identifier: BUSL-1.1
// Teahouse Finance

pragma solidity =0.8.21;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @notice Swapper is a helper contract for sending calls to arbitray swap router
/// @notice Since there's no need to approve tokens to Swapper, it's safe for Swapper
/// @notice to call arbitrary contracts.
contract Swapper is Ownable {

    using SafeERC20 for IERC20;

    error InvalidAddress();
    error NotAllowedCaller();

    mapping (address => bool) public allowedCallers;

    constructor() {
        allowedCallers[msg.sender] = true;
    }

    function setAllowedCaller(address _caller, bool _allow) external onlyOwner {
        allowedCallers[_caller] = _allow;
    }

    function swap(
        IERC20 _srcToken,
        IERC20 _dstToken,
        uint256 _amountIn,
        address _swapRouter,
        bytes calldata _data
    ) external {
        // AUDIT: SRE-01M
        if (_swapRouter == address(0)) revert InvalidAddress();
        // AUDIT: SRE-02M
        if (!allowedCallers[msg.sender]) revert NotAllowedCaller();

        _srcToken.approve(_swapRouter, _amountIn);
        (bool success, bytes memory returndata) = _swapRouter.call(_data);
        uint256 length = returndata.length;
        if (!success) {
            // call failed, propagate revert data
            assembly ("memory-safe") {
                revert(add(returndata, 32), length)
            }
        }
        _srcToken.approve(_swapRouter, 0);

        // send tokens back to caller
        uint256 balance = _srcToken.balanceOf(address(this));
        if (balance > 0) {
            _srcToken.safeTransfer(msg.sender, balance);
        }

        balance = _dstToken.balanceOf(address(this));
        if (balance > 0) {
            _dstToken.safeTransfer(msg.sender, balance);
        }
    }
}
