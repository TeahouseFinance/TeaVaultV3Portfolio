# AssetOracle

`File: Contracts/oracle/AssetOracle.sol`

```None
Inherited:
1. IAssetOracle
2. Ownable
```

## constructor

```solidity!
constructor(address _baseAsset) {}
```

- Visibility: `public`
- Modifier: None
- Parameters:
    1. `address _baseAsset`: base ERC20 asset for valuation.
- Returns: None
- Notes: None
- Actions:
    1. Set `baseAsset` as `_baseAsset`.
    2. Initialize poolInfoChain for `_baseAsset`.

## decimals

```solidity!
function decimals() external override pure returns (uint8) {}
```

- Visibility: `external`
- Modifier: None
- Parameters: None
- Returns:
    1. `uint8`: decimals of the oracle.
- Notes:
    1. Decimals of the oracle equals 18 which is a constant variable.
- Actions:
    1. Return `DECIMALS`.

## getBaseAsset

```solidity!
function getBaseAsset() external override view returns (address) {}
```

- Visibility: `external`
- Modifier: None
- Parameters: None
- Returns:
    1. `address`: `baseAsset`.
- Notes: None
- Actions:
    1. Return `baseAsset`.

## isOracleEnabled

```solidity!
function isOracleEnabled(address _asset) external override view returns (bool) {}
```

- Visibility: `external`
- Modifier: None
- Parameters:
    1. `address _asset`: query asset.
- Returns:
    1. `bool`: whether `_asset` is enabled.
- Notes: None
- Actions:
    1. Return `true` if `poolInfoChain` of `_asset` is initialized.

## enableOracle

```solidity!
function enableOracle(address _asset, IUniswapV3Pool[] calldata _pools, uint32[] memory _twapIntervals) external onlyOwner {}
```

- Visibility: `external`
- Modifier:
    1. `onlyOwner`
- Parameters:
    1. `address _asset`: asset to be enabled.
    2. `IUniswapV3Pool[] calldata _pools`: Uniswap v3 pool chain as TWAP source.
    3. `uint32[] memory _twapIntervals`: TWAP intervals.
- Returns: None
- Notes:
    1. Zero TWAP interval is not allowed.
- Actions:
    1. Sanity check.
    2. Set initialized value to the mapping.

## getValue

```solidity!
function getValue(address _asset, uint256 _amount) external override view returns (uint256 value) {}
```

- Visibility: `external`
- Modifier: None
- Parameters:
    1. `address _asset`: query asset.
    2. `uint256 _amount`: asset amount.
- Returns:
    1. `uint256 value`: TWAP-based value of the `_amount` of `_asset`.
- Notes: None
- Actions:
    1. Call `_getValue`.

## getBatchValue

```solidity!
function getBatchValue(
    address[] calldata _assets,
    uint256[] calldata _amounts
) external override view returns (
    uint256[] memory values
) {}
```

- Visibility: `external`
- Modifier: None
- Parameters:
    1. `address[] calldata _assets`: query assets.
    2. `uint256[] calldata _amounts`: amount of assets.
- Returns:
    1. `uint256[] memory values`: TWAP-based value of each amount of asset.
- Notes:
    1. Batch version of `getValue`.
- Actions:
    1. Call `_getValue` for each asset.

## getValueWithTwap

```solidity!
function getValueWithTwap(address _asset, uint256 _amount, uint256 _twap) external override view returns (uint256 value) {}
```

- Visibility: `external`
- Modifier: None
- Parameters:
    1. `address _asset`: query asset.
    2. `uint256 _amount`: asset amount.
    3. `uint256 _twap`: asset TWAP.
- Returns:
    1. `uint256 value`: value of the `_amount` of `_asset` with TWAP specified.
- Notes: None
- Actions:
    1. Call `_getValueWithTwap`.

## getBatchValueWithTwap

```solidity!
function getBatchValueWithTwap(
    address[] calldata _assets,
    uint256[] calldata _amounts,
    uint256[] calldata _twaps
) external override view returns (
    uint256[] memory values
) {}
```

- Visibility: `external`
- Modifier: None
- Parameters:
    1. `address[] calldata _assets`: query assets.
    2. `uint256[] calldata _amounts`: amount of assets.
    3. `uint256[] calldata _twaps`: TWAP of assets.
- Returns:
    1. `uint256[] memory values`: value of each amount of asset with TWAP specified.
- Notes:
    1. Batch version of `getValueWithTwap`.
- Actions:
    1. Call `_getValueWithTwap` for each asset.

## getTwap

```solidity!
function getTwap(address _asset) external override view returns (uint256 price) {}
```

- Visibility: `external`
- Modifier: None
- Parameters:
    1. `address _asset`: query asset.
- Returns:
    1. `uint256 price`: `_asset` TWAP.
- Notes: None
- Actions:
    1. Call `_getTwap`.

## getBatchTwap

```solidity!
function getBatchTwap(address[] calldata _assets) external override view returns (uint256[] memory prices) {}
```

- Visibility: `external`
- Modifier: None
- Parameters:
    1. `address[] calldata _assets`: query assets.
- Returns:
    1. `uint256[] memory prices`: TWAP of each asset.
- Notes:
    1. Batch version of `getTwap`.
- Actions:
    1. Call `_getTwap` for each asset.

## _getValue

```solidity!
function _getValue(address _asset, uint256 _amount) internal view returns (uint256 value) {}
```

- Visibility: `internal`
- Modifier: None
- Parameters:
    1. `address _asset`: query asset.
    2. `uint256 _amount`: asset amount.
- Returns:
    1. `uint256 value`: TWAP-based value of the `_amount` of `_asset`.
- Notes: None
- Actions:
    1. `_asset` TWAP multiply `_amount` and divide it with $10^{\_asset.decimals()}$.

## _getValueWithTwap

```solidity!
function _getValueWithTwap(address _asset, uint256 _amount, uint256 _twap) internal view returns (uint256 value) {}
```

- Visibility: `internal`
- Modifier: None
- Parameters:
    1. `address _asset`: query asset.
    2. `uint256 _amount`: asset amount.
    3. `uint256 _twap`: asset TWAP.
- Returns:
    1. `uint256 value`: value of the `_amount` of `_asset` with TWAP specified.
- Notes: None
- Actions:
    1. Calculate value with the given TWAP.

## _getTwap

```solidity!
function _getTwap(PoolInfo[] memory _poolInfoChain) internal view returns (uint256 price) {}
```

- Visibility: `internal`
- Modifier: None
- Parameters:
    1. `PoolInfo[] memory _poolInfoChain`: `PoolInfo` chain used to calculate TWAP.
- Returns:
    1. `uint256 price`: asset TWAP.
- Notes: None
- Actions:
    1. Call `UniswapV3Pool.observe`.
    2. Calculate `sqrtPriceX96`.
    3. Convert to human-readable price with `DECIMALS`.
