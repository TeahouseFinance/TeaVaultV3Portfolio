const helpers = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const TeaVaultV3PairCompiled = require("@teahousefinance/teavaultv3pair/artifacts/contracts/TeaVaultV3Pair.sol/TeaVaultV3Pair.json");
const VaultUtilsCompiled = require("@teahousefinance/teavaultv3pair/artifacts/contracts/library/VaultUtils.sol/VaultUtils.json");
const GenericRouter1InchCompiled = require("@teahousefinance/teavaultv3pair/artifacts/contracts/library/GenericRouter1Inch.sol/GenericRouter1Inch.json");

function loadEnvVar(env, errorMsg) {
    if (env == undefined) {
        throw errorMsg;
    }

    return env;
}

function loadEnvVarInt(env, errorMsg) {
    if (env == undefined) {
        throw errorMsg;
    }

    return parseInt(env);
}

function power128(a, n) {
    let result = (1n << 128n);

    while(n > 0) {
        if ((n & 1) == 1) {
            result = (result * a) >> 128n;
        }

        n >>= 1;
        a = (a * a) >> 128n;
    }

    return result;
}

function estimateDecayFactor(a, n) {
    let result = (1n << 128n);

    let step;
    do {
        let an = power128(result, n) - a;
        let slope = power128(result, n - 1) * BigInt(n);
        step = (an << 128n) / slope;
        result = result - step;
    } while(step != 0n);

    return result;
}

const testRpc = loadEnvVar(process.env.UNISWAP_TEST_RPC, "No UNISWAP_TEST_RPC");
const testBlock = loadEnvVarInt(process.env.UNISWAP_TEST_BLOCK, "No UNISWAP_TEST_BLOCK");
const testFactory = loadEnvVar(process.env.UNISWAP_TEST_FACTORY, "No UNISWAP_TEST_FACTORY");
const testAavePool = loadEnvVar(process.env.AAVE_TEST_POOL, "No AAVE_TEST_POOL");
const testRouter = loadEnvVar(process.env.UNISWAP_TEST_ROUTER, "No UNISWAP_TEST_ROUTER");
const testToken0 = loadEnvVar(process.env.UNISWAP_TEST_TOKEN0, "No UNISWAP_TEST_TOKEN0");
const testToken1 = loadEnvVar(process.env.UNISWAP_TEST_TOKEN1, "No UNISWAP_TEST_TOKEN1");
const testToken2 = loadEnvVar(process.env.UNISWAP_TEST_TOKEN2, "No UNISWAP_TEST_TOKEN2");
const testFeeTier = loadEnvVarInt(process.env.UNISWAP_TEST_FEE_TIER, "No UNISWAP_TEST_FEE_TIER");
const testToken0Whale = loadEnvVar(process.env.UNISWAP_TEST_TOKEN0_WHALE, "No UNISWAP_TEST_TOKEN0_WHALE");
const testToken1Whale = loadEnvVar(process.env.UNISWAP_TEST_TOKEN1_WHALE, "No UNISWAP_TEST_TOKEN1_WHALE");
const test1InchRouter = loadEnvVar(process.env.UNISWAP_TEST_1INCH_ROUTER, "No UNISWAP_TEST_1INCH_ROUTER");
const testWeth = loadEnvVar(process.env.UNISWAP_TEST_WETH, "No UNISWAP_TEST_WETH");

const ZERO_ADDRESS = '0x' + '0'.repeat(40);
const UINT256_MAX = '0x' + 'f'.repeat(64);
const UINT64_MAX = '0x' + 'f'.repeat(16);

const uniswapFactoryABI = [{"inputs":[],"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint24","name":"fee","type":"uint24"},{"indexed":true,"internalType":"int24","name":"tickSpacing","type":"int24"}],"name":"FeeAmountEnabled","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"oldOwner","type":"address"},{"indexed":true,"internalType":"address","name":"newOwner","type":"address"}],"name":"OwnerChanged","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"token0","type":"address"},{"indexed":true,"internalType":"address","name":"token1","type":"address"},{"indexed":true,"internalType":"uint24","name":"fee","type":"uint24"},{"indexed":false,"internalType":"int24","name":"tickSpacing","type":"int24"},{"indexed":false,"internalType":"address","name":"pool","type":"address"}],"name":"PoolCreated","type":"event"},{"inputs":[{"internalType":"address","name":"tokenA","type":"address"},{"internalType":"address","name":"tokenB","type":"address"},{"internalType":"uint24","name":"fee","type":"uint24"}],"name":"createPool","outputs":[{"internalType":"address","name":"pool","type":"address"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint24","name":"fee","type":"uint24"},{"internalType":"int24","name":"tickSpacing","type":"int24"}],"name":"enableFeeAmount","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint24","name":"","type":"uint24"}],"name":"feeAmountTickSpacing","outputs":[{"internalType":"int24","name":"","type":"int24"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"},{"internalType":"address","name":"","type":"address"},{"internalType":"uint24","name":"","type":"uint24"}],"name":"getPool","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"owner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"parameters","outputs":[{"internalType":"address","name":"factory","type":"address"},{"internalType":"address","name":"token0","type":"address"},{"internalType":"address","name":"token1","type":"address"},{"internalType":"uint24","name":"fee","type":"uint24"},{"internalType":"int24","name":"tickSpacing","type":"int24"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"_owner","type":"address"}],"name":"setOwner","outputs":[],"stateMutability":"nonpayable","type":"function"}];
const uniswapRouterABI = [{"inputs":[{"internalType":"address","name":"_factory","type":"address"},{"internalType":"address","name":"_WETH9","type":"address"}],"stateMutability":"nonpayable","type":"constructor"},{"inputs":[],"name":"WETH9","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"components":[{"internalType":"bytes","name":"path","type":"bytes"},{"internalType":"address","name":"recipient","type":"address"},{"internalType":"uint256","name":"deadline","type":"uint256"},{"internalType":"uint256","name":"amountIn","type":"uint256"},{"internalType":"uint256","name":"amountOutMinimum","type":"uint256"}],"internalType":"struct ISwapRouter.ExactInputParams","name":"params","type":"tuple"}],"name":"exactInput","outputs":[{"internalType":"uint256","name":"amountOut","type":"uint256"}],"stateMutability":"payable","type":"function"},{"inputs":[{"components":[{"internalType":"address","name":"tokenIn","type":"address"},{"internalType":"address","name":"tokenOut","type":"address"},{"internalType":"uint24","name":"fee","type":"uint24"},{"internalType":"address","name":"recipient","type":"address"},{"internalType":"uint256","name":"deadline","type":"uint256"},{"internalType":"uint256","name":"amountIn","type":"uint256"},{"internalType":"uint256","name":"amountOutMinimum","type":"uint256"},{"internalType":"uint160","name":"sqrtPriceLimitX96","type":"uint160"}],"internalType":"struct ISwapRouter.ExactInputSingleParams","name":"params","type":"tuple"}],"name":"exactInputSingle","outputs":[{"internalType":"uint256","name":"amountOut","type":"uint256"}],"stateMutability":"payable","type":"function"},{"inputs":[{"components":[{"internalType":"bytes","name":"path","type":"bytes"},{"internalType":"address","name":"recipient","type":"address"},{"internalType":"uint256","name":"deadline","type":"uint256"},{"internalType":"uint256","name":"amountOut","type":"uint256"},{"internalType":"uint256","name":"amountInMaximum","type":"uint256"}],"internalType":"struct ISwapRouter.ExactOutputParams","name":"params","type":"tuple"}],"name":"exactOutput","outputs":[{"internalType":"uint256","name":"amountIn","type":"uint256"}],"stateMutability":"payable","type":"function"},{"inputs":[{"components":[{"internalType":"address","name":"tokenIn","type":"address"},{"internalType":"address","name":"tokenOut","type":"address"},{"internalType":"uint24","name":"fee","type":"uint24"},{"internalType":"address","name":"recipient","type":"address"},{"internalType":"uint256","name":"deadline","type":"uint256"},{"internalType":"uint256","name":"amountOut","type":"uint256"},{"internalType":"uint256","name":"amountInMaximum","type":"uint256"},{"internalType":"uint160","name":"sqrtPriceLimitX96","type":"uint160"}],"internalType":"struct ISwapRouter.ExactOutputSingleParams","name":"params","type":"tuple"}],"name":"exactOutputSingle","outputs":[{"internalType":"uint256","name":"amountIn","type":"uint256"}],"stateMutability":"payable","type":"function"},{"inputs":[],"name":"factory","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes[]","name":"data","type":"bytes[]"}],"name":"multicall","outputs":[{"internalType":"bytes[]","name":"results","type":"bytes[]"}],"stateMutability":"payable","type":"function"},{"inputs":[],"name":"refundETH","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"address","name":"token","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"},{"internalType":"uint256","name":"deadline","type":"uint256"},{"internalType":"uint8","name":"v","type":"uint8"},{"internalType":"bytes32","name":"r","type":"bytes32"},{"internalType":"bytes32","name":"s","type":"bytes32"}],"name":"selfPermit","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"address","name":"token","type":"address"},{"internalType":"uint256","name":"nonce","type":"uint256"},{"internalType":"uint256","name":"expiry","type":"uint256"},{"internalType":"uint8","name":"v","type":"uint8"},{"internalType":"bytes32","name":"r","type":"bytes32"},{"internalType":"bytes32","name":"s","type":"bytes32"}],"name":"selfPermitAllowed","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"address","name":"token","type":"address"},{"internalType":"uint256","name":"nonce","type":"uint256"},{"internalType":"uint256","name":"expiry","type":"uint256"},{"internalType":"uint8","name":"v","type":"uint8"},{"internalType":"bytes32","name":"r","type":"bytes32"},{"internalType":"bytes32","name":"s","type":"bytes32"}],"name":"selfPermitAllowedIfNecessary","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"address","name":"token","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"},{"internalType":"uint256","name":"deadline","type":"uint256"},{"internalType":"uint8","name":"v","type":"uint8"},{"internalType":"bytes32","name":"r","type":"bytes32"},{"internalType":"bytes32","name":"s","type":"bytes32"}],"name":"selfPermitIfNecessary","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"address","name":"token","type":"address"},{"internalType":"uint256","name":"amountMinimum","type":"uint256"},{"internalType":"address","name":"recipient","type":"address"}],"name":"sweepToken","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"address","name":"token","type":"address"},{"internalType":"uint256","name":"amountMinimum","type":"uint256"},{"internalType":"address","name":"recipient","type":"address"},{"internalType":"uint256","name":"feeBips","type":"uint256"},{"internalType":"address","name":"feeRecipient","type":"address"}],"name":"sweepTokenWithFee","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"int256","name":"amount0Delta","type":"int256"},{"internalType":"int256","name":"amount1Delta","type":"int256"},{"internalType":"bytes","name":"_data","type":"bytes"}],"name":"uniswapV3SwapCallback","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"amountMinimum","type":"uint256"},{"internalType":"address","name":"recipient","type":"address"}],"name":"unwrapWETH9","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"uint256","name":"amountMinimum","type":"uint256"},{"internalType":"address","name":"recipient","type":"address"},{"internalType":"uint256","name":"feeBips","type":"uint256"},{"internalType":"address","name":"feeRecipient","type":"address"}],"name":"unwrapWETH9WithFee","outputs":[],"stateMutability":"payable","type":"function"},{"stateMutability":"payable","type":"receive"}];
const oneInchRouterABI = [{"inputs":[{"internalType":"address","name":"clipperExchange","type":"address"},{"internalType":"address","name":"srcToken","type":"address"},{"internalType":"address","name":"dstToken","type":"address"},{"internalType":"uint256","name":"inputAmount","type":"uint256"},{"internalType":"uint256","name":"outputAmount","type":"uint256"},{"internalType":"uint256","name":"goodUntil","type":"uint256"},{"internalType":"bytes32","name":"r","type":"bytes32"},{"internalType":"bytes32","name":"vs","type":"bytes32"}],"name":"clipperSwap","outputs":[{"internalType":"uint256","name":"returnAmount","type":"uint256"}],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"address","name":"executor","type":"address"},{"components":[{"internalType":"address","name":"srcToken","type":"address"},{"internalType":"address","name":"dstToken","type":"address"},{"internalType":"address payable","name":"srcReceiver","type":"address"},{"internalType":"address payable","name":"dstReceiver","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"uint256","name":"minReturnAmount","type":"uint256"},{"internalType":"uint256","name":"flags","type":"uint256"}],"internalType":"struct IGenericRouter1Inch.SwapDescription","name":"desc","type":"tuple"},{"internalType":"bytes","name":"permit","type":"bytes"},{"internalType":"bytes","name":"data","type":"bytes"}],"name":"swap","outputs":[{"internalType":"uint256","name":"returnAmount","type":"uint256"},{"internalType":"uint256","name":"spentAmount","type":"uint256"}],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"uint256","name":"minReturn","type":"uint256"},{"internalType":"uint256[]","name":"pools","type":"uint256[]"}],"name":"uniswapV3Swap","outputs":[{"internalType":"uint256","name":"returnAmount","type":"uint256"}],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"address","name":"srcToken","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"uint256","name":"minReturn","type":"uint256"},{"internalType":"uint256[]","name":"pools","type":"uint256[]"}],"name":"unoswap","outputs":[{"internalType":"uint256","name":"returnAmount","type":"uint256"}],"stateMutability":"payable","type":"function"}];

