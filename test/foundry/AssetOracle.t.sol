// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.21;

import "forge-std/Test.sol";
import "contracts/oracle/AssetOracle.sol";
import "contracts/test/MockToken.sol";
import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol";
import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";


contract AssetOracleTest is Test {
    uint256 forkId;
    address owner;
    address user;

    IUniswapV3Factory factory;
    address token0;
    address token1;
    address token2;
    uint24 feeTier;

    AssetOracle public assetOracle;

    function setUp() public {
        forkId = vm.createFork(
            vm.envString("UNISWAP_TEST_RPC"),
            vm.envUint("UNISWAP_TEST_BLOCK")
        );
        vm.selectFork(forkId);
        owner = vm.addr(1);
        user = vm.addr(2);

        factory = IUniswapV3Factory(vm.envAddress("UNISWAP_TEST_FACTORY"));
        token0 = vm.envAddress("UNISWAP_TEST_TOKEN0");
        token1 = vm.envAddress("UNISWAP_TEST_TOKEN1");
        token2 =  vm.envAddress("UNISWAP_TEST_TOKEN2");
        feeTier = uint24(vm.envUint("UNISWAP_TEST_FEE_TIER"));

        vm.prank(owner);
        assetOracle = new AssetOracle(token0); 
    }

    function testDecimals() public selectFork(forkId) {
        assertEq(assetOracle.decimals(), 18);
    }

    function testGetBaseAsset() public selectFork(forkId) {
        assertEq(assetOracle.getBaseAsset(), token0);
    }

    function testEnableOracle() public selectFork(forkId) selectMsgSender(owner) {
        IUniswapV3Pool pool = IUniswapV3Pool(factory.getPool(token0, token1, feeTier));
        assetOracle.enableOracle(token1, pool, 300);
        assertTrue(!assetOracle.isOracleEnabled(token0));
        assertTrue(assetOracle.isOracleEnabled(token1));
    }

    function testUnauthorizedEnabling() public selectFork(forkId) selectMsgSender(user) {
        IUniswapV3Pool pool = IUniswapV3Pool(factory.getPool(token0, token1, feeTier));
        vm.expectRevert("Ownable: caller is not the owner");
        assetOracle.enableOracle(token1, pool, 300);
    }

    function testGetTokenTwap() public selectFork(forkId) selectMsgSender(owner) {
        IUniswapV3Pool pool = IUniswapV3Pool(factory.getPool(token0, token1, feeTier));
        assetOracle.enableOracle(token1, pool, 300);
        assertEq(assetOracle.getTwap(token1), 1917207001122492887082);
    }

    function testGetBatchTokenTwap() public selectFork(forkId) selectMsgSender(owner) {
        IUniswapV3Pool pool1 = IUniswapV3Pool(factory.getPool(token0, token1, feeTier));
        assetOracle.enableOracle(token1, pool1, 300);
        IUniswapV3Pool pool2 = IUniswapV3Pool(factory.getPool(token0, token2, feeTier));
        assetOracle.enableOracle(token2, pool2, 300);
        
        uint256 value1 = assetOracle.getTwap(token1);
        uint256 value2 = assetOracle.getTwap(token2);
        assertEq(value1, 1917207001122492887082);
        assertEq(value2, 1000900360084012601);

        address[] memory tokens = new address[](2);
        uint256[] memory values = new uint256[](2);
        (tokens[0], tokens[1]) = (token1, token2);
        (values[0], values[1]) = (value1, value2);
        assertEq(assetOracle.getBatchTwap(tokens), values);
    }

    function testGetTokenValue() public selectFork(forkId) selectMsgSender(owner) {
        IUniswapV3Pool pool = IUniswapV3Pool(factory.getPool(token0, token1, feeTier));
        assetOracle.enableOracle(token1, pool, 300);
        assertEq(assetOracle.getValue(token1, 10 * 10 ** MockToken(token1).decimals()), 19172070011224928870820);
    }

    function testCannotGetTwapWithoutEnabling() public selectFork(forkId) {
        vm.expectRevert(IAssetOracle.AssetNotEnabled.selector);
        assetOracle.getTwap(token1);
    }

    function testCannotGetValueWithoutEnabling() public selectFork(forkId) {
        uint8 decimals1 = MockToken(token1).decimals();
        vm.expectRevert(IAssetOracle.AssetNotEnabled.selector);
        assetOracle.getValue(token1, 10 * 10 ** decimals1);
    }
    
    // modifiers for testing

    modifier selectMsgSender(address _addr) {
        vm.startPrank(_addr);
        _;
        vm.stopPrank();
    }

    modifier selectFork(uint256 _forkId) {
        vm.selectFork(_forkId);
        _;
    }
}
