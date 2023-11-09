// SPDX-License-Identifier: BUSL-1.1
// Teahouse Finance

pragma solidity =0.8.21;

import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";

import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import "@uniswap/v3-core/contracts/libraries/FullMath.sol";

import "./interface/ITeaVaultV3PortfolioHelper.sol";
import "./interface/IWETH9.sol";
import "./interface/AAVE/IPool.sol";

import "./Swapper.sol";

//import "hardhat/console.sol";

contract TeaVaultV3PortfolioHelper is ITeaVaultV3PortfolioHelper, Ownable {

    using SafeERC20 for IERC20;
    using SafeERC20Upgradeable for ERC20Upgradeable;
    using FullMath for uint256;

    IWETH9 immutable public weth9;
    IPool immutable public aavePool;
    Swapper immutable public swapper;
    address private vault;

    constructor(address _weth9, address _aavePool) {
        weth9 = IWETH9(_weth9);
        aavePool = IPool(_aavePool);
        vault = address(0x1);

        swapper = new Swapper();
    }

    receive() external payable onlyInMulticall {
        // allow receiving eth inside multicall
    }

    /// @inheritdoc ITeaVaultV3PortfolioHelper
    function multicall(
        VaultType _vaultType,
        address _vault,
        address[] calldata _tokens,
        uint256[] calldata _amounts,
        bytes[] calldata _data
    ) external payable returns (bytes[] memory results) {
        if (vault != address(0x1)) {
            revert NestedMulticall();
        }

        vault = _vault;

        // transfer tokens from user
        uint256 tokensLength = _tokens.length;
        bool hasWeth9;
        if (_amounts.length != tokensLength) revert InvalidTokenAmounts();
        for (uint256 i; i < tokensLength; i++) {
            if (_amounts[i] > 0) {
                IERC20(_tokens[i]).safeTransferFrom(msg.sender, address(this), _amounts[i]);
            }

            if (_tokens[i] == address(weth9)) {
                hasWeth9 = true;
            }
        }

        // convert msg.value into weth9 if necessary
        if (msg.value > 0) {
            if (hasWeth9) {
                weth9.deposit{ value: msg.value }();
            }
            else {
                // vault does not support weth9, revert
                revert NotWETH9Vault();
            }
        }

        // execute commands
        results = new bytes[](_data.length);
        for (uint256 i = 0; i < _data.length; i++) {
            (bool success, bytes memory returndata) = address(this).delegatecall(_data[i]);
            if (success) {
                results[i] = returndata;
            }
            else {
                revert MulticallFailed(i, returndata);
            }
        }

        // refund all balances
        if (address(this).balance > 0) {
            Address.sendValue(payable(msg.sender), address(this).balance);
        }

        // refund all tokens
        for (uint256 i; i < tokensLength; i++) {
            uint256 balance = IERC20(_tokens[i]).balanceOf(address(this));
            if (balance > 0) {
                IERC20(_tokens[i]).safeTransfer(msg.sender, balance);
            }
        }

        // refund all vault tokens
        if (_vaultType == VaultType.TeaVaultV3Pair) {
            IERC20 token0 = IERC20(ITeaVaultV3Pair(_vault).assetToken0());
            IERC20 token1 = IERC20(ITeaVaultV3Pair(_vault).assetToken1());

            uint256 balance = token0.balanceOf(address(this));
            if (balance > 0) {
                token0.safeTransfer(msg.sender, balance);
            }

            balance = token1.balanceOf(address(this));
            if (balance > 0) {
                token1.safeTransfer(msg.sender, balance);
            }
        }
        else if (_vaultType == VaultType.TeaVaultV3Portfolio) {
            ERC20Upgradeable[] memory vaultTokens = ITeaVaultV3Portfolio(vault).getAssets();
            tokensLength = vaultTokens.length;
            for (uint256 i; i < tokensLength; i++) {
                uint256 balance = vaultTokens[i].balanceOf(address(this));
                if (balance > 0) {
                    vaultTokens[i].safeTransfer(msg.sender, balance);
                }
            }
        }
        else {
            revert InvalidVaultType();
        }

        vault = address(0x1);
    }

    /// @inheritdoc ITeaVaultV3PortfolioHelper
    function deposit(
        uint256 _shares
    ) external payable onlyInMulticall returns (uint256[] memory amounts) {
        ERC20Upgradeable[] memory tokens = ITeaVaultV3Portfolio(vault).getAssets();
        uint256 tokensLength = tokens.length;

        for(uint256 i; i < tokensLength; i++) {
            tokens[i].safeApprove(vault, type(uint256).max);
        }
        amounts = ITeaVaultV3Portfolio(vault).deposit(_shares);

        // since vault is specified by the caller, it's safer to remove all allowances after depositing
        for(uint256 i; i < tokensLength; i++) {
            tokens[i].safeApprove(vault, 0);
        }

        // send the resulting shares to the caller
        IERC20(vault).safeTransfer(msg.sender, _shares);
    }

    /// @inheritdoc ITeaVaultV3PortfolioHelper
    function depositMax() external payable onlyInMulticall returns (uint256 shares, uint256[] memory amounts) {
        ERC20Upgradeable[] memory tokens = ITeaVaultV3Portfolio(vault).getAssets();
        uint256 tokensLength = tokens.length;

        for(uint256 i; i < tokensLength; i++) {
            tokens[i].safeApprove(vault, type(uint256).max);
        }

        // estimate share amount
        uint256[] memory assetAmounts = ITeaVaultV3Portfolio(vault).getAssetsBalance();
        uint256 totalShares = IERC20(vault).totalSupply();
        uint256 halfShares = type(uint256).max;
        for (uint256 i; i < tokensLength; i++) {
            if (assetAmounts[i] > 0) {
                uint256 balance = tokens[i].balanceOf(address(this));
                uint256 sharesForToken = balance.mulDiv(totalShares, assetAmounts[i]);
                if (halfShares > sharesForToken) {
                    halfShares = sharesForToken;
                }
                assetAmounts[i] = balance;
            }
        }

        // simulate depositing half of the shares
        halfShares /= 2;
        amounts = simulateDeposit(halfShares);

        // estimate share amount again
        shares = type(uint256).max;
        for (uint256 i; i < tokensLength; i++) {
            if (amounts[i] > 0) {
                uint256 sharesForToken = assetAmounts[i].mulDiv(halfShares, amounts[i]);
                if (shares > sharesForToken) {
                    shares = sharesForToken;
                }
            }
        }

        amounts = ITeaVaultV3Portfolio(vault).deposit(shares);

        // since vault is specified by the caller, it's safer to remove all allowances after depositing
        for(uint256 i; i < tokensLength; i++) {
            tokens[i].safeApprove(vault, 0);
        }

        // send the resulting shares to the caller
        IERC20(vault).safeTransfer(msg.sender, shares);
    }

    /// @inheritdoc ITeaVaultV3PortfolioHelper
    function withdraw(
        uint256 _shares
    ) external payable onlyInMulticall returns (uint256[] memory amounts) {
        IERC20(vault).safeTransferFrom(msg.sender, address(this), _shares);
        amounts = ITeaVaultV3Portfolio(vault).withdraw(_shares);
    }


    /// @inheritdoc ITeaVaultV3PortfolioHelper
    function depositV3Pair(
        uint256 _shares,
        uint256 _amount0Max,
        uint256 _amount1Max
    ) external payable onlyInMulticall returns (uint256 depositedAmount0, uint256 depositedAmount1) {
        IERC20 token0 = IERC20(ITeaVaultV3Pair(vault).assetToken0());
        IERC20 token1 = IERC20(ITeaVaultV3Pair(vault).assetToken1());        
        token0.safeApprove(vault, type(uint256).max);
        token1.safeApprove(vault, type(uint256).max);
        (depositedAmount0, depositedAmount1) = ITeaVaultV3Pair(vault).deposit(_shares, _amount0Max, _amount1Max);

        // since vault is specified by the caller, it's safer to remove all allowances after depositing
        token0.safeApprove(vault, 0);
        token1.safeApprove(vault, 0);

        // send the resulting shares to the caller
        IERC20(vault).safeTransfer(msg.sender, _shares);
    }

    /// @inheritdoc ITeaVaultV3PortfolioHelper
    function depositV3PairMax(
        uint256 _amount0Max,
        uint256 _amount1Max
    ) external payable onlyInMulticall returns (uint256 shares, uint256 depositedAmount0, uint256 depositedAmount1) {
        IERC20 token0 = IERC20(ITeaVaultV3Pair(vault).assetToken0());
        IERC20 token1 = IERC20(ITeaVaultV3Pair(vault).assetToken1());        
        token0.safeApprove(vault, type(uint256).max);
        token1.safeApprove(vault, type(uint256).max);

        // estimate share amount
        (uint256 amount0, uint256 amount1) = ITeaVaultV3Pair(vault).vaultAllUnderlyingAssets();
        uint256 totalShares = IERC20(vault).totalSupply();
        uint256 balance0 = token0.balanceOf(address(this));
        uint256 balance1 = token1.balanceOf(address(this));
        uint256 shares0 = balance0.mulDiv(totalShares, amount0);
        uint256 shares1 = balance1.mulDiv(totalShares, amount1);
        shares = shares0 > shares1 ? shares1 : shares0;
        // simulate depositing half of the shares
        (uint256 halfAmount0, uint256 halfAmount1) = simulateDepositV3Pair(shares / 2, _amount0Max, _amount1Max);

        // calculate actual share amount and deposit
        shares0 = balance0.mulDiv(shares / 2, halfAmount0);
        shares1 = balance1.mulDiv(shares / 2, halfAmount1);
        shares = shares0 > shares1 ? shares1 : shares0;
        (depositedAmount0, depositedAmount1) = ITeaVaultV3Pair(vault).deposit(shares, _amount0Max, _amount1Max);

        // since vault is specified by the caller, it's safer to remove all allowances after depositing
        token0.safeApprove(vault, 0);
        token1.safeApprove(vault, 0);

        // send the resulting shares to the caller
        IERC20(vault).safeTransfer(msg.sender, shares);
    }

    /// @inheritdoc ITeaVaultV3PortfolioHelper
    function withdrawV3Pair(
        uint256 _shares,
        uint256 _amount0Min,
        uint256 _amount1Min
    ) external payable onlyInMulticall returns (uint256 withdrawnAmount0, uint256 withdrawnAmount1) {
        IERC20(vault).safeTransferFrom(msg.sender, address(this), _shares);
        (withdrawnAmount0, withdrawnAmount1) = ITeaVaultV3Pair(vault).withdraw(_shares, _amount0Min, _amount1Min);
    }

    /// @inheritdoc ITeaVaultV3PortfolioHelper
    function aaveSupply(address _asset, uint256 _amount) external payable onlyInMulticall {
        ERC20Upgradeable(_asset).approve(address(aavePool), _amount);
        aavePool.supply(_asset, _amount, address(this), 0);
    }

    /// @inheritdoc ITeaVaultV3PortfolioHelper
    function aaveWithdraw(address _asset, uint256 _amount) external payable onlyInMulticall returns (uint256 withdrawAmount) {
        withdrawAmount = aavePool.withdraw(_asset, _amount, address(this));
    }

    /// @inheritdoc ITeaVaultV3PortfolioHelper
    function aaveWithdrawMax(address _asset) external payable onlyInMulticall returns (uint256 withdrawAmount) {
        withdrawAmount = aavePool.withdraw(_asset, type(uint256).max, address(this));
    }

    /// @inheritdoc ITeaVaultV3PortfolioHelper
    function v3PairDeposit(
        address _v3pair,
        uint256 _shares,
        uint256 _amount0Max,
        uint256 _amount1Max
    ) external payable onlyInMulticall returns (uint256 depositedAmount0, uint256 depositedAmount1) {
        ITeaVaultV3Pair v3pair = ITeaVaultV3Pair(_v3pair);
        IERC20 token0 = IERC20(v3pair.assetToken0());
        IERC20 token1 = IERC20(v3pair.assetToken1());        
        token0.safeApprove(_v3pair, type(uint256).max);
        token1.safeApprove(_v3pair, type(uint256).max);
        (depositedAmount0, depositedAmount1) = v3pair.deposit(_shares, _amount0Max, _amount1Max);

        // since v3pair is specified by the caller, it's safer to remove all allowances after depositing
        token0.safeApprove(_v3pair, 0);
        token1.safeApprove(_v3pair, 0);
    }

    /// @inheritdoc ITeaVaultV3PortfolioHelper
    function v3PairWithdraw(
        address _v3pair,
        uint256 _shares,
        uint256 _amount0Min,
        uint256 _amount1Min
    ) external payable onlyInMulticall returns (uint256 withdrawnAmount0, uint256 withdrawnAmount1) {
        (withdrawnAmount0, withdrawnAmount1) = ITeaVaultV3Pair(_v3pair).withdraw(_shares, _amount0Min, _amount1Min);
    }

    /// @inheritdoc ITeaVaultV3PortfolioHelper
    function v3PairWithdrawMax(
        address _v3pair
    ) external payable onlyInMulticall returns (uint256 withdrawnAmount0, uint256 withdrawnAmount1) {
        uint256 shares = IERC20(_v3pair).balanceOf(address(this));
        (withdrawnAmount0, withdrawnAmount1) = ITeaVaultV3Pair(_v3pair).withdraw(shares, 0, 0);
    }

    /// @inheritdoc ITeaVaultV3PortfolioHelper
    function swap(
        address _srcToken,
        address _dstToken,
        uint256 _amountInMax,
        uint256 _amountOutMin,
        address _swapRouter,
        bytes calldata _data
    ) external payable onlyInMulticall returns (uint256 convertedAmount) {
        IERC20(_srcToken).safeTransfer(address(swapper), _amountInMax);
        uint256 dstTokenBalanceBefore = IERC20(_dstToken).balanceOf(address(this));
        (bool success, bytes memory result) = address(swapper).call(
            abi.encodeWithSelector(
                Swapper.swap.selector,
                IERC20(_srcToken),
                IERC20(_dstToken),
                _amountInMax,
                _swapRouter,
                _data
            )
        );
        if (!success) revert ExecuteSwapFailed(result);
        uint256 dstTokenBalanceAfter = IERC20(_dstToken).balanceOf(address(this));
        convertedAmount = dstTokenBalanceAfter - dstTokenBalanceBefore;
        if (convertedAmount < _amountOutMin) revert InsufficientSwapResult(_amountOutMin, convertedAmount);
    }

    /// @inheritdoc ITeaVaultV3PortfolioHelper
    function convertWETH() external payable onlyInMulticall {
        uint256 balance = weth9.balanceOf(address(this));
        if (balance > 0) {
            weth9.withdraw(balance);
        }
    }

    /// @inheritdoc ITeaVaultV3PortfolioHelper
    function refundTokens(
        address[] calldata _tokens
    ) external payable onlyInMulticall {
        uint256 tokensLength = _tokens.length;
        for (uint256 i; i < tokensLength; i++) {
            uint256 balance = IERC20(_tokens[i]).balanceOf(address(this));
            if (balance > 0) {
                IERC20(_tokens[i]).safeTransfer(msg.sender, balance);
            }
        }
    }    

    /// @inheritdoc ITeaVaultV3PortfolioHelper
    function rescueEth(uint256 _amount) external onlyOwner {
        Address.sendValue(payable(msg.sender), _amount);
    }

    /// @inheritdoc ITeaVaultV3PortfolioHelper
    function rescueFund(address _token, uint256 _amount) external onlyOwner {
        IERC20(_token).safeTransfer(msg.sender, _amount);
    }

    /// @notice Simulate deposit to TeaVaultV3Portfolio
    /// @param _shares Share amount to be mint
    /// @return amounts Deposited token amounts
    function simulateDeposit(uint256 _shares) internal returns (uint256[] memory amounts) {
        (bool success, bytes memory returndata) = address(this).delegatecall(
            abi.encodeWithSelector(
                this.simulateFunctionCall.selector,
                abi.encodeWithSelector(ITeaVaultV3Portfolio.deposit.selector, _shares)
            )
        );
        
        if (success) {
            // shouldn't happen, revert
            revert();
        }
        else {
            if (returndata.length == 0) {
                // no result, revert
                revert();
            }

            amounts = abi.decode(returndata, (uint256[]));
        }
    }

    /// @notice Simulate deposit to TeaVaultV3Pair
    /// @param _shares Share amount to be mint
    /// @param _amount0Max Max token0 amount to be deposited
    /// @param _amount1Max Max token1 amount to be deposited
    /// @return depositedAmount0 Deposited token0 amount
    /// @return depositedAmount1 Deposited token1 amount
    function simulateDepositV3Pair(uint256 _shares, uint256 _amount0Max, uint256 _amount1Max) internal returns (uint256 depositedAmount0, uint256 depositedAmount1) {
        (bool success, bytes memory returndata) = address(this).delegatecall(
            abi.encodeWithSelector(
                this.simulateFunctionCall.selector,
                abi.encodeWithSelector(ITeaVaultV3Pair.deposit.selector, _shares, _amount0Max, _amount1Max)
            )
        );
        
        if (success) {
            // shouldn't happen, revert
            revert();
        }
        else {
            if (returndata.length == 0) {
                // no result, revert
                revert();
            }

            (depositedAmount0, depositedAmount1) = abi.decode(returndata, (uint256, uint256));
        }
    }

    /// @dev Helper function for simulating function call
    /// @dev This function always revert, so there's no point calling it directly
    function simulateFunctionCall(bytes calldata _data) external payable onlyInMulticall {
        (bool success, bytes memory returndata) = vault.call(_data);
        
        uint256 length = returndata.length;
        if (success && length > 0) {
            assembly ("memory-safe") {
                revert(add(returndata, 32), length)
            }
        }
        else {
            revert();
        }
    }

    // modifiers
    modifier onlyInMulticall() {
        if (vault == address(0x1)) revert OnlyInMulticall();
        _;
    }
}