async function deployTeaVaultV3Portfolio() {
    // fork a testing environment
    await helpers.reset(testRpc, testBlock);

    // Contracts are deployed using the first signer/account by default
    const [owner, manager, user, fee] = await ethers.getSigners();

    // get ERC20 tokens
    const MockToken = await ethers.getContractFactory("MockToken");
    const token0 = MockToken.attach(testToken0);
    const token1 = MockToken.attach(testToken1);
    const token2 = MockToken.attach(testToken2);

    // get tokens from whale
    await helpers.impersonateAccount(testToken0Whale);
    const token0Whale = await ethers.getSigner(testToken0Whale);
    await helpers.setBalance(token0Whale.address, ethers.parseEther("100"));  // assign some eth to the whale in case it's a contract and not accepting eth
    await token0.connect(token0Whale).transfer(user.address, ethers.parseUnits("3000000", await token0.decimals()));

    await helpers.impersonateAccount(testToken1Whale);
    const token1Whale = await ethers.getSigner(testToken1Whale);
    await helpers.setBalance(token1Whale.address, ethers.parseEther("100"));  // assign some eth to the whale in case it's a contract and not accepting eth
    await token1.connect(token1Whale).transfer(user.address, ethers.parseUnits("100000", await token1.decimals()));

    // deploy UniswapV3PathRecommender
    const UniswapV3PathRecommender = await ethers.getContractFactory("UniswapV3PathRecommender");
    const pathRecommender = await UniswapV3PathRecommender.deploy();

    // deploy price oracles
    const AssetOracle = await ethers.getContractFactory("AssetOracle");
    const assetOracle = await AssetOracle.deploy(token0.target);

    const factory = await ethers.getContractAt(uniswapFactoryABI, testFactory);
    const pool = await factory.getPool(token0.target, token1.target, testFeeTier);
    await assetOracle.enableOracle(token1.target, [pool], [300]);

    const AaveATokenOracle = await ethers.getContractFactory("AaveATokenOracle");
    const aaveOracle = await AaveATokenOracle.deploy(token0.target, assetOracle.target);

    const TeaVaultV3PairOracle = await ethers.getContractFactory("TeaVaultV3PairOracle");
    const pairOracle = await TeaVaultV3PairOracle.deploy(token0.target, assetOracle.target);

    // deploy swapper
    const Swapper = await ethers.getContractFactory("Swapper");
    const swapper = await Swapper.deploy();

    // deploy library
    const AssetsHelper = await ethers.getContractFactory("AssetsHelper");
    const assetsHelper = await AssetsHelper.deploy();

    // deploy TeaVaultV3Portfolio
    const TeaVaultV3Portfolio = await ethers.getContractFactory("TeaVaultV3Portfolio", { libraries: { AssetsHelper: assetsHelper.target } });
    const decayFactor = estimateDecayFactor(1n << 127n, 86400 * 180);
    const feeCap = 999999;
    const feeConfig = {
        vault: fee.address,
        entryFee: 0,
        exitFee: 0,
        managementFee: 0,
        performanceFee: 0,
        decayFactor: decayFactor,
    };

    const vault = await upgrades.deployProxy(TeaVaultV3Portfolio,
        [ 
            "Test Vault",
            "TVault",
            feeCap,
            feeConfig,
            manager.address,
            token0.target,
            [ token1.target ],
            [ 2 ],       // ERC20Type.Atomic
            testAavePool,
            testRouter,
            pathRecommender.target,
            assetOracle.target,
            aaveOracle.target,
            pairOracle.target,
            swapper.target,
            owner.address,
        ],
        { 
            kind: "uups",
            unsafeAllowLinkedLibraries: true,
            unsafeAllow: [ 'delegatecall' ],
        }
    );

    await swapper.setAllowedCaller(vault.target, true);

    return { owner, manager, user, fee, vault, token0, token1, token2, pathRecommender, assetOracle, aaveOracle, pairOracle, factory }
}

async function deployTeaVaultV3PortfolioV3Pair() {
    const results = await deployTeaVaultV3Portfolio();

    // deploy TeaVaultV3Pair
    const VaultUtils = await ethers.getContractFactoryFromArtifact(VaultUtilsCompiled);
    const vaultUtils = await VaultUtils.deploy();

    const GenericRouter1Inch = await ethers.getContractFactoryFromArtifact(GenericRouter1InchCompiled);
    const genericRouter1Inch = await GenericRouter1Inch.deploy();

    const TeaVaultV3Pair = await ethers.getContractFactoryFromArtifact(TeaVaultV3PairCompiled, {
        libraries: {
            VaultUtils: vaultUtils.target,
            GenericRouter1Inch: genericRouter1Inch.target,
        },
    });

    const feeCap = 999999;
    const feeConfig = {
        vault: results.owner.address,
        entryFee: 0,
        exitFee: 0,
        performanceFee: 0,
        managementFee: 0,
    };
    const vaultImpl = await TeaVaultV3Pair.deploy();

    const token0Decimals = await results.token0.decimals();
    const initializeData = TeaVaultV3Pair.interface.encodeFunctionData("initialize", [
        "Test Vault",
        "TVault",
        testFactory,
        results.token0.target,
        results.token1.target,
        testFeeTier,
        18n - token0Decimals,
        feeCap,
        feeConfig,
        results.owner.address,
    ]);

    const ERC1967Proxy = await ethers.getContractFactory("MockERC1967Proxy");
    const vaultProxy = await ERC1967Proxy.deploy(vaultImpl.target, initializeData);
    const v3pair = TeaVaultV3Pair.attach(vaultProxy.target);

    // add to vault
    await results.pairOracle.enableOracle(v3pair.target);
    await results.vault.addAsset(v3pair.target, 3);

    await v3pair.assignManager(results.manager.address);

    // make some deposits
    await results.token0.connect(results.user).approve(v3pair.target, UINT256_MAX);
    await v3pair.connect(results.user).deposit(ethers.parseEther("100"), UINT256_MAX, UINT256_MAX);

    // convert tokens
    const poolAddr = await results.factory.getPool(results.token0.target, results.token1.target, testFeeTier);
    const pool = await ethers.getContractAt("IUniswapV3Pool", poolAddr);
    const slot0 = await pool.slot0();
    const tickSpacing = await pool.tickSpacing();

    await v3pair.connect(results.manager).swapInputSingle(
        true,
        ethers.parseUnits("50", token0Decimals),
        0,
        0,
        UINT64_MAX
    );

    // add liquidity
    let amount0 = await results.token0.balanceOf(v3pair.target);
    let amount1 = await results.token1.balanceOf(v3pair.target);

    // add positions
    const tick0 = ((slot0.tick - tickSpacing * 30n) / tickSpacing) * tickSpacing;
    const tick1 = ((slot0.tick - tickSpacing * 10n + tickSpacing - 1n) / tickSpacing) * tickSpacing;
    const tick2 = ((slot0.tick + tickSpacing * 10n + tickSpacing - 1n) / tickSpacing) * tickSpacing;
    const tick3 = ((slot0.tick + tickSpacing * 30n + tickSpacing - 1n) / tickSpacing) * tickSpacing;

    // add "center" position
    const liquidity1 = await v3pair.getLiquidityForAmounts(tick1, tick2, amount0 / 3n, amount1 / 3n);
    await v3pair.connect(results.manager).addLiquidity(tick1, tick2, liquidity1, 0, 0, UINT64_MAX);

    // add "lower" position
    amount1 = await results.token1.balanceOf(v3pair.target);
    const liquidity0 = await v3pair.getLiquidityForAmounts(tick0, tick1, 0, amount1);
    await v3pair.connect(results.manager).addLiquidity(tick0, tick1, liquidity0, 0, 0, UINT64_MAX);

    // add "upper" position
    amount0 = await results.token0.balanceOf(v3pair.target);
    const liquidity2 = await v3pair.getLiquidityForAmounts(tick2, tick3, amount0, 0);
    await v3pair.connect(results.manager).addLiquidity(tick2, tick3, liquidity2, 0, 0, UINT64_MAX);

    // add aToken to vault
    const aavePool = await ethers.getContractAt("IPool", testAavePool);
    const aToken0Data = await aavePool.getReserveData(results.token0.target);
    const aToken0 = await ethers.getContractAt("MockToken", aToken0Data.aTokenAddress);
    await results.aaveOracle.enableOracle(aToken0.target);
    await results.vault.addAsset(aToken0.target, 4);

    return { ...results, v3pair, aavePool, aToken0 };
}

