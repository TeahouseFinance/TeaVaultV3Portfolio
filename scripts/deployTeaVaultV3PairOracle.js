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
    const TeaVaultV3PairOracle = await ethers.getContractFactory("TeaVaultV3PairOracle");
    const teaVaultV3PairOracle = await TeaVaultV3PairOracle.deploy(baseAsset, baseAssetOracle);
    console.log("TeaVaultV3PairOracle depolyed", teaVaultV3PairOracle.target);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
