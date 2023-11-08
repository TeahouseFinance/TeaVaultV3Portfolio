// SPDX-License-Identifier: BUSL-1.1
// Teahouse Finance

pragma solidity =0.8.21;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeCastUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/MathUpgradeable.sol";
import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import "@uniswap/v3-core/contracts/libraries/TickMath.sol";
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";

import "./UniswapV3PathRecommender.sol";
import "./oracle/interface/IAssetOracle.sol";
import "./interface/ITeaVaultV3Portfolio.sol";
import "./interface/ITeaVaultV3Pair.sol";
import "./interface/AAVE/IAToken.sol";
import "./interface/AAVE/IPool.sol";

//import "hardhat/console.sol";
contract TeaVaultV3Portfolio is
    ITeaVaultV3Portfolio,
    Initializable,
    UUPSUpgradeable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    ERC20Upgradeable
{
    using SafeERC20Upgradeable for ERC20Upgradeable;
    using SafeCastUpgradeable for uint256;
    using MathUpgradeable for uint256;

    uint256 public SECONDS_IN_A_YEAR;
    uint256 public PERCENTAGE_MULTIPLIER;
    uint24 public FEE_CAP;
    uint8 internal DECIMALS;
    
    address public manager;
    FeeConfig public feeConfig;
    ERC20Upgradeable[] public assets;
    mapping (ERC20Upgradeable => AssetType) public assetType;
    IPool public aavePool;
    address public uniswapV3SwapRouter;
    UniswapV3PathRecommender public pathRecommender;
    IAssetOracle public assetOracle;
    IAssetOracle public aaveATokenOracle;
    IAssetOracle public teaVaultV3PairOracle;
    uint256 public lastCollectManagementFee;
    uint256 public lastCollectPerformanceFee;
    uint256 public highWaterMark;
    uint256 public performanceFeeReserve;
    mapping (address => bool) public allowedSwapRouters;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

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
    ) public initializer {
        __UUPSUpgradeable_init();
        __Ownable_init();
        __ReentrancyGuard_init();
        __ERC20_init(_name, _symbol);

        SECONDS_IN_A_YEAR = 365 * 24 * 60 * 60;
        PERCENTAGE_MULTIPLIER = 1000000;
        FEE_CAP = _feeCap;
        DECIMALS = 18;
        _assignManager(_manager);
        _setFeeConfig(_feeConfig);
        aavePool = _aavePool;
        uniswapV3SwapRouter = _uniswapV3SwapRouter;
        pathRecommender = _pathRecommender;

        assetOracle = _assetOracle;
        aaveATokenOracle = _aaveATokenOracle;
        teaVaultV3PairOracle = _teaVaultV3PairOracle;

        _addAsset(_baseAsset, AssetType.Base);
        for (uint256 i; i < _assets.length; i = i + 1) {
            _addAsset(_assets[i], _assetTypes[i]);
        }
        
        if (
            address(_baseAsset) != _assetOracle.getBaseAsset() ||
            address(_baseAsset) != _teaVaultV3PairOracle.getBaseAsset()
        ) revert IAssetOracle.BaseAssetMismatch();

        transferOwnership(_owner);
        emit TeaVaultV3PortCreated(address(this), _name, _symbol);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    function decimals() public override view returns (uint8) {
        return DECIMALS;
    }

    /// @inheritdoc ITeaVaultV3Portfolio
    function getNumberOfAssets() external override view returns (uint256 numAssets) {
        numAssets = assets.length;
    }

    /// @inheritdoc ITeaVaultV3Portfolio
    function addAsset(ERC20Upgradeable _asset, AssetType _assetType) external override onlyOwner {
        _addAsset(_asset, _assetType);
    }

    function _addAsset(ERC20Upgradeable _asset, AssetType _assetType) internal {
        // base asset must be the first to be added
        if (_assetType == AssetType.Null || _assetType >= AssetType.End) revert InvalidAssetType();
        if (_assetType == AssetType.Base && assets.length != 0) revert BaseAssetCannotBeAdded();
        if (assetType[_asset] != AssetType.Null) revert AssetAlreadyAdded();
        if (_assetType == AssetType.Atomic && !assetOracle.isOracleEnabled(address(_asset))) revert OracleNotEnabled();
        if (_assetType == AssetType.AToken && !aaveATokenOracle.isOracleEnabled(address(_asset))) revert OracleNotEnabled();
        if (_assetType == AssetType.TeaVaultV3Pair && !teaVaultV3PairOracle.isOracleEnabled(address(_asset))) revert OracleNotEnabled();
        
        assets.push(_asset);
        assetType[_asset] = _assetType;

        emit AssetAdded(address(_asset), block.timestamp);
    }

    /// @inheritdoc ITeaVaultV3Portfolio
    function removeAsset(uint256 _index) external override onlyOwner {
        if (assets[_index].balanceOf(address(this)) != 0) revert AssetBalanceNotZero();
        if (assetType[assets[_index]] == AssetType.Base) revert BaseAssetCannotBeRemoved();

        ERC20Upgradeable asset = assets[_index];
        assets[_index] = assets[assets.length - 1];
        assets.pop();
        assetType[asset] = AssetType.Null;

        emit AssetRemoved(address(asset), block.timestamp);
    }

    /// @inheritdoc ITeaVaultV3Portfolio
    function setAllowedSwapRouters(address[] calldata _swapRouters, bool[] calldata _enabled) external override onlyOwner {
        uint256 length = _swapRouters.length;
        if (length != _enabled.length) revert InconsistentArrayLengths();

        for (uint256 i; i < length; i++) {
            allowedSwapRouters[_swapRouters[i]] = _enabled[i];
        }
    }

    /// @inheritdoc ITeaVaultV3Portfolio
    function getAssets() external override view returns (ERC20Upgradeable[] memory) {
        return assets;
    }

    function getAssetsBalance() external override view returns (uint256[] memory balances) {
        balances = _calculateTotalAmounts(assets);
    }

    /// @inheritdoc ITeaVaultV3Portfolio
    function assignManager(address _manager) external override onlyOwner {
        _assignManager(_manager);
    }

    function _assignManager(address _manager) internal {
        manager = _manager;

        emit ManagerChanged(_manager, block.timestamp);
    }

    /// @inheritdoc ITeaVaultV3Portfolio
    function setFeeConfig(FeeConfig calldata _feeConfig) external override onlyOwner {
        _setFeeConfig(_feeConfig);
    }

    function _setFeeConfig(FeeConfig calldata _feeConfig) internal {
        if (_feeConfig.vault == address(0)) revert InvalidAddress();
        if (_feeConfig.entryFee + _feeConfig.exitFee > FEE_CAP) revert InvalidFeeRate();
        if (_feeConfig.managementFee > FEE_CAP) revert InvalidFeeRate();
        if (_feeConfig.performanceFee > FEE_CAP) revert InvalidFeeRate();
        if (_feeConfig.decayFactor >= 2 ** 128) revert InvalidFeeRate();

        feeConfig = _feeConfig;

        emit FeeConfigChanged(_feeConfig, block.timestamp);
    }

    function _calculateShareAmounts(
        ERC20Upgradeable[] memory _assets,
        uint256[] memory _totalAmounts,
        uint256 _shares,
        uint256 _totalShares,
        MathUpgradeable.Rounding _rounding
    ) internal view returns (
        uint256[] memory shareAmounts
    ) {
        uint256 assetsLength = _assets.length;
        shareAmounts = new uint256[](assetsLength);

        if (_totalShares == 0) {
            // vault is empty, default to 1:1 share to token0 ratio
            shareAmounts[0] = _shares.ceilDiv(10 ** (DECIMALS - _assets[0].decimals()));
        }
        else {
            for (uint256 i; i < assetsLength; i = i + 1) {
                shareAmounts[i] = _totalAmounts[i].mulDiv(_shares, _totalShares, _rounding);
            }
        }
    }

    function _calculateTotalAmounts(
        ERC20Upgradeable[] memory _assets
    ) internal view returns (
        uint256[] memory totalAmounts
    ) {
        uint256 assetsLength = _assets.length;
        totalAmounts = new uint256[](assetsLength);

        if (totalSupply() != 0) {
            for (uint256 i; i < assetsLength; i = i + 1) {
                totalAmounts[i] = _assets[i].balanceOf(address(this));
            }
        }
    }

    /// @inheritdoc ITeaVaultV3Portfolio
    function deposit(
        uint256 _shares
    ) external override checkShares(_shares) nonReentrant returns (
        uint256[] memory depositedAmounts
    ) {
        uint256 totalShares = totalSupply();
        ERC20Upgradeable[] memory _assets = assets;
        FeeConfig memory _feeConfig = feeConfig;
        depositedAmounts = new uint256[](_assets.length);
        _collectManagementFee(totalShares, _feeConfig);

        uint256[] memory totalAmounts = _calculateTotalAmounts(_assets);
        uint256[] memory twaps = _getAssetsTwap(_assets);
        uint256 totalValue = _calculateAssetsValue(_assets, totalAmounts, twaps);
        _collectPerformanceFee(totalShares, totalValue, _feeConfig);

        uint256[] memory shareAmounts = _calculateShareAmounts(_assets, totalAmounts, _shares, totalSupply(), MathUpgradeable.Rounding.Up);
        uint256 depositedValue = _calculateAssetsValue(_assets, shareAmounts, twaps);
        // initialize timestamp
        // will not reflect possible donations
        if (totalShares == 0) {
            lastCollectPerformanceFee = block.timestamp;
        }

        if (totalValue == 0) {
            highWaterMark = depositedValue;
        }
        else {
            highWaterMark = highWaterMark.mulDiv(totalValue + depositedValue, totalValue);
        }

        uint256 totalAmount;
        bool senderNotVault = msg.sender != _feeConfig.vault;
        uint256 entryFeeAmount;
        uint256[] memory entryFeeAmounts = new uint256[](_assets.length);
        uint256 assetsLength = (totalShares == 0 ? 1 : _assets.length);
        for (uint256 i; i < assetsLength; i = i + 1) {
            if (shareAmounts[i] > 0) {
                _assets[i].safeTransferFrom(msg.sender, address(this), shareAmounts[i]);
                totalAmount = totalAmount + shareAmounts[i];
                
                // collect entry fee for users
                // do not collect entry fee for fee recipient
                if (senderNotVault) {
                    entryFeeAmount = shareAmounts[i].mulDiv(
                        _feeConfig.entryFee,
                        PERCENTAGE_MULTIPLIER,
                        MathUpgradeable.Rounding.Up
                    );

                    if (entryFeeAmount > 0) {
                        totalAmount = totalAmount + entryFeeAmount;
                        _assets[i].safeTransferFrom(msg.sender, _feeConfig.vault, entryFeeAmount);
                        entryFeeAmounts[i] = entryFeeAmount;
                    }
                }
                depositedAmounts[i] = shareAmounts[i] + entryFeeAmount;
            }
        }
        emit EntryFeeCollected(_feeConfig.vault, entryFeeAmounts, block.timestamp);
        // if shares is too low such that no assets is needed, do not mint
        if (totalAmount == 0) revert InvalidShareAmount();
        _mint(msg.sender, _shares);

        emit Deposit(msg.sender, _shares, depositedAmounts, block.timestamp);
    }

    /// @inheritdoc ITeaVaultV3Portfolio
    function withdraw(
        uint256 _shares
    ) external override checkShares(_shares) nonReentrant returns (
        uint256[] memory withdrawnAmounts
    ) {
        if (_shares > balanceOf(msg.sender)) revert InvalidShareAmount();
        uint256 totalShares = totalSupply();
        ERC20Upgradeable[] memory _assets = assets;
        FeeConfig memory _feeConfig = feeConfig;

        _collectManagementFee(totalShares, _feeConfig);
        // collect exit fee in shares
        uint256 collectedShares;
        if (msg.sender != _feeConfig.vault) {
            collectedShares = _shares.mulDiv(_feeConfig.exitFee, PERCENTAGE_MULTIPLIER, MathUpgradeable.Rounding.Up);

            if (collectedShares > 0) {
                _transfer(msg.sender, _feeConfig.vault, collectedShares);
                emit ExitFeeCollected(_feeConfig.vault, collectedShares, block.timestamp);
            }
        }
        _shares = _shares - collectedShares;

        uint256[] memory totalAmounts = _calculateTotalAmounts(_assets);
        uint256[] memory twaps = _getAssetsTwap(_assets);
        uint256 totalValue = _calculateAssetsValue(_assets, totalAmounts, twaps);
        _collectPerformanceFee(totalShares, totalValue, _feeConfig);

        withdrawnAmounts = _calculateShareAmounts(_assets, totalAmounts, _shares, totalSupply(), MathUpgradeable.Rounding.Down);
        uint256 withdrawnValue = _calculateAssetsValue(_assets, totalAmounts, twaps);
        _burn(msg.sender, _shares);

        // totalValue shouldn't be zero
        highWaterMark = highWaterMark.mulDiv(totalValue - withdrawnValue, totalValue);

        uint256 assetsLength = _assets.length;
        for (uint256 i; i < assetsLength; i = i + 1) {
            if (withdrawnAmounts[i] > 0) {
                _assets[i].safeTransfer(msg.sender, withdrawnAmounts[i]);
            }
        }

        emit Withdraw(msg.sender, _shares, withdrawnAmounts, block.timestamp);
    }

    /// @inheritdoc ITeaVaultV3Portfolio
    function collectManagementFee() external override nonReentrant returns (uint256 collectedShares) {
        return _collectManagementFee(totalSupply(), feeConfig);
    }

    function _collectManagementFee(
        uint256 _totalShares,
        FeeConfig memory _feeConfig
    ) internal returns (
        uint256 collectedShares
    ) {
        uint256 timeDiff = block.timestamp - lastCollectManagementFee;
        if (timeDiff > 0) {
            unchecked {
                uint256 feeTimesTimediff = _feeConfig.managementFee * timeDiff;
                uint256 denominator = (
                    PERCENTAGE_MULTIPLIER * SECONDS_IN_A_YEAR > feeTimesTimediff ?
                        PERCENTAGE_MULTIPLIER * SECONDS_IN_A_YEAR - feeTimesTimediff :
                        1
                );
                collectedShares = _totalShares.mulDiv(feeTimesTimediff, denominator, MathUpgradeable.Rounding.Up);
            }

            if (collectedShares > 0) {
                _mint(_feeConfig.vault, collectedShares);
                emit ManagementFeeCollected(_feeConfig.vault, collectedShares, block.timestamp);
            }

            lastCollectManagementFee = block.timestamp;
        }
    }

    /// @inheritdoc ITeaVaultV3Portfolio
    function collectPerformanceFee() external override nonReentrant returns (uint256 collectedShares) {
        ERC20Upgradeable[] memory _assets = assets;

        return _collectPerformanceFee(
            totalSupply(),
            _calculateAssetsValue(_assets, _calculateTotalAmounts(_assets), _getAssetsTwap(_assets)),
            feeConfig
        );
    }

    function _collectPerformanceFee(
        uint256 _totalShares,
        uint256 _totalValue,
        FeeConfig memory _feeConfig
    ) internal returns (
        uint256 collectedShares
    ) {
        // calculate and transfer the unlocked performance fee from the reserve
        uint256 timeDiff = block.timestamp - lastCollectPerformanceFee;
        if (performanceFeeReserve > 0 && timeDiff > 0) {
            collectedShares = performanceFeeReserve.mulDiv(
                (1 << 128) - power128(feeConfig.decayFactor, timeDiff),
                1 << 128,
                MathUpgradeable.Rounding.Up
            );
            if (collectedShares > 0) {
                performanceFeeReserve -= collectedShares;
                _transfer(address(this), feeConfig.vault, collectedShares);
                lastCollectPerformanceFee = block.timestamp;
                emit PerformanceFeeCollected(feeConfig.vault, collectedShares, block.timestamp);
            }
        }

        if (_totalShares != 0) {
            if (_totalValue > highWaterMark) {
                uint256 increasedReserveValue = (_totalValue - highWaterMark).mulDiv(
                    _feeConfig.performanceFee,
                    PERCENTAGE_MULTIPLIER,
                    MathUpgradeable.Rounding.Up
                );
                uint256 increasedReserve = _totalShares.mulDiv(
                    increasedReserveValue,
                    _totalValue - increasedReserveValue,
                    MathUpgradeable.Rounding.Up
                );
                performanceFeeReserve = performanceFeeReserve + increasedReserve;
                _mint(address(this), increasedReserve);
                highWaterMark = _totalValue;
            }
            else {
                uint256 decreasedReserveValue = (highWaterMark - _totalValue).mulDiv(
                    _feeConfig.performanceFee,
                    PERCENTAGE_MULTIPLIER
                );
                uint256 decreasedReserve = _totalShares.mulDiv(
                    decreasedReserveValue,
                    _totalValue + decreasedReserveValue
                );
                decreasedReserve = decreasedReserve > performanceFeeReserve ? performanceFeeReserve : decreasedReserve;
                performanceFeeReserve = performanceFeeReserve - decreasedReserve;
                _burn(address(this), decreasedReserve);
            }
        }
    }

    function _getAssetsTwap(ERC20Upgradeable[] memory _assets) internal view returns (uint256[] memory twaps) {
        IAssetOracle _assetOracle = assetOracle;
        IAssetOracle _aaveATokenOracle = aaveATokenOracle;
        IAssetOracle _teaVaultV3PairOracle = teaVaultV3PairOracle;
        uint256 assetsLength = _assets.length;
        twaps = new uint256[](assetsLength);

        for (uint256 i; i < assetsLength; i = i + 1) {
            if (assetType[_assets[i]] == AssetType.TeaVaultV3Pair) {
                twaps[i] = _teaVaultV3PairOracle.getTwap(address(_assets[i]));
            }
            else if (assetType[_assets[i]] == AssetType.AToken) {
                twaps[i] = _aaveATokenOracle.getTwap(address(_assets[i]));
            }
            else {
                twaps[i] = _assetOracle.getTwap(address(_assets[i]));
            }
        }
    }

    /// @inheritdoc ITeaVaultV3Portfolio
    function calculateValueComposition() external override view returns (uint256[] memory values) {
        return _calculateValueComposition();
    }

    function _calculateValueComposition() internal view returns (uint256[] memory values) {
        ERC20Upgradeable[] memory _assets = assets;

        return _calculateValueComposition(_assets, _calculateTotalAmounts(_assets), _getAssetsTwap(_assets));
    }

    function _calculateValueComposition(
        ERC20Upgradeable[] memory _assets,
        uint256[] memory _balances,
        uint256[] memory _twaps
    ) internal view returns (uint256[] memory values) {
        IAssetOracle _assetOracle = assetOracle;
        IAssetOracle _aaveATokenOracle = aaveATokenOracle;
        IAssetOracle _teaVaultV3PairOracle = teaVaultV3PairOracle;
        uint256 assetsLength = _assets.length;
        values = new uint256[](assetsLength);

        for (uint256 i; i < assetsLength; i = i + 1) {
            if (assetType[_assets[i]] == AssetType.TeaVaultV3Pair) {
                values[i] = _teaVaultV3PairOracle.getValueWithTwap(address(_assets[i]), _balances[i], _twaps[i]);
            }
            else if (assetType[_assets[i]] == AssetType.AToken) {
                values[i] = _aaveATokenOracle.getValueWithTwap(address(_assets[i]), _balances[i], _twaps[i]);
            }
            else {
                values[i] = _assetOracle.getValueWithTwap(address(_assets[i]), _balances[i], _twaps[i]);
            }
        }
    }

    /// @inheritdoc ITeaVaultV3Portfolio
    function calculateTotalValue() external override view returns (uint256 totalValue) {
        uint256 totalShares = totalSupply();
        if (totalShares == 0) {
            return 0;
        }

        uint256[] memory values = _calculateValueComposition();
        for (uint256 i; i < values.length; i = i + 1) {
            totalValue = totalValue + values[i];
        }
    }

    function _calculateAssetsValue(
        ERC20Upgradeable[] memory _assets,
        uint256[] memory _balances,
        uint256[] memory _twaps
    ) internal view returns (uint256 value) {
        uint256[] memory values = _calculateValueComposition(_assets, _balances, _twaps);
        for (uint256 i; i < values.length; i = i + 1) {
            value = value + values[i];
        }   
    }

    /// @inheritdoc ITeaVaultV3Portfolio
    function aaveSupply(address _asset, uint256 _amount) external override onlyManager nonReentrant {
        if (assetType[ERC20Upgradeable(_asset)] != AssetType.AToken) revert InvalidAssetType();

        IPool _aavePool = aavePool;
        address underlyingAsset = IAToken(_asset).UNDERLYING_ASSET_ADDRESS();
        ERC20Upgradeable(underlyingAsset).approve(address(_aavePool), _amount);
        _aavePool.supply(underlyingAsset, _amount, address(this), 0);
    }

    /// @inheritdoc ITeaVaultV3Portfolio
    function aaveWithdraw(
        address _asset,
        uint256 _amount
    ) external override onlyManager nonReentrant returns (
        uint256 withdrawAmount
    ) {
        if (assetType[ERC20Upgradeable(_asset)] != AssetType.AToken) revert InvalidAssetType();

        address underlyingAsset = IAToken(_asset).UNDERLYING_ASSET_ADDRESS();
        withdrawAmount = aavePool.withdraw(underlyingAsset, _amount, address(this));
    }

    /// @inheritdoc ITeaVaultV3Portfolio
    function v3PairDeposit(
        address _asset,
        uint256 _shares,
        uint256 _amount0Max,
        uint256 _amount1Max
    ) external override onlyManager nonReentrant returns (
        uint256 depositedAmount0,
        uint256 depositedAmount1
    ) {
        if (assetType[ERC20Upgradeable(_asset)] != AssetType.TeaVaultV3Pair) revert InvalidAssetType();

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

    /// @inheritdoc ITeaVaultV3Portfolio
    function v3PairWithdraw(
        address _asset,
        uint256 _shares,
        uint256 _amount0Min,
        uint256 _amount1Min
    ) external override onlyManager nonReentrant returns (
        uint256 withdrawnAmount0,
        uint256 withdrawnAmount1
    ) {
        if (assetType[ERC20Upgradeable(_asset)] != AssetType.TeaVaultV3Pair) revert InvalidAssetType();

        (
            withdrawnAmount0,
            withdrawnAmount1
        ) = ITeaVaultV3Pair(_asset).withdraw(_shares, _amount0Min, _amount1Min);
    }

    /// @inheritdoc ITeaVaultV3Portfolio
    function uniswapV3SwapViaSwapRouter(
        bool _isExactInput,
        address[] calldata _tokens,
        uint24[] calldata _fees,
        uint256 _deadline,
        uint256 _amountInOrOut,
        uint256 _amountOutOrInTolerance
    ) external override onlyManager nonReentrant returns (
        uint256 amountOutOrIn
    ) {
        address srcToken = _tokens[0];
        address dstToken = _tokens[_tokens.length - 1];
        bytes memory recommendedPath =_checkAndGetRecommendedPath(_isExactInput, srcToken, dstToken);
        address _uniswapV3SwapRouter = uniswapV3SwapRouter;
        uint256 simulatedAmount = simulateSwapViaV3Router(
            _uniswapV3SwapRouter, _isExactInput, srcToken, recommendedPath, _amountInOrOut
        );

        bytes memory path = abi.encodePacked(_isExactInput ? srcToken : dstToken);
        uint256 feesLength = _fees.length;
        for (uint256 i; i < feesLength; i = i + 1) {
            path = bytes.concat(
                path,
                _isExactInput ? 
                    abi.encodePacked(_fees[i], _tokens[i + 1]) : 
                    abi.encodePacked(_fees[feesLength - i - 1], _tokens[feesLength - i - 1])
            );
        }

        ERC20Upgradeable(srcToken).approve(_uniswapV3SwapRouter, type(uint256).max);
        if (_isExactInput) {
            if (simulatedAmount > _amountOutOrInTolerance) {
                _amountOutOrInTolerance = simulatedAmount;
            }
            ISwapRouter.ExactInputParams memory params = ISwapRouter.ExactInputParams({
                path: path,
                recipient: address(this),
                deadline: _deadline,
                amountIn: _amountInOrOut,
                amountOutMinimum: _amountOutOrInTolerance
            });
            amountOutOrIn = ISwapRouter(_uniswapV3SwapRouter).exactInput(params);
            emit Swap(msg.sender, srcToken, dstToken, _uniswapV3SwapRouter, _amountInOrOut, amountOutOrIn, block.timestamp);
        }
        else {
            if (simulatedAmount < _amountOutOrInTolerance) {
                _amountOutOrInTolerance = simulatedAmount;
            }
            ISwapRouter.ExactOutputParams memory params = ISwapRouter.ExactOutputParams({
                path: path,
                recipient: address(this),
                deadline: _deadline,
                amountOut: _amountInOrOut,
                amountInMaximum: _amountOutOrInTolerance
            });
            amountOutOrIn = ISwapRouter(_uniswapV3SwapRouter).exactOutput(params);
            emit Swap(msg.sender, srcToken, dstToken, _uniswapV3SwapRouter, amountOutOrIn, _amountInOrOut, block.timestamp);
        }
        ERC20Upgradeable(srcToken).approve(_uniswapV3SwapRouter, 0);
    }

    /// @inheritdoc ITeaVaultV3Portfolio
    function executeSwap(
        address _srcToken,
        address _dstToken,
        uint256 _inputAmount,
        address _swapRouter,
        bytes calldata _data
    ) external override onlyManager nonReentrant returns (
        uint256 convertedAmount
    ) {
        if (allowedSwapRouters[_swapRouter] != true) revert NotAllowedSwapRouter();
        bytes memory recommendedPath = _checkAndGetRecommendedPath(true, _srcToken, _dstToken);
        uint256 minAmount = simulateSwapViaV3Router(uniswapV3SwapRouter, true, _srcToken, recommendedPath, _inputAmount);
        
        ERC20Upgradeable(_srcToken).approve(_swapRouter, _inputAmount);
        uint256 dstTokenBalanceBefore = ERC20Upgradeable(_dstToken).balanceOf(address(this));
        
        (bool success, bytes memory result) = _swapRouter.call(_data);
        if (!success) revert ExecuteSwapFailed(result);
        uint256 dstTokenBalanceAfter = ERC20Upgradeable(_dstToken).balanceOf(address(this));
        convertedAmount = dstTokenBalanceAfter - dstTokenBalanceBefore;
        if (convertedAmount < minAmount) revert InsufficientSwapResult(minAmount, convertedAmount);
        ERC20Upgradeable(_srcToken).approve(_swapRouter, 0);

        emit Swap(msg.sender, _srcToken, _dstToken, _swapRouter, _inputAmount, convertedAmount, block.timestamp);
    }

    /// @notice Simulate exact input swap through uniswap v3 swap router
    /// @param _uniswapV3SwapRouter Uniswap V3 SwapRouter address
    /// @param _isExactInput Swap mode is exactInput or not
    /// @param _srcToken Swap source token
    /// @param _path Swap path
    /// @param _amountInOrOut Amount input/output for exactInput/exactOutput swap
    function simulateSwapViaV3Router(
        address _uniswapV3SwapRouter,
        bool _isExactInput,
        address _srcToken,
        bytes memory _path,
        uint256 _amountInOrOut
    ) internal returns (uint256 amountOutOrIn) {
        uint256 UINT256_MAX = type(uint256).max;
        ERC20Upgradeable(_srcToken).approve(_uniswapV3SwapRouter, UINT256_MAX);
        
        SwapRouterGenericParams memory params = SwapRouterGenericParams({
            path: _path,
            recipient: address(this),
            deadline: UINT256_MAX,
            amountInOrOut: _amountInOrOut,
            amountOutOrInTolerance: _isExactInput ? 0 : UINT256_MAX
        });

        (bool success, bytes memory returndata) = address(this).delegatecall(
            // 0xc04b8d59: bytes4(keccak256( "exactInput((bytes,address,uint256,uint256,uint256))" ))
            // 0xf28c0498: bytes4(keccak256( "exactOutput((bytes,address,uint256,uint256,uint256))" ))
            abi.encodeWithSelector(
                TeaVaultV3Portfolio.simulateSwapViaV3RouterInternal.selector,
                bytes4(uint32(_isExactInput ? 0xc04b8d59 : 0xf28c0498)),
                _uniswapV3SwapRouter,
                params
            )
        );
        
        if (success) {
            // shouldn't happen, revert
            revert();
        }
        else {
            if (returndata.length == 0) {
                // no result, revert
                revert SimulationError();
            }
            amountOutOrIn = abi.decode(returndata, (uint256));
        }
        ERC20Upgradeable(_srcToken).approve(_uniswapV3SwapRouter, 0);
    }

    /// @dev Helper function for simulating exact input swap
    /// @dev This function always revert, so there's no point calling it directly
    function simulateSwapViaV3RouterInternal(
        bytes4 _selector,
        address _uniswapV3SwapRouter,
        SwapRouterGenericParams memory _params
    ) external onlyManager {
        (bool success, bytes memory returndata) = _uniswapV3SwapRouter.call(abi.encodeWithSelector(_selector, _params));

        if (success) {
            assembly ("memory-safe") {
                revert(add(returndata, 32), 32)
            }
        }
        else {
            revert();
        }
    }
    
    function _checkAndGetRecommendedPath(
        bool _isExactInput,
        address _srcToken,
        address _dstToken
    ) internal view returns (bytes memory recommendedPath) {
        recommendedPath = pathRecommender.getRecommendedPath(_isExactInput, _srcToken, _dstToken);
        if (recommendedPath.length == 0 ||
            assetType[ERC20Upgradeable(_srcToken)] == AssetType.Null ||
            assetType[ERC20Upgradeable(_dstToken)] == AssetType.Null) {
            revert InvalidSwapTokens();
        }
    }

    /// @notice Calculate base ** exp where base is a 128 bits fixed point number (i.e. 1 << 128 means 1).
    /// @notice This function assumes base < (1 << 128), but does not verify to save gas.
    /// @notice Caller is responsible for making sure that base is within range.
    function power128(uint256 base, uint256 exp) internal pure returns (uint256 result) {
        result = 1 << 128;

        unchecked {
            while(exp > 0) {
                if ((exp & 1) == 1) {
                    result *= base;
                    result >>= 128;
                }

                exp >>= 1;
                base *= base;
                base >>= 128;
            }
        }

        return result;
    }

    // modifiers

    /**
     * @dev Throws if called by any account other than the manager.
     */
    modifier onlyManager() {
        if (msg.sender != manager) revert CallerIsNotManager();
        _;
    }

    /**
     * @dev Throws if _shares is zero.
     */
    modifier checkShares(uint256 _shares) {
        if (_shares == 0) revert InvalidShareAmount();
        _;
    }

    uint256[35] private __gap;
}