describe("TeaVaultV3Portfolio", function () {

    describe("Deployment", function() {
        it("Should set the correct assets", async function () {
            const { vault, token0, token1 } = await helpers.loadFixture(deployTeaVaultV3Portfolio);

            expect(await vault.getNumberOfAssets()).to.equal(2n);
            expect(await vault.assets(0)).to.equal(token0.target);
            expect(await vault.assets(1)).to.equal(token1.target);
            expect(await vault.assetType(token0.target)).to.equal(1n);
            expect(await vault.assetType(token1.target)).to.equal(2n);
            expect(await vault.getAssets()).to.eql([ token0.target, token1.target ]);
        });

        it("Should set the correct decimals", async function () {
            const { vault } = await helpers.loadFixture(deployTeaVaultV3Portfolio);

            expect(await vault.decimals()).to.equal(18n);
        });

        it("Should set the correct fee config", async function () {
            const { vault, fee } = await helpers.loadFixture(deployTeaVaultV3Portfolio);

            const decayFactor = estimateDecayFactor(1n << 127n, 86400 * 180);
            expect(await vault.feeConfig()).to.eql([
                fee.address,
                0n,
                0n,
                0n,
                0n,
                decayFactor,
            ]);
        });

        it("Should set the correct manager", async function () {
            const { vault, manager } = await helpers.loadFixture(deployTeaVaultV3Portfolio);

            expect(await vault.manager()).to.equal(manager.address);
        });

        it("Should set the correct path recommender", async function () {
            const { vault, pathRecommender } = await helpers.loadFixture(deployTeaVaultV3Portfolio);

            expect(await vault.pathRecommender()).to.equal(pathRecommender.target);
        });

        it("Should set the correct oracles", async function () {
            const { vault, assetOracle, pairOracle } = await helpers.loadFixture(deployTeaVaultV3Portfolio);

            expect(await vault.assetOracle()).to.equal(assetOracle.target);
            expect(await vault.teaVaultV3PairOracle()).to.equal(pairOracle.target);
        });   
    });

    describe("Owner functions", function() {
        it("Should be able to add atomic asset", async function () {
            const { vault, token0, token2, assetOracle, factory } = await helpers.loadFixture(deployTeaVaultV3Portfolio);

            const pool = await factory.getPool(token0.target, token2.target, testFeeTier);
            await assetOracle.enableOracle(token2.target, [pool], [300]);
        
            await expect(vault.addAsset(token2.target, 2))
            .to.emit(vault, "AssetAdded")
            .withArgs(token2.target, anyValue);
            expect(await vault.getNumberOfAssets()).to.equal(3n);
            expect(await vault.assets(2)).to.equal(token2.target);
            expect(await vault.assetType(token2.target)).to.equal(2n);
        });

        it("Should not be able to add existing asset", async function () {
            const { vault, token1 } = await helpers.loadFixture(deployTeaVaultV3Portfolio);

            await expect(vault.addAsset(token1.target, 2))
            .to.be.revertedWithCustomError(vault, "AssetAlreadyAdded");
        });

        it("Should not be able to add atomic asset without oracle", async function () {
            const { vault, token2 } = await helpers.loadFixture(deployTeaVaultV3Portfolio);

            await expect(vault.addAsset(token2.target, 2))
            .to.be.revertedWithCustomError(vault, "OracleNotEnabled");
        });

        it("Should not be able to add asset with incorrect type", async function () {
            const { vault, token1 } = await helpers.loadFixture(deployTeaVaultV3Portfolio);

            await expect(vault.addAsset(token1.target, 1))
            .to.be.revertedWithCustomError(vault, "BaseAssetCannotBeAdded");
            await expect(vault.addAsset(token1.target, 5))
            .to.be.revertedWithCustomError(vault, "InvalidAssetType");
        });

        it("Should not be able to add asset from non-owner", async function () {
            const { vault, manager, token0, token2, assetOracle, factory } = await helpers.loadFixture(deployTeaVaultV3Portfolio);

            const pool = await factory.getPool(token0.target, token2.target, testFeeTier);
            await assetOracle.enableOracle(token2.target, [pool], [300]);
        
            await expect(vault.connect(manager).addAsset(token2.target, 2))
            .to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("Should be able to add AToken asset", async function () {
            const { vault, token0, aaveOracle } = await helpers.loadFixture(deployTeaVaultV3Portfolio);

            const aavePool = await ethers.getContractAt("IPool", testAavePool);
            const aToken0Data = await aavePool.getReserveData(token0.target);
            const aToken0 = await ethers.getContractAt("MockToken", aToken0Data.aTokenAddress);
            await aaveOracle.enableOracle(aToken0.target);
        
            await expect(vault.addAsset(aToken0.target, 4))
            .to.emit(vault, "AssetAdded")
            .withArgs(aToken0.target, anyValue);

            expect(await vault.getNumberOfAssets()).to.equal(3n);
            expect(await vault.assets(2)).to.equal(aToken0.target);
            expect(await vault.assetType(aToken0.target)).to.equal(4n);
        });

        it("Should be able to remove atomic asset", async function () {
            const { vault, token1 } = await helpers.loadFixture(deployTeaVaultV3Portfolio);
        
            await expect(vault.removeAsset(1))
            .to.emit(vault, "AssetRemoved")
            .withArgs(token1.target, anyValue);
            expect(await vault.getNumberOfAssets()).to.equal(1n);
            expect(await vault.assetType(token1.target)).to.equal(0n);
        });

        it("Should be able to swap and remove atomic asset", async function () {
            const { vault, pathRecommender, token0, token1, manager, user } = await helpers.loadFixture(deployTeaVaultV3Portfolio);

            const token0Decimals = await token0.decimals();
            const shares = ethers.parseEther("1");
            const tokens = ethers.parseUnits("1", token0Decimals);
            await token0.connect(user).approve(vault.target, UINT256_MAX);                      
            await vault.connect(user).deposit(shares);

            // convert half of token0 to token1
            await pathRecommender.setRecommendedPath([ token0.target, token1.target ], [ 500 ]);
            let swapPath = await vault.calculateSwapPath(true, [ token0.target, token1.target ], [ 500 ]);
            await vault.connect(manager).uniswapV3SwapViaSwapRouter(
                true,
                token0.target,
                token1.target,
                swapPath,
                UINT64_MAX,
                tokens / 2n,
                0
            );
        
            // swap token1 to token0 and remove token1
            await pathRecommender.setRecommendedPath([ token1.target, token0.target ], [ 500 ]);
            swapPath = await vault.calculateSwapPath(true, [ token1.target, token0.target ], [ 500 ]);
            await expect(vault.swapAndRemoveAsset(
                1,
                token0.target,
                swapPath,
                UINT64_MAX,
                0
            ))
            .to.emit(vault, "AssetRemoved")
            .withArgs(token1.target, anyValue);
            expect(await vault.getNumberOfAssets()).to.equal(1n);
            expect(await vault.assetType(token1.target)).to.equal(0n);
        });

        it("Should not be able to remove non-existing asset", async function () {
            const { vault } = await helpers.loadFixture(deployTeaVaultV3Portfolio);
        
            await expect(vault.removeAsset(2))
            .to.be.revertedWithPanic(0x32);     // array out of bound
        });

        it("Should not be able to remove base asset", async function () {
            const { vault } = await helpers.loadFixture(deployTeaVaultV3Portfolio);
        
            await expect(vault.removeAsset(0))
            .to.be.revertedWithCustomError(vault, "BaseAssetCannotBeRemoved");
        });

        it("Should not be able to remove asset from non-owner", async function () {
            const { vault, manager } = await helpers.loadFixture(deployTeaVaultV3Portfolio);
        
            await expect(vault.connect(manager).removeAsset(1))
            .to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("Should not be able to remove asset with remaining balance", async function () {
            const { vault, pathRecommender, token0, token1, manager, user } = await helpers.loadFixture(deployTeaVaultV3Portfolio);

            const token0Decimals = await token0.decimals();
            const shares = ethers.parseEther("1");
            const tokens = ethers.parseUnits("1", token0Decimals);
            await token0.connect(user).approve(vault.target, UINT256_MAX);                      
            await vault.connect(user).deposit(shares);

            // convert half of token0 to token1
            await pathRecommender.setRecommendedPath([ token0.target, token1.target ], [ 500 ]);
            let swapPath = await vault.calculateSwapPath(true, [ token0.target, token1.target ], [ 500 ]);
            await vault.connect(manager).uniswapV3SwapViaSwapRouter(
                true,
                token0.target,
                token1.target,
                swapPath,
                UINT64_MAX,
                tokens / 2n,
                0
            );

            await expect(vault.removeAsset(1))
            .to.be.revertedWithCustomError(vault, "AssetBalanceNotZero");
        });

        it("Should not be able to swap and remove atomic asset from non-owner", async function () {
            const { vault, pathRecommender, token0, token1, manager, user } = await helpers.loadFixture(deployTeaVaultV3Portfolio);

            const token0Decimals = await token0.decimals();
            const shares = ethers.parseEther("1");
            const tokens = ethers.parseUnits("1", token0Decimals);
            await token0.connect(user).approve(vault.target, UINT256_MAX);                      
            await vault.connect(user).deposit(shares);

            // convert half of token0 to token1
            await pathRecommender.setRecommendedPath([ token0.target, token1.target ], [ 500 ]);
            let swapPath = await vault.calculateSwapPath(true, [ token0.target, token1.target ], [ 500 ]);
            await vault.connect(manager).uniswapV3SwapViaSwapRouter(
                true,
                token0.target,
                token1.target,
                swapPath,
                UINT64_MAX,
                tokens / 2n,
                0
            );
        
            // swap token1 to token0 and remove token1
            await pathRecommender.setRecommendedPath([ token1.target, token0.target ], [ 500 ]);
            swapPath = await vault.calculateSwapPath(true, [ token1.target, token0.target ], [ 500 ]);
            await expect(vault.connect(user).swapAndRemoveAsset(
                1,
                token0.target,
                swapPath,
                UINT64_MAX,
                0
            ))
            .to.be.revertedWith("Ownable: caller is not the owner");
        });        

        it("Should be able to assign new manager", async function () {
            const { vault, user } = await helpers.loadFixture(deployTeaVaultV3Portfolio);
        
            await expect(vault.assignManager(user.address))
            .to.emit(vault, "ManagerChanged")
            .withArgs(user.address, anyValue);

            expect(await vault.manager()).to.equal(user.address);
        });

        it("Should not be able to assign new manager from non-owner", async function () {
            const { vault, manager, user } = await helpers.loadFixture(deployTeaVaultV3Portfolio);
        
            await expect(vault.connect(manager).assignManager(user.address))
            .to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("Should be able to set fee config", async function () {
            const { vault, user } = await helpers.loadFixture(deployTeaVaultV3Portfolio);

            const decayFactor = estimateDecayFactor(1n << 127n, 86400 * 240);
            const feeConfig = {
                vault: user.address,
                entryFee: 10,
                exitFee: 20,
                managementFee: 30,
                performanceFee: 40,
                decayFactor: decayFactor,
            };            
            await expect(vault.setFeeConfig(feeConfig))
            .to.emit(vault, "FeeConfigChanged")
            .withArgs([
                user.address,
                10n,
                20n,
                30n,
                40n,
                decayFactor
            ], anyValue);
            expect(await vault.feeConfig()).to.eql([
                user.address,
                10n,
                20n,
                30n,
                40n,
                decayFactor
            ]);
        });

        it("Should not be able to set fee config over fee cap", async function () {
            const { vault, user } = await helpers.loadFixture(deployTeaVaultV3Portfolio);
        
            const decayFactor = estimateDecayFactor(1n << 127n, 86400 * 240);
            let feeConfig = {
                vault: user.address,
                entryFee: 500000,
                exitFee: 500000,
                managementFee: 30,
                performanceFee: 40,
                decayFactor: decayFactor,
            };            
            await expect(vault.setFeeConfig(feeConfig))
            .to.be.revertedWithCustomError(vault, "InvalidFeeRate");

            feeConfig = {
                vault: user.address,
                entryFee: 10,
                exitFee: 20,
                managementFee: 1000000,
                performanceFee: 40,
                decayFactor: decayFactor,
            };            
            await expect(vault.setFeeConfig(feeConfig))
            .to.be.revertedWithCustomError(vault, "InvalidFeeRate");

            feeConfig = {
                vault: user.address,
                entryFee: 10,
                exitFee: 20,
                managementFee: 30,
                performanceFee: 1000000,
                decayFactor: decayFactor,
            };
            await expect(vault.setFeeConfig(feeConfig))
            .to.be.revertedWithCustomError(vault, "InvalidFeeRate");

            feeConfig = {
                vault: user.address,
                entryFee: 10,
                exitFee: 20,
                managementFee: 30,
                performanceFee: 40,
                decayFactor: 2n ** 128n,
            };
            await expect(vault.setFeeConfig(feeConfig))
            .to.be.revertedWithCustomError(vault, "InvalidFeeRate");
        });

        it("Should not be able to set vault to zero address", async function () {
            const { vault } = await helpers.loadFixture(deployTeaVaultV3Portfolio);
        
            const decayFactor = estimateDecayFactor(1n << 127n, 86400 * 240);
            let feeConfig = {
                vault: ZERO_ADDRESS,
                entryFee: 10,
                exitFee: 20,
                managementFee: 30,
                performanceFee: 40,
                decayFactor: decayFactor,
            };            
            await expect(vault.setFeeConfig(feeConfig))
            .to.be.revertedWithCustomError(vault, "InvalidAddress");
        });

        it("Should not be able to set fee config from non-owner", async function () {
            const { vault, manager, user } = await helpers.loadFixture(deployTeaVaultV3Portfolio);
        
            const decayFactor = estimateDecayFactor(1n << 127n, 86400 * 240);
            const feeConfig = {
                vault: user.address,
                entryFee: 10,
                exitFee: 20,
                managementFee: 30,
                performanceFee: 40,
                decayFactor: decayFactor,
            };            
            await expect(vault.connect(manager).setFeeConfig(feeConfig))
            .to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("Should be able to remove asset with remaining TeaVaultV3Pair shares", async function () {
            const { vault, pathRecommender, v3pair, token0, token1, manager, user } = await helpers.loadFixture(deployTeaVaultV3PortfolioV3Pair);

            const token0Decimals = await token0.decimals();
            const shares = ethers.parseEther("1");
            const tokens = ethers.parseUnits("1", token0Decimals);
            await token0.connect(user).approve(vault.target, UINT256_MAX);                      
            await vault.connect(user).deposit(shares);

            // convert half of token0 to token1
            await pathRecommender.setRecommendedPath([ token0.target, token1.target ], [ 500 ]);
            const swapPath = await vault.calculateSwapPath(true, [ token0.target, token1.target ], [ 500 ]);
            await vault.connect(manager).uniswapV3SwapViaSwapRouter(
                true,
                token0.target,
                token1.target,
                swapPath,
                UINT64_MAX,
                tokens / 2n,
                0
            );

            // add liquidity
            const v3pairShares = ethers.parseEther("0.5");
            await vault.connect(manager).v3PairDeposit(v3pair.target, v3pairShares, UINT256_MAX, UINT256_MAX);

            // remove asset
            await expect(vault.removeAsset(2))
            .to.emit(vault, "AssetRemoved")
            .withArgs(v3pair.target, anyValue);            
            expect(await vault.getNumberOfAssets()).to.equal(3n);
            expect(await vault.assetType(v3pair.target)).to.equal(0n);
            expect(await v3pair.balanceOf(vault.target)).to.equal(0n);
        });

        it("Should be able to remove asset with remaining AToken shares", async function () {
            const { vault, token0, aToken0, manager, user } = await helpers.loadFixture(deployTeaVaultV3PortfolioV3Pair);

            const token0Decimals = await token0.decimals();
            const shares = ethers.parseEther("1");
            const tokens = ethers.parseUnits("1", token0Decimals);
            await token0.connect(user).approve(vault.target, UINT256_MAX);                      
            await vault.connect(user).deposit(shares);

            // deposit some ATokens
            const aToken0Amount = ethers.parseUnits("0.1", token0Decimals);
            await vault.connect(manager).aaveSupply(aToken0.target, aToken0Amount);

            // remove asset
            await expect(vault.removeAsset(3))
            .to.emit(vault, "AssetRemoved")
            .withArgs(aToken0.target, anyValue);
            expect(await vault.getNumberOfAssets()).to.equal(3n);
            expect(await vault.assetType(aToken0.target)).to.equal(0n);
            expect(await aToken0.balanceOf(vault.target)).to.equal(0n);
        });        
    });

    describe("User functions", function() {
        it("Should be able to deposit to and then withdraw from an empty vault from users", async function () {
            const { vault, token0, user } = await helpers.loadFixture(deployTeaVaultV3PortfolioV3Pair);

            const token0Decimals = await token0.decimals();
            const shares = ethers.parseEther("1");
            const tokens = ethers.parseUnits("1", token0Decimals);
            await token0.connect(user).approve(vault.target, UINT256_MAX);

            // precalculate required token amounts
            const depositAmounts = await vault.connect(user).deposit.staticCall(shares);
            expect(depositAmounts).to.eql([ tokens, 0n, 0n, 0n ]);

            // check with previewDeposit
            const previewDepositAmounts = await vault.previewDeposit(shares);
            expect(depositAmounts).to.eql(previewDepositAmounts);
                        
            const tx = vault.connect(user).deposit(shares);
            await expect(tx).to.changeTokenBalance(vault, user.address, shares);
            await expect(tx).to.changeTokenBalance(token0, user.address, -tokens);
            await expect(tx).to.emit(vault, "Deposit")
            .withArgs(user.address, shares, [ tokens, 0n, 0n, 0n ], anyValue);
            
            // deposit again
            const tx2 = vault.connect(user).deposit(shares);
            await expect(tx2).to.changeTokenBalance(vault, user.address, shares);
            await expect(tx2).to.changeTokenBalance(token0, user.address, -tokens);
            await expect(tx).to.emit(vault, "Deposit")
            .withArgs(user.address, shares, [ tokens, 0n, 0n, 0n ], anyValue);

            // check value (oracle decimals is 18)
            expect(await vault.calculateTotalValue()).to.equal(tokens * 2n * 10n ** 12n);

            // check value composition
            expect(await vault.calculateValueComposition()).to.eql([ tokens * 2n * 10n ** 12n, 0n, 0n, 0n ]);

            // precalculate withdrawn token amounts
            const withdrawnAmounts = await vault.connect(user).withdraw.staticCall(shares);
            expect(withdrawnAmounts).to.eql([ tokens, 0n, 0n, 0n ]);

            // withdraw
            const tx3 = vault.connect(user).withdraw(shares);
            await expect(tx3).to.changeTokenBalance(vault, user.address, -shares);
            await expect(tx3).to.changeTokenBalance(token0, user.address, tokens);
            await expect(tx3).to.emit(vault, "Withdraw")
            .withArgs(user.address, shares, [ tokens, 0n, 0n, 0n ], anyValue);

            // withdraw again
            const tx4 = vault.connect(user).withdraw(shares);
            await expect(tx4).to.changeTokenBalance(vault, user.address, -shares);
            await expect(tx4).to.changeTokenBalance(token0, user.address, tokens);
            await expect(tx4).to.emit(vault, "Withdraw")
            .withArgs(user.address, shares, [ tokens, 0n, 0n, 0n ], anyValue);
        });

        it("Should be able to deposit to and then withdraw from a vault with only one non-base asset from users", async function () {
            const { vault, pathRecommender, token0, token1, manager, user } = await helpers.loadFixture(deployTeaVaultV3PortfolioV3Pair);

            const token0Decimals = await token0.decimals();
            const shares = ethers.parseEther("1");
            const tokens = ethers.parseUnits("1", token0Decimals);            
            await token0.connect(user).approve(vault.target, tokens);            
            await vault.connect(user).deposit(shares);

            // convert all token0 to token1
            await pathRecommender.setRecommendedPath([ token0.target, token1.target ], [ 500 ]);
            const swapPath = await vault.calculateSwapPath(true, [ token0.target, token1.target ], [ 500 ]);
            await vault.connect(manager).uniswapV3SwapViaSwapRouter(
                true,
                token0.target,
                token1.target,
                swapPath,
                UINT64_MAX,
                tokens,
                0
            );

            // get token1 balance
            let token1Balance = await token1.balanceOf(vault.target);

            // precalculate required token amounts
            await token1.connect(user).approve(vault.target, UINT256_MAX);
            const depositAmounts = await vault.connect(user).deposit.staticCall(shares);
            expect(depositAmounts).to.eql([ 0n, token1Balance, 0n, 0n ]);

            // check with previewDeposit
            const previewDepositAmounts = await vault.previewDeposit(shares);
            expect(depositAmounts).to.eql(previewDepositAmounts);

            // deposit again
            const tx = vault.connect(user).deposit(shares);
            await expect(tx).to.changeTokenBalance(vault, user.address, shares);
            await expect(tx).to.changeTokenBalance(token1, user.address, -token1Balance);
            await expect(tx).to.emit(vault, "Deposit")
            .withArgs(user.address, shares, [ 0n, token1Balance, 0n, 0n ], anyValue);

            // check value (oracle decimals is 18), close to 0.1%
            expect(await vault.calculateTotalValue()).to.be.closeTo(tokens * 2n * 10n ** 12n, 10n ** 15n);

            // check value composition
            const valueComposition = await vault.calculateValueComposition();
            expect(valueComposition[0]).to.equal(0n);
            expect(valueComposition[1]).to.be.closeTo(tokens * 2n * 10n ** 12n, 10n ** 15n);
            expect(valueComposition[2]).to.equal(0n);

            // get token1 balance again
            token1Balance = await token1.balanceOf(vault.target);

            // precalculate withdrawn token amounts
            const withdrawnAmounts = await vault.connect(user).withdraw.staticCall(shares);
            expect(withdrawnAmounts).to.eql([ 0n, token1Balance / 2n, 0n, 0n ]);

            // withdraw
            const tx2 = vault.connect(user).withdraw(shares);
            await expect(tx2).to.changeTokenBalance(vault, user.address, -shares);
            await expect(tx2).to.changeTokenBalance(token1, user.address, token1Balance / 2n);
            await expect(tx2).to.emit(vault, "Withdraw")
            .withArgs(user.address, shares, [ 0n, token1Balance / 2n, 0n, 0n ], anyValue);

            // get token1 balance again
            token1Balance = await token1.balanceOf(vault.target);

            // withdraw again
            const tx3 = vault.connect(user).withdraw(shares);
            await expect(tx3).to.changeTokenBalance(vault, user.address, -shares);
            await expect(tx3).to.changeTokenBalance(token1, user.address, token1Balance);
            await expect(tx3).to.emit(vault, "Withdraw")
            .withArgs(user.address, shares, [ 0n, token1Balance, 0n, 0n ], anyValue);
        });

        it("Should be able to deposit to and then withdraw from a vault with multiple assets from users", async function () {
            const { vault, pathRecommender, token0, token1, manager, user } = await helpers.loadFixture(deployTeaVaultV3PortfolioV3Pair);

            const token0Decimals = await token0.decimals();
            const shares = ethers.parseEther("1");
            const tokens = ethers.parseUnits("1", token0Decimals);
            await token0.connect(user).approve(vault.target, UINT256_MAX);
            await vault.connect(user).deposit(shares);

            // convert half of token0 to token1
            await pathRecommender.setRecommendedPath([ token0.target, token1.target ], [ 500 ]);
            const swapPath = await vault.calculateSwapPath(true, [ token0.target, token1.target ], [ 500 ]);
            await vault.connect(manager).uniswapV3SwapViaSwapRouter(
                true,
                token0.target,
                token1.target,
                swapPath,
                UINT64_MAX,
                tokens / 2n,
                0
            );

            // get token balances
            let token0Balance = await token0.balanceOf(vault.target);
            let token1Balance = await token1.balanceOf(vault.target);

            // precalculate required token amounts
            await token1.connect(user).approve(vault.target, UINT256_MAX);
            const depositAmounts = await vault.connect(user).deposit.staticCall(shares);
            expect(depositAmounts).to.eql([ token0Balance, token1Balance, 0n, 0n ]);

            // check with previewDeposit
            const previewDepositAmounts = await vault.previewDeposit(shares);
            expect(depositAmounts).to.eql(previewDepositAmounts);

            // deposit again
            const tx = vault.connect(user).deposit(shares);
            await expect(tx).to.changeTokenBalance(vault, user.address, shares);
            await expect(tx).to.changeTokenBalance(token0, user.address, -token0Balance);
            await expect(tx).to.changeTokenBalance(token1, user.address, -token1Balance);
            await expect(tx).to.emit(vault, "Deposit")
            .withArgs(user.address, shares, [ token0Balance, token1Balance, 0n, 0n ], anyValue);

            // check value (oracle decimals is 18), close to 0.1%
            expect(await vault.calculateTotalValue()).to.be.closeTo(tokens * 2n * 10n ** 12n, 10n ** 15n);

            // check value composition
            const valueComposition = await vault.calculateValueComposition();
            expect(valueComposition[0]).to.be.closeTo(tokens * 10n ** 12n, 10n ** 15n);
            expect(valueComposition[1]).to.be.closeTo(tokens * 10n ** 12n, 10n ** 15n);
            expect(valueComposition[2]).to.equal(0n);

            // get token balances again
            token0Balance = await token0.balanceOf(vault.target);
            token1Balance = await token1.balanceOf(vault.target);

            // precalculate withdrawn token amounts
            const withdrawnAmounts = await vault.connect(user).withdraw.staticCall(shares);
            expect(withdrawnAmounts).to.eql([ token0Balance / 2n, token1Balance / 2n, 0n, 0n ]);

            // withdraw
            const tx2 = vault.connect(user).withdraw(shares);
            await expect(tx2).to.changeTokenBalance(vault, user.address, -shares);
            await expect(tx2).to.changeTokenBalance(token0, user.address, token0Balance / 2n);
            await expect(tx2).to.changeTokenBalance(token1, user.address, token1Balance / 2n);
            await expect(tx2).to.emit(vault, "Withdraw")
            .withArgs(user.address, shares, [ token0Balance / 2n, token1Balance / 2n, 0n, 0n ], anyValue);

            // get token balances again
            token0Balance = await token0.balanceOf(vault.target);
            token1Balance = await token1.balanceOf(vault.target);

            // withdraw again
            const tx3 = vault.connect(user).withdraw(shares);
            await expect(tx3).to.changeTokenBalance(vault, user.address, -shares);
            await expect(tx3).to.changeTokenBalance(token0, user.address, token0Balance);
            await expect(tx3).to.changeTokenBalance(token1, user.address, token1Balance);
            await expect(tx3).to.emit(vault, "Withdraw")
            .withArgs(user.address, shares, [ token0Balance, token1Balance, 0n, 0n ], anyValue);
        });

        it("Should be able to deposit to and then withdraw from a vault with non-atomic assets from users", async function () {
            const { vault, pathRecommender, token0, token1, v3pair, aToken0, aavePool, manager, user } = await helpers.loadFixture(deployTeaVaultV3PortfolioV3Pair);

            const token0Decimals = await token0.decimals();
            const shares = ethers.parseEther("1");
            const tokens = ethers.parseUnits("1", token0Decimals);
            await token0.connect(user).approve(vault.target, UINT256_MAX);
            await vault.connect(user).deposit(shares);

            // convert half of token0 to token1
            await pathRecommender.setRecommendedPath([ token0.target, token1.target ], [ 500 ]);
            const swapPath = await vault.calculateSwapPath(true, [ token0.target, token1.target ], [ 500 ]);
            await vault.connect(manager).uniswapV3SwapViaSwapRouter(
                true,
                token0.target,
                token1.target,
                swapPath,
                UINT64_MAX,
                tokens / 2n,
                0
            );

            // add liquidity
            const v3pairShares = ethers.parseEther("0.5");
            await vault.connect(manager).v3PairDeposit(v3pair.target, v3pairShares, UINT256_MAX, UINT256_MAX);

            // deposit some ATokens
            const aToken0Amount = ethers.parseUnits("0.1", token0Decimals);
            await vault.connect(manager).aaveSupply(aToken0.target, aToken0Amount);

            // get token balances
            let token0Balance = await token0.balanceOf(vault.target);
            let token1Balance = await token1.balanceOf(vault.target);
            let v3pairBalance = await v3pair.balanceOf(vault.target);
            let aToken0Balance = await aToken0.balanceOf(vault.target);

            // make some aToken0 for the user
            await token0.connect(user).approve(aavePool.target, UINT256_MAX);
            await aavePool.connect(user).supply(token0.target, ethers.parseUnits("10", token0Decimals), user.address, 0);
           
            // precalculate required token amounts
            await token1.connect(user).approve(vault.target, UINT256_MAX);
            await v3pair.connect(user).approve(vault.target, UINT256_MAX);
            await aToken0.connect(user).approve(vault.target, UINT256_MAX);
            const depositAmounts = await vault.connect(user).deposit.staticCall(shares);
            expect(depositAmounts).to.eql([ token0Balance, token1Balance, v3pairBalance, aToken0Balance ]);

            // check with previewDeposit
            const previewDepositAmounts = await vault.previewDeposit(shares);
            expect(depositAmounts).to.eql(previewDepositAmounts);

            // deposit again
            const tx = vault.connect(user).deposit(shares);
            await expect(tx).to.changeTokenBalance(vault, user.address, shares);
            await expect(tx).to.changeTokenBalance(token0, user.address, -token0Balance);
            await expect(tx).to.changeTokenBalance(token1, user.address, -token1Balance);
            await expect(tx).to.changeTokenBalance(v3pair, user.address, -v3pairBalance);
            await expect(tx).to.changeTokenBalance(aToken0, user.address, -aToken0Balance);
            await expect(tx).to.emit(vault, "Deposit")
            .withArgs(user.address, shares, [ token0Balance, token1Balance, v3pairBalance, aToken0Balance ], anyValue);

            // check value (oracle decimals is 18), close to 0.1%
            expect(await vault.calculateTotalValue()).to.be.closeTo(tokens * 2n * 10n ** 12n, 10n ** 15n);

            // check value composition
            const valueComposition = await vault.calculateValueComposition();
            const token0Diff = tokens / 2n - token0Balance - aToken0Balance;
            expect(valueComposition[0]).to.be.closeTo(token0Balance * 2n * 10n ** 12n, 10n ** 15n);
            expect(valueComposition[1]).to.be.closeTo((token0Balance + aToken0Balance) * 2n * 10n ** 12n, 10n ** 15n);  // token1 value should be close to token0 value
            expect(valueComposition[2]).to.be.closeTo(token0Diff * 4n * 10n ** 12n, 10n ** 15n);
            expect(valueComposition[3]).to.be.closeTo(aToken0Balance * 2n * 10n ** 12n, 10n ** 15n);

            // get token balances again
            token0Balance = await token0.balanceOf(vault.target);
            token1Balance = await token1.balanceOf(vault.target);
            v3pairBalance = await v3pair.balanceOf(vault.target);
            aToken0Balance = await aToken0.balanceOf(vault.target);

            // precalculate withdrawn token amounts
            const withdrawnAmounts = await vault.connect(user).withdraw.staticCall(shares);
            expect(withdrawnAmounts).to.eql([ token0Balance / 2n, token1Balance / 2n, v3pairBalance / 2n, aToken0Balance / 2n ]);

            // withdraw
            const tx2 = vault.connect(user).withdraw(shares);
            await expect(tx2).to.changeTokenBalance(vault, user.address, -shares);
            await expect(tx2).to.changeTokenBalance(token0, user.address, token0Balance / 2n);
            await expect(tx2).to.changeTokenBalance(token1, user.address, token1Balance / 2n);
            await expect(tx2).to.changeTokenBalance(v3pair, user.address, v3pairBalance / 2n);
            await expect(tx2).to.changeTokenBalance(aToken0, user.address, aToken0Balance / 2n);
            await expect(tx2).to.emit(vault, "Withdraw")
            .withArgs(user.address, shares, [ token0Balance / 2n, token1Balance / 2n, v3pairBalance / 2n, aToken0Balance / 2n ], anyValue);

            // get token balances again
            token0Balance = await token0.balanceOf(vault.target);
            token1Balance = await token1.balanceOf(vault.target);
            v3pairBalance = await v3pair.balanceOf(vault.target);
            aToken0Balance = await aToken0.balanceOf(vault.target);

            const aToken0Before = await aToken0.balanceOf(user.address);

            // withdraw again
            const tx3 = vault.connect(user).withdraw(shares);
            await expect(tx3).to.changeTokenBalance(vault, user.address, -shares);
            await expect(tx3).to.changeTokenBalance(token0, user.address, token0Balance);
            await expect(tx3).to.changeTokenBalance(token1, user.address, token1Balance);
            await expect(tx3).to.changeTokenBalance(v3pair, user.address, v3pairBalance);
            await expect(tx3).to.emit(vault, "Withdraw")
            .withArgs(user.address, shares, [ token0Balance, token1Balance, v3pairBalance, aToken0Balance ], anyValue);

            // aToken0 balance changes are not very accurate sometimes
            const aToken0After = await aToken0.balanceOf(user.address);
            expect(aToken0After - aToken0Before).to.be.closeTo(aToken0Balance, 1);
        });

        it("Should require at least some tokens even with very small deposits", async function () {
            const { vault, token0, user } = await helpers.loadFixture(deployTeaVaultV3PortfolioV3Pair);

            await token0.connect(user).approve(vault.target, UINT256_MAX);
            const depositAmounts = await vault.connect(user).deposit.staticCall(1n);
            expect(depositAmounts).to.eql([ 1n, 0n, 0n, 0n ]);

            const tx = vault.connect(user).deposit(1n);
            await expect(tx).to.changeTokenBalance(vault, user.address, 1n);
            await expect(tx).to.changeTokenBalance(token0, user.address, -1n);            
        });

        it("Should not be able to deposit zero shares", async function () {
            const { vault, token0, user } = await helpers.loadFixture(deployTeaVaultV3PortfolioV3Pair);

            await token0.connect(user).approve(vault.target, UINT256_MAX);
            await expect(vault.connect(user).deposit(0))
            .to.be.revertedWithCustomError(vault, "InvalidShareAmount");
        });

        it("Should not be able to deposit shares with more assets than available", async function () {
            const { vault, token0, user } = await helpers.loadFixture(deployTeaVaultV3PortfolioV3Pair);

            const token0Decimals = await token0.decimals();
            await token0.connect(user).approve(vault.target, ethers.parseUnits("100", token0Decimals));
            await expect(vault.connect(user).deposit(ethers.parseEther("100000")))
            .to.be.revertedWith("ERC20: transfer amount exceeds allowance");

            await token0.connect(user).approve(vault.target, UINT256_MAX);
            await expect(vault.connect(user).deposit(ethers.parseEther("10000000")))
            .to.be.revertedWith("ERC20: transfer amount exceeds balance");
        });

        it("Should not be able to withdraw zero shares", async function () {
            const { vault, user } = await helpers.loadFixture(deployTeaVaultV3PortfolioV3Pair);

            await expect(vault.connect(user).withdraw(0))
            .to.be.revertedWithCustomError(vault, "InvalidShareAmount");
        });

        it("Should not be able to withdraw more shares than available", async function () {
            const { vault, token0, user } = await helpers.loadFixture(deployTeaVaultV3PortfolioV3Pair);

            const shares = ethers.parseEther("1");
            await token0.connect(user).approve(vault.target, UINT256_MAX);
            await vault.connect(user).deposit(shares);

            await expect(vault.connect(user).withdraw(shares + 1n))
            .to.be.revertedWithCustomError(vault, "InvalidShareAmount");
        });
    });

    describe("Manager functions", function() {
        it("Should be able to swap assets using UniswapV3 (exact input)", async function () {
            const { vault, pathRecommender, assetOracle, token0, token1, manager, user } = await helpers.loadFixture(deployTeaVaultV3PortfolioV3Pair);

            const token0Decimals = await token0.decimals();
            const shares = ethers.parseEther("1");
            const tokens = ethers.parseUnits("1", token0Decimals);
            await token0.connect(user).approve(vault.target, UINT256_MAX);                      
            await vault.connect(user).deposit(shares);

            // convert half of token0 to token1
            await pathRecommender.setRecommendedPath([ token0.target, token1.target ], [ 500 ]);
            const swapPath = await vault.calculateSwapPath(true, [ token0.target, token1.target ], [ 500 ]);
            await expect(vault.connect(manager).uniswapV3SwapViaSwapRouter(
                true,
                token0.target,
                token1.target,
                swapPath,
                UINT64_MAX,
                tokens / 2n,
                0
            ))
            .to.emit(vault, "Swap")
            .withArgs(manager.address, token0.target, token1.target, testRouter, tokens / 2n, anyValue, anyValue);

            // get token balances
            const token0Balance = await token0.balanceOf(vault.target);
            const token1Balance = await token1.balanceOf(vault.target);

            // use assetOracle to get a price estimation
            const token1Decimals = await token1.decimals();
            const token1Unit = ethers.parseUnits("1", token1Decimals);
            const oracleDecimals = await assetOracle.decimals();
            const estimatedToken1Price = await assetOracle.getValue(token1, token1Unit);
            const estimatedToken1Amount = (tokens / 2n) * (10n ** token1Decimals) * (10n ** oracleDecimals) / (estimatedToken1Price * (10n ** token0Decimals));

            expect(token0Balance).to.equal(tokens / 2n);
            expect(token1Balance).to.be.closeTo(estimatedToken1Amount, estimatedToken1Amount / 100n);
        });

        it("Should be able to swap assets using UniswapV3 (exact output)", async function () {
            const { vault, pathRecommender, assetOracle, token0, token1, manager, user } = await helpers.loadFixture(deployTeaVaultV3PortfolioV3Pair);

            const token0Decimals = await token0.decimals();
            const shares = ethers.parseEther("1");
            const tokens = ethers.parseUnits("1", token0Decimals);
            await token0.connect(user).approve(vault.target, UINT256_MAX);                      
            await vault.connect(user).deposit(shares);

            // use assetOracle to get a price estimation
            const token1Decimals = await token1.decimals();
            const token1Unit = ethers.parseUnits("1", token1Decimals);
            const oracleDecimals = await assetOracle.decimals();
            const estimatedToken1Price = await assetOracle.getValue(token1, token1Unit);
            const estimatedToken1Amount = (tokens / 2n) * (10n ** token1Decimals) * (10n ** oracleDecimals) / (estimatedToken1Price * (10n ** token0Decimals));

            // convert half of token0 to token1
            await pathRecommender.setRecommendedPath([ token0.target, token1.target ], [ 500 ]);
            const swapPath = await vault.calculateSwapPath(false, [ token0.target, token1.target ], [ 500 ]);
            await expect(vault.connect(manager).uniswapV3SwapViaSwapRouter(
                false,
                token0.target,
                token1.target,
                swapPath,
                UINT64_MAX,
                estimatedToken1Amount,
                tokens
            ))
            .to.emit(vault, "Swap")
            .withArgs(manager.address, token0.target, token1.target, testRouter, anyValue, estimatedToken1Amount, anyValue);

            // get token balances
            const token0Balance = await token0.balanceOf(vault.target);
            const token1Balance = await token1.balanceOf(vault.target);

            expect(token0Balance).to.be.closeTo(tokens / 2n, tokens / 200n);
            expect(token1Balance).to.equal(estimatedToken1Amount);
        });

        it("Should not be able to swap assets using worse path in UniswapV3", async function () {
            const { vault, pathRecommender, token0, token1, manager, user } = await helpers.loadFixture(deployTeaVaultV3PortfolioV3Pair);

            const token0Decimals = await token0.decimals();
            const shares = ethers.parseEther("1");
            const tokens = ethers.parseUnits("1", token0Decimals);
            await token0.connect(user).approve(vault.target, UINT256_MAX);                      
            await vault.connect(user).deposit(shares);

            // convert half of token0 to token1 using a worse path
            await pathRecommender.setRecommendedPath([ token0.target, token1.target ], [ 500 ]);
            const swapPath = await vault.calculateSwapPath(true, [ token0.target, token1.target ], [ 10000 ]);
            await expect(vault.connect(manager).uniswapV3SwapViaSwapRouter(
                true,
                token0.target,
                token1.target,
                swapPath,
                UINT64_MAX,
                tokens / 2n,
                0
            ))
            .to.be.revertedWith("Too little received");
        });

        it("Should not be able to swap assets into unsupported assets in UniswapV3", async function () {
            const { vault, pathRecommender, token0, token2, manager, user } = await helpers.loadFixture(deployTeaVaultV3PortfolioV3Pair);

            const token0Decimals = await token0.decimals();
            const shares = ethers.parseEther("1");
            const tokens = ethers.parseUnits("1", token0Decimals);
            await token0.connect(user).approve(vault.target, UINT256_MAX);                      
            await vault.connect(user).deposit(shares);

            // convert half of token0 to token1 using a worse path
            await pathRecommender.setRecommendedPath([ token0.target, token2.target ], [ 500 ]);
            const swapPath = await vault.calculateSwapPath(true, [ token0.target, token2.target ], [ 500 ]);
            await expect(vault.connect(manager).uniswapV3SwapViaSwapRouter(
                true,
                token0.target,
                token2.target,
                swapPath,
                UINT64_MAX,
                tokens / 2n,
                0
            ))
            .to.be.revertedWithCustomError(vault, "InvalidSwapTokens");
        });        

        it("Should not be able to swap assets using UniswapV3 from non-manager", async function () {
            const { vault, pathRecommender, token0, token1, user } = await helpers.loadFixture(deployTeaVaultV3PortfolioV3Pair);

            const token0Decimals = await token0.decimals();
            const shares = ethers.parseEther("1");
            const tokens = ethers.parseUnits("1", token0Decimals);
            await token0.connect(user).approve(vault.target, UINT256_MAX);                      
            await vault.connect(user).deposit(shares);

            // convert half of token0 to token1 using a worse path
            await pathRecommender.setRecommendedPath([ token0.target, token1.target ], [ 500 ]);
            const swapPath = await vault.calculateSwapPath(true, [ token0.target, token1.target ], [ 500 ]);
            await expect(vault.connect(user).uniswapV3SwapViaSwapRouter(
                true,
                token0.target,
                token1.target,
                swapPath,
                UINT64_MAX,
                tokens / 2n,
                0
            ))
            .to.be.revertedWithCustomError(vault, "CallerIsNotManager");
        });        

        it("Should be able to swap assets using 1Inch router (swap)", async function () {
            const { vault, pathRecommender, token0, token1, manager, user } = await helpers.loadFixture(deployTeaVaultV3PortfolioV3Pair);

            const token0Decimals = await token0.decimals();
            const shares = ethers.parseEther("100");
            const tokens = ethers.parseUnits("100", token0Decimals);
            await token0.connect(user).approve(vault.target, UINT256_MAX);                      
            await vault.connect(user).deposit(shares);

            // convert half of token0 to token1
            await pathRecommender.setRecommendedPath([ token0.target, token1.target ], [ 500 ]);

            // test in-place swap
            const amountIn = tokens / 2n;
            const swapPath = await vault.calculateSwapPath(true, [ token0.target, token1.target ], [ 500 ]);
            const amountOut = await vault.connect(manager).uniswapV3SwapViaSwapRouter.staticCall(
                true,
                token0.target,
                token1.target,
                swapPath,
                UINT64_MAX,
                amountIn,
                0
            );

            // data produced from 1Inch API
            // need to change receiver address
            const data = "0x12aa3caf0000000000000000000000007122db0ebe4eb9b434a9f2ffe6760bc03bfbd0e0000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc20000000000000000000000007122db0ebe4eb9b434a9f2ffe6760bc03bfbd0e000000000000000000000000047ac0fb4f2d84898e4d9e7b4dab3c24507a6d5030000000000000000000000000000000000000000000000000000000002faf080000000000000000000000000000000000000000000000000005e68a54e2a8a67000000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000001400000000000000000000000000000000000000000000000000000000000000160000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001360000000000000000000000000000000000000000000001180000ea0000d0512061bb2fda13600c497272a8dd029313afdb125fd3a0b86991c6218b36c1d19d4a2e9eb0ce3606eb480044d5bcb9b5000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb4800000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000005e68a54e2a8a6700000000000000000000000042f527f50f16a103b6ccab48bccca214500c10214041c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2d0e30db080a06c4eca27c02aaa39b223fe8d0a0e5c4f27ead9083c756cc21111111254eeb25477b68fb85ed929f73a96058200000000000000000000cfee7c08";
            const oneInchInterface = new ethers.Interface(oneInchRouterABI);
            const decoded = oneInchInterface.decodeFunctionData("swap", data);
            const desc = {
                srcToken: decoded.desc.srcToken,
                dstToken: decoded.desc.dstToken,
                srcReceiver: decoded.desc.srcReceiver,
                dstReceiver: vault.target,
                amount: amountIn,
                minReturnAmount: decoded.desc.minReturnAmount,
                flags: decoded.desc.flags
            };
            const newData = oneInchInterface.encodeFunctionData("swap", [
                decoded.executor,
                desc,
                decoded.permit,
                decoded.data
            ]);
            await expect(vault.connect(manager).executeSwap(token0.target, token1.target, amountIn, test1InchRouter, newData))
            .to.emit(vault, "Swap")
            .withArgs(manager.address, token0.target, token1.target, test1InchRouter, amountIn, anyValue, anyValue);

            // get token balances
            const token0Balance = await token0.balanceOf(vault.target);
            const token1Balance = await token1.balanceOf(vault.target);

            expect(token0Balance).to.equal(tokens / 2n);
            expect(token1Balance).to.be.greaterThanOrEqual(amountOut);
        });

        it("Should be able to swap assets using 1Inch router (unoswap)", async function () {
            const { vault, pathRecommender, token0, token1, manager, user } = await helpers.loadFixture(deployTeaVaultV3PortfolioV3Pair);

            const token0Decimals = await token0.decimals();
            const shares = ethers.parseEther("100");
            const tokens = ethers.parseUnits("100", token0Decimals);
            await token0.connect(user).approve(vault.target, UINT256_MAX);                      
            await vault.connect(user).deposit(shares);

            // convert half of token0 to token1
            // use a worse path to allow unoswap to outperform
            await pathRecommender.setRecommendedPath([ token0.target, token1.target ], [ 10000 ]);

            // test in-place swap
            const amountIn = tokens / 2n;
            const swapPath = await vault.calculateSwapPath(true, [ token0.target, token1.target ], [ 10000 ]);
            const amountOut = await vault.connect(manager).uniswapV3SwapViaSwapRouter.staticCall(
                true,
                token0.target,
                token1.target,
                swapPath,
                UINT64_MAX,
                amountIn,
                0
            );

            // data produced from 1Inch API
            const data = "0x0502b1c5000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb480000000000000000000000000000000000000000000000000000000002faf080000000000000000000000000000000000000000000000000005b39c7bf3723b40000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000000000000100000000000000003b6d0340b4e16d0168e52d35cacd2c6185b44281ec28c9dccfee7c08";
            await expect(vault.connect(manager).executeSwap(token0.target, token1.target, amountIn, test1InchRouter, data))
            .to.emit(vault, "Swap")
            .withArgs(manager.address, token0.target, token1.target, test1InchRouter, amountIn, anyValue, anyValue);

            // get token balances
            const token0Balance = await token0.balanceOf(vault.target);
            const token1Balance = await token1.balanceOf(vault.target);

            expect(token0Balance).to.equal(tokens / 2n);
            expect(token1Balance).to.be.greaterThanOrEqual(amountOut);
        });

        it("Should be able to swap assets using 1Inch router (uniswapv3)", async function () {
            const { vault, pathRecommender, token0, token1, manager, user } = await helpers.loadFixture(deployTeaVaultV3PortfolioV3Pair);

            const token0Decimals = await token0.decimals();
            const shares = ethers.parseEther("100");
            const tokens = ethers.parseUnits("100", token0Decimals);
            await token0.connect(user).approve(vault.target, UINT256_MAX);                      
            await vault.connect(user).deposit(shares);

            // convert half of token0 to token1
            // use a worse path to allow uniswapv3 to outperform
            await pathRecommender.setRecommendedPath([ token0.target, token1.target ], [ 3000 ]);

            // test in-place swap
            const amountIn = tokens / 2n;
            const swapPath = await vault.calculateSwapPath(true, [ token0.target, token1.target ], [ 3000 ]);
            const amountOut = await vault.connect(manager).uniswapV3SwapViaSwapRouter.staticCall(
                true,
                token0.target,
                token1.target,
                swapPath,
                UINT64_MAX,
                amountIn,
                0
            );

            // data produced from 1Inch API
            const data = "0xe449022e0000000000000000000000000000000000000000000000000000000002faf080000000000000000000000000000000000000000000000000005badeac783afdb00000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000001000000000000000000000000e0554a476a092703abdb3ef35c80e0d76d32939fcfee7c08";
            await expect(vault.connect(manager).executeSwap(token0.target, token1.target, amountIn, test1InchRouter, data))
            .to.emit(vault, "Swap")
            .withArgs(manager.address, token0.target, token1.target, test1InchRouter, amountIn, anyValue, anyValue);

            // get token balances
            const token0Balance = await token0.balanceOf(vault.target);
            const token1Balance = await token1.balanceOf(vault.target);

            expect(token0Balance).to.equal(tokens / 2n);
            expect(token1Balance).to.be.greaterThanOrEqual(amountOut);
        });

        it("Should not be able to swap assets using worse path in 1Inch router", async function () {
            const { vault, pathRecommender, token0, token1, manager, user } = await helpers.loadFixture(deployTeaVaultV3PortfolioV3Pair);

            const token0Decimals = await token0.decimals();
            const shares = ethers.parseEther("100");
            await token0.connect(user).approve(vault.target, UINT256_MAX);                      
            await vault.connect(user).deposit(shares);

            // convert half of token0 to token1
            await pathRecommender.setRecommendedPath([ token0.target, token1.target ], [ 500 ]);
            const amountIn = ethers.parseUnits("50", token0Decimals);

            // data is produced from 1Inch API
            const data = "0x0502b1c5000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb480000000000000000000000000000000000000000000000000000000002faf080000000000000000000000000000000000000000000000000005b39c7bf3723b40000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000000000000100000000000000003b6d0340b4e16d0168e52d35cacd2c6185b44281ec28c9dccfee7c08";
            await expect(vault.connect(manager).executeSwap(token0.target, token1.target, amountIn, test1InchRouter, data))
            .to.be.revertedWithCustomError(vault, "InsufficientSwapResult");
        });

        it("Should not be able to swap assets using 1Inch router with incorrect selector", async function () {
            const { vault, pathRecommender, token0, token1, manager, user } = await helpers.loadFixture(deployTeaVaultV3PortfolioV3Pair);

            const token0Decimals = await token0.decimals();
            const shares = ethers.parseEther("100");
            await token0.connect(user).approve(vault.target, UINT256_MAX);                      
            await vault.connect(user).deposit(shares);

            // convert half of token0 to token1
            await pathRecommender.setRecommendedPath([ token0.target, token1.target ], [ 500 ]);
            const amountIn = ethers.parseUnits("50", token0Decimals);

            // use wrong 1inch data
            await expect(vault.connect(manager).executeSwap(token0.target, token1.target, amountIn, test1InchRouter, '0x12345678'))
            .to.be.revertedWithCustomError(vault, "ExecuteSwapFailed");
        });

        it("Should not be able to swap assets using 1Inch router with incorrect data", async function () {
            const { vault, pathRecommender, token0, token1, manager, user } = await helpers.loadFixture(deployTeaVaultV3PortfolioV3Pair);

            const token0Decimals = await token0.decimals();
            const shares = ethers.parseEther("100");
            await token0.connect(user).approve(vault.target, UINT256_MAX);                      
            await vault.connect(user).deposit(shares);

            // convert half of token0 to token1
            await pathRecommender.setRecommendedPath([ token0.target, token1.target ], [ 500 ]);
            const amountIn = ethers.parseUnits("50", token0Decimals);

            // use wrong 1inch data
            await expect(vault.connect(manager).executeSwap(token0.target, token1.target, amountIn, test1InchRouter, '0x84bd6d29'))
            .to.be.revertedWithCustomError(vault, "ExecuteSwapFailed");
        });

        it("Should not be able to swap assets into unsupported assets using 1Inch router", async function () {
            const { vault, pathRecommender, token0, token2, manager, user } = await helpers.loadFixture(deployTeaVaultV3PortfolioV3Pair);

            const token0Decimals = await token0.decimals();
            const shares = ethers.parseEther("100");
            const tokens = ethers.parseUnits("100", token0Decimals);
            await token0.connect(user).approve(vault.target, UINT256_MAX);                      
            await vault.connect(user).deposit(shares);

            // convert half of token0 to token1
            // use a worse path to allow uniswapv3 to outperform
            await pathRecommender.setRecommendedPath([ token0.target, token2.target ], [ 3000 ]);

            // get uniswapV3 pool
            const factory = await ethers.getContractAt(uniswapFactoryABI, testFactory);
            const pool = await factory.getPool(token0.target, token2.target, 500);        

            // data produced from 1Inch API
            const oneInchInterface = new ethers.Interface(oneInchRouterABI);
            const data = oneInchInterface.encodeFunctionData("uniswapV3Swap", [
                tokens,
                0,
                [ pool ]
            ]);
            await expect(vault.connect(manager).executeSwap(token0.target, token2.target, tokens, test1InchRouter, data))
            .to.be.revertedWithCustomError(vault, "InvalidSwapTokens");
        });

        it("Should not be able to swap assets using 1Inch router from non-manager", async function () {
            const { vault, pathRecommender, token0, token1, user } = await helpers.loadFixture(deployTeaVaultV3PortfolioV3Pair);

            const token0Decimals = await token0.decimals();
            const shares = ethers.parseEther("100");
            await token0.connect(user).approve(vault.target, UINT256_MAX);                      
            await vault.connect(user).deposit(shares);

            // convert half of token0 to token1
            await pathRecommender.setRecommendedPath([ token0.target, token1.target ], [ 500 ]);
            const amountIn = ethers.parseUnits("50", token0Decimals);

            // data is produced from 1Inch API
            const data = "0x0502b1c5000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb480000000000000000000000000000000000000000000000000000000002faf080000000000000000000000000000000000000000000000000005b39c7bf3723b40000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000000000000100000000000000003b6d0340b4e16d0168e52d35cacd2c6185b44281ec28c9dccfee7c08";
            await expect(vault.connect(user).executeSwap(token0.target, token1.target, amountIn, test1InchRouter, data))
            .to.be.revertedWithCustomError(vault, "CallerIsNotManager");
        });

        it("Should be able to add and remove liquidity", async function () {
            const { vault, pathRecommender, v3pair, token0, token1, manager, user } = await helpers.loadFixture(deployTeaVaultV3PortfolioV3Pair);

            const token0Decimals = await token0.decimals();
            const shares = ethers.parseEther("1");
            const tokens = ethers.parseUnits("1", token0Decimals);
            await token0.connect(user).approve(vault.target, UINT256_MAX);                      
            await vault.connect(user).deposit(shares);

            // convert half of token0 to token1
            await pathRecommender.setRecommendedPath([ token0.target, token1.target ], [ 500 ]);
            const swapPath = await vault.calculateSwapPath(true, [ token0.target, token1.target ], [ 500 ]);
            await vault.connect(manager).uniswapV3SwapViaSwapRouter(
                true,
                token0.target,
                token1.target,
                swapPath,
                UINT64_MAX,
                tokens / 2n,
                0
            );

            // get token balances
            const token0Balance = await token0.balanceOf(vault.target);
            const token1Balance = await token1.balanceOf(vault.target);            

            // precalculate required tokens to add liquidity
            const v3pairShares = ethers.parseEther("0.5");
            const tokensRequired = await vault.connect(manager).v3PairDeposit.staticCall(v3pair.target, v3pairShares, UINT256_MAX, UINT256_MAX);

            // add liquidity
            await vault.connect(manager).v3PairDeposit(v3pair.target, v3pairShares, UINT256_MAX, UINT256_MAX);

            // get token balances
            let token0BalanceAfter = await token0.balanceOf(vault.target);
            let token1BalanceAfter = await token1.balanceOf(vault.target);
            let v3pairBalanceAfter = await v3pair.balanceOf(vault.target);
            
            expect(token0BalanceAfter).to.equal(token0Balance - tokensRequired[0]);
            expect(token1BalanceAfter).to.equal(token1Balance - tokensRequired[1]);
            expect(v3pairBalanceAfter).to.equal(v3pairShares);

            // precalculate tokens from removing liquidity
            const tokensReceived = await vault.connect(manager).v3PairWithdraw.staticCall(v3pair.target, v3pairShares, 0, 0);
            expect(tokensReceived[0]).to.be.closeTo(tokensRequired[0], tokensRequired[0] / 1000n);
            expect(tokensReceived[1]).to.be.closeTo(tokensRequired[1], tokensRequired[1] / 1000n);

            // remove liquidity
            await vault.connect(manager).v3PairWithdraw(v3pair.target, v3pairShares, 0, 0);

            // get token balances again
            token0BalanceAfter = await token0.balanceOf(vault.target);
            token1BalanceAfter = await token1.balanceOf(vault.target);
            v3pairBalanceAfter = await v3pair.balanceOf(vault.target);

            expect(token0BalanceAfter).to.closeTo(token0Balance, token0Balance / 1000n);
            expect(token1BalanceAfter).to.closeTo(token1Balance, token1Balance / 1000n);
            expect(v3pairBalanceAfter).to.equal(0n);
        });

        it("Should not be able to add liquidity to asset tokens", async function () {
            const { vault, pathRecommender, token0, token1, manager, user } = await helpers.loadFixture(deployTeaVaultV3PortfolioV3Pair);

            const token0Decimals = await token0.decimals();
            const shares = ethers.parseEther("1");
            const tokens = ethers.parseUnits("1", token0Decimals);
            await token0.connect(user).approve(vault.target, UINT256_MAX);                      
            await vault.connect(user).deposit(shares);

            // convert half of token0 to token1
            await pathRecommender.setRecommendedPath([ token0.target, token1.target ], [ 500 ]);
            const swapPath = await vault.calculateSwapPath(true, [ token0.target, token1.target ], [ 500 ]);
            await vault.connect(manager).uniswapV3SwapViaSwapRouter(
                true,
                token0.target,
                token1.target,
                swapPath,
                UINT64_MAX,
                tokens / 2n,
                0
            );

            // add liquidity
            const v3pairShares = ethers.parseEther("0.5");
            await expect(vault.connect(manager).v3PairDeposit(token1.target, v3pairShares, UINT256_MAX, UINT256_MAX))
            .to.be.revertedWithCustomError(vault, "InvalidAssetType");
        });

        it("Should not be able to remove liquidity from asset tokens", async function () {
            const { vault, pathRecommender, token0, token1, manager, user } = await helpers.loadFixture(deployTeaVaultV3PortfolioV3Pair);

            const token0Decimals = await token0.decimals();
            const shares = ethers.parseEther("1");
            const tokens = ethers.parseUnits("1", token0Decimals);
            await token0.connect(user).approve(vault.target, UINT256_MAX);                      
            await vault.connect(user).deposit(shares);

            // convert half of token0 to token1
            await pathRecommender.setRecommendedPath([ token0.target, token1.target ], [ 500 ]);
            const swapPath = await vault.calculateSwapPath(true, [ token0.target, token1.target ], [ 500 ]);
            await vault.connect(manager).uniswapV3SwapViaSwapRouter(
                true,
                token0.target,
                token1.target,
                swapPath,
                UINT64_MAX,
                tokens / 2n,
                0
            );

            // remove liquidity
            const v3pairShares = ethers.parseEther("0.5");
            await expect(vault.connect(manager).v3PairWithdraw(token1.target, v3pairShares, 0, 0))
            .to.be.revertedWithCustomError(vault, "InvalidAssetType");
        });        

        it("Should not be able to add liquidity from non-manager", async function () {
            const { vault, pathRecommender, token0, token1, v3pair, manager, user } = await helpers.loadFixture(deployTeaVaultV3PortfolioV3Pair);

            const token0Decimals = await token0.decimals();
            const shares = ethers.parseEther("1");
            const tokens = ethers.parseUnits("1", token0Decimals);
            await token0.connect(user).approve(vault.target, UINT256_MAX);                      
            await vault.connect(user).deposit(shares);

            // convert half of token0 to token1
            await pathRecommender.setRecommendedPath([ token0.target, token1.target ], [ 500 ]);
            const swapPath = await vault.calculateSwapPath(true, [ token0.target, token1.target ], [ 500 ]);
            await vault.connect(manager).uniswapV3SwapViaSwapRouter(
                true,
                token0.target,
                token1.target,
                swapPath,
                UINT64_MAX,
                tokens / 2n,
                0
            );

            // add liquidity
            const v3pairShares = ethers.parseEther("0.5");
            await expect(vault.connect(user).v3PairDeposit(v3pair.target, v3pairShares, UINT256_MAX, UINT256_MAX))
            .to.be.revertedWithCustomError(vault, "CallerIsNotManager");
        });
        
        it("Should not be able to remove liquidity from non-manager", async function () {
            const { vault, pathRecommender, token0, token1, v3pair, manager, user } = await helpers.loadFixture(deployTeaVaultV3PortfolioV3Pair);

            const token0Decimals = await token0.decimals();
            const shares = ethers.parseEther("1");
            const tokens = ethers.parseUnits("1", token0Decimals);
            await token0.connect(user).approve(vault.target, UINT256_MAX);                      
            await vault.connect(user).deposit(shares);

            // convert half of token0 to token1
            await pathRecommender.setRecommendedPath([ token0.target, token1.target ], [ 500 ]);
            const swapPath = await vault.calculateSwapPath(true, [ token0.target, token1.target ], [ 500 ]);
            await vault.connect(manager).uniswapV3SwapViaSwapRouter(
                true,
                token0.target,
                token1.target,
                swapPath,
                UINT64_MAX,
                tokens / 2n,
                0
            );

            // add liquidity
            const v3pairShares = ethers.parseEther("0.5");
            await vault.connect(manager).v3PairDeposit(v3pair.target, v3pairShares, UINT256_MAX, UINT256_MAX);

            // remove liquidity
            await expect(vault.connect(user).v3PairWithdraw(v3pair.target, v3pairShares, 0, 0))
            .to.be.revertedWithCustomError(vault, "CallerIsNotManager");
        });

        it("Should be able to supply and withdraw ATokens", async function () {
            const { vault, token0, token1, aToken0, manager, user } = await helpers.loadFixture(deployTeaVaultV3PortfolioV3Pair);

            const token0Decimals = await token0.decimals();
            const shares = ethers.parseEther("1");
            await token0.connect(user).approve(vault.target, UINT256_MAX);                      
            await vault.connect(user).deposit(shares);

            // supply to get aToken0
            const aToken0Amount = ethers.parseUnits("0.5", token0Decimals);
            await vault.connect(manager).aaveSupply(aToken0.target, aToken0Amount);

            // get token balances
            let aToken0Balance = await aToken0.balanceOf(vault.target);
            expect(aToken0Balance).to.be.closeTo(aToken0Amount, 1n);

            // convert aToken0 back to token0
            await vault.connect(manager).aaveWithdraw(aToken0.target, aToken0Balance);

            aToken0Balance = await aToken0.balanceOf(vault.target);
            expect(aToken0Balance).to.equal(0n);
        });

        it("Should not be able to supply ATokens to asset tokens", async function () {
            const { vault, token0, manager, user } = await helpers.loadFixture(deployTeaVaultV3PortfolioV3Pair);

            const token0Decimals = await token0.decimals();
            const shares = ethers.parseEther("1");
            await token0.connect(user).approve(vault.target, UINT256_MAX);                      
            await vault.connect(user).deposit(shares);

            // supply
            const aToken0Amount = ethers.parseUnits("0.5", token0Decimals);
            await expect(vault.connect(manager).aaveSupply(token0.target, aToken0Amount))
            .to.be.revertedWithCustomError(vault, "InvalidAssetType");
        });

        it("Should not be able to withdraw ATokens to asset tokens", async function () {
            const { vault, token0, manager, user } = await helpers.loadFixture(deployTeaVaultV3PortfolioV3Pair);

            const token0Decimals = await token0.decimals();
            const shares = ethers.parseEther("1");
            await token0.connect(user).approve(vault.target, UINT256_MAX);                      
            await vault.connect(user).deposit(shares);

            // withdraw
            const aToken0Amount = ethers.parseUnits("0.5", token0Decimals);
            await expect(vault.connect(manager).aaveWithdraw(token0.target, aToken0Amount))
            .to.be.revertedWithCustomError(vault, "InvalidAssetType");
        });

        it("Should not be able to supply ATokens from non-manager", async function () {
            const { vault, token0, aToken0, user } = await helpers.loadFixture(deployTeaVaultV3PortfolioV3Pair);

            const token0Decimals = await token0.decimals();
            const shares = ethers.parseEther("1");
            await token0.connect(user).approve(vault.target, UINT256_MAX);                      
            await vault.connect(user).deposit(shares);

            // supply to get aToken0
            const aToken0Amount = ethers.parseUnits("0.5", token0Decimals);
            await expect(vault.connect(user).aaveSupply(aToken0.target, aToken0Amount))
            .to.be.revertedWithCustomError(vault, "CallerIsNotManager");
        });

        it("Should not be able to withdraw ATokens from non-manager", async function () {
            const { vault, token0, aToken0, manager, user } = await helpers.loadFixture(deployTeaVaultV3PortfolioV3Pair);

            const token0Decimals = await token0.decimals();
            const shares = ethers.parseEther("1");
            await token0.connect(user).approve(vault.target, UINT256_MAX);                      
            await vault.connect(user).deposit(shares);

            // supply to get aToken0
            const aToken0Amount = ethers.parseUnits("0.5", token0Decimals);
            await vault.connect(manager).aaveSupply(aToken0.target, aToken0Amount);

            // supply to get aToken0
            await expect(vault.connect(user).aaveWithdraw(aToken0.target, aToken0Amount))
            .to.be.revertedWithCustomError(vault, "CallerIsNotManager");
        });        
    });

    describe("Fee calculations", function() {
        it("Should collect correct entry fees", async function () {        
            const { vault, token0, fee, user } = await helpers.loadFixture(deployTeaVaultV3PortfolioV3Pair);

            const decayFactor = estimateDecayFactor(1n << 127n, 86400 * 240);
            const feeConfig = {
                vault: fee.address,
                entryFee: 1000,
                exitFee: 2000,
                managementFee: 0,
                performanceFee: 0,
                decayFactor: decayFactor,
            };
            await vault.setFeeConfig(feeConfig);            

            const token0Decimals = await token0.decimals();
            const shares = ethers.parseEther("1");
            const tokens = ethers.parseUnits("1", token0Decimals);
            await token0.connect(user).approve(vault.target, UINT256_MAX);                      
            const tx = vault.connect(user).deposit(shares);

            // should collect 0.1% entry fee
            const entryFee = tokens * 1n / 1000n;
            await expect(tx).to.changeTokenBalance(token0, user, -(tokens + entryFee));
            await expect(tx).to.changeTokenBalance(token0, fee, entryFee);
            await expect(tx).to.emit(vault, "EntryFeeCollected")
            .withArgs(fee.address, [ entryFee, 0n, 0n, 0n  ], anyValue);
        });

        it("Should collect correct exit fees", async function () {        
            const { vault, token0, fee, user } = await helpers.loadFixture(deployTeaVaultV3PortfolioV3Pair);

            const decayFactor = estimateDecayFactor(1n << 127n, 86400 * 240);
            const feeConfig = {
                vault: fee.address,
                entryFee: 1000,
                exitFee: 2000,
                managementFee: 0,
                performanceFee: 0,
                decayFactor: decayFactor,
            };
            await vault.setFeeConfig(feeConfig);

            const token0Decimals = await token0.decimals();
            const shares = ethers.parseEther("1");
            const tokens = ethers.parseUnits("1", token0Decimals);
            await token0.connect(user).approve(vault.target, UINT256_MAX);                      
            await vault.connect(user).deposit(shares);

            const tx = vault.connect(user).withdraw(shares);
            // should collect 0.2% exit fee in shares
            const exitFee = shares * 2n / 1000n;
            await expect(tx).to.changeTokenBalance(token0, user, tokens * 998n / 1000n);
            await expect(tx).to.changeTokenBalance(vault, fee, exitFee);
            await expect(tx).to.emit(vault, "ExitFeeCollected")
            .withArgs(fee.address, exitFee, anyValue);
        });

        it("Should collect correct management fees", async function () {        
            const { vault, token0, fee, user } = await helpers.loadFixture(deployTeaVaultV3PortfolioV3Pair);

            const decayFactor = estimateDecayFactor(1n << 127n, 86400 * 240);
            const feeConfig = {
                vault: fee.address,
                entryFee: 0,
                exitFee: 0,
                managementFee: 10000,
                performanceFee: 0,
                decayFactor: decayFactor,
            };
            await vault.setFeeConfig(feeConfig);

            const shares = ethers.parseEther("1");
            await token0.connect(user).approve(vault.target, UINT256_MAX);                      
            await vault.connect(user).deposit(shares);

            // advance 1000 seconds
            await helpers.time.increase(1000);

            const time = 1001n;   // mine the block increases time by 1 second           
            const feeInShares = (shares * time * 10000n + (365n * 86400n * 1000000n - time * 10000n - 1n)) / (365n * 86400n * 1000000n - time * 10000n); // roundup
            const tx = vault.connect(user).withdraw(shares)
            await expect(tx).to.changeTokenBalance(vault, fee, feeInShares);
            await expect(tx).to.emit(vault, "ManagementFeeCollected")
            .withArgs(fee.address, feeInShares, anyValue);
            expect(feeInShares * 1000000n * 365n * 86400n).to.be.closeTo((feeInShares + shares) * 10000n * time, (feeInShares + shares) * 10000n * time / 1000000n);
        });

        it("Should collect correct performance fees", async function () {        
            const { vault, fee, pathRecommender, token0, token1, manager, user } = await helpers.loadFixture(deployTeaVaultV3PortfolioV3Pair);

            const decayFactor = estimateDecayFactor(1n << 127n, 86400 * 240);
            const feeConfig = {
                vault: fee.address,
                entryFee: 0,
                exitFee: 0,
                managementFee: 0,
                performanceFee: 100000,
                decayFactor: decayFactor,
            };
            await vault.setFeeConfig(feeConfig);

            const token0Decimals = await token0.decimals();
            const shares = ethers.parseEther("1");
            const tokens = ethers.parseUnits("1", token0Decimals);
            await token0.connect(user).approve(vault.target, UINT256_MAX);
            await vault.connect(user).deposit(shares);
            const value0 = await vault.calculateTotalValue();

            // convert half of token0 to token1
            await pathRecommender.setRecommendedPath([ token0.target, token1.target ], [ 500 ]);
            const swapPath = await vault.calculateSwapPath(true, [ token0.target, token1.target ], [ 500 ]);
            await vault.connect(manager).uniswapV3SwapViaSwapRouter(
                true,
                token0.target,
                token1.target,
                swapPath,
                UINT64_MAX,
                tokens / 2n,
                0
            );

            // increase vault value by exchange token0 for token1
            const router = await ethers.getContractAt(uniswapRouterABI, testRouter);
            await token0.connect(user).approve(router.target, UINT256_MAX);
            await router.connect(user).exactInputSingle([
                token0.target, token1.target, 500, user.address, UINT256_MAX, ethers.parseUnits("1000000", token0Decimals), 0, 0
            ]);

            // advance time to allow twap to take the value change in account
            await helpers.time.increase(1000);
            await helpers.mine();
            const value1 = await vault.calculateTotalValue();
            const valueIncrease = value1 - value0;
            const feeInShares = (shares * valueIncrease * 10n + (value1 * 100n - valueIncrease * 10n - 1n)) / (value1 * 100n - valueIncrease * 10n); // roundup

            await vault.connect(user).withdraw(shares);
            expect(await vault.performanceFeeReserve()).to.equal(feeInShares);
            expect(feeInShares * 100n * value1).to.be.closeTo((feeInShares + shares) * 10n * valueIncrease, (feeInShares + shares) * 10n * valueIncrease / 1000000n);

            // estimate how much performance fee is actually collected
            const factor = power128(decayFactor, 1000);
            const availableFees = feeInShares * ((1n << 128n) - factor) / (1n << 128n);
            await expect(vault.collectPerformanceFee())
            .to.emit(vault, "PerformanceFeeCollected");
            const collectedFees = await vault.balanceOf(fee.address);
            expect(collectedFees).to.be.closeTo(availableFees, availableFees / 100n);

            // decrease vault value by exchange token1 for token0
            await token1.connect(user).approve(router.target, UINT256_MAX);
            await router.connect(user).exactInputSingle([
                token1.target, token0.target, 500, user.address, UINT256_MAX, ethers.parseEther("10000"), 0, 0
            ]);
            
            // advance time to allow twap to take the value change in account
            await helpers.time.increase(1000);
            await helpers.mine();
           
            // deposit again
            const oldHighWaterMark = await vault.highWaterMark();
            const value2 = await vault.calculateTotalValue();
            await token1.connect(user).approve(vault.target, UINT256_MAX);
            await vault.connect(user).deposit(shares);
            const newHighWaterMark = await vault.highWaterMark();
            const value3 = await vault.calculateTotalValue();

            // change in highWaterMark should be propotional to change in value deposited
            expect(newHighWaterMark * value2).to.be.closeTo(oldHighWaterMark * value3, oldHighWaterMark * value3 / 1000n);

            // increase vault value by exchange token0 for token1
            await router.connect(user).exactInputSingle([
                token0.target, token1.target, 500, user.address, UINT256_MAX, ethers.parseUnits("100000", token0Decimals), 0, 0
            ]);

            // advance time to allow twap to take the value change in account
            await helpers.time.increase(1000);
            await helpers.mine();

            // collect performance fee
            let oldFeeReserve = await vault.performanceFeeReserve();
            const value4 = await vault.calculateTotalValue();
            expect(value4).to.be.lessThan(newHighWaterMark);
            await vault.collectPerformanceFee();
            let newFeeReserve = await vault.performanceFeeReserve();
            expect(newFeeReserve - oldFeeReserve).to.lessThan(0n);

            // increase vault value by exchange more token0 for token1
            await router.connect(user).exactInputSingle([
                token0.target, token1.target, 500, user.address, UINT256_MAX, ethers.parseUnits("20000000", token0Decimals), 0, 0
            ]);

            // advance time to allow twap to take the value change in account
            await helpers.time.increase(1000);
            await helpers.mine();

            // collect performance fee again
            oldFeeReserve = await vault.performanceFeeReserve();
            const value5 = await vault.calculateTotalValue();
            expect(value5).to.be.greaterThan(newHighWaterMark);
            await vault.collectPerformanceFee();
            newFeeReserve = await vault.performanceFeeReserve();
            expect(newFeeReserve - oldFeeReserve).to.greaterThan(0n);
        });
    });
});
