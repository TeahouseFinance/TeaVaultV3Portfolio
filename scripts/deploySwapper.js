const { ethers } = require("hardhat");

async function main() {
    const Swapper = await ethers.getContractFactory("Swapper");
    const swapper = await Swapper.deploy();
    console.log("Swapper depolyed", swapper.target);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
