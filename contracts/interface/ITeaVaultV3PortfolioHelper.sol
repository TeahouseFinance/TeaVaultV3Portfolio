// SPDX-License-Identifier: BUSL-1.1
// Teahouse Finance

pragma solidity ^0.8.0;

import "../interface/ITeaVaultV3Pair.sol";
import "../interface/ITeaVaultV3Portfolio.sol";

interface ITeaVaultV3PortfolioHelper {

    enum VaultType {
        TeaVaultV3Pair,
        TeaVaultV3Portfolio
    }

    error NestedMulticall();
    error OnlyInMulticall();
    error NotWETH9Vault();
    error InvalidSwapReceiver();
    error InvalidTokenAmounts();
    error InvalidTokenType();
    error MulticallFailed(uint256 index, bytes reason);
    error ExecuteSwapFailed(bytes reason);
    error InsufficientSwapResult(uint256 minAmount, uint256 convertedAmount);
    error InvalidVaultType();
    error InconsistentArrayLengths();
    error NotAllowedSwapRouter();

    /// @notice Multicall for TeaVaultV3Portfolio
    /// @notice This function converts all msg.value into WETH9, and transfer required token amounts from the caller to the contract,
    /// @notice perform the transactions specified in _data, then refund all remaining ETH and tokens back to the caller.
    /// @notice Only ETH and tokens in _tokens will be refunded. Use refundTokens function to refund other tokens.
    /// @param _vaultType type of vault
    /// @param _vault address of TeaVaultV3Portfolio vault for this transaction
    /// @param _tokens Address of each token for use in this transaction
    /// @param _amounts Amounts of each token for use in this transaction
    /// @param _data array of function call data
    /// @return results function call results
    function multicall(
        VaultType _vaultType,
        address _vault,
        address[] calldata _tokens,        
        uint256[] calldata _amounts,
        bytes[] calldata _data
    ) external payable returns (bytes[] memory results);

    /// @notice Deposit to TeaVaultV3Portfolio vault
    /// @notice Can only be called inside multicall
    /// @param _shares Share amount to be mint
    /// @return amounts Amounts of tokens deposited
    /// @dev this function is set to payable because multicall is payable
    /// @dev otherwise calls to this function fails as solidity requires msg.value to be 0 for non-payable functions
    function deposit(
        uint256 _shares
    ) external payable returns (uint256[] memory amounts);

    /// @notice Deposit maximum possible shares to TeaVaultV3Portfolio vault
    /// @notice Can only be called inside multicall
    /// @return shares Amount of shares minted
    /// @return amounts Amounts of tokens deposited
    /// @dev this function is set to payable because multicall is payable
    /// @dev otherwise calls to this function fails as solidity requires msg.value to be 0 for non-payable functions
    function depositMax() external payable returns (uint256 shares, uint256[] memory amounts);

    /// @notice Burn shares and withdraw token0 and token1 from a TeaVaultV3Portfolio vault
    /// @notice Can only be called inside multicall
    /// @param _shares Share amount to be burnt
    /// @return amounts Amounts of tokens withdrawn
    /// @dev this function is set to payable because multicall is payable
    /// @dev otherwise calls to this function fails as solidity requires msg.value to be 0 for non-payable functions
    function withdraw(
        uint256 _shares
    ) external payable returns (uint256[] memory amounts);

    /// @notice Deposit to TeaVaultV3Pair vault
    /// @notice Can only be called inside multicall
    /// @param _shares Share amount to be mint
    /// @param _amount0Max Max token0 amount to be deposited
    /// @param _amount1Max Max token1 amount to be deposited
    /// @return depositedAmount0 Deposited token0 amount
    /// @return depositedAmount1 Deposited token1 amount
    /// @dev this function is set to payable because multicall is payable
    /// @dev otherwise calls to this function fails as solidity requires msg.value to be 0 for non-payable functions
    function depositV3Pair(
        uint256 _shares,
        uint256 _amount0Max,
        uint256 _amount1Max
    ) external payable returns (uint256 depositedAmount0, uint256 depositedAmount1);

    /// @notice Deposit max possible shares to TeaVaultV3Pair vault
    /// @notice Can only be called inside multicall
    /// @param _amount0Max Max token0 amount to be deposited
    /// @param _amount1Max Max token1 amount to be deposited
    /// @return shares Amount of shares minted
    /// @return depositedAmount0 Deposited token0 amount
    /// @return depositedAmount1 Deposited token1 amount
    /// @dev this function is set to payable because multicall is payable
    /// @dev otherwise calls to this function fails as solidity requires msg.value to be 0 for non-payable functions
    function depositV3PairMax(
        uint256 _amount0Max,
        uint256 _amount1Max
    ) external payable returns (uint256 shares, uint256 depositedAmount0, uint256 depositedAmount1);    

    /// @notice Burn shares and withdraw token0 and token1 from TeaVaultV3Pair vault
    /// @notice Can only be called inside multicall
    /// @param _shares Share amount to be burnt
    /// @param _amount0Min Min token0 amount to be withdrawn
    /// @param _amount1Min Min token1 amount to be withdrawn
    /// @return withdrawnAmount0 Withdrew token0 amount
    /// @return withdrawnAmount1 Withdrew token1 amount
    /// @dev this function is set to payable because multicall is payable
    /// @dev otherwise calls to this function fails as solidity requires msg.value to be 0 for non-payable functions
    function withdrawV3Pair(
        uint256 _shares,
        uint256 _amount0Min,
        uint256 _amount1Min
    ) external payable returns (uint256 withdrawnAmount0, uint256 withdrawnAmount1);

