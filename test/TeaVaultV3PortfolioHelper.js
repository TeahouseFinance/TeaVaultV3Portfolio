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
const testWeth = loadEnvVar(process.env.UNISWAP_TEST_WETH, "No UNISWAP_TEST_WETH");

const ZERO_ADDRESS = '0x' + '0'.repeat(40);
const UINT256_MAX = '0x' + 'f'.repeat(64);
const UINT64_MAX = '0x' + 'f'.repeat(16);

const VAULT_TYPE_TEAVAULTV3PAIR = 0;
const VAULT_TYPE_TEAVAULTV3PORTFOLIO = 1;

const uniswapFactoryABI = [{"inputs":[],"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint24","name":"fee","type":"uint24"},{"indexed":true,"internalType":"int24","name":"tickSpacing","type":"int24"}],"name":"FeeAmountEnabled","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"oldOwner","type":"address"},{"indexed":true,"internalType":"address","name":"newOwner","type":"address"}],"name":"OwnerChanged","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"token0","type":"address"},{"indexed":true,"internalType":"address","name":"token1","type":"address"},{"indexed":true,"internalType":"uint24","name":"fee","type":"uint24"},{"indexed":false,"internalType":"int24","name":"tickSpacing","type":"int24"},{"indexed":false,"internalType":"address","name":"pool","type":"address"}],"name":"PoolCreated","type":"event"},{"inputs":[{"internalType":"address","name":"tokenA","type":"address"},{"internalType":"address","name":"tokenB","type":"address"},{"internalType":"uint24","name":"fee","type":"uint24"}],"name":"createPool","outputs":[{"internalType":"address","name":"pool","type":"address"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint24","name":"fee","type":"uint24"},{"internalType":"int24","name":"tickSpacing","type":"int24"}],"name":"enableFeeAmount","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint24","name":"","type":"uint24"}],"name":"feeAmountTickSpacing","outputs":[{"internalType":"int24","name":"","type":"int24"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"},{"internalType":"address","name":"","type":"address"},{"internalType":"uint24","name":"","type":"uint24"}],"name":"getPool","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"owner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"parameters","outputs":[{"internalType":"address","name":"factory","type":"address"},{"internalType":"address","name":"token0","type":"address"},{"internalType":"address","name":"token1","type":"address"},{"internalType":"uint24","name":"fee","type":"uint24"},{"internalType":"int24","name":"tickSpacing","type":"int24"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"_owner","type":"address"}],"name":"setOwner","outputs":[],"stateMutability":"nonpayable","type":"function"}];
const uniswapRouterABI = [{"inputs":[{"internalType":"address","name":"_factory","type":"address"},{"internalType":"address","name":"_WETH9","type":"address"}],"stateMutability":"nonpayable","type":"constructor"},{"inputs":[],"name":"WETH9","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"components":[{"internalType":"bytes","name":"path","type":"bytes"},{"internalType":"address","name":"recipient","type":"address"},{"internalType":"uint256","name":"deadline","type":"uint256"},{"internalType":"uint256","name":"amountIn","type":"uint256"},{"internalType":"uint256","name":"amountOutMinimum","type":"uint256"}],"internalType":"struct ISwapRouter.ExactInputParams","name":"params","type":"tuple"}],"name":"exactInput","outputs":[{"internalType":"uint256","name":"amountOut","type":"uint256"}],"stateMutability":"payable","type":"function"},{"inputs":[{"components":[{"internalType":"address","name":"tokenIn","type":"address"},{"internalType":"address","name":"tokenOut","type":"address"},{"internalType":"uint24","name":"fee","type":"uint24"},{"internalType":"address","name":"recipient","type":"address"},{"internalType":"uint256","name":"deadline","type":"uint256"},{"internalType":"uint256","name":"amountIn","type":"uint256"},{"internalType":"uint256","name":"amountOutMinimum","type":"uint256"},{"internalType":"uint160","name":"sqrtPriceLimitX96","type":"uint160"}],"internalType":"struct ISwapRouter.ExactInputSingleParams","name":"params","type":"tuple"}],"name":"exactInputSingle","outputs":[{"internalType":"uint256","name":"amountOut","type":"uint256"}],"stateMutability":"payable","type":"function"},{"inputs":[{"components":[{"internalType":"bytes","name":"path","type":"bytes"},{"internalType":"address","name":"recipient","type":"address"},{"internalType":"uint256","name":"deadline","type":"uint256"},{"internalType":"uint256","name":"amountOut","type":"uint256"},{"internalType":"uint256","name":"amountInMaximum","type":"uint256"}],"internalType":"struct ISwapRouter.ExactOutputParams","name":"params","type":"tuple"}],"name":"exactOutput","outputs":[{"internalType":"uint256","name":"amountIn","type":"uint256"}],"stateMutability":"payable","type":"function"},{"inputs":[{"components":[{"internalType":"address","name":"tokenIn","type":"address"},{"internalType":"address","name":"tokenOut","type":"address"},{"internalType":"uint24","name":"fee","type":"uint24"},{"internalType":"address","name":"recipient","type":"address"},{"internalType":"uint256","name":"deadline","type":"uint256"},{"internalType":"uint256","name":"amountOut","type":"uint256"},{"internalType":"uint256","name":"amountInMaximum","type":"uint256"},{"internalType":"uint160","name":"sqrtPriceLimitX96","type":"uint160"}],"internalType":"struct ISwapRouter.ExactOutputSingleParams","name":"params","type":"tuple"}],"name":"exactOutputSingle","outputs":[{"internalType":"uint256","name":"amountIn","type":"uint256"}],"stateMutability":"payable","type":"function"},{"inputs":[],"name":"factory","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes[]","name":"data","type":"bytes[]"}],"name":"multicall","outputs":[{"internalType":"bytes[]","name":"results","type":"bytes[]"}],"stateMutability":"payable","type":"function"},{"inputs":[],"name":"refundETH","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"address","name":"token","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"},{"internalType":"uint256","name":"deadline","type":"uint256"},{"internalType":"uint8","name":"v","type":"uint8"},{"internalType":"bytes32","name":"r","type":"bytes32"},{"internalType":"bytes32","name":"s","type":"bytes32"}],"name":"selfPermit","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"address","name":"token","type":"address"},{"internalType":"uint256","name":"nonce","type":"uint256"},{"internalType":"uint256","name":"expiry","type":"uint256"},{"internalType":"uint8","name":"v","type":"uint8"},{"internalType":"bytes32","name":"r","type":"bytes32"},{"internalType":"bytes32","name":"s","type":"bytes32"}],"name":"selfPermitAllowed","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"address","name":"token","type":"address"},{"internalType":"uint256","name":"nonce","type":"uint256"},{"internalType":"uint256","name":"expiry","type":"uint256"},{"internalType":"uint8","name":"v","type":"uint8"},{"internalType":"bytes32","name":"r","type":"bytes32"},{"internalType":"bytes32","name":"s","type":"bytes32"}],"name":"selfPermitAllowedIfNecessary","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"address","name":"token","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"},{"internalType":"uint256","name":"deadline","type":"uint256"},{"internalType":"uint8","name":"v","type":"uint8"},{"internalType":"bytes32","name":"r","type":"bytes32"},{"internalType":"bytes32","name":"s","type":"bytes32"}],"name":"selfPermitIfNecessary","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"address","name":"token","type":"address"},{"internalType":"uint256","name":"amountMinimum","type":"uint256"},{"internalType":"address","name":"recipient","type":"address"}],"name":"sweepToken","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"address","name":"token","type":"address"},{"internalType":"uint256","name":"amountMinimum","type":"uint256"},{"internalType":"address","name":"recipient","type":"address"},{"internalType":"uint256","name":"feeBips","type":"uint256"},{"internalType":"address","name":"feeRecipient","type":"address"}],"name":"sweepTokenWithFee","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"int256","name":"amount0Delta","type":"int256"},{"internalType":"int256","name":"amount1Delta","type":"int256"},{"internalType":"bytes","name":"_data","type":"bytes"}],"name":"uniswapV3SwapCallback","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"amountMinimum","type":"uint256"},{"internalType":"address","name":"recipient","type":"address"}],"name":"unwrapWETH9","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"uint256","name":"amountMinimum","type":"uint256"},{"internalType":"address","name":"recipient","type":"address"},{"internalType":"uint256","name":"feeBips","type":"uint256"},{"internalType":"address","name":"feeRecipient","type":"address"}],"name":"unwrapWETH9WithFee","outputs":[],"stateMutability":"payable","type":"function"},{"stateMutability":"payable","type":"receive"}];

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

    // deploy TeaVaultV3Portfolio
    const TeaVaultV3Portfolio = await ethers.getContractFactory("TeaVaultV3Portfolio", { });
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
            unsafeAllow: [ 'delegatecall' ],
        }
    );

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

