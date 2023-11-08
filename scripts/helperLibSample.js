// A sample script on how to use the helper contract

const helpers = require("@nomicfoundation/hardhat-network-helpers");
const { ethers, upgrades } = require("hardhat");
const helperLib = require("./helperLib.js");
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

const UINT256_MAX = '0x' + 'f'.repeat(64);
const UINT64_MAX = '0x' + 'f'.repeat(16);

const uniswapFactoryABI = [{"inputs":[],"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint24","name":"fee","type":"uint24"},{"indexed":true,"internalType":"int24","name":"tickSpacing","type":"int24"}],"name":"FeeAmountEnabled","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"oldOwner","type":"address"},{"indexed":true,"internalType":"address","name":"newOwner","type":"address"}],"name":"OwnerChanged","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"token0","type":"address"},{"indexed":true,"internalType":"address","name":"token1","type":"address"},{"indexed":true,"internalType":"uint24","name":"fee","type":"uint24"},{"indexed":false,"internalType":"int24","name":"tickSpacing","type":"int24"},{"indexed":false,"internalType":"address","name":"pool","type":"address"}],"name":"PoolCreated","type":"event"},{"inputs":[{"internalType":"address","name":"tokenA","type":"address"},{"internalType":"address","name":"tokenB","type":"address"},{"internalType":"uint24","name":"fee","type":"uint24"}],"name":"createPool","outputs":[{"internalType":"address","name":"pool","type":"address"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint24","name":"fee","type":"uint24"},{"internalType":"int24","name":"tickSpacing","type":"int24"}],"name":"enableFeeAmount","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint24","name":"","type":"uint24"}],"name":"feeAmountTickSpacing","outputs":[{"internalType":"int24","name":"","type":"int24"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"},{"internalType":"address","name":"","type":"address"},{"internalType":"uint24","name":"","type":"uint24"}],"name":"getPool","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"owner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"parameters","outputs":[{"internalType":"address","name":"factory","type":"address"},{"internalType":"address","name":"token0","type":"address"},{"internalType":"address","name":"token1","type":"address"},{"internalType":"uint24","name":"fee","type":"uint24"},{"internalType":"int24","name":"tickSpacing","type":"int24"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"_owner","type":"address"}],"name":"setOwner","outputs":[],"stateMutability":"nonpayable","type":"function"}];

async function deployTeaVaultV3Portfolio() {
    // fork a testing environment
    // does not specify a block because we want to use 1inch API
    // and it has to be fairly close to the latest block
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
    await token0.connect(token0Whale).transfer(user.address, ethers.parseUnits("10000", await token0.decimals()));

    await helpers.impersonateAccount(testToken1Whale);
    const token1Whale = await ethers.getSigner(testToken1Whale);
    await helpers.setBalance(token1Whale.address, ethers.parseEther("100"));  // assign some eth to the whale in case it's a contract and not accepting eth
    await token1.connect(token1Whale).transfer(user.address, ethers.parseUnits("10000", await token1.decimals()));

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
            owner.address,
        ],
        { 
            kind: "uups",
            unsafeAllow: [ 'delegatecall' ],
        }
    );

    await pathRecommender.setRecommendedPath([ token0.target, token1.target ], [ 500 ]);

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

async function testDepositV3Portfolio(helper, vault, user, token, amount) {
    // preview deposit to TeaVaultV3Portfolio
    console.log("DepositV3Portfolio:");
    const previewDeposit = await helperLib.previewDepositV3Portfolio(helper, vault, token.target, amount);
    console.log(previewDeposit);

    console.log("estimated shares:", previewDeposit.estimatedShares);

    // make a simulated call
    // simulated call requires approve to work
    await token.connect(user).approve(helper.target, amount);
    const results = await user.call({
        to: previewDeposit.helper,
        data: previewDeposit.callData,
    });

    // decode results
    const decodedResults = helper.interface.decodeFunctionResult("multicall", results);
    const depositResults = helper.interface.decodeFunctionResult("depositMax", decodedResults[0][previewDeposit.depositIndex]);
    console.log("estimated shares deposited:", depositResults.shares);

    // actually call data
    const sharesBefore = await vault.balanceOf(user.address);
    await user.sendTransaction({
        to: previewDeposit.helper,
        data: previewDeposit.callData,
    });
    const sharesAfter = await vault.balanceOf(user.address);
    console.log("shares minted:", sharesAfter - sharesBefore);
}

