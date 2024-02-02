// SPDX-License-Identifier: BUSL-1.1
// Teahouse Finance

pragma solidity =0.8.21;

import "@openzeppelin/contracts/access/Ownable.sol";

import "./interface/IAssetOracle.sol";
import "../interface/AAVE/IAToken.sol";

//import "hardhat/console.sol";
contract AaveATokenOracle is IAssetOracle, Ownable {

    address immutable public baseAsset;
    IAssetOracle public baseAssetOracle;
    uint8 private constant DECIMALS = 18;
    mapping (address => address) public underlyingAsset;

    constructor(address _baseAsset, IAssetOracle _baseAssetOracle) {
        if (_baseAsset != _baseAssetOracle.getBaseAsset()) revert BaseAssetMismatch();
        baseAsset = _baseAsset;
        baseAssetOracle = _baseAssetOracle;
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
        return underlyingAsset[_asset] != address(0);
    }

    function enableOracle(IAToken _aaveAToken) external onlyOwner {
        underlyingAsset[address(_aaveAToken)] = _aaveAToken.UNDERLYING_ASSET_ADDRESS();
    }

    /// @inheritdoc IAssetOracle
    function getValue(address _asset, uint256 _amount) external override view returns (uint256 value) {
        return _getValue(baseAssetOracle, _asset, _amount);
    }

    /// @inheritdoc IAssetOracle
    function getBatchValue(
        address[] calldata _assets,
        uint256[] calldata _amounts
    ) external override view returns (
        uint256[] memory values
    ) {
        if (_assets.length != _amounts.length) revert BatchLengthMismatched();
        IAssetOracle _baseAssetOracle = baseAssetOracle;
        values = new uint256[](_assets.length);
        // AUDIT: AAT-01C
        for (uint256 i; i < _assets.length; ) {
            values[i] = _getValue(_baseAssetOracle, _assets[i], _amounts[i]);
            unchecked { i = i + 1; }
        }
    }

    /// @inheritdoc IAssetOracle
    function getValueWithTwap(address _asset, uint256 _amount, uint256 _twap) external override view returns (uint256 value) {
        return _getValueWithTwap(baseAssetOracle, _asset, _amount, _twap);
    }

    /// @inheritdoc IAssetOracle
    function getBatchValueWithTwap(
        address[] calldata _assets,
        uint256[] calldata _amounts,
        uint256[] calldata _twaps
    ) external override view returns (
        uint256[] memory values
    ) {
        // AUDIT: AAT-01M
        if (_assets.length != _amounts.length) revert BatchLengthMismatched();
        if (_assets.length != _twaps.length) revert BatchLengthMismatched();

        IAssetOracle _baseAssetOracle = baseAssetOracle;
        values = new uint256[](_assets.length);

        // AUDIT: AAT-01C
        for (uint256 i; i < _assets.length; ) {
            values[i] = _getValueWithTwap(_baseAssetOracle, _assets[i], _amounts[i], _twaps[i]);
            unchecked { i = i + 1; }
        }
    }

    /// @inheritdoc IAssetOracle
    function getTwap(address _asset) external override view returns (uint256 price) {
        return _getTwap(baseAssetOracle, _asset);
    }

    /// @inheritdoc IAssetOracle
    function getBatchTwap(address[] calldata _assets) external override view returns (uint256[] memory prices) {
        IAssetOracle _baseAssetOracle = baseAssetOracle;
        prices = new uint256[](_assets.length);

        // AUDIT: AAT-01C
        for (uint256 i; i < _assets.length; ) {
            prices[i] = _getTwap(_baseAssetOracle, _assets[i]);
            unchecked { i = i + 1; }
        }
    }

    function _getValue(IAssetOracle _baseAssetOracle, address _asset, uint256 _amount) internal view returns (uint256 value) {
        return _baseAssetOracle.getValue(underlyingAsset[_asset], _amount);
    }

    function _getValueWithTwap(
        IAssetOracle _baseAssetOracle,
        address _asset,
        uint256 _amount,
        uint256 _twap
    ) internal view returns (
        uint256 value
    ) {
        return _baseAssetOracle.getValueWithTwap(underlyingAsset[_asset], _amount, _twap);
    }

    function _getTwap(IAssetOracle _baseAssetOracle, address _asset) internal view returns (uint256 price) {
        return _baseAssetOracle.getTwap(underlyingAsset[_asset]);
    }
}