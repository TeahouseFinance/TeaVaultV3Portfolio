const { ethers, upgrades } = require("hardhat");

function loadEnvVar(env, errorMsg) {
    if (env == undefined) {
        throw errorMsg;
    }

    return env;
}

const assetsHelper= loadEnvVar(process.env.ASSETS_HELPER, "No ASSETS_HELPER");
const proxy = loadEnvVar(process.env.PROXY, "No PROXY");

async function main() {
    const TeaVaultV3Portfolio = await ethers.getContractFactory("TeaVaultV3Portfolio", {
        libraries: {
            AssetsHelper: assetsHelper,
        },
    });

    console.log("Upgrading TeaVaultV3Portfolio...");
    const newLogic = await upgrades.upgradeProxy(proxy, TeaVaultV3Portfolio, {
        kind: "uups",
        unsafeAllowLinkedLibraries: true,
        unsafeAllow: ["delegatecall"],
    });
    console.log("TeaVaultV3Portfolio upgraded successfully, new implementation:", newLogic.target);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});