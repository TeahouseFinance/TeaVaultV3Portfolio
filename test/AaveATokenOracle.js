const helpers = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const { ethers } = require("hardhat");
require("@nomicfoundation/hardhat-chai-matchers")

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

const testRpc = loadEnvVar(process.env.UNISWAP_TEST_RPC, "No UNISWAP_TEST_RPC");
const testBlock = loadEnvVarInt(process.env.UNISWAP_TEST_BLOCK, "No UNISWAP_TEST_BLOCK");
const testFactory = loadEnvVar(process.env.UNISWAP_TEST_FACTORY, "No UNISWAP_TEST_FACTORY");
const testToken0 = loadEnvVar(process.env.UNISWAP_TEST_TOKEN0, "No UNISWAP_TEST_TOKEN0");
const testToken1 = loadEnvVar(process.env.UNISWAP_TEST_TOKEN1, "No UNISWAP_TEST_TOKEN1");
const testToken2 = loadEnvVar(process.env.UNISWAP_TEST_TOKEN2, "No UNISWAP_TEST_TOKEN2");
const testToken3 = loadEnvVar(process.env.UNISWAP_TEST_TOKEN3, "No UNISWAP_TEST_TOKEN3");
const testFeeTier = loadEnvVarInt(process.env.UNISWAP_TEST_FEE_TIER, "No UNISWAP_TEST_FEE_TIER");
const testAavePool = loadEnvVar(process.env.AAVE_TEST_POOL, "No AAVE_TEST_POOL");

const uniswapFactoryABI = [{"inputs":[],"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint24","name":"fee","type":"uint24"},{"indexed":true,"internalType":"int24","name":"tickSpacing","type":"int24"}],"name":"FeeAmountEnabled","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"oldOwner","type":"address"},{"indexed":true,"internalType":"address","name":"newOwner","type":"address"}],"name":"OwnerChanged","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"token0","type":"address"},{"indexed":true,"internalType":"address","name":"token1","type":"address"},{"indexed":true,"internalType":"uint24","name":"fee","type":"uint24"},{"indexed":false,"internalType":"int24","name":"tickSpacing","type":"int24"},{"indexed":false,"internalType":"address","name":"pool","type":"address"}],"name":"PoolCreated","type":"event"},{"inputs":[{"internalType":"address","name":"tokenA","type":"address"},{"internalType":"address","name":"tokenB","type":"address"},{"internalType":"uint24","name":"fee","type":"uint24"}],"name":"createPool","outputs":[{"internalType":"address","name":"pool","type":"address"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint24","name":"fee","type":"uint24"},{"internalType":"int24","name":"tickSpacing","type":"int24"}],"name":"enableFeeAmount","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint24","name":"","type":"uint24"}],"name":"feeAmountTickSpacing","outputs":[{"internalType":"int24","name":"","type":"int24"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"},{"internalType":"address","name":"","type":"address"},{"internalType":"uint24","name":"","type":"uint24"}],"name":"getPool","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"owner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"parameters","outputs":[{"internalType":"address","name":"factory","type":"address"},{"internalType":"address","name":"token0","type":"address"},{"internalType":"address","name":"token1","type":"address"},{"internalType":"uint24","name":"fee","type":"uint24"},{"internalType":"int24","name":"tickSpacing","type":"int24"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"_owner","type":"address"}],"name":"setOwner","outputs":[],"stateMutability":"nonpayable","type":"function"}];

async function deployAaveATokenOracle() {
    // fork a testing environment
    await helpers.reset(testRpc, testBlock);

    // Contracts are deployed using the first signer/account by default
    const [owner, user] = await ethers.getSigners();

    // get ERC20 tokens
    const MockToken = await ethers.getContractFactory("MockToken");
    const token0 = MockToken.attach(testToken0);
    const token1 = MockToken.attach(testToken1);
    const token2 = MockToken.attach(testToken2);
    const token3 = MockToken.attach(testToken3);

    // deploy price oracles
    const AssetOracle = await ethers.getContractFactory("AssetOracle");
    const assetOracle = await AssetOracle.deploy(token0.target);

    // enable token1, token2 and token3 on assetOracle
    const factory = await ethers.getContractAt(uniswapFactoryABI, testFactory);
    const pool1 = await factory.getPool(token0.target, token1.target, testFeeTier);
    await assetOracle.enableOracle(token1.target, [pool1], [300]);
    const pool2 = await factory.getPool(token0.target, token2.target, testFeeTier);
    await assetOracle.enableOracle(token2.target, [pool2], [300]);
    const pool3 = await factory.getPool(token3.target, token0.target, testFeeTier);
    await assetOracle.enableOracle(token3.target, [pool3], [300]);

    const AaveATokenOracle = await ethers.getContractFactory("AaveATokenOracle");
    const aaveATokenOracle = await AaveATokenOracle.deploy(token0.target, assetOracle.target);

    const AavePool = await ethers.getContractAt("IPool", testAavePool);
    const aavePool = AavePool.attach(testAavePool);
    const aToken1 = MockToken.attach((await aavePool.getReserveData(token1.target))[8]);
    const aToken2 = MockToken.attach((await aavePool.getReserveData(token2.target))[8]);
    const aToken3 = MockToken.attach((await aavePool.getReserveData(token3.target))[8]);

    return { owner, user, aaveATokenOracle, token0, aToken1, aToken2, aToken3 }
}

