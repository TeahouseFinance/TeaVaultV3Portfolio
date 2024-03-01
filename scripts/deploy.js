const { ethers, upgrades } = require("hardhat");

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

function loadEnvArr(env, errorMsg) {
    if (env == undefined) {
        throw errorMsg;
    }

    return env.split(",").map(item => item.trim());
}

function power128(a, n) {
    let result = 1n << 128n;

    while (n > 0) {
        if ((n & 1) == 1) {
            result = (result * a) >> 128n;
        }

        n >>= 1;
        a = (a * a) >> 128n;
    }

    return result;
}

function estimateDecayFactor(a, n) {
    let result = 1n << 128n;

    let step;
    do {
        let an = power128(result, n) - a;
        let slope = power128(result, n - 1) * BigInt(n);
        step = (an << 128n) / slope;
        result = result - step;
    } while (step != 0n);

    return result;
}

const name = loadEnvVar(process.env.NAME, "No NAME");
const symbol = loadEnvVar(process.env.SYMBOL, "No SYMBOL");
const feeCap = loadEnvVar(process.env.FEE_CAP, "No FEE_CAP");
const feeVault = loadEnvVar(process.env.FEE_VAULT, "No FEE_VAULT");
const entryFee = loadEnvVarInt(process.env.ENTRY_FEE, "No ENTRY_FEE");
const exitFee = loadEnvVarInt(process.env.EXIT_FEE, "No EXIT_FEE");
const performanceFee = loadEnvVarInt(process.env.PPERFORMANCE_FEE, "No PPERFORMANCE_FEE");
const managementFee = loadEnvVarInt(process.env.MANAGEMENT_FEE, "No MANAGEMENT_FEE");
const decayPercentageOneYear = loadEnvVarInt(process.env.DECAY_PERCENTAGE_ONE_YEAR, "No DECAY_PERCENTAGE_ONE_YEAR");
const manager = loadEnvVar(process.env.MANAGER, "No MANAGER");
const baseAsset = loadEnvVar(process.env.BASE_ASSET, "No BASE_ASSET");
const assets = loadEnvArr(process.env.ASSETS, "No ASSETS");
const assetTypes = loadEnvArr(process.env.ASSET_TYPES, "No ASSET TYPES");
const aavePool = loadEnvVar(process.env.AAVE_POOL, "No AAVE_POOL");
const uniswapV3SwapRouter = loadEnvVar(process.env.UNISWAP_V3_SWAP_ROUTER, "No UNISWAP_V3_SWAP_ROUTER");
const pathRecommender = loadEnvVar(process.env.PATH_RECOMMENDER, "No PATH_RECOMMENDER");
const baseAssetOracle = loadEnvVar(process.env.BASE_ASSET_ORACLE, "No BASE_ASSET_ORACLE");
const aaveATokenOracle = loadEnvVar(process.env.AAVE_A_TOKEN_ORACLE, "No AAVE_A_TOKEN_ORACLE");
const teaVaultV3PairOracle = loadEnvVar(process.env.TEA_VAULT_V3_PAIT_ORACLE, "No TEA_VAULT_V3_PAIT_ORACLE");
const swapper = loadEnvVar(process.env.SWAPPER, "No SWAPPER");
const owner = loadEnvVar(process.env.OWNER, "No OWNER");


async function main() {
    // const [deployer] = await ethers.getSigners();

    // deploy AssetsHelper
    const AssetsHelper = await ethers.getContractFactory("AssetsHelper");
    const assetsHelper = await AssetsHelper.deploy();
    console.log("Lib AssetsHelper", assetsHelper.target);

    // deploy TeaVaultV3Portfolio
    const TeaVaultV3Portfolio = await ethers.getContractFactory("TeaVaultV3Portfolio", {
        libraries: { AssetsHelper: assetsHelper.target }
    });
    const decayFactor = estimateDecayFactor((1n << 128n) * BigInt(decayPercentageOneYear) / (100n), 86400 * 360);
    const vault = await upgrades.deployProxy(
        TeaVaultV3Portfolio,
        [
            name,
            symbol,
            feeCap,
            [feeVault, entryFee, exitFee, managementFee, performanceFee, decayFactor],
            manager,
            baseAsset,
            assets,
            assetTypes,
            aavePool,
            uniswapV3SwapRouter,
            pathRecommender,
            baseAssetOracle,
            aaveATokenOracle,
            teaVaultV3PairOracle,
            swapper,
            owner
        ],
        {
            kind: "uups",
            unsafeAllowLinkedLibraries: true,
            unsafeAllow: ["delegatecall"],
        }
    );
    console.log("Vault depolyed", vault.target);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
