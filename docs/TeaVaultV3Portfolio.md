# TeaVaultV3Portfolio

`File: Contracts/TeaVaultV3Portfolio.sol`

```None
Inherited:
1. TeaVaultV3Portfolio
2. Initializable
3. UUPS upgradable pattern
4. Ownable
5. Reentrancy guard
6. ERC20
```

## initialize

```solidity!
function initialize(
    string calldata _name,
    string calldata _symbol,
    uint24 _feeCap,
    FeeConfig calldata _feeConfig,
    address _manager,
    ERC20Upgradeable _baseAsset,
    ERC20Upgradeable[] calldata _assets,
    AssetType[] calldata _assetTypes,
    IPool _aavePool,
    address _uniswapV3SwapRouter,
    UniswapV3PathRecommender _pathRecommender,
    IAssetOracle _assetOracle,
    IAssetOracle _aaveATokenOracle,
    IAssetOracle _teaVaultV3PairOracle,
    address _owner
) public initializer {}
```

- Visibility: `public`
- Modifier:
    1. `initializer`
- Parameters:
    1. `string calldata _name`: name of ERC20 PORT share.
    2. `string calldata _symbol`: symbol of ERC20 PORT share.
    3. `uint24 _feeCap`: upper limit of fees in _feeConfig.
    4. `FeeConfig _feeConfig`: initial fee configuration.
    5. `address _manager`: manager address to be set.
    6. `ERC20Upgradeable _baseAsset`: base ERC20 asset for valuation.
    7. `ERC20Upgradeable[] calldata _assets`: ERC20 assets excluding `_baseAsset`.
    8. `AssetType[] calldata _assetTypes`: asset type of `_assets` including `AssetType.Atomic` for atomic ERC20 assets, `AssetType.AToken` for AAVE aToken and `AssetType.TeaVaultV3Pair` for PAIRs.
    9. `IPool _aavePool`: AAVE pool.
    10. `address _uniswapV3SwapRouter`: Uniswap V3 `SwapRouter`.
    11. `UniswapV3PathRecommender _pathRecommender`: Uniswap baseline swap route recommender.
    12. `IAssetOracle _assetOracle`: oracle for `AssetType.Atomic` assets.
    13. `IAssetOracle _aaveATokenOracle`: oracle for `AssetType.AToken` assets.
    14. `IAssetOracle _teaVaultV3PairOracle`: oracle for `AssetType.TeaVaultV3Pair` assets.
    15. `address _owner`: new owner address. It is advised to use a multi-sig account for better security.
- Returns: None
- Notes:
    1. Initialize after contract deployment.
    2. It's advised that after initializing a vault, make a deposit as soon as possible to prevent a 'donation' attack, where an attack may inflate the share price by a significant amount and make future deposits more difficult.
- Actions:
    1. Set contract variables.
    2. Transfer ownership from deployer to `_owner`.

## \_authorizeUpgrade

```solidity!
function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
```

- Visibility: `internal`
- Modifier:
    1. `onlyOwner`
- Parameters:
    1. `address newImplementation`: new implementation contract address.
- Returns: None
- Notes:
    1. Check permissions while upgrading.
- Actions: None

## decimals

```solidity!
function decimals() public override view returns (uint8) {}
```

- Visibility: `public`
- Modifier: None
- Parameters: None
- Returns:
    1. `uint8`: decimals of tokenized TeaVault.
- Notes:
    1. Decimals of tokenized PORT equals 18 specified in `initialize`.
- Actions:
    1. Return `DECIMALS`.

## getNumberOfAssets

```solidity!
function getNumberOfAssets() external override view returns (uint256 numAssets) {}
```

- Visibility: `external`
- Modifier: None
- Parameters: None
- Returns:
    1. `uint256 numAssets`: number of assets.
- Notes: None
- Actions:
    1. Return `assets` length.

## addAsset

```solidity!
function addAsset(ERC20Upgradeable _asset, AssetType _assetType) external override onlyOwner {}
```

- Visibility: `external`
- Modifier:
    1. `onlyOwner`
- Parameters:
    1. `ERC20Upgradeable _asset`: asset to be added
    2. `AssetType _assetType`: asset type of `_asset`.
