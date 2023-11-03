const { ethers, upgrades } = require("hardhat");
const fs = require('fs');

const rawConfig = fs.readFileSync("./scripts/config.json");
const config = JSON.parse(rawConfig)["UniswapV3PathRecommender"];

async function main() {
    const UniswapV3PathRecommender = await ethers.getContractFactory("UniswapV3PathRecommender");
    // const uniswapV3PathRecommender = await UniswapV3PathRecommender.deploy();
    // console.log("UniswapV3PathRecommender depolyed", uniswapV3PathRecommender.target);

    for (let i = 0; i < config.length; i++) {
        // await uniswapV3PathRecommender.setRecommendedPath(config[i]["tokens"], config[i]["fees"]);
        console.log('-------------------------------------');
        console.log(`Path ${i + 1} set!`);
        console.log(`\tTokens: ${config[i]["tokens"]}`);
        console.log(`\tFees: ${config[i]["fees"]}`);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