async function deployTeaVaultV3PortfolioHelper() {
    const results = await deployTeaVaultV3PortfolioV3Pair();

    // deploy TeaVaultV3PortfolioHelper
    const Helper = await ethers.getContractFactory("TeaVaultV3PortfolioHelper");
    const helper = await Helper.deploy(testWeth, testAavePool);

    return { ...results, helper };
}

describe("TeaVaultV3PortfolioHelper", function () {

    describe("Deployment", function() {
        it("Should set the correct weth9 and aavePool", async function () {
            const { helper } = await helpers.loadFixture(deployTeaVaultV3PortfolioHelper);

            expect(await helper.weth9()).to.equal(testWeth);
            expect(await helper.aavePool()).to.equal(testAavePool);
        });
    });

    describe("Owner functions", function() {
        it("Should be able to rescue ERC20 tokens from owner", async function () {
            const { helper, token0, owner, user } = await helpers.loadFixture(deployTeaVaultV3PortfolioHelper);

            const amount = ethers.parseUnits("1000", await token0.decimals());
            await token0.connect(user).transfer(helper.target, amount);

            await expect(helper.rescueFund(token0.target, amount))
            .to.changeTokenBalances(token0, [ helper.target, owner.address ], [ -amount, amount ]);
        });

        it("Should not be able to rescue ERC20 tokens from non-owner", async function () {
            const { helper, token0, user } = await helpers.loadFixture(deployTeaVaultV3PortfolioHelper);

            const amount = ethers.parseUnits("1000", await token0.decimals());
            await token0.connect(user).transfer(helper.target, amount);

            await expect(helper.connect(user).rescueFund(token0.target, amount)).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("Should be able to rescue ETH from owner", async function () {
            const { helper, token0, owner } = await helpers.loadFixture(deployTeaVaultV3PortfolioHelper);

            const amount =  ethers.parseEther("1");
            await helpers.setBalance(helper.target, amount);

            await expect(helper.rescueEth(amount))
            .to.changeEtherBalances([ helper.target, owner.address ], [ -amount, amount ]);
        });

        it("Should not be able to rescue ETH from non-owner", async function () {
            const { helper, token0, user } = await helpers.loadFixture(deployTeaVaultV3PortfolioHelper);

            const amount =  ethers.parseEther("1");
            await helpers.setBalance(helper.target, amount);

            await expect(helper.connect(user).rescueEth(amount)).to.be.revertedWith("Ownable: caller is not the owner");
        });
    });

    describe("TeaVaultV3Portfolio functions", function() {
        it("Should be able to deposit", async function() {
            const { owner, manager, user, helper, vault, pathRecommender, token0, token1 } = await helpers.loadFixture(deployTeaVaultV3PortfolioHelper);

            // set fees
            const decayFactor = estimateDecayFactor(1n << 127n, 86400 * 180);
            const feeConfig = {
                vault: owner.address,
                entryFee: 1000,
                exitFee: 2000,
                performanceFee: 100000,
                managementFee: 0,
                decayFactor: decayFactor
            }

            await vault.setFeeConfig(feeConfig);

            // deposit
            const token0Decimals = await token0.decimals();
            const token1Decimals = await token1.decimals();
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

            // deposit using helper
            // estimate how much tokens are required
            await token1.connect(user).approve(vault.target, UINT256_MAX);
            const shares2 = ethers.parseEther("1000");
            const amounts = await vault.connect(user).deposit.staticCall(shares2);
            await token0.connect(user).approve(vault.target, 0);
            await token1.connect(user).approve(vault.target, 0);

            // deposit
            await token0.connect(user).approve(helper.target, UINT256_MAX);
            await token1.connect(user).approve(helper.target, UINT256_MAX);
            const depositData = helper.interface.encodeFunctionData("deposit", [ shares2 ]);
            const tx = helper.connect(user).multicall(
                VAULT_TYPE_TEAVAULTV3PORTFOLIO,
                vault.target,
                [ token0.target, token1.target ],
                [ 
                    amounts[0] + ethers.parseUnits("100", token0Decimals), // add some extra tokens to test refund
                    amounts[1] + ethers.parseUnits("100", token1Decimals), // add some extra tokens to test refund
                ],
                [ 0n, 0n, 0n, 0n ],
                [ depositData ]
            );

            // should have shares minted
            await expect(tx).to.changeTokenBalance(vault, user, shares2);

            // should have tokens refunded
            await expect(tx).to.changeTokenBalance(token0, user, -amounts[0]);
            await expect(tx).to.changeTokenBalance(token1, user, -amounts[1]);
        });

        it("Should be able to swap and deposit", async function() {
            const { owner, manager, user, helper, vault, pathRecommender, token0, token1 } = await helpers.loadFixture(deployTeaVaultV3PortfolioHelper);

            // set fees
            const decayFactor = estimateDecayFactor(1n << 127n, 86400 * 180);
            const feeConfig = {
                vault: owner.address,
                entryFee: 1000,
                exitFee: 2000,
                performanceFee: 100000,
                managementFee: 0,
                decayFactor: decayFactor
            }

            await vault.setFeeConfig(feeConfig);

            // deposit
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

            // deposit using helper
            // estimate how much tokens are required
            await token1.connect(user).approve(vault.target, UINT256_MAX);
            const shares2 = ethers.parseEther("1000");
            const amounts = await vault.connect(user).deposit.staticCall(shares2);
            await token0.connect(user).approve(vault.target, 0);
            await token1.connect(user).approve(vault.target, 0);

            // swap half of token0 and deposit
            const totalAmount = amounts[0] * 2n * 101n / 100n;  // slight increase total amount to account for slippage
            const swapAmount = totalAmount / 2n;
            const v3Router = new ethers.Contract(testRouter, uniswapRouterABI);
            const swapper = await helper.swapper();
            const uniswapV3SwapData = v3Router.interface.encodeFunctionData("exactInputSingle", [
                [ 
                    token0.target,
                    token1.target,
                    500,
                    swapper,
                    UINT64_MAX,
                    swapAmount,
                    0n,
                    0n
                ]
            ]);
            const swapData = helper.interface.encodeFunctionData("swap", [
                token0.target,
                token1.target,
                swapAmount,
                0n,
                testRouter,
                uniswapV3SwapData
            ]);

            await token0.connect(user).approve(helper.target, totalAmount);
            const depositData = helper.interface.encodeFunctionData("deposit", [ shares2 ]);
            const tx = helper.connect(user).multicall(
                VAULT_TYPE_TEAVAULTV3PORTFOLIO,
                vault.target,
                [ token0.target ],
                [ totalAmount ],
                [ 0n, 0n, 0n, 0n ],
                [ swapData, depositData ]
            );

            // should have shares minted
            await expect(tx).to.changeTokenBalance(vault, user, shares2);

            // should have tokens refunded
            await expect(tx).to.changeTokenBalance(token0, user, -(amounts[0] + swapAmount));
        });

        if (testToken0 == testWeth || testToken1 == testWeth) {
            it("Should be able to convert to WETH9 and deposit", async function() {
                const { owner, manager, user, helper, vault, pathRecommender, token0, token1 } = await helpers.loadFixture(deployTeaVaultV3PortfolioHelper);

                // set fees
                const decayFactor = estimateDecayFactor(1n << 127n, 86400 * 180);
                const feeConfig = {
                    vault: owner.address,
                    entryFee: 1000,
                    exitFee: 2000,
                    performanceFee: 100000,
                    managementFee: 0,
                    decayFactor: decayFactor
                }

                await vault.setFeeConfig(feeConfig);

                // deposit
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

                // deposit using helper
                // estimate how much tokens are required
                await token1.connect(user).approve(vault.target, UINT256_MAX);
                const shares2 = ethers.parseEther("1000");
                const amounts = await vault.connect(user).deposit.staticCall(shares2);
                await token0.connect(user).approve(vault.target, 0);
                await token1.connect(user).approve(vault.target, 0);

                // swap half of token0 and deposit
                const totalAmount = amounts[1] * 2n * 101n / 100n;  // slight increase total amount to account for slippage
                const swapAmount = totalAmount / 2n;
                const v3Router = new ethers.Contract(testRouter, uniswapRouterABI);
                const swapper = await helper.swapper();
                const uniswapV3SwapData = v3Router.interface.encodeFunctionData("exactInputSingle", [
                    [ 
                        token1.target,
                        token0.target,
                        500,
                        swapper,
                        UINT64_MAX,
                        swapAmount,
                        0n,
                        0n
                    ]
                ]);
                const swapData = helper.interface.encodeFunctionData("swap", [
                    token1.target,
                    token0.target,
                    swapAmount,
                    0n,
                    testRouter,
                    uniswapV3SwapData
                ]);

                const balanceBefore = await ethers.provider.getBalance(user.address);
                const sharesBefore = await vault.balanceOf(user.address);                
                await token0.connect(user).approve(helper.target, totalAmount);
                const depositData = helper.interface.encodeFunctionData("deposit", [ shares2 ]);
                const convertWethData = helper.interface.encodeFunctionData("convertWETH");
                await helper.connect(user).multicall(
                    VAULT_TYPE_TEAVAULTV3PORTFOLIO,
                    vault.target,
                    [ token1.target ],
                    [ 0n ],
                    [ 0n, 0n, 0n, 0n ],
                    [ swapData, depositData, convertWethData ],
                    { value: totalAmount * 2n },
                );
                const balanceAfter = await ethers.provider.getBalance(user.address);
                const sharesAfter = await vault.balanceOf(user.address);                

                // should have shares minted
                expect(sharesAfter - sharesBefore).to.equal(shares2);
                
                // should have eth refunded
                expect(balanceBefore - balanceAfter).to.be.closeTo(totalAmount, totalAmount / 100n);
            });
        }

        it("Should be able to swap, add liquidity, and deposit", async function() {
            const { owner, manager, user, helper, vault, pathRecommender, token0, token1, v3pair } = await helpers.loadFixture(deployTeaVaultV3PortfolioHelper);

            // set fees
            const decayFactor = estimateDecayFactor(1n << 127n, 86400 * 180);
            const feeConfig = {
                vault: owner.address,
                entryFee: 1000,
                exitFee: 2000,
                performanceFee: 100000,
                managementFee: 0,
                decayFactor: decayFactor
            }

            await vault.setFeeConfig(feeConfig);

            // deposit
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

            // swap half of token0, add liquidity, and deposit
            const totalAmount = tokens * 101n / 100n;  // slight increase total amount to account for slippage and entry fees
            const swapAmount = totalAmount / 2n;
            const v3Router = new ethers.Contract(testRouter, uniswapRouterABI);
            const swapper = await helper.swapper();
            const uniswapV3SwapData = v3Router.interface.encodeFunctionData("exactInputSingle", [
                [ 
                    token0.target,
                    token1.target,
                    500,
                    swapper,
                    UINT64_MAX,
                    swapAmount,
                    0n,
                    0n
                ]
            ]);
            const swapData = helper.interface.encodeFunctionData("swap", [
                token0.target,
                token1.target,
                swapAmount,
                0,
                testRouter,
                uniswapV3SwapData
            ]);
            const addLiquidityData = helper.interface.encodeFunctionData("v3PairDeposit", [ v3pair.target, v3pairShares * 1002n / 1000n, UINT256_MAX, UINT256_MAX ]);
            await token0.connect(user).approve(helper.target, totalAmount);
            const depositData = helper.interface.encodeFunctionData("deposit", [ shares ]);
            const tx = helper.connect(user).multicall(
                VAULT_TYPE_TEAVAULTV3PORTFOLIO,
                vault.target,
                [ token0.target ],
                [ totalAmount ],
                [ 0n, 0n, 0n, 0n ],
                [ swapData, addLiquidityData, depositData ]
            );

            // should have shares minted
            await expect(tx).to.changeTokenBalance(vault, user, shares);
        });

        it("Should be able to swap, add liquidity, convert to Atoken, and deposit", async function() {
            const { owner, manager, user, helper, vault, pathRecommender, token0, token1, v3pair, aToken0 } = await helpers.loadFixture(deployTeaVaultV3PortfolioHelper);

            // set fees
            const decayFactor = estimateDecayFactor(1n << 127n, 86400 * 180);
            const feeConfig = {
                vault: owner.address,
                entryFee: 1000,
                exitFee: 2000,
                performanceFee: 100000,
                managementFee: 0,
                decayFactor: decayFactor
            }

            await vault.setFeeConfig(feeConfig);

            // deposit
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
            const v3pairShares = ethers.parseEther("0.4");
            await vault.connect(manager).v3PairDeposit(v3pair.target, v3pairShares, UINT256_MAX, UINT256_MAX);

            // convert to aToken0
            const aToken0Amount = ethers.parseUnits("0.1", token0Decimals);
            await vault.connect(manager).aaveSupply(aToken0.target, aToken0Amount);

            // swap half of token0, add liquidity, convert to AToken0, and deposit
            const totalAmount = tokens * 101n / 100n;  // slight increase total amount to account for slippage and entry fees
            const swapAmount = totalAmount / 2n;
            const v3Router = new ethers.Contract(testRouter, uniswapRouterABI);
            const swapper = await helper.swapper();
            const uniswapV3SwapData = v3Router.interface.encodeFunctionData("exactInputSingle", [
                [ 
                    token0.target,
                    token1.target,
                    500,
                    swapper,
                    UINT64_MAX,
                    swapAmount,
                    0n,
                    0n
                ]
            ]);
            const swapData = helper.interface.encodeFunctionData("swap", [
                token0.target,
                token1.target,
                swapAmount,
                0,
                testRouter,
                uniswapV3SwapData
            ]);
            const addLiquidityData = helper.interface.encodeFunctionData("v3PairDeposit", [ v3pair.target, v3pairShares * 1002n / 1000n, UINT256_MAX, UINT256_MAX ]);
            const aaveSupplyData = helper.interface.encodeFunctionData("aaveSupply", [ token0.target, aToken0Amount * 1002n / 1000n ]);
            await token0.connect(user).approve(helper.target, totalAmount);
            const depositData = helper.interface.encodeFunctionData("deposit", [ shares ]);
            const tx = helper.connect(user).multicall(
                VAULT_TYPE_TEAVAULTV3PORTFOLIO,
                vault.target,
                [ token0.target ],
                [ totalAmount ],
                [ 0n, 0n, 0n, 0n ],
                [ swapData, addLiquidityData, aaveSupplyData, depositData ]
            );

            // should have shares minted
            await expect(tx).to.changeTokenBalance(vault, user, shares);
        });

        it("Should be able to swap, add liquidity, convert to Atoken, and deposit using depositMax", async function() {
            const { owner, manager, user, helper, vault, pathRecommender, token0, token1, v3pair, aToken0 } = await helpers.loadFixture(deployTeaVaultV3PortfolioHelper);

            // set fees
            const decayFactor = estimateDecayFactor(1n << 127n, 86400 * 180);
            const feeConfig = {
                vault: owner.address,
                entryFee: 1000,
                exitFee: 2000,
                performanceFee: 100000,
                managementFee: 0,
                decayFactor: decayFactor
            }

            await vault.setFeeConfig(feeConfig);

            // deposit
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
            const v3pairShares = ethers.parseEther("0.4");
            await vault.connect(manager).v3PairDeposit(v3pair.target, v3pairShares, UINT256_MAX, UINT256_MAX);

            // convert to aToken0
            const aToken0Amount = ethers.parseUnits("0.1", token0Decimals);
            await vault.connect(manager).aaveSupply(aToken0.target, aToken0Amount);

            // swap half of token0, add liquidity, convert to AToken0, and deposit
            const totalAmount = tokens * 101n / 100n;  // slight increase total amount to account for slippage and entry fees
            const swapAmount = totalAmount / 2n;
            const v3Router = new ethers.Contract(testRouter, uniswapRouterABI);
            const swapper = await helper.swapper();
            const uniswapV3SwapData = v3Router.interface.encodeFunctionData("exactInputSingle", [
                [ 
                    token0.target,
                    token1.target,
                    500,
                    swapper,
                    UINT64_MAX,
                    swapAmount,
                    0n,
                    0n
                ]
            ]);
            const swapData = helper.interface.encodeFunctionData("swap", [
                token0.target,
                token1.target,
                swapAmount,
                0,
                testRouter,
                uniswapV3SwapData
            ]);
            const addLiquidityData = helper.interface.encodeFunctionData("v3PairDeposit", [ v3pair.target, v3pairShares * 1002n / 1000n, UINT256_MAX, UINT256_MAX ]);
            const aaveSupplyData = helper.interface.encodeFunctionData("aaveSupply", [ token0.target, aToken0Amount * 1002n / 1000n ]);
            await token0.connect(user).approve(helper.target, totalAmount);
            const depositData = helper.interface.encodeFunctionData("depositMax");
            const sharesBefore = await vault.balanceOf(user.address);
            await helper.connect(user).multicall(
                VAULT_TYPE_TEAVAULTV3PORTFOLIO,
                vault.target,
                [ token0.target ],
                [ totalAmount ],
                [ 0n, 0n, 0n, 0n ],
                [ swapData, addLiquidityData, aaveSupplyData, depositData ]
            );
            const sharesAfter = await vault.balanceOf(user.address);

            // should have shares minted
            expect(sharesAfter - sharesBefore).to.be.closeTo(shares, shares / 100n);
        });

        it("Should be able to withdraw and unwind all composite assets", async function() {
            const { owner, manager, user, helper, vault, pathRecommender, token0, token1, v3pair, aToken0 } = await helpers.loadFixture(deployTeaVaultV3PortfolioHelper);

            // set fees
            const decayFactor = estimateDecayFactor(1n << 127n, 86400 * 180);
            const feeConfig = {
                vault: owner.address,
                entryFee: 1000,
                exitFee: 2000,
                performanceFee: 100000,
                managementFee: 0,
                decayFactor: decayFactor
            }

            await vault.setFeeConfig(feeConfig);

            // deposit
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
            const v3pairShares = ethers.parseEther("0.4");
            await vault.connect(manager).v3PairDeposit(v3pair.target, v3pairShares, UINT256_MAX, UINT256_MAX);

            // convert to aToken0
            const aToken0Amount = ethers.parseUnits("0.1", token0Decimals);
            await vault.connect(manager).aaveSupply(aToken0.target, aToken0Amount);

            // estimate how much tokens will be withdrawn
            const amounts = await vault.connect(user).withdraw.staticCall(shares);
            
            // withdraw and unwind tokens
            const token0BalanceBefore = await token0.balanceOf(user.address);
            const withdrawData = helper.interface.encodeFunctionData("withdraw", [ shares ]);
            const removeLiquidityData = helper.interface.encodeFunctionData("v3PairWithdraw", [ v3pair.target, amounts[2], 0, 0 ]);
            const aaveWithdrawData = helper.interface.encodeFunctionData("aaveWithdraw", [ token0.target, amounts[3] ]);

            // estimate amount of tokens withdrawn and converted
            await vault.connect(user).approve(helper.target, shares);
            const results = await helper.connect(user).multicall.staticCall(
                VAULT_TYPE_TEAVAULTV3PORTFOLIO, vault.target, [], [], [ 0n, 0n, 0n, 0n ], [ withdrawData, removeLiquidityData, aaveWithdrawData ]
            );
            const v3PairResults = helper.interface.decodeFunctionResult("v3PairWithdraw", results[1]);
            const aaveResults = helper.interface.decodeFunctionResult("aaveWithdraw", results[2]);
            const amounts1 = amounts[1] + v3PairResults.withdrawnAmount1;

            // convert and swap
            const v3Router = new ethers.Contract(testRouter, uniswapRouterABI);
            const swapper = await helper.swapper();
            const uniswapV3SwapData = v3Router.interface.encodeFunctionData("exactInputSingle", [
                [ 
                    token1.target,
                    token0.target,
                    500,
                    swapper,
                    UINT64_MAX,
                    amounts1,
                    0n,
                    0n
                ]
            ]);
            const swapData = helper.interface.encodeFunctionData("swap", [
                token1.target,
                token0.target,
                amounts1,
                0,
                testRouter,
                uniswapV3SwapData
            ]);

            const tx = helper.connect(user).multicall(
                VAULT_TYPE_TEAVAULTV3PORTFOLIO,
                vault.target,
                [ ],
                [ ],
                [ 0n, 0n, 0n, 0n ],
                [ withdrawData, removeLiquidityData, aaveWithdrawData, swapData ]
            );

            // should have shares burned
            await expect(tx).to.changeTokenBalance(vault, user.address, -shares);
            const token0BalanceAfter = await token0.balanceOf(user.address);

            // should receive tokens
            expect(token0BalanceAfter - token0BalanceBefore).to.be.closeTo(tokens, tokens / 100n);
        });

        it("Should be able to withdraw and unwind all composite assets using 'max' functions", async function() {
            const { owner, manager, user, helper, vault, pathRecommender, token0, token1, v3pair, aToken0 } = await helpers.loadFixture(deployTeaVaultV3PortfolioHelper);

            // set fees
            const decayFactor = estimateDecayFactor(1n << 127n, 86400 * 180);
            const feeConfig = {
                vault: owner.address,
                entryFee: 1000,
                exitFee: 2000,
                performanceFee: 100000,
                managementFee: 0,
                decayFactor: decayFactor
            }

            await vault.setFeeConfig(feeConfig);

            // deposit
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
            const v3pairShares = ethers.parseEther("0.4");
            await vault.connect(manager).v3PairDeposit(v3pair.target, v3pairShares, UINT256_MAX, UINT256_MAX);

            // convert to aToken0
            const aToken0Amount = ethers.parseUnits("0.1", token0Decimals);
            await vault.connect(manager).aaveSupply(aToken0.target, aToken0Amount);

            // estimate how much tokens will be withdrawn
            const amounts = await vault.connect(user).withdraw.staticCall(shares);
            
            // withdraw and unwind tokens
            const token0BalanceBefore = await token0.balanceOf(user.address);
            const withdrawData = helper.interface.encodeFunctionData("withdraw", [ shares ]);
            const removeLiquidityData = helper.interface.encodeFunctionData("v3PairWithdrawMax", [ v3pair.target ]);
            const aaveWithdrawData = helper.interface.encodeFunctionData("aaveWithdrawMax", [ token0.target ]);

            // estimate amount of tokens withdrawn and converted
            await vault.connect(user).approve(helper.target, shares);
            const results = await helper.connect(user).multicall.staticCall(
                VAULT_TYPE_TEAVAULTV3PORTFOLIO, vault.target, [], [], [ 0n, 0n, 0n, 0n ], [ withdrawData, removeLiquidityData, aaveWithdrawData ]
            );
            const v3PairResults = helper.interface.decodeFunctionResult("v3PairWithdrawMax", results[1]);
            const aaveResults = helper.interface.decodeFunctionResult("aaveWithdrawMax", results[2]);
            const amounts1 = amounts[1] + v3PairResults.withdrawnAmount1;

            // convert and swap
            const v3Router = new ethers.Contract(testRouter, uniswapRouterABI);
            const swapper = await helper.swapper();
            const uniswapV3SwapData = v3Router.interface.encodeFunctionData("exactInputSingle", [
                [ 
                    token1.target,
                    token0.target,
                    500,
                    swapper,
                    UINT64_MAX,
                    amounts1,
                    0n,
                    0n
                ]
            ]);
            const swapData = helper.interface.encodeFunctionData("swap", [
                token1.target,
                token0.target,
                amounts1,
                0,
                testRouter,
                uniswapV3SwapData
            ]);

            const tx = helper.connect(user).multicall(
                VAULT_TYPE_TEAVAULTV3PORTFOLIO,
                vault.target,
                [ ],
                [ ],
                [ 0n, 0n, 0n, 0n ],
                [ withdrawData, removeLiquidityData, aaveWithdrawData, swapData ]
            );

            // should have shares burned
            await expect(tx).to.changeTokenBalance(vault, user.address, -shares);
            const token0BalanceAfter = await token0.balanceOf(user.address);

            // should receive tokens
            expect(token0BalanceAfter - token0BalanceBefore).to.be.closeTo(tokens, tokens / 100n);
        });
    });

    describe("TeaVaultV3Pair functions", function() {
        it("Should be able to deposit", async function() {
            const { owner, user, helper, v3pair, token0, token1 } = await helpers.loadFixture(deployTeaVaultV3PortfolioHelper);

            // set fees
            const feeConfig = {
                vault: owner.address,
                entryFee: 1000,
                exitFee: 2000,
                performanceFee: 100000,
                managementFee: 0,
            }

            await v3pair.setFeeConfig(feeConfig);

            // deposit using helper
            // estimate how much tokens are required
            await token0.connect(user).approve(v3pair.target, UINT256_MAX);
            await token1.connect(user).approve(v3pair.target, UINT256_MAX);
            const shares = ethers.parseEther("1000");
            const amounts = await v3pair.connect(user).deposit.staticCall(shares, UINT256_MAX, UINT256_MAX);
            await token0.connect(user).approve(v3pair.target, 0);
            await token1.connect(user).approve(v3pair.target, 0);

            // deposit
            await token0.connect(user).approve(helper.target, UINT256_MAX);
            await token1.connect(user).approve(helper.target, UINT256_MAX);
            const depositData = helper.interface.encodeFunctionData("depositV3Pair", [ shares, UINT256_MAX, UINT256_MAX ]);
            const tx = helper.connect(user).multicall(
                VAULT_TYPE_TEAVAULTV3PAIR,
                v3pair.target,
                [ token0.target, token1.target ],
                [ amounts.depositedAmount0 + 100n, amounts.depositedAmount1 + 100n ], // add some extra tokens to test refund
                [ 0n, 0n ],
                [ depositData ]
            );
            
            // should have shares minted
            await expect(tx).to.changeTokenBalance(v3pair, user, shares);

            // should have tokens refunded
            await expect(tx).to.changeTokenBalance(token0, user, -amounts.depositedAmount0);
            await expect(tx).to.changeTokenBalance(token1, user, -amounts.depositedAmount1);
        });

        it("Should be able to deposit using depositV3PairMax", async function() {
            const { owner, user, helper, v3pair, token0, token1 } = await helpers.loadFixture(deployTeaVaultV3PortfolioHelper);

            // set fees
            const feeConfig = {
                vault: owner.address,
                entryFee: 1000,
                exitFee: 2000,
                performanceFee: 100000,
                managementFee: 0,
            }

            await v3pair.setFeeConfig(feeConfig);

            // deposit using helper
            // estimate how much tokens are required
            await token0.connect(user).approve(v3pair.target, UINT256_MAX);
            await token1.connect(user).approve(v3pair.target, UINT256_MAX);
            const shares = ethers.parseEther("1000");
            const amounts = await v3pair.connect(user).deposit.staticCall(shares, UINT256_MAX, UINT256_MAX);
            await token0.connect(user).approve(v3pair.target, 0);
            await token1.connect(user).approve(v3pair.target, 0);

            // deposit
            const sharesBefore = await v3pair.balanceOf(user.address);
            await token0.connect(user).approve(helper.target, UINT256_MAX);
            await token1.connect(user).approve(helper.target, UINT256_MAX);
            const depositData = helper.interface.encodeFunctionData("depositV3PairMax", [ UINT256_MAX, UINT256_MAX ]);
            await helper.connect(user).multicall(
                VAULT_TYPE_TEAVAULTV3PAIR,
                v3pair.target,
                [ token0.target, token1.target ],
                [ amounts.depositedAmount0, amounts.depositedAmount1 ], // add some extra tokens to test refund
                [ 0n, 0n ],
                [ depositData ]
            );
            const sharesAfter = await v3pair.balanceOf(user.address);
            
            // should have shares minted
            expect(sharesAfter - sharesBefore).to.be.closeTo(shares, shares / 1000n);
        });

        if (testToken0 == testWeth || testToken1 == testWeth) {
            it("Should be able to convert to WETH and deposit", async function() {
                const { owner, user, helper, v3pair, token0, token1 } = await helpers.loadFixture(deployTeaVaultV3PortfolioHelper);

                // set fees
                const feeConfig = {
                    vault: owner.address,
                    entryFee: 1000,
                    exitFee: 2000,
                    performanceFee: 100000,
                    managementFee: 0,
                }

                await v3pair.setFeeConfig(feeConfig);

                // deposit using helper
                // estimate how much tokens are required
                await token0.connect(user).approve(v3pair.target, UINT256_MAX);
                await token1.connect(user).approve(v3pair.target, UINT256_MAX);
                const shares = ethers.parseEther("1000");
                const amounts = await v3pair.connect(user).deposit.staticCall(shares, UINT256_MAX, UINT256_MAX);
                await token0.connect(user).approve(v3pair.target, 0);
                await token1.connect(user).approve(v3pair.target, 0);

                let amount0 = amounts.depositedAmount0;
                let amount1 = amounts.depositedAmount1;

                let ethAmount;
                if (testToken0 == testWeth) {
                    ethAmount = amount0;
                    amount0 = 0n;
                }
                else {
                    ethAmount = amount1;
                    amount1 = 0n;
                }

                // deposit
                if (amount0 != 0n) {
                    await token0.connect(user).approve(helper.target, UINT256_MAX);
                }
                if (amount1 != 0n) {
                    await token1.connect(user).approve(helper.target, UINT256_MAX);
                }

                const token0Before = await token0.balanceOf(user.address);
                const token1Before = await token1.balanceOf(user.address);
                const balanceBefore = await ethers.provider.getBalance(user.address);
                const sharesBefore = await v3pair.balanceOf(user.address);
                const depositData = helper.interface.encodeFunctionData("depositV3Pair", [ shares, UINT256_MAX, UINT256_MAX ]);
                const convertWethData = helper.interface.encodeFunctionData("convertWETH");
                const tx = await helper.connect(user).multicall(
                    VAULT_TYPE_TEAVAULTV3PAIR,
                    v3pair.target,
                    [ token0.target, token1.target ],
                    [ amount0, amount1 ],
                    [ 0n, 0n ],
                    [ 
                        depositData,
                        convertWethData,
                    ],
                    { value: ethAmount + 100n }
                );
                const token0After = await token0.balanceOf(user.address);
                const token1After = await token1.balanceOf(user.address);
                const balanceAfter = await ethers.provider.getBalance(user.address);
                const sharesAfter = await v3pair.balanceOf(user.address);
                
                // should have shares minted
                expect(sharesAfter - sharesBefore).to.equal(shares);

                // calculate tx price
                const receipt = await ethers.provider.getTransactionReceipt(tx.hash);
                const ethUsed = receipt.gasUsed * tx.gasPrice;
                
                // should have tokens refunded
                expect(token0Before - token0After).to.equal(amount0);
                expect(token1Before - token1After).to.equal(amount1);
                expect(balanceBefore - balanceAfter).to.equal(ethAmount + ethUsed);
            });
        }

        it("Should be able to swap and deposit", async function() {
            const { owner, user, helper, v3pair, token0, token1 } = await helpers.loadFixture(deployTeaVaultV3PortfolioHelper);

            // set fees
            const feeConfig = {
                vault: owner.address,
                entryFee: 1000,
                exitFee: 2000,
                performanceFee: 100000,
                managementFee: 0,
            }

            await v3pair.setFeeConfig(feeConfig);

            // deposit using helper
            // estimate how much tokens are required
            await token0.connect(user).approve(v3pair.target, UINT256_MAX);
            await token1.connect(user).approve(v3pair.target, UINT256_MAX);
            const shares = ethers.parseEther("1000");
            const amounts = await v3pair.connect(user).deposit.staticCall(shares, UINT256_MAX, UINT256_MAX);
            await token0.connect(user).approve(v3pair.target, 0);
            await token1.connect(user).approve(v3pair.target, 0);

            // swap half of token0 and deposit
            const totalAmount = amounts.depositedAmount0 * 2n * 101n / 100n;  // slight increase total amount to account for slippage
            const swapAmount = totalAmount / 2n;
            const v3Router = new ethers.Contract(testRouter, uniswapRouterABI);
            const swapper = await helper.swapper();
            const uniswapV3SwapData = v3Router.interface.encodeFunctionData("exactInputSingle", [
                [ 
                    token0.target,
                    token1.target,
                    500,
                    swapper,
                    UINT64_MAX,
                    swapAmount,
                    0n,
                    0n
                ]
            ]);
            const swapData = helper.interface.encodeFunctionData("swap", [
                token0.target,
                token1.target,
                swapAmount,
                0,
                testRouter,
                uniswapV3SwapData
            ]);

            await token0.connect(user).approve(helper.target, totalAmount);
            const depositData = helper.interface.encodeFunctionData("depositV3Pair", [ shares, UINT256_MAX, UINT256_MAX ]);
            const tx = helper.connect(user).multicall(
                VAULT_TYPE_TEAVAULTV3PAIR,
                v3pair.target,
                [ token0.target ],
                [ totalAmount ],
                [ 0n, 0n ],
                [ swapData, depositData ]
            );
            
            // should have shares minted
            await expect(tx).to.changeTokenBalance(v3pair, user, shares);

            // should have tokens refunded
            expect(await token0.balanceOf(helper.target)).to.equal(0n);
            expect(await token1.balanceOf(helper.target)).to.equal(0n);
        });

        it("Should be able to swap and deposit using depositV3PairMax", async function() {
            const { owner, user, helper, v3pair, token0, token1 } = await helpers.loadFixture(deployTeaVaultV3PortfolioHelper);

            // set fees
            const feeConfig = {
                vault: owner.address,
                entryFee: 1000,
                exitFee: 2000,
                performanceFee: 100000,
                managementFee: 0,
            }

            await v3pair.setFeeConfig(feeConfig);

            // deposit using helper
            // estimate how much tokens are required
            await token0.connect(user).approve(v3pair.target, UINT256_MAX);
            await token1.connect(user).approve(v3pair.target, UINT256_MAX);
            const shares = ethers.parseEther("1000");
            const amounts = await v3pair.connect(user).deposit.staticCall(shares, UINT256_MAX, UINT256_MAX);
            await token0.connect(user).approve(v3pair.target, 0);
            await token1.connect(user).approve(v3pair.target, 0);

            // swap half of token0 and deposit
            const totalAmount = amounts.depositedAmount0 * 2n * 101n / 100n;  // slight increase total amount to account for slippage
            const swapAmount = totalAmount / 2n;
            const v3Router = new ethers.Contract(testRouter, uniswapRouterABI);
            const swapper = await helper.swapper();
            const uniswapV3SwapData = v3Router.interface.encodeFunctionData("exactInputSingle", [
                [ 
                    token0.target,
                    token1.target,
                    500,
                    swapper,
                    UINT64_MAX,
                    swapAmount,
                    0n,
                    0n
                ]
            ]);
            const swapData = helper.interface.encodeFunctionData("swap", [
                token0.target,
                token1.target,
                swapAmount,
                0,
                testRouter,
                uniswapV3SwapData
            ]);

            const sharesBefore = await v3pair.balanceOf(user.address);
            await token0.connect(user).approve(helper.target, totalAmount);
            const depositData = helper.interface.encodeFunctionData("depositV3PairMax", [ UINT256_MAX, UINT256_MAX ]);
            await helper.connect(user).multicall(
                VAULT_TYPE_TEAVAULTV3PAIR,
                v3pair.target,
                [ token0.target ],
                [ totalAmount ],
                [ 0n, 0n ],
                [ swapData, depositData ]
            );
            const sharesAfter = await v3pair.balanceOf(user.address);
            
            // should have shares minted
            expect(sharesAfter - sharesBefore).to.be.closeTo(shares, shares / 100n);

            // should have tokens refunded
            expect(await token0.balanceOf(helper.target)).to.equal(0n);
            expect(await token1.balanceOf(helper.target)).to.equal(0n);
        });

        it("Should be able to withdraw and swap", async function() {
            const { owner, user, helper, v3pair, token0, token1 } = await helpers.loadFixture(deployTeaVaultV3PortfolioHelper);

            // set fees
            const feeConfig = {
                vault: owner.address,
                entryFee: 1000,
                exitFee: 2000,
                performanceFee: 100000,
                managementFee: 0,
            }

            await v3pair.setFeeConfig(feeConfig);

            // deposit
            // estimate how much tokens are required
            await token0.connect(user).approve(v3pair.target, UINT256_MAX);
            await token1.connect(user).approve(v3pair.target, UINT256_MAX);
            const shares = ethers.parseEther("1000");
            await v3pair.connect(user).deposit(shares, UINT256_MAX, UINT256_MAX);
            await token0.connect(user).approve(v3pair.target, 0);
            await token1.connect(user).approve(v3pair.target, 0);

            // esitmate amount of components
            const amounts = await v3pair.connect(user).withdraw.staticCall(shares, 0, 0);

            // estimate vault value in token0
            const valueInToken0 = (await v3pair.estimatedValueInToken0()) * shares / (await v3pair.totalSupply());

            // swap
            const v3Router = new ethers.Contract(testRouter, uniswapRouterABI);
            const swapper = await helper.swapper();
            const uniswapV3SwapData = v3Router.interface.encodeFunctionData("exactInputSingle", [
                [ 
                    token1.target,
                    token0.target,
                    500,
                    swapper,
                    UINT64_MAX,
                    amounts.withdrawnAmount1,
                    0n,
                    0n
                ]
            ]);
            const swapData = helper.interface.encodeFunctionData("swap", [
                token1.target,
                token0.target,
                amounts.withdrawnAmount1,
                0,
                testRouter,
                uniswapV3SwapData
            ]);

            // withdraw and swap using helper
            const sharesBefore = await v3pair.balanceOf(user.address);
            const token0Before = await token0.balanceOf(user.address);
            const withdrawData = helper.interface.encodeFunctionData("withdrawV3Pair", [ shares, 0, 0 ]);
            await v3pair.connect(user).approve(helper.target, shares);
            await helper.connect(user).multicall(
                VAULT_TYPE_TEAVAULTV3PAIR,
                v3pair.target,
                [ ],
                [ ],
                [ 0n, 0n ],
                [ withdrawData, swapData ]
            );
            const sharesAfter = await v3pair.balanceOf(user.address);
            const token0After = await token0.balanceOf(user.address);

            // should burned shares
            expect(sharesBefore - sharesAfter).to.equal(shares);

            // received token0 should be > 95% of estimated vault value in token0
            expect(token0After - token0Before > valueInToken0 * 95n / 100n).to.be.true;
        });
    });
});