- Returns: None
- Notes: None
- Actions:
    1. Call `_addAsset`.

## _addAsset

```solidity!
function _addAsset(ERC20Upgradeable _asset, AssetType _assetType) internal {}
```

- Visibility: `internal`
- Modifier: None
- Parameters:
    1. `ERC20Upgradeable _asset`: asset to be added
    2. `AssetType _assetType`: asset type of `_asset`.
- Returns: None
- Notes: None
- Actions:
    1. Add `_asset` to `assets`.
    2. Map `_asset` to `_assetType` in `assetType` mapping.

## removeAsset

```solidity!
function removeAsset(uint256 _index) external override onlyOwner {}
```

- Visibility: `external`
- Modifier:
    1. `onlyOwner`
- Parameters:
    1. `uint256 _index`: asset index to be removed.
- Returns: None
- Notes: None
- Actions:
    1. Remove asset of index in `assets`.

## getAssets

```solidity!
function getAssets() external override view returns (ERC20Upgradeable[] memory assets) {}
```

- Visibility: `external`
- Modifier: None
- Parameters: None
- Returns: None
    1. `ERC20Upgradeable[] memory assets`: `assets`.
- Notes: None
- Actions:
    1. Return `assets`.

## getAssetsBalance

```solidity!
function getAssetsBalance() external override view returns (uint256[] memory balances) {}
```

- Visibility: `external`
- Modifier: None
- Parameters: None
- Returns: None
    1. `uint256[] memory balances`: balances of `assets`.
- Notes: None
- Actions:
    1. Call `_calculateTotalAmounts`.

## assignManager

```solidity!
function assignManager(address _manager) external override onlyOwner {}
```

- Visibility: `external`
- Modifier:
    1. `onlyOwner`
- Parameters:
    1. `address _manager`: manager address to be set.
- Returns: None
- Notes: None
- Actions:
    1. Call `_assignManager`.

## _assignManager

```solidity!
function _assignManager(address _manager) internal {}
```

- Visibility: `internal`
- Modifier: None
- Parameters:
    1. `address _manager`: manager address to be set.
- Returns: None
- Notes: None
- Actions:
    1. Set `manager` as `_manager`.

## setFeeConfig

```solidity!
function setFeeConfig(FeeConfig calldata _feeConfig) external override onlyOwner {}
```

- Visibility: `external`
- Modifier:
    1. `onlyOwner`
- Parameters:
    1. `FeeConfig calldata _feeConfig`: fee config to be set.
- Returns: None
- Notes: None
- Actions:
    1. Call `_feeConfig`.

## _setFeeConfig

```solidity!
function _setFeeConfig(FeeConfig calldata _feeConfig) internal {}
```

- Visibility: `internal`
- Modifier: None
- Parameters:
    1. `FeeConfig calldata _feeConfig`: fee config to be set.
- Returns: None
- Notes: None
- Actions:
    1. Set `feeConfig` as `_feeConfig`.

## _calculateShareAmounts

```solidity!
function _calculateShareAmounts(
   ERC20Upgradeable[] memory _assets,
   uint256[] memory _totalAmounts,
   uint256 _shares,
   uint256 _totalShares,
   MathUpgradeable.Rounding _rounding
) internal view returns (
   uint256[] memory shareAmounts
) {}
```

- Visibility: `internal`
- Modifier: None
- Parameters:
    1. `ERC20Upgradeable[] memory _assets`: `assets`.
    2. `uint256[] memory _totalAmounts`: each balance of `assets`.
    3. `_shares`: share amount to be calculated.
    4. `_totalShares`: total shares.
    5. `MathUpgradeable.Rounding _rounding`: rounding method.
- Returns:
    1. `uint256[] memory shareAmounts`: `assets` amount of `_shares`.
- Notes:
    1. If vault is empty, share to token ratio is 1:1 by default.
- Actions:
    1. Calculate `totalAmounts` * (`_shares` / `_totalShares`).

## _calculateTotalAmounts

```solidity!
function _calculateTotalAmounts(
   ERC20Upgradeable[] memory _assets
) internal view returns (
   uint256[] memory totalAmounts
) {}
```

- Visibility: `internal`
- Modifier: None
- Parameters:
    1. `ERC20Upgradeable[] memory _assets`: `assets`.
