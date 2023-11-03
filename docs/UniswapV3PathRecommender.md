# UniswapV3PathRecommender

`File: Contracts/UniswapV3PathRecommender.sol`

```None
Inherited:
1. Ownable
```

## setRecommendedPath

```solidity!
function setRecommendedPath(
    address[] calldata _tokens,
    uint24[] calldata _fees
) external onlyOwner returns (
    bytes memory pathExactInput,
    bytes memory pathExactOutput
) {}
```

- Visibility: `external`
- Modifier:
    1. `onlyOwner`
- Parameters:
    1. `address[] calldata _tokens`: chain of swap token from source token to destination token.
    2. `uint24[] calldata _fees`: swap fee tier of the swap pools in the swap path.
- Returns:
    1. `bytes memory pathExactInput`: encoded `exactInput` swap path.
    1. `bytes memory pathExactOutput`: encoded `exactOutput` swap path.
- Notes:
    1. Unlike Uniswap v3 `SwapRouter`, the swap chain `_tokens` is from source token to destination token for both `exactInput` and `exactOutput`.
    2. `setRecommendedPath` will convert to Uniswap v3 `SwapRouter` encoded format for both `exactInput` and `exactOutput`.
- Actions:
    1. Set value of `srcToken => dstToken => path` in the mapping including `exactInput` path and `exactOutput` path.

## getRecommendedPath

```solidity!
function getRecommendedPath(bool _isExactInput, address _srcToken, address _dstToken) external view returns (bytes memory path) {}
```

- Visibility: `external`
- Modifier: None
- Parameters:
    1. `bool _isExactInput`: swap is exact input mode or not.
    2. `address _srcToken`: source token.
    3. `address _dstToken`: destination token.
- Returns:
    1. `bytes memory path`: encoded multi-hop swap path for Uniswap v3 `SwapRouter`.
- Notes:
    1. Get the recommended path of source token and destination token.
- Actions:
    1. Return value of `srcToken => dstToken => path` in the mapping.

## deleteRecommendedPath

```solidity!
function deleteRecommendedPath(address _srcToken, address _dstToken) external onlyOwner {}
```

- Visibility: `external`
- Modifier:
    1. `onlyOwner`
- Parameters:
    1. `address _srcToken`: source token.
    2. `address _dstToken`: destination token.
- Returns: None
- Notes:
    1. Delete the recommended path of source token and destination token.
- Actions:
    1. Remove value of `srcToken => dstToken => path` in the mapping.
