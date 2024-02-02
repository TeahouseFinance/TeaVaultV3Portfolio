// SPDX-License-Identifier: BUSL-1.1
// Teahouse Finance

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";

import "../oracle/interface/IAssetOracle.sol";

pragma solidity ^0.8.0;

interface ITeaVaultV3Portfolio {

    error BaseAssetNotSet();
    error OracleNotEnabled();
    error AssetBalanceNotZero();
    error BaseAssetCannotBeAdded();
    error BaseAssetCannotBeRemoved();
    error AssetAlreadyAdded();
    error InvalidAssetType();
    error InvalidAddress();
    error InvalidFeeRate();
    error ExecuteSwapFailed(bytes reason);
    error InsufficientSwapResult(uint256 minAmount, uint256 convertedAmount);
    error InvalidSwapTokens();
    error SimulationError();
    error CallerIsNotManager();
    error InvalidShareAmount();

    event TeaVaultV3PortCreated(address indexed teaVaultAddress, string indexed name, string indexed symbol);
    event AssetAdded(address indexed asset, uint256 timestamp);
    event AssetRemoved(address indexed asset, uint256 timestamp);
    event ManagerChanged(address indexed manager, uint256 timestamp);
    event FeeConfigChanged(FeeConfig feeConfig, uint256 timestamp);
    event Deposit(address indexed from, uint256 shares, uint256[] amounts, uint256 timestamp);
    event Withdraw(address indexed from, uint256 shares, uint256[] amounts, uint256 timestamp);
    event EntryFeeCollected(address indexed vault, uint256[] amounts, uint256 timestamp);
    event ExitFeeCollected(address indexed vault, uint256 shares, uint256 timestamp);
    event ManagementFeeCollected(address indexed vault, uint256 shares, uint256 timestamp);
    event PerformanceFeeCollected(address indexed vault, uint256 shares, uint256 timestamp);
    event Swap(address indexed manager, address indexed srcToken, address indexed dstToken, address router, uint256 amountIn, uint256 amountOut, uint256 timestamp);

    /// @notice Fee config structure
    /// @param vault Fee goes to this address
    /// @param entryFee Entry fee in bps (collected when depositing)
    /// @param exitFee Exit fee in bps (collected when withdrawing)
    /// @param managementFee Platform yearly management fee in bps (collected when depositing/withdrawing)
    /// @param performanceFee Platform performance fee in 0.0001% (collected for each cycle, from profits)
    /// @param decayFactor Performance fee reserve decay factor in UQ0.128
    struct FeeConfig {
        address vault;
        uint24 entryFee;
        uint24 exitFee;
        uint24 managementFee;
        uint24 performanceFee;
        uint256 decayFactor;
    }

    /// @notice Asset AssetType type
    /// @param Null Empty type
    /// @param Base Vault base asset
    /// @param Atomic Simple asset
    /// @param TeaVaultV3Pair TeaVaultV3Pair asset
    /// @param End End of ERC20 type, not a real type
    enum AssetType {
        Null,
        Base,
        Atomic,
        TeaVaultV3Pair,
        AToken,
        End
    }

    /// @notice Generic version of Uniswap V3 SwapRouter exactInput and exactOutput params
    /// @param path Swap path
    /// @param recipient Swap recipient
    /// @param deadline Transaction deadline
    /// @param amountInOrOut Amount input/output for exactInput/exactOutput swap
    /// @param amountOutOrInTolerance Amount output/input tolerance for exactInput/exactOutput swap
    struct SwapRouterGenericParams {
        bytes path;
        address recipient;
        uint256 deadline;
        uint256 amountInOrOut;
        uint256 amountOutOrInTolerance;
    }

    /// @notice Get number of assets
    /// @return numAssets number of assets
    function getNumberOfAssets() external view returns (uint256 numAssets);

    /// @notice Add AssetType.Atomic or AssetType.Composite asset
    /// @notice Only the owner can do this
    /// @param _asset Asset address
    /// @param _assetType Asset AssetType
    function addAsset(ERC20Upgradeable _asset, AssetType _assetType) external;

    /// @notice Remove AssetType.Atomic or AssetType.Composite asset
    /// @notice Only the owner can do this
    /// @param _index Asset index
    function removeAsset(uint256 _index) external;

    /// @notice Get all assets
    /// @return assets All assets
    function getAssets() external view returns (ERC20Upgradeable[] memory assets);

    /// @notice Get balance of all assets
    /// @return balances Balance of all assets
    function getAssetsBalance() external view returns (uint256[] memory balances);

    /// @notice Calculate value composition in base asset
    /// @return values value of assets
    function calculateValueComposition() external view returns (uint256[] memory values);

    /// @notice Calculate total vault value in base asset
    /// @return totalValue estimated vault value in base asset
    function calculateTotalValue() external view returns (uint256 totalValue);