- Returns:
    1. `uint256[] memory totalAmounts`: each balance of `assets`.
- Notes: None
- Actions:
    1. Enumerate `assets` and get balance of the PORT.

## deposit

```solidity!
function deposit(
    uint256 _shares
) external checkShares(_shares) nonReentrant override returns (
    uint256[] memory depositedAmounts
) {}
```

- Visibility: `external`
- Modifier:
    1. `checkShares`
    2. `nonReentrant`
- Parameters:
    1. `uint256 _shares`: share amount to be mint.
- Returns:
    1. `uint256[] memory depositedAmounts`: deposited `asset` amounts.
- Notes:
    1. Mint shares and deposit `assets`.
- Actions:
    1. Call `_collectManagementFee`.
    2. Call `_collectPerformanceFee`.
    3. Calculate `assets` amount of shares.
    4. If vault is empty, initialize performance fee timestamp.
    5. Update high water mark.
    6. If vault is empty, mint shares with share to asset ratio 1:1 in index 0 of `assets` by default.
    7. If vault is not empty, transfer `assets` from the depositor to the vault based on the share to `totalSupply()` ratio to be minted.
    8. Calculate and collect entry fee of `assets` if the entry fee is not zero or depositor is not the fee vault `feeConfig.vault`.

## withdraw

```solidity!
function withdraw(
    uint256 _shares
) external override checkShares(_shares) nonReentrant returns (
    uint256[] memory withdrawnAmounts
) {}
```

- Visibility: `external`
- Modifier:
    1. `checkShares`
    2. `nonReentrant`
- Parameters:
    1. `uint256 _shares`: share amount to be burnt.
- Returns:
    1. `uint256[] memory withdrawnAmounts`: withdrew `assets` amount.
- Notes:
    1. Burn shares and withdraw `assets`.
- Actions:
    1. Call `_collectManagementFee`.
    2. Calculate and collect exit fee of the share if the exit fee is not zero or depositor is not the fee vault `feeConfig.vault`.
    3. Call `_collectPerformanceFee`.
    4. Update high water mark.
    5. Calculate and transfer withdrawn amount of `assets`.

## collectManagementFee

```solidity!
function collectManagementFee() external override nonReentrant returns (uint256 collectedShares) {}
```

- Visibility: `external`
- Modifier: None
- Parameters: None
- Returns:
    1. `uint256 collectedShares`: collected shares.
- Notes:
    1. Mint new shares as management fee.
- Actions:
    Call `_collectManagementFee`.

## \_collectManagementFee

```solidity!
function _collectManagementFee(
    uint256 _totalShares,
    FeeConfig memory _feeConfig
) internal returns (
    uint256 collectedShares
) {}
```

- Visibility: `external`
- Modifier: None
- Parameters:
    1. `uint256 _totalShares`: total shares.
    2. `FeeConfig memory _feeConfig`: `feeConfig`.
- Returns:
    1. `uint256 collectedShares`: collected shares.
- Notes:
    1. Mint new shares as management fee.
- Actions:
    1. Calculate the time elapsed `timeDiff` since the last management fee collection.
    2. Calculate amount to be collected based on the fee rate and time elapsed `collectedShares` and mint new shares if `timeDiff` > 0 and `collectedShares` > 0.
    3. Update the timestamp of the last management fee collection `lastCollectManagementFee`.

## collectPerformanceFee

```solidity!
function collectPerformanceFee() external override nonReentrant returns (uint256 collectedShares) {}
```

- Visibility: `external`
- Modifier:
    1. `nonReentrant`
- Parameters: None
- Returns:
    1. `uint256 collectedShares`: collected shares.
- Notes:
    1. Unlock reserved shares based on time elasped from last collect.
    2. If performance is under high water mark, burn collected shares from the reserve.
    3. If performance is over high water mark, mint new shares to the reserve.
- Actions:
    1. Call `_collectPerformanceFee`.

## \_collectPerformanceFee

```solidity!
function _collectPerformanceFee(
    uint256 _totalShares,
    uint256 _totalValue,
    FeeConfig memory _feeConfig
) internal returns (
   uint256 collectedShares
) {}
```