describe("AaveATokenOracle", function () {
    it("Should set the correct decimals", async function () {
        const { aaveATokenOracle } = await helpers.loadFixture(deployAaveATokenOracle);

        expect(await aaveATokenOracle.decimals()).to.equal(18n);
    });

    it("Should set the correct base token", async function () {
        const { aaveATokenOracle, token0 } = await helpers.loadFixture(deployAaveATokenOracle);

        expect(await aaveATokenOracle.getBaseAsset()).to.equal(token0.target);
    });


    it("Should be able to enable oracle from owner", async function() {
        const { aaveATokenOracle, aToken1, aToken2 } = await helpers.loadFixture(deployAaveATokenOracle);

        await aaveATokenOracle.enableOracle(aToken1.target);

        expect(await aaveATokenOracle.isOracleEnabled(aToken1.target)).to.equal(true);
        expect(await aaveATokenOracle.isOracleEnabled(aToken2.target)).to.equal(false);
    });

    it("Should not be able to enable oracle from non-owner", async function() {
        const { aaveATokenOracle, user, aToken1 } = await helpers.loadFixture(deployAaveATokenOracle);
       
        await expect(aaveATokenOracle.connect(user).enableOracle(aToken1.target)).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should be able to get token twap", async function() {
        const { aaveATokenOracle, aToken1 } = await helpers.loadFixture(deployAaveATokenOracle);
        
        await aaveATokenOracle.enableOracle(aToken1.target);
        const value = await aaveATokenOracle.getTwap(aToken1.target);
        expect(value).to.equal(1917207001122492887082n);    // this value depends on actual market price at the time of the block
    });

    it("Should be able to get multiple token twap", async function() {
        const { aaveATokenOracle, aToken1, aToken2, aToken3 } = await helpers.loadFixture(deployAaveATokenOracle);

        await aaveATokenOracle.enableOracle(aToken1.target);
        await aaveATokenOracle.enableOracle(aToken2.target);
        await aaveATokenOracle.enableOracle(aToken3.target); 

        const value1 = await aaveATokenOracle.getTwap(aToken1.target);
        const value2 = await aaveATokenOracle.getTwap(aToken2.target);
        const value3 = await aaveATokenOracle.getTwap(aToken3.target);

        expect(value1).to.equal(1917207001122492887082n);
        expect(value2).to.equal(1000900360084012601n);
        expect(value3).to.equal(30055017868696708191670n);
        expect(await aaveATokenOracle.getBatchTwap([ aToken1.target, aToken2.target, aToken3.target ]))
        .to.eql([ value1, value2, value3 ]);
    });    

    it("Should be able to get token value", async function() {
        const { aaveATokenOracle, aToken1, aToken3 } = await helpers.loadFixture(deployAaveATokenOracle);
       
        await aaveATokenOracle.enableOracle(aToken1.target);
        await aaveATokenOracle.enableOracle(aToken3.target);
        
        expect(await aaveATokenOracle.getValue(aToken1.target, ethers.parseUnits("10", await aToken1.decimals())))
        .to.equal(19172070011224928870820n); // this value depends on actual market price at the time of the block
        expect(await aaveATokenOracle.getValue(aToken3.target, ethers.parseUnits("10", await aToken3.decimals())))
        .to.equal(300550178686967081916700n); // this value depends on actual market price at the time of the block 
    });

    it("Should not be able to get token twap without enabling oracle", async function() {
        const { aaveATokenOracle, aToken1 } = await helpers.loadFixture(deployAaveATokenOracle);

        await expect(aaveATokenOracle.getTwap(aToken1.target)).to.be.revertedWithCustomError(aaveATokenOracle, "AssetNotEnabled");
    });

    it("Should not be able to get token value without enabling oracle", async function() {
        const { aaveATokenOracle, aToken1 } = await helpers.loadFixture(deployAaveATokenOracle);
       
        await expect(aaveATokenOracle.getValue(aToken1.target, ethers.parseUnits("10", await aToken1.decimals())))
        .to.be.revertedWithCustomError(aaveATokenOracle, "AssetNotEnabled");
    });    
});