    /// @notice Assign weight manager
    /// @notice Only the owner can do this
    /// @param _manager Weight manager address
    function assignManager(address _manager) external;

    /// @notice Set fee structure and vault addresses
    /// @notice Only available to the owner
    /// @param _feeConfig Fee structure settings
    function setFeeConfig(FeeConfig calldata _feeConfig) external;

    /// @notice Mint shares and deposit asset tokens
    /// @param _shares Share amount to be minted
    /// @return amounts Deposited asset amounts
    function deposit(uint256 _shares) external returns (uint256[] memory amounts);

    /// @notice Burn shares and withdraw asset tokens
    /// @param _shares Share amount to be burnt
    /// @return amounts Withdrawn asset amounts
    function withdraw(uint256 _shares) external returns (uint256[] memory amounts);

    /// @notice Collect performance fee
    /// @return collectedShares Collected performance fee in shares
    function collectPerformanceFee() external returns (uint256 collectedShares);

    /// @notice Collect management fee
    /// @return collectedShares Collected management fee in shares
    function collectManagementFee() external returns (uint256 collectedShares);

    /// @notice Supply to AAVE pool and get aToken
    /// @notice Only fund manager can do this
    /// @param _asset Asset to deposit
    /// @param _amount amount to be deposited
    function aaveSupply(address _asset, uint256 _amount) external;

    /// @notice Withdraw from AAVE pool and burn aToken
    /// @notice Only fund manager can do this
    /// @param _asset Asset to withdraw
    /// @param _amount amount to be withdrawn, use type(uint256).max to withdraw all
    /// @return withdrawAmount Withdrawn amount
    function aaveWithdraw(address _asset, uint256 _amount) external returns (uint256 withdrawAmount);

    /// @notice Deposit and get TeaVaultV3Pair share token
    /// @notice Only fund manager can do this
    /// @param _asset Asset to deposit
    /// @param _shares Composite asset share amount to be mint
    /// @param _amount0Max Max token0 amount to be deposited
    /// @param _amount1Max Max token1 amount to be deposited
    /// @return depositedAmount0 Deposited token0 amount
    /// @return depositedAmount1 Deposited token1 amount
    function v3PairDeposit(
        address _asset,
        uint256 _shares,
        uint256 _amount0Max,
        uint256 _amount1Max
    ) external returns (
        uint256 depositedAmount0,
        uint256 depositedAmount1
    );

    /// @notice Withdraw and burn TeaVaultV3Pair share token
    /// @notice Only fund manager can do this
    /// @param _asset Asset to withdraw
    /// @param _shares Composite asset share amount to be burnt
    /// @param _amount0Min Min token0 amount to be withdrawn
    /// @param _amount1Min Min token1 amount to be withdrawn
    /// @return withdrawnAmount0 Withdrawn token0 amount
    /// @return withdrawnAmount1 Withdrawn token1 amount
    function v3PairWithdraw(
        address _asset,
        uint256 _shares,
        uint256 _amount0Min,
        uint256 _amount1Min
    ) external returns (
        uint256 withdrawnAmount0,
        uint256 withdrawnAmount1
    );

    /// @notice A helper function for manager to calculate Uniswap V3 swap path
    /// @param _isExactInput Swap mode is exactInput or not
    /// @param _tokens Swap path tokens
    /// @param _fees Swap path fees
    /// @return path Swap path
    function calculateSwapPath(
        bool _isExactInput,
        address[] calldata _tokens,
        uint24[] calldata _fees
    ) external pure returns (
        bytes memory path
    );

    /// @notice Swap assets via Uniswap V3 SwapRouter
    /// @notice Only fund manager can do this
    /// @param _isExactInput Swap mode is exactInput or not
    /// @param _srcToken Swap source token
    /// @param _dstToken Swap destination token
    /// @param _path Swap path
    /// @param _deadline Transaction deadline
    /// @param _amountInOrOut Amount input/output for exactInput/exactOutput swap
    /// @param _amountOutOrInTolerance Amount output/input tolerance for exactInput/exactOutput swap
    /// @return amountOutOrIn Swap output/input amount
    function uniswapV3SwapViaSwapRouter(
        bool _isExactInput,
        address _srcToken,
        address _dstToken,
        bytes calldata _path,
        uint256 _deadline,
        uint256 _amountInOrOut,
        uint256 _amountOutOrInTolerance
    ) external returns (
        uint256 amountOutOrIn
    );

    /// @notice Swap assets via swap router
    /// @notice Only fund manager can do this
    /// @param _srcToken Source token
    /// @param _dstToken Destination token
    /// @param _inputAmount Amount of source tokens to swap
    /// @param _swapRouter Swap router
    /// @param _data Calldata of swap router
    /// @return convertedAmount Swap output amount
    function executeSwap(
        address _srcToken,
        address _dstToken,
        uint256 _inputAmount,
        address _swapRouter,
        bytes calldata _data
    ) external returns (
        uint256 convertedAmount
    );
}