- Visibility: `internal`
- Modifier: None
- Parameters:
    1. `uint256 _totalShares`: total shares.
    2. `uint256 _totalValue`: total value of `assets`.
    3. `FeeConfig memory _feeConfig`: `feeConfig`.
- Returns:
    1. `uint256 collectedShares`: collected shares.
- Notes:
    1. Unlock reserved shares based on time elasped from last collect.
    2. If performance is under high water mark, burn collected shares from the reserve, and update high water mark.
    3. If performance is over high water mark, mint new shares to the reserve.
- Actions:
    1. Calculate the time elapsed `timeDiff` since the last performance fee collection.
    2. Calculate amount to be unlocked based on the decay factor and time elapsed and transfer to the fee vault.
    3. Increase/decrease fee reserve based on the performance compared with last high water mark.

## _getAssetsTwap

```solidity!
function _getAssetsTwap(ERC20Upgradeable[] memory _assets) internal view returns (uint256[] memory twaps) {}
```

- Visibility: `internal`
- Modifier: None
- Parameters:
    1. `ERC20Upgradeable[] memory _assets`: `assets`.
- Returns:
    1. `uint256[] memory twaps`: TWAP of each asset.
- Notes: None
- Actions:
    1. Call `IAssetOracle.getTwap` for each asset.

## calculateValueComposition

```solidity!
function calculateValueComposition() external override view returns (uint256[] memory values) {}
```

- Visibility: `external`
- Modifier: None
- Parameters: None
- Returns:
    1. `uint256[] memory values`: value of each asset.
- Notes: None
- Actions:
    1. Call `_calculateValueComposition` w/o parmas.

## \_calculateValueComposition w/o params

```solidity!
function _calculateValueComposition() internal view returns (uint256[] memory values) {}
```

- Visibility: `internal`
- Modifier: None
- Parameters: None
- Returns:
    1. `uint256[] memory values`: value of each asset.
- Notes: None
- Actions:
    1. Get balance of each `assets`.
    2. Call `_calculateValueComposition` w/ params.

## \_calculateValueComposition w/ params

```solidity!
function _calculateValueComposition(
   ERC20Upgradeable[] memory _assets,
   uint256[] memory _balances,
   uint256[] memory _twaps
) internal view returns (uint256[] memory values) {}
```

- Visibility: `internal`
- Modifier: None
- Parameters:
    1. `ERC20Upgradeable[] memory _assets`: `assets`.
    2. `uint256[] memory _balances`: balance of each `assets`.
    3. `uint256[] memory _twaps`: TWAP of each asset.
- Returns:
    1. `uint256[] memory values`: value of each asset.
- Notes: None
- Actions:
    1. Call `IAssetOracle.getValueWithTwap` to get value of each asset.

## calculateTotalValue

```solidity!
function calculateTotalValue() external override view returns (uint256 totalValue) {}
```

- Visibility: `external`
- Modifier: None
- Parameters: None
- Returns:
    1. `uint256 totalValue`: total value of `assets`.
- Notes: None
- Actions:
    1. Call `_calculateValueComposition` w/o params and sum up the result.

## \_calculateAssetsValue

```solidity!
function _calculateAssetsValue(
   ERC20Upgradeable[] memory _assets,
   uint256[] memory _balances,
   uint256[] memory _twaps
) internal view returns (uint256 value) {}
```

- Visibility: `internal`
- Modifier: None
- Parameters:
    1. `ERC20Upgradeable[] memory _assets`: `assets`.
    2. `_balance`: balance of each `assets`.
    3. `uint256[] memory _twaps`: TWAP of each asset.
- Returns:
    1. `uint256 value`: value of the given of `assets` with the given amounts.
- Notes: None
- Actions:
    1. Call `_calculateValueComposition` w/ params and sum up the result.

## aaveSupply

```solidity!
function aaveSupply(address _asset, uint256 _amount) external override onlyManager nonReentrant {}
```

- Visibility: `external`
- Modifier:
    1. `onlyManager`
    2. `nonReentrant`
- Parameters:
    1. `address _asset`: asset to be supplied to AAVE pool.
    2. `uint256 _amount`: amount of asset to be supplied.
- Returns: None
- Notes: None
- Actions:
    1. Approve `_asset` for `aavePool`.
    2. Call `aavePool.supply`.

