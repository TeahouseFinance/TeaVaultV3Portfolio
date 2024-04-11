const { ethers, upgrades } = require("hardhat");

function loadEnvVar(env, errorMsg) {
    if (env == undefined) {
        throw errorMsg;
    }

    return env;
}


const baseAsset = loadEnvVar(process.env.BASE_ASSET, "No BASE_ASSET");
const baseAssetOracle = loadEnvVar(process.env.BASE_ASSET_ORACLE, "No BASE_ASSET_ORACLE");

async function main() {
    const AaveATokenOracle = await ethers.getContractFactory("AaveATokenOracle");
    const aaveATokenOracle = await AaveATokenOracle.deploy(baseAsset, baseAssetOracle);
    console.log("AaveATokenOracle depolyed", aaveATokenOracle.target);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