async function testDepositV3PortfolioShares(helper, vault, user, shares) {
    // preview deposit to TeaVaultV3Portfolio
    console.log("DepositV3PortfolioShares:");
    const previewDeposit = await helperLib.previewDepositV3PortfolioShares(helper, vault, shares);
    console.log(previewDeposit);

    // make a simulated call
    // simulated call requires approve to work
    const MockToken = await ethers.getContractFactory("MockToken");
    for (let i = 0; i < previewDeposit.componentTokens.length; i++) {
        const token = MockToken.attach(previewDeposit.componentTokens[i]);
        await token.connect(user).approve(helper.target, UINT256_MAX);
        console.log(await token.balanceOf(user.address));
    }

    // actually call data
    const sharesBefore = await vault.balanceOf(user.address);
    await user.sendTransaction({
        to: previewDeposit.helper,
        data: previewDeposit.callData,
    });
    const sharesAfter = await vault.balanceOf(user.address);
    console.log("shares to mint:", shares);
    console.log("shares minted:", sharesAfter - sharesBefore);
}

async function testDepositV3PortfolioEth(helper, vault, user, token, amount) {
    // preview deposit to TeaVaultV3Portfolio
    console.log("DepositV3PortfolioEth:");
    const previewDeposit = await helperLib.previewDepositV3Portfolio(helper, vault, token.target, 0, undefined, amount);
    console.log(previewDeposit);

    console.log("estimated shares:", previewDeposit.estimatedShares);

    // make a simulated call
    const results = await user.call({
        to: previewDeposit.helper,
        data: previewDeposit.callData,
        value: amount,
    });

    // decode results
    const decodedResults = helper.interface.decodeFunctionResult("multicall", results);
    const depositResults = helper.interface.decodeFunctionResult("depositMax", decodedResults[0][previewDeposit.depositIndex]);
    console.log("estimated shares deposited:", depositResults.shares);

    // actually call data
    const sharesBefore = await vault.balanceOf(user.address);
    await user.sendTransaction({
        to: previewDeposit.helper,
        data: previewDeposit.callData,
        value: amount,
    });
    const sharesAfter = await vault.balanceOf(user.address);
    console.log("shares minted:", sharesAfter - sharesBefore);
}

async function testWithdrawV3Portfolio(helper, vault, user, token, shares) {
    // preview withdraw from TeaVaultV3Portfolio
    console.log("WithdrawV3Portfolio:");
    const previewWithdraw = await helperLib.previewWithdrawV3Portfolio(helper, vault.connect(user), shares, token.target);
    console.log(previewWithdraw);

    // actually call data
    const tokenBefore = await token.balanceOf(user.address);
    const balanceBefore = await ethers.provider.getBalance(user.address);
    await vault.connect(user).approve(helper.target, shares);
    await user.sendTransaction({
        to: previewWithdraw.helper,
        data: previewWithdraw.callData,
    });
    const tokenAfter = await token.balanceOf(user.address);
    const balanceAfter = await ethers.provider.getBalance(user.address);

    console.log("token diff:", tokenAfter - tokenBefore);
    console.log("eth diff:", balanceAfter - balanceBefore);
}