## aaveWithdraw

```solidity!
function aaveWithdraw(
    address _asset,
    uint256 _amount
) external override onlyManager nonReentrant returns (
    uint256 withdrawAmount
) {}
```

- Visibility: `external`
- Modifier:
    1. `onlyManager`
    2. `nonReentrant`
- Parameters:
    1. `address _asset`: asset to be withdrawn from AAVE pool.
    2. `uint256 _amount`: amount of asset to be withdrawn.
- Returns:
    1. `withdrawAmount`: withdrawn amount.
- Notes: None
- Actions:
    1. Approve `_asset` for `aavePool`.
    2. Call `aavePool.withdraw`.

## v3PairDeposit

```solidity!
function v3PairDeposit(
   uint256 _index,
   uint256 _shares,
   uint256 _amount0Max,
   uint256 _amount1Max
) external override onlyManager nonReentrant returns (
   uint256 depositedAmount0,
   uint256 depositedAmount1
) {}
```

- Visibility: `external`
- Modifier:
    1. `onlyManager`
    2. `nonReentrant`
- Parameters:
    1. `uint256 _index`: index of PAIR asset.
    2. `uint256 _shares`: number of shares to be minted.
    3. `uint256 _amount0Max`: token0 price protection.
    4. `uint256 _amount1Max`: token1 price protection.
- Returns:
    1. `uint256 depositedAmount0`: total deposited token0.
    1. `uint256 depositedAmount0`: total deposited token1.
- Notes: None
- Actions:
    1. Approve token0 and token 1 for PAIR.
    2. Call `ITeaVaultV3Pair.deposit`.
    3. Revoke approval of token0 and token 1 for PAIR.

## v3PairWithdraw

```solidity!
function compoWithdraw(
   uint256 _index,
   uint256 _shares,
   uint256 _amount0Min,
   uint256 _amount1Min
) external override onlyManager nonReentrant returns (
   uint256 withdrawnAmount0,
   uint256 withdrawnAmount1
) {}
```

- Visibility: `external`
- Modifier:
    1. `onlyManager`
    2. `nonReentrant`
- Parameters:
    1. `uint256 _index`: index of PAIR asset.
    2. `uint256 _shares`: number of shares to be burnt.
    3. `uint256 _amount0Min`: token0 price protection.
    4. `uint256 _amount1Min`: token1 price protection.
- Returns:
    1. `uint256 withdrawnAmount0`: total withdrawn token0.
    1. `uint256 withdrawnAmount1`: total withdrawn token1.
- Notes: None
- Actions:
    1. Call `ITeaVaultV3Pair.withdraw`.

## uniswapV3SwapViaSwapRouter

```solidity!
function uniswapV3SwapViaSwapRouter(
   bool _isExactInput,
   address[] calldata _tokens,
   uint24[] calldata _fees,
   uint256 _deadline,
   uint256 _amountInOrOut,
   uint256 _amountOutOrInTolerance
) external override onlyManager nonReentrant returns (
   uint256 amountOutOrIn
) {}
```

- Visibility: `external`
- Modifier:
    1. `onlyManager`
    2. `nonReentrant`
- Parameters:
    1. `bool _isExactInput`: swap is exact input mode or not.
    2. `_tokens`: chain of swap token from source token to destination token.
    3. `_fees`: swap fee tier of the swap pools in the swap path.
    4. `_deadline`: transaction deadline.
    5. `_amountInOrOut`: input amount for exact input swap or output amount for exact output swap.
    6. `_amountOutOrInTolerance`: minimum output amount for exact input swap or maximum input amount for exact output swap.
- Returns:
    1. `amountOutOrIn`: output amount for exact input swap or input amount for exact output swap.
- Notes:
    1. Can be generalized to `executeSwap` but we keep it here that is easier to use through this interface for manager.
- Actions:
    1. Get recommended path from `UniswapV3PathRecommender`.
    2. Get baseline swap amount.
    3. Approve source token for Uniswap v3 `SwapRouter`.
    4. Swap via Uniswap v3 `SwapRouter` with baseline swap amount as the amount tolerance.
    5. Revoke source token approval for Uniswap v3 `SwapRouter`.

## executeSwap

