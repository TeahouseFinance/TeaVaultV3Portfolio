// SPDX-License-Identifier: BUSL-1.1
// Teahouse Finance

pragma solidity =0.8.21;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import "@uniswap/v3-core/contracts/libraries/TickMath.sol";
import "@uniswap/v3-core/contracts/libraries/FullMath.sol";

import "./interface/IAssetOracle.sol";

// import "hardhat/console.sol";
contract AssetOracle is IAssetOracle, Ownable {
    using FullMath for uint256;

    struct PoolInfo {
        IUniswapV3Pool pool;
        uint32 twapInterval;
        uint8 decimals0;
        uint8 decimals1;
        bool assetIsToken0;
    }

    address immutable public baseAsset;
    uint8 private constant DECIMALS = 18;
    mapping (address => PoolInfo[]) public poolInfoChain;

    constructor(address _baseAsset) {
        baseAsset = _baseAsset;
        poolInfoChain[_baseAsset] = new PoolInfo[](1);
        
        poolInfoChain[_baseAsset][0] = PoolInfo({
            pool: IUniswapV3Pool(address(1)),
            twapInterval: 0,
            decimals0: ERC20(_baseAsset).decimals(),
            decimals1: 0,
            assetIsToken0: true
        });
    }

    /// @inheritdoc IAssetOracle
    function decimals() external override pure returns (uint8) {
        return DECIMALS;
    }

    /// @inheritdoc IAssetOracle
    function getBaseAsset() external override view returns (address) {
        return baseAsset;
    }

    /// @inheritdoc IAssetOracle
    function isOracleEnabled(address _asset) external override view returns (bool) {
        return (poolInfoChain[_asset].length) != 0;
    }

    function enableOracle(address _asset, IUniswapV3Pool[] calldata _pools, uint32[] memory _twapIntervals) external onlyOwner {
        if (_pools.length != _twapIntervals.length) revert ConfigLengthMismatch();
        if (_asset == baseAsset) revert BaseAssetCannotBeReenabled();

        // reset mapping before setting
        delete poolInfoChain[_asset];
        PoolInfo[] storage _poolInfoChain = poolInfoChain[_asset];
        address token0;
        address token1;
        for (uint256 i; i < _pools.length; i = i + 1) {
            if (_twapIntervals[i] == 0) revert ZeroTwapIntervalNotAllowed();
            token0 = _pools[i].token0();
            token1 = _pools[i].token1();
            if (_asset != token0 && _asset != token1) revert AssetNotInPool();
            _poolInfoChain.push(PoolInfo({
                pool: _pools[i],
                twapInterval: _twapIntervals[i],
                decimals0: ERC20(token0).decimals(),
                decimals1: ERC20(token1).decimals(),
                assetIsToken0: (_asset == token0)
            }));
            _asset = (_asset == token0) ? token1 : token0;
        }
        if (token0 != baseAsset && token1 != baseAsset) revert BaseAssetMismatch();
    }

    /// @inheritdoc IAssetOracle
    function getValue(address _asset, uint256 _amount) external override view returns (uint256 value) {
        return _getValue(_asset, _amount);
    }

    /// @inheritdoc IAssetOracle
    function getBatchValue(
        address[] calldata _assets,
        uint256[] calldata _amounts
    ) external override view returns (
        uint256[] memory values
    ) {
        if (_assets.length != _amounts.length) revert BatchLengthMismatched();

        values = new uint256[](_assets.length);
        for (uint256 i; i < _assets.length; i = i + 1) {
            values[i] = _getValue(_assets[i], _amounts[i]);
        }
    }

    /// @inheritdoc IAssetOracle
    function getValueWithTwap(address _asset, uint256 _amount, uint256 _twap) external override view returns (uint256 value) {
        return _getValueWithTwap(_asset, _amount, _twap);
    }

    /// @inheritdoc IAssetOracle
    function getBatchValueWithTwap(
        address[] calldata _assets,
        uint256[] calldata _amounts,
        uint256[] calldata _twaps
    ) external override view returns (
        uint256[] memory values
    ) {
        values = new uint256[](_assets.length);

        for (uint256 i; i < _assets.length; i = i + 1) {
            values[i] = _getValueWithTwap(_assets[i], _amounts[i], _twaps[i]);
        }
    }

    /// @inheritdoc IAssetOracle
    function getTwap(address _asset) external override view returns (uint256 price) {
        return _getTwap(poolInfoChain[_asset]);
    }

    /// @inheritdoc IAssetOracle
    function getBatchTwap(address[] calldata _assets) external override view returns (uint256[] memory prices) {
        prices = new uint256[](_assets.length);

        for (uint256 i; i < _assets.length; i = i + 1) {
            prices[i] = _getTwap(poolInfoChain[_assets[i]]);
        }
    }

    function _getValue(address _asset, uint256 _amount) internal view returns (uint256 value) {
        PoolInfo[] memory _poolInfoChain = poolInfoChain[_asset];
        return _amount.mulDiv(
            _getTwap(_poolInfoChain),
            10 ** (_poolInfoChain[0].assetIsToken0 ? _poolInfoChain[0].decimals0 : _poolInfoChain[0].decimals1)
        );
    }

    function _getValueWithTwap(address _asset, uint256 _amount, uint256 _twap) internal view returns (uint256 value) {
        PoolInfo[] memory _poolInfoChain = poolInfoChain[_asset];
        return _amount.mulDiv(
            _twap,
            10 ** (_poolInfoChain[0].assetIsToken0 ? _poolInfoChain[0].decimals0 : _poolInfoChain[0].decimals1)
        );
    }

    function _getTwap(PoolInfo[] memory _poolInfoChain) internal view returns (uint256 price) {
        if ((_poolInfoChain.length) == 0) revert AssetNotEnabled();

        price = 10 ** DECIMALS;
        if (address(_poolInfoChain[0].pool) == address(1)) {
            return price;
        }

        uint256 relativePrice;
        uint32[] memory secondsAgo = new uint32[](2);
        int56[] memory tickCumulatives;
        uint256 sqrtPriceX96;
        PoolInfo memory _poolInfo;
        for (uint256 i; i < _poolInfoChain.length; i = i + 1) {
            _poolInfo = _poolInfoChain[i];

            secondsAgo[0] = _poolInfo.twapInterval;
            (tickCumulatives, ) = _poolInfo.pool.observe(secondsAgo);
            sqrtPriceX96 = TickMath.getSqrtRatioAtTick(
                int24((tickCumulatives[1] - tickCumulatives[0]) / int64(uint64(_poolInfo.twapInterval)))
            );
            if (_poolInfo.assetIsToken0) {
                // (sqrtX96 / 2 ^ 96) ^ 2 * 10 ^ (decimals0 - decimals1) * 10 ^ DECIMALS
                relativePrice = sqrtPriceX96.mulDiv(sqrtPriceX96, 1 << 96);
                relativePrice = _poolInfo.decimals0 > _poolInfo.decimals1 ? 
                    relativePrice.mulDiv(10 ** (DECIMALS + _poolInfo.decimals0 - _poolInfo.decimals1), 1 << 96) :
                    relativePrice.mulDiv(10 ** DECIMALS, (1 << 96) * 10 ** (_poolInfo.decimals1 - _poolInfo.decimals0));
            }
            else {
                // (2 ^ 96 / sqrtX96) ^ 2 * 10 ^ (decimals1 - decimals0) * 10 ^ DECIMALS
                relativePrice = uint256(1 << 96).mulDiv(1 << 96, sqrtPriceX96);
                relativePrice = _poolInfo.decimals1 > _poolInfo.decimals0 ? 
                    relativePrice.mulDiv(10 ** (DECIMALS + _poolInfo.decimals1 - _poolInfo.decimals0), sqrtPriceX96) :
                    relativePrice.mulDiv(10 ** DECIMALS, sqrtPriceX96 * 10 ** (_poolInfo.decimals0 - _poolInfo.decimals1));
            }
            price = price.mulDiv(relativePrice, 10 ** DECIMALS);
        }
    }
}