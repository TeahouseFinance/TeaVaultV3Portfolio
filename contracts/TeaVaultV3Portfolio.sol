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

import "./library/AssetsHelper.sol";

import "./Swapper.sol";

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
    // AUDIT: TVV-08C
    uint256 constant public SECONDS_IN_A_YEAR = 365 * 24 * 60 * 60;
    uint256 constant public PERCENTAGE_MULTIPLIER = 100_0000;      // AUDIT: TVV-01S
    uint256 constant private DECAY_FACTOR_100_PERCENT = 1 << 128; // AUDIT: TVV-13C
    uint8 constant internal DECIMALS = 18;
    uint24 public FEE_CAP;

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
    Swapper public swapper;

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
        Swapper _swapper,
        address _owner
    ) public initializer {
        __UUPSUpgradeable_init();
        __Ownable_init();
        __ReentrancyGuard_init();
        __ERC20_init(_name, _symbol);
  
        FEE_CAP = _feeCap;
        _assignManager(_manager);
        _setFeeConfig(_feeConfig);
        aavePool = _aavePool;
        uniswapV3SwapRouter = _uniswapV3SwapRouter;
        pathRecommender = _pathRecommender;

        assetOracle = _assetOracle;
        aaveATokenOracle = _aaveATokenOracle;
        teaVaultV3PairOracle = _teaVaultV3PairOracle;
        swapper = _swapper;

        // AUDIT: TVV-02S
        if (_uniswapV3SwapRouter == address(0)) revert InvalidAddress();
        if (address(_pathRecommender) == address(0)) revert InvalidAddress();
        if (address(_assetOracle) == address(0)) revert InvalidAddress();
        if (address(_swapper) == address(0)) revert InvalidAddress();

        _addAsset(_baseAsset, AssetType.Base);
        for (uint256 i; i < _assets.length; ) {
            _addAsset(_assets[i], _assetTypes[i]);
            // AUDIT: TVV-10C
            unchecked { i = i + 1; }
        }
        // AUDIT: TVV-05M
        if (
            address(_baseAsset) != _assetOracle.getBaseAsset() ||
            address(_baseAsset) != _aaveATokenOracle.getBaseAsset() ||
            address(_baseAsset) != _teaVaultV3PairOracle.getBaseAsset()
        ) revert IAssetOracle.BaseAssetMismatch();
        // AUDIT: TVV-05C
        _transferOwnership(_owner);
        emit TeaVaultV3PortCreated(address(this), _name, _symbol);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    function decimals() public override pure returns (uint8) {
        return DECIMALS;
    }

    /// @inheritdoc ITeaVaultV3Portfolio
    function getNumberOfAssets() external override view returns (uint256 numAssets) {
        numAssets = assets.length;
    }

    /// @inheritdoc ITeaVaultV3Portfolio
    function addAsset(ERC20Upgradeable _asset, AssetType _assetType) external override nonReentrant onlyOwner {
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
    function removeAsset(uint256 _index) external override nonReentrant onlyOwner {
        ERC20Upgradeable _assetToken = assets[_index];
        uint256 _balance = _assetToken.balanceOf(address(this));
        if (_balance > 0) {
            // still has remaining balance, try to withdraw
            if (assetType[_assetToken] == AssetType.TeaVaultV3Pair) {
                ITeaVaultV3Pair _v3Pair = ITeaVaultV3Pair(address(_assetToken));
                _v3Pair.withdraw(_balance, 0, 0);
            }
            else if (assetType[_assetToken] == AssetType.AToken) {
                IAToken _aToken = IAToken(address(_assetToken));
                address _underlyingToken = _aToken.UNDERLYING_ASSET_ADDRESS();
                aavePool.withdraw(_underlyingToken, _balance, address(this));
            }
        }

        _removeAsset(_index);
    }

    /// @inheritdoc ITeaVaultV3Portfolio
    function swapAndRemoveAsset( // AUDIT: TVV-06M
        uint256 _index,
        address _dstToken,
        bytes calldata _path,
        uint256 _deadline,
        uint256 _amountOutTolerance
    ) external override nonReentrant onlyOwner returns (
        uint256 convertedAmount
    ) {
        IERC20Upgradeable _srcToken = assets[_index];
        uint256 _inputAmount = _srcToken.balanceOf(address(this));
        convertedAmount = _uniswapV3SwapViaSwapRouter(
            true,
            address(_srcToken),
            _dstToken,
            _path,
            _deadline,
            _inputAmount,
            _amountOutTolerance
        );
        _removeAsset(_index);
    }

    function _removeAsset(uint256 _index) internal {
        if (assets[_index].balanceOf(address(this)) != 0) revert AssetBalanceNotZero();
        if (assetType[assets[_index]] == AssetType.Base) revert BaseAssetCannotBeRemoved();

        ERC20Upgradeable asset = assets[_index];
        // AUDIT: TVV-07C
        if (_index != assets.length - 1) {
            assets[_index] = assets[assets.length - 1];
        }
        assets.pop();
        assetType[asset] = AssetType.Null;

        emit AssetRemoved(address(asset), block.timestamp);
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
    function setFeeConfig(FeeConfig calldata _feeConfig) external override nonReentrant onlyOwner {
        // collecting management and performance fee based on previous config first
        // to prevent incorrect amount of fee collection after setting new config
        FeeConfig memory _feeConfigCache = feeConfig;
        _collectManagementFee(totalSupply(), _feeConfigCache);
        ERC20Upgradeable[] memory _assets = assets;
        uint256 totalValue = _calculateAssetsValue(assets, _calculateTotalAmounts(_assets), _getAssetsTwap(_assets));
        _collectPerformanceFee(totalSupply(), totalValue, _feeConfigCache);

        _setFeeConfig(_feeConfig);
    }

    function _setFeeConfig(FeeConfig calldata _feeConfig) internal {
        if (_feeConfig.vault == address(0)) revert InvalidAddress();
        if (_feeConfig.entryFee + _feeConfig.exitFee > FEE_CAP) revert InvalidFeeRate();
        if (_feeConfig.managementFee > FEE_CAP) revert InvalidFeeRate();
        if (_feeConfig.performanceFee > FEE_CAP) revert InvalidFeeRate();
        if (_feeConfig.decayFactor >= DECAY_FACTOR_100_PERCENT) revert InvalidFeeRate();

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
            for (uint256 i; i < assetsLength; ) {
                shareAmounts[i] = _totalAmounts[i].mulDiv(_shares, _totalShares, _rounding);
                unchecked { i = i + 1; }
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
            for (uint256 i; i < assetsLength; ) {
                totalAmounts[i] = _assets[i].balanceOf(address(this));
                unchecked { i = i + 1; }
            }
        }
    }

    /// @inheritdoc ITeaVaultV3Portfolio
    function previewDeposit(
        uint256 _shares
    ) external override view checkShares(_shares) returns (
        uint256[] memory depositedAmounts
    ) {
        uint256 totalShares = totalSupply();
        ERC20Upgradeable[] memory _assets = assets;
        FeeConfig memory _feeConfig = feeConfig;
        depositedAmounts = new uint256[](_assets.length);
        uint256 collectedShares = _previewManagementFee(totalShares, _feeConfig);
        totalShares += collectedShares;

        uint256[] memory totalAmounts = _calculateTotalAmounts(_assets);
        uint256[] memory twaps = _getAssetsTwap(_assets);
        uint256 totalValue = _calculateAssetsValue(_assets, totalAmounts, twaps);
        (uint256 increasedReserve, uint256 decreasedReserve) = _previewPerformanceFee(totalShares, totalValue, _feeConfig);

        totalShares = totalShares + increasedReserve - decreasedReserve;
        uint256[] memory shareAmounts = _calculateShareAmounts(_assets, totalAmounts, _shares, totalShares, MathUpgradeable.Rounding.Up);

        bool nonZeroAmount;
        bool senderNotVault = msg.sender != _feeConfig.vault;
        uint256 entryFeeAmount;
        uint256 assetsLength = (totalShares == 0 ? 1 : _assets.length);
        for (uint256 i; i < assetsLength; ) {
            if (shareAmounts[i] > 0) {
                nonZeroAmount = true;
                
                // collect entry fee for users
                // do not collect entry fee for fee recipient
                if (senderNotVault) {
                    entryFeeAmount = shareAmounts[i].mulDiv(
                        _feeConfig.entryFee,
                        PERCENTAGE_MULTIPLIER,
                        MathUpgradeable.Rounding.Up
                    );
                }

                depositedAmounts[i] = shareAmounts[i] + entryFeeAmount;
            }
            unchecked { i = i + 1; }
        }

        // if shares is too low such that no assets is needed, do not mint
        if (!nonZeroAmount) revert InvalidShareAmount();
    }

    /// @inheritdoc ITeaVaultV3Portfolio
    function deposit(
        uint256 _shares
    ) external override checkShares(_shares) nonReentrant returns (
        uint256[] memory depositedAmounts
    ) {
        ERC20Upgradeable[] memory _assets = assets;
        FeeConfig memory _feeConfig = feeConfig;
        depositedAmounts = new uint256[](_assets.length);
        _collectManagementFee(totalSupply(), _feeConfig);

        uint256[] memory totalAmounts = _calculateTotalAmounts(_assets);
        uint256[] memory twaps = _getAssetsTwap(_assets);
        uint256 totalValue = _calculateAssetsValue(_assets, totalAmounts, twaps);
        _collectPerformanceFee(totalSupply(), totalValue, _feeConfig);

        uint256 totalShares = totalSupply();
        uint256[] memory shareAmounts = _calculateShareAmounts(_assets, totalAmounts, _shares, totalShares, MathUpgradeable.Rounding.Up);
        uint256 depositedValue = _calculateAssetsValue(_assets, shareAmounts, twaps);
        // initialize timestamp
        // will not reflect possible donations
        if (totalShares == 0) {
            lastCollectPerformanceFee = block.timestamp;
        }
        // AUDIT: TVV-07M
        highWaterMark = highWaterMark == 0 ? 
            depositedValue :
            highWaterMark.mulDiv(totalValue + depositedValue, totalValue);
        // AUDIT: TVV-12C
        bool nonZeroAmount;
        bool senderNotVault = msg.sender != _feeConfig.vault;
        uint256 entryFeeAmount;
        uint256[] memory entryFeeAmounts = new uint256[](_assets.length);
        uint256 assetsLength = (totalShares == 0 ? 1 : _assets.length);
        for (uint256 i; i < assetsLength; ) {
            if (shareAmounts[i] > 0) {
                _assets[i].safeTransferFrom(msg.sender, address(this), shareAmounts[i]);
                nonZeroAmount = true;
                
                // collect entry fee for users
                // do not collect entry fee for fee recipient
                if (senderNotVault) {
                    entryFeeAmount = shareAmounts[i].mulDiv(
                        _feeConfig.entryFee,
                        PERCENTAGE_MULTIPLIER,
                        MathUpgradeable.Rounding.Up
                    );

                    if (entryFeeAmount > 0) {
                        _assets[i].safeTransferFrom(msg.sender, _feeConfig.vault, entryFeeAmount);
                        entryFeeAmounts[i] = entryFeeAmount;
                    }
                }
                depositedAmounts[i] = shareAmounts[i] + entryFeeAmount;
            }
            unchecked { i = i + 1; }
        }
        if (senderNotVault) {
            // AUDIT: TVV-02C
            emit EntryFeeCollected(_feeConfig.vault, entryFeeAmounts, block.timestamp);
        }
        // if shares is too low such that no assets is needed, do not mint
        if (!nonZeroAmount) revert InvalidShareAmount();
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
        ERC20Upgradeable[] memory _assets = assets;
        FeeConfig memory _feeConfig = feeConfig;

        _collectManagementFee(totalSupply(), _feeConfig);
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
        _collectPerformanceFee(totalSupply(), totalValue, _feeConfig);

        withdrawnAmounts = _calculateShareAmounts(_assets, totalAmounts, _shares, totalSupply(), MathUpgradeable.Rounding.Down);
        uint256 withdrawnValue = _calculateAssetsValue(_assets, totalAmounts, twaps);
        _burn(msg.sender, _shares);

        // totalValue shouldn't be zero
        highWaterMark = highWaterMark.mulDiv(totalValue - withdrawnValue, totalValue);

        uint256 assetsLength = _assets.length;
        for (uint256 i; i < assetsLength; ) {
            if (withdrawnAmounts[i] > 0) {
                _assets[i].safeTransfer(msg.sender, withdrawnAmounts[i]);
            }
            unchecked { i = i + 1; }
        }

        emit Withdraw(msg.sender, _shares, withdrawnAmounts, block.timestamp);
    }

    /// @inheritdoc ITeaVaultV3Portfolio
    function collectManagementFee() external override nonReentrant returns (uint256 collectedShares) {
        return _collectManagementFee(totalSupply(), feeConfig);
    }

    function _previewManagementFee(
        uint256 _totalShares,
        FeeConfig memory _feeConfig
    ) internal view returns (
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
        }
    }

    function _collectManagementFee(
        uint256 _totalShares,
        FeeConfig memory _feeConfig
    ) internal returns (
        uint256 collectedShares
    ) {
        collectedShares = _previewManagementFee(_totalShares, _feeConfig);
        if (collectedShares > 0) {
            _mint(_feeConfig.vault, collectedShares);
            emit ManagementFeeCollected(_feeConfig.vault, collectedShares, block.timestamp);
        }

        lastCollectManagementFee = block.timestamp;
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

    function _previewPerformanceFee(
        uint256 _totalShares,
        uint256 _totalValue,
        FeeConfig memory _feeConfig
    ) internal view returns (
        uint256 increasedReserve,
        uint256 decreasedReserve
    ) {
        if (_totalShares != 0) {
            if (_totalValue > highWaterMark) {
                uint256 increasedReserveValue = (_totalValue - highWaterMark).mulDiv(
                    _feeConfig.performanceFee,
                    PERCENTAGE_MULTIPLIER,
                    MathUpgradeable.Rounding.Up
                );
                increasedReserve = _totalShares.mulDiv(
                    increasedReserveValue,
                    _totalValue - increasedReserveValue,
                    MathUpgradeable.Rounding.Up
                );
            }
            else {
                uint256 decreasedReserveValue = (highWaterMark - _totalValue).mulDiv(
                    _feeConfig.performanceFee,
                    PERCENTAGE_MULTIPLIER
                );
                decreasedReserve = _totalShares.mulDiv(
                    decreasedReserveValue,
                    _totalValue + decreasedReserveValue
                );
                decreasedReserve = MathUpgradeable.min(decreasedReserve, performanceFeeReserve);
            }
        }
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
                DECAY_FACTOR_100_PERCENT - _power128(feeConfig.decayFactor, timeDiff),
                DECAY_FACTOR_100_PERCENT,
                MathUpgradeable.Rounding.Up
            );
            if (collectedShares > 0) {
                performanceFeeReserve -= collectedShares;
                _transfer(address(this), feeConfig.vault, collectedShares);
                emit PerformanceFeeCollected(feeConfig.vault, collectedShares, block.timestamp);
            }
            lastCollectPerformanceFee = block.timestamp; // AUDIT: TVV-02M
        }

        // adjust reserved performance fee according to _totalValue and highWaterMark
        (uint256 increasedReserve, uint256 decreasedReserve) = _previewPerformanceFee(_totalShares, _totalValue, _feeConfig);
        if (increasedReserve > 0) {
            performanceFeeReserve = performanceFeeReserve + increasedReserve;
            _mint(address(this), increasedReserve);
            highWaterMark = _totalValue;
        }
        else if (decreasedReserve > 0) {
            performanceFeeReserve = performanceFeeReserve - decreasedReserve;
            _burn(address(this), decreasedReserve);
        }
    }

    function _getAssetsTwap(ERC20Upgradeable[] memory _assets) internal view returns (uint256[] memory twaps) {
        IAssetOracle _assetOracle = assetOracle;
        IAssetOracle _aaveATokenOracle = aaveATokenOracle;
        IAssetOracle _teaVaultV3PairOracle = teaVaultV3PairOracle;
        uint256 assetsLength = _assets.length;
        twaps = new uint256[](assetsLength);

        for (uint256 i; i < assetsLength; ) {
            if (assetType[_assets[i]] == AssetType.TeaVaultV3Pair) {
                twaps[i] = _teaVaultV3PairOracle.getTwap(address(_assets[i]));
            }
            else if (assetType[_assets[i]] == AssetType.AToken) {
                twaps[i] = _aaveATokenOracle.getTwap(address(_assets[i]));
            }
            else {
                twaps[i] = _assetOracle.getTwap(address(_assets[i]));
            }
            unchecked { i = i + 1; }
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

        for (uint256 i; i < assetsLength; ) {
            if (assetType[_assets[i]] == AssetType.TeaVaultV3Pair) {
                values[i] = _teaVaultV3PairOracle.getValueWithTwap(address(_assets[i]), _balances[i], _twaps[i]);
            }
            else if (assetType[_assets[i]] == AssetType.AToken) {
                values[i] = _aaveATokenOracle.getValueWithTwap(address(_assets[i]), _balances[i], _twaps[i]);
            }
            else {
                values[i] = _assetOracle.getValueWithTwap(address(_assets[i]), _balances[i], _twaps[i]);
            }
            unchecked { i = i + 1; }
        }
    }

    /// @inheritdoc ITeaVaultV3Portfolio
    function calculateTotalValue() external override view returns (uint256 totalValue) {
        uint256 totalShares = totalSupply();
        if (totalShares == 0) {
            return 0;
        }

        uint256[] memory values = _calculateValueComposition();
        for (uint256 i; i < values.length; ) {
            totalValue = totalValue + values[i];
            unchecked { i = i + 1; }
        }
    }

    function _calculateAssetsValue(
        ERC20Upgradeable[] memory _assets,
        uint256[] memory _balances,
        uint256[] memory _twaps
    ) internal view returns (uint256 value) {
        uint256[] memory values = _calculateValueComposition(_assets, _balances, _twaps);
        for (uint256 i; i < values.length; ) {
            value = value + values[i];
            unchecked { i = i + 1; }
        }   
    }

    /// @inheritdoc ITeaVaultV3Portfolio
    function aaveSupply(address _asset, uint256 _amount) external override onlyManager nonReentrant {
        if (assetType[ERC20Upgradeable(_asset)] != AssetType.AToken) revert InvalidAssetType();
        return AssetsHelper.aaveSupply(aavePool, _asset, _amount);
    }

    /// @inheritdoc ITeaVaultV3Portfolio
    function aaveWithdraw(
        address _asset,
        uint256 _amount
    ) external override onlyManager nonReentrant returns (
        uint256 withdrawAmount
    ) {
        if (assetType[ERC20Upgradeable(_asset)] != AssetType.AToken) revert InvalidAssetType();
        return AssetsHelper.aaveWithdraw(aavePool, _asset, _amount);
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
        return AssetsHelper.v3PairDeposit(_asset, _shares, _amount0Max, _amount1Max);
    }

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
        return AssetsHelper.v3PairWithdraw(_asset, _shares, _amount0Min, _amount1Min);
    }

    /// @inheritdoc ITeaVaultV3Portfolio
    function calculateSwapPath(
        bool _isExactInput,
        address[] calldata _tokens,
        uint24[] calldata _fees
    ) external pure returns (
        bytes memory path
    ) {
        return AssetsHelper.calculateSwapPath(_isExactInput, _tokens, _fees);
    }

    /// @inheritdoc ITeaVaultV3Portfolio
    function uniswapV3SwapViaSwapRouter(
        bool _isExactInput,
        address _srcToken,
        address _dstToken,
        bytes calldata _path, // AUDIT: TVV-04C
        uint256 _deadline,
        uint256 _amountInOrOut,
        uint256 _amountOutOrInTolerance
    ) external override onlyManager nonReentrant returns (
        uint256 amountOutOrIn
    ) {
        return _uniswapV3SwapViaSwapRouter(
            _isExactInput,
            _srcToken,
            _dstToken,
            _path,
            _deadline,
            _amountInOrOut,
            _amountOutOrInTolerance
        );
    }

    function _uniswapV3SwapViaSwapRouter(
        bool _isExactInput,
        address _srcToken,
        address _dstToken,
        bytes calldata _path, // AUDIT: TVV-04C
        uint256 _deadline,
        uint256 _amountInOrOut,
        uint256 _amountOutOrInTolerance
    ) internal returns (
        uint256 amountOutOrIn
    ) {
        bytes memory recommendedPath = _checkAndGetRecommendedPath(_isExactInput, _srcToken, _dstToken);
        address _uniswapV3SwapRouter = uniswapV3SwapRouter;
        uint256 simulatedAmount = simulateSwapViaV3Router(
            _uniswapV3SwapRouter, _isExactInput, _srcToken, recommendedPath, _amountInOrOut
        );

        ERC20Upgradeable(_srcToken).approve(_uniswapV3SwapRouter, type(uint256).max);
        if (_isExactInput) {
            if (simulatedAmount > _amountOutOrInTolerance) {
                _amountOutOrInTolerance = simulatedAmount;
            }
            ISwapRouter.ExactInputParams memory params = ISwapRouter.ExactInputParams({
                path: _path,
                recipient: address(this),
                deadline: _deadline,
                amountIn: _amountInOrOut,
                amountOutMinimum: _amountOutOrInTolerance
            });
            amountOutOrIn = ISwapRouter(_uniswapV3SwapRouter).exactInput(params);
            emit Swap(msg.sender, _srcToken, _dstToken, _uniswapV3SwapRouter, _amountInOrOut, amountOutOrIn, block.timestamp);
        }
        else {
            if (simulatedAmount < _amountOutOrInTolerance) {
                _amountOutOrInTolerance = simulatedAmount;
            }
            ISwapRouter.ExactOutputParams memory params = ISwapRouter.ExactOutputParams({
                path: _path,
                recipient: address(this),
                deadline: _deadline,
                amountOut: _amountInOrOut,
                amountInMaximum: _amountOutOrInTolerance
            });
            amountOutOrIn = ISwapRouter(_uniswapV3SwapRouter).exactOutput(params);
            emit Swap(msg.sender, _srcToken, _dstToken, _uniswapV3SwapRouter, amountOutOrIn, _amountInOrOut, block.timestamp);
        }
        ERC20Upgradeable(_srcToken).approve(_uniswapV3SwapRouter, 0);
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
        bytes memory recommendedPath = _checkAndGetRecommendedPath(true, _srcToken, _dstToken);
        uint256 minAmount = simulateSwapViaV3Router(uniswapV3SwapRouter, true, _srcToken, recommendedPath, _inputAmount);

        ERC20Upgradeable(_srcToken).safeTransfer(address(swapper), _inputAmount);        
        uint256 dstTokenBalanceBefore = ERC20Upgradeable(_dstToken).balanceOf(address(this));
        (bool success, bytes memory result) = address(swapper).call(
            abi.encodeWithSelector(
                Swapper.swap.selector,
                IERC20(_srcToken),
                IERC20(_dstToken),
                _inputAmount,
                _swapRouter,
                _data
            )
        );
        if (!success) revert ExecuteSwapFailed(result);

        uint256 dstTokenBalanceAfter = ERC20Upgradeable(_dstToken).balanceOf(address(this));
        convertedAmount = dstTokenBalanceAfter - dstTokenBalanceBefore;
        if (convertedAmount < minAmount) revert InsufficientSwapResult(minAmount, convertedAmount);

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
        // AUDIT: TVV-11C
        ERC20Upgradeable(_srcToken).approve(_uniswapV3SwapRouter, type(uint256).max);
        
        SwapRouterGenericParams memory params = SwapRouterGenericParams({
            path: _path,
            recipient: address(this),
            deadline: type(uint256).max,
            amountInOrOut: _amountInOrOut,
            amountOutOrInTolerance: _isExactInput ? 0 : type(uint256).max
        });

        (bool success, bytes memory returndata) = address(this).delegatecall(
            // AUDIT: TVV-01C
            abi.encodeWithSelector(
                TeaVaultV3Portfolio.simulateSwapViaV3RouterInternal.selector,
                bytes4(uint32(_isExactInput ? ISwapRouter.exactInput.selector : ISwapRouter.exactOutput.selector)),
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
    ) external onlyManagerOrOwner {
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
    /// @notice (DECAY_FACTOR_100_PERCENT is set to 1 << 128).
    /// @notice This function assumes base < (1 << 128), but does not verify to save gas.
    /// @notice Caller is responsible for making sure that base is within range.
    function _power128(uint256 base, uint256 exp) internal pure returns (uint256 result) {
        result = DECAY_FACTOR_100_PERCENT;

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
     * @dev Throws if called by any account other than the manager.
     */
    modifier onlyManagerOrOwner() {
        if (msg.sender != owner() && msg.sender != manager) revert CallerIsNotManagerNorOwner();
        _;
    }

    /**
     * @dev Throws if _shares is zero.
     */
    modifier checkShares(uint256 _shares) {
        if (_shares == 0) revert InvalidShareAmount();
        _;
    }
    // AUDIT: TVV-01M
    uint256[34] private __gap;
}