    /// @notice Supply to AAVE pool and get aToken
    /// @param _asset Token to supply to AAVE pool
    /// @param _amount amount to be deposited
    function aaveSupply(address _asset, uint256 _amount) external payable;

    /// @notice Withdraw from AAVE pool and burn aToken
    /// @param _asset aToken to withdraw
    /// @param _amount amount to be withdrawn, use type(uint256).max to withdraw all
    /// @return withdrawAmount Withdrawn amount
    function aaveWithdraw(address _asset, uint256 _amount) external payable returns (uint256 withdrawAmount);

    /// @notice Withdraw all from AAVE pool and burn aToken
    /// @notice Should pair this with aaveSupply in a call chain to make sure all unused aTokens are converted
    /// @notice back to tokens so they can be refunded
    /// @param _asset aToken to withdraw
    /// @return withdrawAmount Withdrawn amount
    function aaveWithdrawMax(address _asset) external payable returns (uint256 withdrawAmount);

    /// @notice Deposit to a TeaVaultV3Pair
    /// @notice Can only be called inside multicall
    /// @param _v3pair The TeaVaultV3Pair vault to deposit to
    /// @param _shares Share amount to be mint
    /// @param _amount0Max Max token0 amount to be deposited
    /// @param _amount1Max Max token1 amount to be deposited
    /// @return depositedAmount0 Deposited token0 amount
    /// @return depositedAmount1 Deposited token1 amount
    /// @dev this function is set to payable because multicall is payable
    /// @dev otherwise calls to this function fails as solidity requires msg.value to be 0 for non-payable functions
    function v3PairDeposit(
        address _v3pair,
        uint256 _shares,
        uint256 _amount0Max,
        uint256 _amount1Max
    ) external payable returns (uint256 depositedAmount0, uint256 depositedAmount1);

    /// @notice Withdraw from a TeaVaultV3Pair
    /// @notice Can only be called inside multicall
    /// @param _v3pair The TeaVaultV3Pair vault to deposit to
    /// @param _shares Share amount to be burnt
    /// @param _amount0Min Min token0 amount to be withdrawn
    /// @param _amount1Min Min token1 amount to be withdrawn
    /// @return withdrawnAmount0 Withdrew token0 amount
    /// @return withdrawnAmount1 Withdrew token1 amount
    /// @dev this function is set to payable because multicall is payable
    /// @dev otherwise calls to this function fails as solidity requires msg.value to be 0 for non-payable functions
    function v3PairWithdraw(
        address _v3pair,
        uint256 _shares,
        uint256 _amount0Min,
        uint256 _amount1Min
    ) external payable returns (uint256 withdrawnAmount0, uint256 withdrawnAmount1);

    /// @notice Withdraw all shares from a TeaVaultV3Pair
    /// @notice Can only be called inside multicall
    /// @notice Should pair this with v3PairDeposit in a call chain to make sure all unused shares are converted
    /// @notice back to tokens so they can be refunded
    /// @param _v3pair The TeaVaultV3Pair vault to deposit to
    /// @return withdrawnAmount0 Withdrew token0 amount
    /// @return withdrawnAmount1 Withdrew token1 amount
    /// @dev this function is set to payable because multicall is payable
    /// @dev otherwise calls to this function fails as solidity requires msg.value to be 0 for non-payable functions
    function v3PairWithdrawMax(
        address _v3pair
    ) external payable returns (uint256 withdrawnAmount0, uint256 withdrawnAmount1);

    /// @notice Swap assets via swap router
    /// @notice Can only be called inside multicall
    /// @param _srcToken Source token
    /// @param _dstToken Destination token
    /// @param _amountInMax Max amount of source token to swap
    /// @param _amountOutMin Min amount of destination tokens to receive
    /// @param _swapRouter swap router
    /// @param _data Call data of swap router
    /// @return convertedAmount Swap output amount
    /// @dev this function is set to payable because multicall is payable
    /// @dev otherwise calls to this function fails as solidity requires msg.value to be 0 for non-payable functions
    function swap(
        address _srcToken,
        address _dstToken,
        uint256 _amountInMax,
        uint256 _amountOutMin,
        address _swapRouter,
        bytes calldata _data
    ) external payable returns (uint256 convertedAmount);

    /// @notice Convert all WETH9 back to ETH
    /// @notice Can only be called inside multicall
    /// @dev this function is set to payable because multicall is payable
    /// @dev otherwise calls to this function fails as solidity requires msg.value to be 0 for non-payable functions
    function convertWETH() external payable;

    /// @notice Refund tokens
    /// @notice Can only be called inside multicall
    /// @notice Send all tokens specified in _tokens back to the send.
    /// @param _tokens Address of each token to refund
    function refundTokens(
        address[] calldata _tokens
    ) external payable;

    /// @notice Set allowed swapRouter addresses.
    /// @notice Only owner can call this function.
    /// @param _swapRouters array of address to be set for allowed swapRouters
    /// @param _enabled array of true or false to enable or disable swapRouters
    function setAllowedSwapRouters(address[] calldata _swapRouters, bool[] calldata _enabled) external;

    /// @notice Resuce stuck native tokens in the contract, send them to the caller
    /// @notice Only owner can call this function.
    /// @notice This is for emergency only. Users should not left tokens in the contract.
    /// @param _amount Amount to transfer
    function rescueEth(uint256 _amount) external;

    /// @notice Resuce stuck tokens in the contract, send them to the caller
    /// @notice Only owner can call this function.
    /// @notice This is for emergency only. Users should not left tokens in the contract.
    /// @param _token Address of the token
    /// @param _amount Amount to transfer
    function rescueFund(address _token, uint256 _amount) external;
}
