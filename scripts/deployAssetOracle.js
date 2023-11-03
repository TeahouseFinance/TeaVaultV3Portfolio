const { ethers, upgrades } = require("hardhat");

function loadEnvVar(env, errorMsg) {
    if (env == undefined) {
        throw errorMsg;
    }

    return env;
}


const baseAsset = loadEnvVar(process.env.BASE_ASSET, "No BASE_ASSET");
// const owner = loadEnvVar(process.env.OWNER, "No OWNER");


async function main() {
    const AssetOracle = await ethers.getContractFactory("AssetOracle");
    const assetOracle = await AssetOracle.deploy(baseAsset);
    console.log("AssetOracle depolyed", assetOracle.target);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
