const { ethers, upgrades } = require("hardhat");
const fs = require('fs');

const rawConfig = fs.readFileSync("./scripts/config.json");
const config = JSON.parse(rawConfig)["UniswapV3PathRecommender"];

async function main() {
    const UniswapV3PathRecommender = await ethers.getContractFactory("UniswapV3PathRecommender");
    const uniswapV3PathRecommender = await UniswapV3PathRecommender.deploy();
    console.log("UniswapV3PathRecommender depolyed", uniswapV3PathRecommender.target);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
