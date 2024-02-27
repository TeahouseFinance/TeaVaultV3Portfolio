// SPDX-License-Identifier: BUSL-1.1
// Teahouse Finance

pragma solidity =0.8.21;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";

import "../interface/ITeaVaultV3Pair.sol";
import "../interface/AAVE/IAToken.sol";
import "../interface/AAVE/IPool.sol";

library AssetsHelper {

    function aaveSupply(IPool _aavePool, address _asset, uint256 _amount) external {
        address underlyingAsset = IAToken(_asset).UNDERLYING_ASSET_ADDRESS();
        ERC20Upgradeable(underlyingAsset).approve(address(_aavePool), _amount);
        _aavePool.supply(underlyingAsset, _amount, address(this), 0);
    }

    function aaveWithdraw(
        IPool _aavePool,
        address _asset,
        uint256 _amount
    ) external returns (
        uint256 withdrawAmount
    ) {
        address underlyingAsset = IAToken(_asset).UNDERLYING_ASSET_ADDRESS();
        withdrawAmount = _aavePool.withdraw(underlyingAsset, _amount, address(this));
    }

    function v3PairDeposit(
        address _asset,
        uint256 _shares,
        uint256 _amount0Max,
        uint256 _amount1Max
    ) external returns (
        uint256 depositedAmount0,
        uint256 depositedAmount1
    ) {
        uint256 UINT256_MAX = type(uint256).max;
        ITeaVaultV3Pair compositeAsset = ITeaVaultV3Pair(_asset);
        ERC20Upgradeable token0 = ERC20Upgradeable(compositeAsset.assetToken0());
        ERC20Upgradeable token1 = ERC20Upgradeable(compositeAsset.assetToken1());

        token0.approve(address(compositeAsset), UINT256_MAX);
        token1.approve(address(compositeAsset), UINT256_MAX);
        (
            depositedAmount0,
            depositedAmount1
        ) = ITeaVaultV3Pair(_asset).deposit(_shares, _amount0Max, _amount1Max);
        token0.approve(address(compositeAsset), 0);
        token1.approve(address(compositeAsset), 0);
    }

    function v3PairWithdraw(
        address _asset,
        uint256 _shares,
        uint256 _amount0Min,
        uint256 _amount1Min
    ) external returns (
        uint256 withdrawnAmount0,
        uint256 withdrawnAmount1
    ) {
        (
            withdrawnAmount0,
            withdrawnAmount1
        ) = ITeaVaultV3Pair(_asset).withdraw(_shares, _amount0Min, _amount1Min);
    }

    function calculateSwapPath(
        bool _isExactInput,
        address[] calldata _tokens,
        uint24[] calldata _fees
    ) external pure returns (
        bytes memory path
    ) {
        address srcToken = _tokens[0];
        address dstToken = _tokens[_tokens.length - 1];
        path = abi.encodePacked(_isExactInput ? srcToken : dstToken);
        uint256 feesLength = _fees.length;
        for (uint256 i; i < feesLength; ) {
            path = bytes.concat(
                path,
                _isExactInput ? 
                    abi.encodePacked(_fees[i], _tokens[i + 1]) : 
                    abi.encodePacked(_fees[feesLength - i - 1], _tokens[feesLength - i - 1])
            );
            unchecked { i = i + 1; }
        }
    }
}