async function testDepositV3Pair(helper, vault, user, token, amount) {
    // preview deposit to TeaVaultV3Pair
    console.log("DepositV3Pair:");
    const previewDeposit = await helperLib.previewDepositV3Pair(helper, vault, token.target, amount);
    console.log(previewDeposit);

    console.log("estimated shares:", previewDeposit.estimatedShares);

    // make a simulated call
    // simulated call requires approve to work
    await token.connect(user).approve(helper.target, amount);
    const results = await user.call({
        to: previewDeposit.helper,
        data: previewDeposit.callData,
    });

    // decode results
    const decodedResults = helper.interface.decodeFunctionResult("multicall", results);
    const depositResults = helper.interface.decodeFunctionResult("depositV3PairMax", decodedResults[0][previewDeposit.depositIndex]);
    console.log("estimated shares deposited:", depositResults.shares);

    // actually call data
    const sharesBefore = await vault.balanceOf(user.address);
    await user.sendTransaction({
        to: previewDeposit.helper,
        data: previewDeposit.callData,
    });
    const sharesAfter = await vault.balanceOf(user.address);
    console.log("shares minted:", sharesAfter - sharesBefore);
}

async function testDepositV3PairEth(helper, vault, user, token, amount) {
    // preview deposit to TeaVaultV3Pair
    console.log("DepositV3PairEth:");
    const previewDeposit = await helperLib.previewDepositV3Pair(helper, vault, token.target, 0, undefined, amount);
    console.log(previewDeposit);

    console.log("estimated shares:", previewDeposit.estimatedShares);

    // make a simulated call
    const results = await user.call({
        to: previewDeposit.helper,
        data: previewDeposit.callData,
        value: amount,
    });

    // decode results
    const decodedResults = helper.interface.decodeFunctionResult("multicall", results);
    const depositResults = helper.interface.decodeFunctionResult("depositV3PairMax", decodedResults[0][previewDeposit.depositIndex]);
    console.log("estimated shares deposited:", depositResults.shares);

    // actually call data
    const sharesBefore = await vault.balanceOf(user.address);
    await user.sendTransaction({
        to: previewDeposit.helper,
        data: previewDeposit.callData,
        value: amount,
    });
    const sharesAfter = await vault.balanceOf(user.address);
    console.log("shares minted:", sharesAfter - sharesBefore);
}

async function testWithdrawV3Pair(helper, vault, user, token, shares) {
    // preview withdraw from TeaVaultV3Pair
    console.log("WithdrawV3Pair:");
    const previewWithdraw = await helperLib.previewWithdrawV3Pair(helper, vault.connect(user), shares, token.target);
    console.log(previewWithdraw);

    // actually call data
    const tokenBefore = await token.balanceOf(user.address);
    const balanceBefore = await ethers.provider.getBalance(user.address);
    await vault.connect(user).approve(helper.target, shares);
    await user.sendTransaction({
        to: previewWithdraw.helper,
        data: previewWithdraw.callData,
    });
    const tokenAfter = await token.balanceOf(user.address);
    const balanceAfter = await ethers.provider.getBalance(user.address);

    console.log("token diff:", tokenAfter - tokenBefore);
    console.log("eth diff:", balanceAfter - balanceBefore);
}

async function main() {
    const { manager, user, vault, helper, token0, token1, v3pair, aToken0 } = await deployTeaVaultV3PortfolioHelper();

    const token0Decimals = await token0.decimals();    
    const shares = ethers.parseEther("1000");
    const tokens = ethers.parseUnits("1000", token0Decimals);
    await token0.connect(user).approve(vault.target, UINT256_MAX);
    await vault.connect(user).deposit(shares);

    // convert half of token0 to token1
    await vault.connect(manager).uniswapV3SwapViaSwapRouter(
        true,
        [ token0.target, token1.target ],
        [ 500 ],
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

    // tests
    await testDepositV3Portfolio(helper, vault, user, token1, ethers.parseEther("10"));
    await testDepositV3PortfolioShares(helper, vault, user, ethers.parseEther("1"));
    await testDepositV3PortfolioEth(helper, vault, user, token1, ethers.parseEther("10"));
    await testWithdrawV3Portfolio(helper, vault, user, token0, ethers.parseEther("10"));

    await testDepositV3Pair(helper, v3pair, user, token1, ethers.parseEther("10"));
    await testDepositV3PairEth(helper, v3pair, user, token1, ethers.parseEther("10"));
    await testWithdrawV3Pair(helper, v3pair, user, token0, ethers.parseEther("10"));
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
