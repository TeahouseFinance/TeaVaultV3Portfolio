// SPDX-License-Identifier: BUSL-1.1
// Teahouse Finance

pragma solidity =0.8.21;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/MathUpgradeable.sol";
import "@uniswap/v3-periphery/contracts/libraries/LiquidityAmounts.sol";
import "@uniswap/v3-core/contracts/libraries/TickMath.sol";

import "./interface/IAssetOracle.sol";
import "../interface/ITeaVaultV3Pair.sol";

//import "hardhat/console.sol";
contract TeaVaultV3PairOracle is IAssetOracle, Ownable {
    using MathUpgradeable for uint256;

    struct TeaVaultV3PairInfo {
        address token0;
        address token1;
        uint8 decimals;
        uint8 token0Decimals;
        uint8 token1Decimals;
    }

    address immutable public baseAsset;
    IAssetOracle public baseAssetOracle;
    uint8 immutable baseAssetOracleDecimals;
    uint8 private constant DECIMALS = 18;
    mapping (address => TeaVaultV3PairInfo) public teaVaultV3PairInfo;

    constructor(address _baseAsset, IAssetOracle _baseAssetOracle) {
        if (_baseAsset != _baseAssetOracle.getBaseAsset()) revert BaseAssetMismatch();
        baseAsset = _baseAsset;
        baseAssetOracle = _baseAssetOracle;
        baseAssetOracleDecimals = _baseAssetOracle.decimals();
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
        return teaVaultV3PairInfo[_asset].decimals != 0;
    }

    function enableOracle(ITeaVaultV3Pair _teaVaultV3Pair) external onlyOwner {
        address token0 = _teaVaultV3Pair.assetToken0();
        address token1 = _teaVaultV3Pair.assetToken1();
        
        teaVaultV3PairInfo[address(_teaVaultV3Pair)] = TeaVaultV3PairInfo({
            token0: token0,
            token1: token1,
            decimals: ERC20(address(_teaVaultV3Pair)).decimals(),
            token0Decimals: ERC20(token0).decimals(),
            token1Decimals: ERC20(token1).decimals()
        });
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
        return _getTwap(ITeaVaultV3Pair(_asset), teaVaultV3PairInfo[_asset]);
    }

    /// @inheritdoc IAssetOracle
    function getBatchTwap(address[] calldata _assets) external override view returns (uint256[] memory prices) {
        prices = new uint256[](_assets.length);

        for (uint256 i; i < _assets.length; i = i + 1) {
            prices[i] = _getTwap(ITeaVaultV3Pair(_assets[i]), teaVaultV3PairInfo[_assets[i]]);
        }
    }

    function _getValue(address _asset, uint256 _amount) internal view returns (uint256 value) {
        TeaVaultV3PairInfo memory _teaVaultV3PairInfo = teaVaultV3PairInfo[_asset];
        return _amount.mulDiv(
            _getTwap(ITeaVaultV3Pair(_asset), _teaVaultV3PairInfo),
            10 ** (_teaVaultV3PairInfo.decimals)
        );
    }

    function _getValueWithTwap(address _asset, uint256 _amount, uint256 _twap) internal view returns (uint256 value) {
        TeaVaultV3PairInfo memory _teaVaultV3PairInfo = teaVaultV3PairInfo[_asset];
        return _amount.mulDiv(_twap, 10 ** (_teaVaultV3PairInfo.decimals));
    }

    function _getTwap(
        ITeaVaultV3Pair _teaVaultV3Pair,
        TeaVaultV3PairInfo memory _teaVaultV3PairInfo
    ) internal view returns (
        uint256 price
    ) {
        if (address(_teaVaultV3PairInfo.token0) == address(0)) revert AssetNotEnabled();
        IAssetOracle _baseAssetOracle = baseAssetOracle;
        uint256 price0 = _teaVaultV3PairInfo.token0 != baseAsset
            ? _baseAssetOracle.getTwap(_teaVaultV3PairInfo.token0)
            : 10 ** baseAssetOracleDecimals;
        uint256 price1 = _teaVaultV3PairInfo.token1 != baseAsset
            ? _baseAssetOracle.getTwap(_teaVaultV3PairInfo.token1)
            : 10 ** baseAssetOracleDecimals;

        uint160 sqrtPriceX96 = uint160(
            (_sqrt(uint256(price0) * 10 ** _teaVaultV3PairInfo.token1Decimals) << 96) /
            _sqrt(uint256(price1) * 10 ** _teaVaultV3PairInfo.token0Decimals)
        );

        uint256 token0Balance = _teaVaultV3Pair.getToken0Balance();
        uint256 token1Balance = _teaVaultV3Pair.getToken1Balance();

        ITeaVaultV3Pair.Position[] memory allPositions = _teaVaultV3Pair.getAllPositions();
        for (uint256 i; i < allPositions.length; i = i + 1) {
            // calculate token0 and token1 amount of each position based on converted oracle price
            (uint256 amount0, uint256 amount1) = LiquidityAmounts.getAmountsForLiquidity(
                sqrtPriceX96,
                TickMath.getSqrtRatioAtTick(allPositions[i].tickLower),
                TickMath.getSqrtRatioAtTick(allPositions[i].tickUpper),
                allPositions[i].liquidity
            );

            token0Balance = token0Balance + amount0;
            token1Balance = token1Balance + amount1;
        }
        (, , uint256 fee0, uint256 fee1) = _teaVaultV3Pair.allPositionInfo();
        token0Balance = token0Balance + fee0;
        token1Balance = token1Balance + fee1;
        
        // totalValue = sigma(twap * (amount / 10 ^ baseAssetDecimals)) / 10 ^ twapDecimals
        price = token0Balance.mulDiv(price0, 10 ** _teaVaultV3PairInfo.token0Decimals) + 
            token1Balance.mulDiv(price1, 10 ** _teaVaultV3PairInfo.token1Decimals);
        // shareTokenTwap = (totalValue / (shareTotalSupply / 10 ^ shareDecimals)) * 10 ^ DECIMALS
        price = price.mulDiv(
            10 ** (DECIMALS + ERC20(address(_teaVaultV3Pair)).decimals()),
            ERC20(address(_teaVaultV3Pair)).totalSupply() * 10 ** baseAssetOracleDecimals
        );
    }

    // source: v2-core/contracts/libraries/Math.sol
    // babylonian method (https://en.wikipedia.org/wiki/Methods_of_computing_square_roots#Babylonian_method)
    function _sqrt(uint y) internal pure returns (uint z) {
        if (y > 3) {
            z = y;
            uint x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }
}