```solidity!
function executeSwap(
    address _srcToken,
    address _dstToken,
    uint256 _inputAmount,
    address _swapRouter,
    bytes calldata _data
) external override onlyManager nonReentrant returns (
    uint256 convertedAmount
) {}
```

- Visibility: `external`
- Modifier:
    1. `onlyManager`
    2. `nonReentrant`
- Parameters:
    1. `address _srcToken`: source token.
    2. `address _dstToken`: destination token.
    3. `uint256 _inputAmount`: source token amount.
    4. `address _swapRouter`: swap router.
    5. `bytes calldata _data`: encoded calldata for `_swapRouter`.
- Returns:
    1. `uint256 convertedAmount`: swap output amount.
- Notes: None
- Actions:
    1. Get recommended path from `UniswapV3PathRecommender`.
    2. Get baseline swap amount.
    3. Approve source token for `_swapRouter`.
    4. Swap via `_swapRouter`.
    5. `_dstToken` balance changed must be not less than the baseline.

## simulateSwapViaV3Router

```solidity!
function simulateSwapViaV3Router(
   address _uniswapV3SwapRouter,
   bool _isExactInput,
   address _srcToken,
   bytes memory _path,
   uint256 _amountInOrOut
) internal returns (uint256 amountOutOrIn) {}
```

- Visibility: `internal`
- Modifier: None
- Parameters:
    1. `address _uniswapV3SwapRouter`: Uniswap v3 `SwapRouter`.
    2. `bool _isExactInput`: swap is exact input mode or not.
    3. `address _srcToken`: source token.
    4. `bytes memory _path`: encoded swap path for Uniswap v3 `SwapRouter`.
    5. `uint256 _amountInOrOut`: input amount for exact input swap or output amount for exact output swap.
- Returns:
    1. `uint256 amountOutOrIn`: simulated swap amount.
- Notes:
    1. Simulate swap using the given path.
- Actions:
    1. Approve source token for Uniswap v3 `SwapRouter`.
    2. Construct swap params.
    3. Delegate call `simulateSwapViaV3RouterInternal`.
    4. Decode reverted data as the simulated swap amount.
    5. Rovoke source token approval for Uniswap v3 `SwapRouter`.

## simulateSwapViaV3RouterInternal

```solidity!
function simulateSwapViaV3RouterInternal(
   bytes4 _selector,
   address _uniswapV3SwapRouter,
   SwapRouterGenericParams memory _params
) external onlyManager {}
```

- Visibility: `external`
- Modifier: None
- Parameters:
    1. `bytes4 _selector`: selector of `exactInput` or `exactOutput` for distingushing different swap mode.
    2. `address _uniswapV3SwapRouter`: Uniswap v3 `SwapRouter`.
    3. `SwapRouterGenericParams memory _params`: swap params for Uniswap v3 `SwapRouter`.
- Returns: None
- Notes:
    1. Helper function for simulating swap using the given path.
    2. Will always revert.
- Actions:
    1. Call Uniswap v3 `SwapRouter`.
    2. Encode the result in the reverted data.

## _checkAndGetRecommendedPath

```solidity!
function _checkAndGetRecommendedPath(
   bool _isExactInput,
   address _srcToken,
   address _dstToken
) internal view returns (bytes memory recommendedPath) {}
```

- Visibility: `internal`
- Modifier: None
- Parameters:
    1. `bool _isExactInput`: swap is exact input mode or not.
    2. `address _srcToken`: source token.
    3. `address _dstToken`: destination token.
- Returns:
    1. `bytes memory recommendedPath`: recommended swap path.
- Notes: None
- Actions:
    1. Check if `_srcToken` and `_dstToken` are in `assets`.
    2. Get recommended swap path from `pathRecommender`.

## power128

```solidity!
function power128(uint256 base, uint256 exp) internal pure returns (uint256 result) {}
```

- Visibility: `internal`
- Modifier: None
- Parameters:
    1. `uint256 base`: base, a 128-bit fixed point number.
    2. `uint256 exp`: exponent.
- Returns:
    1. `uint256 result`: $base ^ {exp}$.
- Notes:
    1. Calculate $base ^ {exp}$ where base is a 128-bit fixed point number.
- Actions:
    1. Calculate $base ^ {exp}$.
