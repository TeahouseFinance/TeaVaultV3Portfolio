// A simple library for using the Helper contract
// Teahouse Finance

const fetch = require('node-fetch');
const ethers = require('ethers');

const HARDHAT_NETWORK_CHAINID = 31337;
const OVERRIDE_CHAINID = 1; // override chainId for forked hardhat network

const UINT256_MAX = '0x' + 'f'.repeat(64);
const UINT64_MAX = '0x' + 'f'.repeat(16);
const ERC20ABI = [
    "function decimals() external view returns (uint8)",
];
const V3PairABI = [
    "function assetToken0() external view returns (address token0)",
    "function assetToken1() external view returns (address token1)",
];
const ATokenABI = [
    "function UNDERLYING_ASSET_ADDRESS() external view returns (address)",
];
const uniswapRouterABI = [{"inputs":[{"internalType":"address","name":"_factory","type":"address"},{"internalType":"address","name":"_WETH9","type":"address"}],"stateMutability":"nonpayable","type":"constructor"},{"inputs":[],"name":"WETH9","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"components":[{"internalType":"bytes","name":"path","type":"bytes"},{"internalType":"address","name":"recipient","type":"address"},{"internalType":"uint256","name":"deadline","type":"uint256"},{"internalType":"uint256","name":"amountIn","type":"uint256"},{"internalType":"uint256","name":"amountOutMinimum","type":"uint256"}],"internalType":"struct ISwapRouter.ExactInputParams","name":"params","type":"tuple"}],"name":"exactInput","outputs":[{"internalType":"uint256","name":"amountOut","type":"uint256"}],"stateMutability":"payable","type":"function"},{"inputs":[{"components":[{"internalType":"address","name":"tokenIn","type":"address"},{"internalType":"address","name":"tokenOut","type":"address"},{"internalType":"uint24","name":"fee","type":"uint24"},{"internalType":"address","name":"recipient","type":"address"},{"internalType":"uint256","name":"deadline","type":"uint256"},{"internalType":"uint256","name":"amountIn","type":"uint256"},{"internalType":"uint256","name":"amountOutMinimum","type":"uint256"},{"internalType":"uint160","name":"sqrtPriceLimitX96","type":"uint160"}],"internalType":"struct ISwapRouter.ExactInputSingleParams","name":"params","type":"tuple"}],"name":"exactInputSingle","outputs":[{"internalType":"uint256","name":"amountOut","type":"uint256"}],"stateMutability":"payable","type":"function"},{"inputs":[{"components":[{"internalType":"bytes","name":"path","type":"bytes"},{"internalType":"address","name":"recipient","type":"address"},{"internalType":"uint256","name":"deadline","type":"uint256"},{"internalType":"uint256","name":"amountOut","type":"uint256"},{"internalType":"uint256","name":"amountInMaximum","type":"uint256"}],"internalType":"struct ISwapRouter.ExactOutputParams","name":"params","type":"tuple"}],"name":"exactOutput","outputs":[{"internalType":"uint256","name":"amountIn","type":"uint256"}],"stateMutability":"payable","type":"function"},{"inputs":[{"components":[{"internalType":"address","name":"tokenIn","type":"address"},{"internalType":"address","name":"tokenOut","type":"address"},{"internalType":"uint24","name":"fee","type":"uint24"},{"internalType":"address","name":"recipient","type":"address"},{"internalType":"uint256","name":"deadline","type":"uint256"},{"internalType":"uint256","name":"amountOut","type":"uint256"},{"internalType":"uint256","name":"amountInMaximum","type":"uint256"},{"internalType":"uint160","name":"sqrtPriceLimitX96","type":"uint160"}],"internalType":"struct ISwapRouter.ExactOutputSingleParams","name":"params","type":"tuple"}],"name":"exactOutputSingle","outputs":[{"internalType":"uint256","name":"amountIn","type":"uint256"}],"stateMutability":"payable","type":"function"},{"inputs":[],"name":"factory","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes[]","name":"data","type":"bytes[]"}],"name":"multicall","outputs":[{"internalType":"bytes[]","name":"results","type":"bytes[]"}],"stateMutability":"payable","type":"function"},{"inputs":[],"name":"refundETH","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"address","name":"token","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"},{"internalType":"uint256","name":"deadline","type":"uint256"},{"internalType":"uint8","name":"v","type":"uint8"},{"internalType":"bytes32","name":"r","type":"bytes32"},{"internalType":"bytes32","name":"s","type":"bytes32"}],"name":"selfPermit","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"address","name":"token","type":"address"},{"internalType":"uint256","name":"nonce","type":"uint256"},{"internalType":"uint256","name":"expiry","type":"uint256"},{"internalType":"uint8","name":"v","type":"uint8"},{"internalType":"bytes32","name":"r","type":"bytes32"},{"internalType":"bytes32","name":"s","type":"bytes32"}],"name":"selfPermitAllowed","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"address","name":"token","type":"address"},{"internalType":"uint256","name":"nonce","type":"uint256"},{"internalType":"uint256","name":"expiry","type":"uint256"},{"internalType":"uint8","name":"v","type":"uint8"},{"internalType":"bytes32","name":"r","type":"bytes32"},{"internalType":"bytes32","name":"s","type":"bytes32"}],"name":"selfPermitAllowedIfNecessary","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"address","name":"token","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"},{"internalType":"uint256","name":"deadline","type":"uint256"},{"internalType":"uint8","name":"v","type":"uint8"},{"internalType":"bytes32","name":"r","type":"bytes32"},{"internalType":"bytes32","name":"s","type":"bytes32"}],"name":"selfPermitIfNecessary","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"address","name":"token","type":"address"},{"internalType":"uint256","name":"amountMinimum","type":"uint256"},{"internalType":"address","name":"recipient","type":"address"}],"name":"sweepToken","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"address","name":"token","type":"address"},{"internalType":"uint256","name":"amountMinimum","type":"uint256"},{"internalType":"address","name":"recipient","type":"address"},{"internalType":"uint256","name":"feeBips","type":"uint256"},{"internalType":"address","name":"feeRecipient","type":"address"}],"name":"sweepTokenWithFee","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"int256","name":"amount0Delta","type":"int256"},{"internalType":"int256","name":"amount1Delta","type":"int256"},{"internalType":"bytes","name":"_data","type":"bytes"}],"name":"uniswapV3SwapCallback","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"amountMinimum","type":"uint256"},{"internalType":"address","name":"recipient","type":"address"}],"name":"unwrapWETH9","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"uint256","name":"amountMinimum","type":"uint256"},{"internalType":"address","name":"recipient","type":"address"},{"internalType":"uint256","name":"feeBips","type":"uint256"},{"internalType":"address","name":"feeRecipient","type":"address"}],"name":"unwrapWETH9WithFee","outputs":[],"stateMutability":"payable","type":"function"},{"stateMutability":"payable","type":"receive"}];
const uniswapPoolABI = [
    "function token0() external view returns (address)",
    "function token1() external view returns (address)",
    "function fee() external view returns (uint24)",
    "function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)",
];

module.exports = {
    getQuoteFromLiFi,
    previewDepositV3Portfolio,
    previewDepositV3PortfolioShares,
    previewWithdrawV3Portfolio,
    previewDepositV3Pair,
    previewDepositV3PairUniV3,
    previewWithdrawV3Pair,
    previewWithdrawV3PairUniV3,
};

const FQDN_LIFI = 'https://li.quest/v1/';
const INTEGRATOR = "teahousefinance";

const VAULT_TYPE_TEAVAULTV3PAIR = 0;
const VAULT_TYPE_TEAVAULTV3PORTFOLIO = 1;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// convert opt to URL query string
function optToString(opt) {
    let result = '';
    if (opt == undefined) {
        return '';
    }

    Object.keys(opt).forEach((key) => {
        const value = opt[key];
        if (result != '') {
            result += '&';
        }

        result += encodeURIComponent(key) + '=' + encodeURIComponent(value);
    });

    return result;
}

async function getPriceFromUniV3Pool(pool, zeroToOne, amount) {
    const slot0 = await pool.slot0();
    console.log(slot0);
    amount = BigInt(amount);
    if (zeroToOne) {
        // amount is token0, convert to token1
        return amount * (slot0.sqrtPriceX96 * slot0.sqrtPriceX96) / (2n ** 192n);
    }
    else {
        // amount is token1, convert to token0
        return amount * 2n ** 192n / (slot0.sqrtPriceX96 * slot0.sqrtPriceX96);
    }
}

function minAmountWithSlippage(amount, slippage) {
    return amount * BigInt((1 - Number(slippage)) * 1000000) / 1000000n;
}

/// Get a swap quote from li.fi
///
/// @param chainId is the chain ID to do the swap
/// @param fromToken is the address of source token
/// @param toToken is the address of target token
/// @param amount is the amount of source token to swap
/// @param fromAddress is the address to do the swap
/// @param slippage is the slippage allowed, 0.005 means 0.5%
/// @param opt is the optional parameters to send to li.fi
/// @return the quote object from li.fi
async function getQuoteFromLiFi(chainId, fromToken, toToken, amount, fromAddress, slippage = '0.005', opt = undefined) {
    if (chainId == HARDHAT_NETWORK_CHAINID) chainId = OVERRIDE_CHAINID;
    const optString = optToString(opt);
    const url = FQDN_LIFI + 'quote?'
        + 'fromChain=' + chainId + '&'
        + 'toChain=' + chainId + '&'
        + 'fromToken=' + fromToken + '&'
        + 'toToken=' + toToken + '&'
        + 'fromAddress=' + fromAddress + '&'
        + 'fromAmount=' + amount + '&'
        + 'integrator=' + INTEGRATOR
        + 'slippage=' + slippage
        + (optString == '' ? '' : '&' + optString);
    const response = await fetch(url, {
        headers: {
            "accept": "application/json",
        },        
    });

    await sleep(1000);

    if (response.status == 200) {
        const jsonData = await response.json();
        return jsonData;
    }
    else {
        const jsonData = await response.json();
        if (jsonData.message != undefined) {
            throw new Error("Unable to get quote from li.fi\n" + jsonData.message);
        }
        else if (jsonData.error != undefined) {
            throw new Error("Unable to get quote from li.fi\n" + jsonData.error);
        }
        else {
            throw new Error("Unable to get quote from li.fi");
        }
    }
}

/// Preview deposit for TeaVaultV3Portfolio
///
/// @param helper is a TeaVaultV3PortfolioHelper contract object created using ethers.js v6
/// @param vault is a TeaVaultV3Portfolio contract object created using ethers.js v6
/// @parma token is the address of original token
/// @param amount is the amount of original token in BigInt
/// @param slippage is the slippage allowed, default to 0.005 (0.005 means 0.5%)
/// @param eth is the total amount of eth to use (token must be WETH9 if eth is not 0n)
/// @param opt is optional parameters for li.fi
/// @return an object contains the followings
///   originToken is the address of original token
///   originAmount is the amount of original Token in BigInt
///   eth is the amount of eth to be used in BigInt
///   conversions is an array contains objects describing conversion steps
///   estimatedShares is the estimated amount of shares to be minted
///   componentTokens is the array of the component token addresses
///   estimatedComponents is the array of the estimated amount of component tokens
///   helper: address of the helper contract
///   callData: call data to perform the actual deposit process
///   depositIndex: multicall index of the actual deposit call, can be used in static call to retrive return value of deposit call
async function previewDepositV3Portfolio(helper, vault, token, amount, slippage = undefined, eth = undefined, opt = {}) {
    const network = await vault.runner.provider.getNetwork();
    const chainId = network.chainId;
    const targetTokens = await vault.getAssets();
    const targetAmounts = await vault.getAssetsBalance();
    const manager = await vault.manager();
    const weth9 = await helper.weth9();
    let conversions = [];

    if (slippage == undefined) {
        slippage = '0.005';
    }

    amount = BigInt(amount);
    eth = BigInt(eth == undefined ? 0n : eth);

    // if eth is not 0, token must be WETH9
    // and add eth to amount
    if (eth != 0n) {
        if (token != weth9) {
            throw new Error("token must be WETH9 when eth is not 0");
        }
        else {
            // add all eth to amount
            amount += eth;
        }
    }

    // check if the vault is empty
    let vaultIsEmpty = true;
    for (let i = 0; i < targetAmounts.length; i++) {
        if (targetAmounts[i] != 0n) {
            vaultIsEmpty = false;
            break;
        }
    }

    let estimatedShares;
    let estimatedComponents = new Array(targetAmounts.length);
    for (let i = 0; i < targetAmounts.length; i++) {
        estimatedComponents[i] = 0n;
    }

    let conversionData = [];
    if (vaultIsEmpty) {
        // convert all tokens to base token, if necessary
        const vaultDecimals = await vault.decimals();
        const tokenERC20 = new ethers.Contract(targetTokens[0], ERC20ABI, vault.runner.provider);
        const tokenDecimals = await tokenERC20.decimals();
        if (token != targetTokens[0]) {
            const quote = await getQuoteFromLiFi(chainId, token, targetTokens[0], amount, helper.target, slippage, opt);
            conversions.push({
                fromToken: token,
                toToken: targetTokens[0],
                fromAmount: BigInt(quote.estimate.fromAmount),
                toAmount: BigInt(quote.estimate.toAmount),
            });

            conversionData.push(helper.interface.encodeFunctionData(
                "swap",
                [
                    token,
                    targetTokens[0],
                    quote.estimate.fromAmount,
                    quote.estimate.toAmountMin,
                    quote.transactionRequest.to,
                    quote.transactionRequest.data,
                ]
            ));

            estimatedShares = BigInt(quote.estimate.toAmount) * (10n ** BigInt(vaultDecimals)) / (10n ** BigInt(tokenDecimals));
            estimatedComponents[0] = quote.estimate.toAmount;
        }
        else {
            estimatedShares = BigInt(amount) * (10n ** BigInt(vaultDecimals)) / (10n ** BigInt(tokenDecimals));
            estimatedComponents[0] = amount;
        }
    }
    else {
        // estimate composition of composite assets
        const vaultRead = vault.connect(vault.runner.provider); // get a read-only contract object which can be called statically from any address    
        let flattenAmounts = new Array(targetAmounts.length);
        let types = new Array(targetAmounts.length);
        let underlyingAssets = new Array(targetAmounts.length);
        for (let i = 0; i < targetAmounts.length; i++) {
            flattenAmounts[i] = 0n;
        }

        for (let i = 0; i < targetAmounts.length; i++) {
            if (targetAmounts[i] == 0n) {
                continue;
            }
            
            const type = await vault.assetType(targetTokens[i]);
            types[i] = type;
            if (type == 1n || type == 2n) {
                flattenAmounts[i] += targetAmounts[i];
            }
            else if (type == 3n) {
                // get token components
                const v3pair = new ethers.Contract(targetTokens[i], V3PairABI, vault.runner.provider);
                const assetToken0 = await v3pair.assetToken0();
                const assetToken1 = await v3pair.assetToken1();
                // calculate how many tokens required for this component
                const results = await vaultRead.v3PairWithdraw.staticCall(targetTokens[i], targetAmounts[i], 0, 0, { from: manager });
                flattenAmounts[targetTokens.indexOf(assetToken0)] += results[0];
                flattenAmounts[targetTokens.indexOf(assetToken1)] += results[1];
            }
            else if (type == 4n) {
                // get token components
                const aToken = new ethers.Contract(targetTokens[i], ATokenABI, vault.runner.provider);
                const underlyingAsset = await aToken.UNDERLYING_ASSET_ADDRESS();
                underlyingAssets[i] = underlyingAsset;
                // calculate how many tokens required for this component
                const results = await vaultRead.aaveWithdraw.staticCall(targetTokens[i], targetAmounts[i], { from: manager });
                flattenAmounts[targetTokens.indexOf(underlyingAsset)] += results;
            }
        }

        // get quotes for each token required for conversion
        let rates = new Array(flattenAmounts.length);
        for (let i = 0; i < flattenAmounts.length; i++) {
            if (flattenAmounts[i] != 0n && targetTokens[i] != token) {
                const quote = await getQuoteFromLiFi(chainId, token, targetTokens[i], amount, helper.target, slippage, opt);
                rates[i] = BigInt(quote.estimate.toAmount);
            }
            else if (targetTokens[i] == token) {
                // no conversion needed, rates set to 1:1
                rates[i] = amount;
            }
        }

        // estimate amount of tokens for each conversion
        let totalAmounts = 0n;
        for (let i = 0; i < flattenAmounts.length; i++) {
            if (flattenAmounts[i] != 0n) {
                totalAmounts += flattenAmounts[i] * amount / rates[i];
            }
        }

        // swap tokens into components
        for (let i = 0; i < flattenAmounts.length; i++) {
            if (flattenAmounts[i] != 0n && targetTokens[i] != token) {
                const amountToConvert = flattenAmounts[i] * amount * amount / (rates[i] * totalAmounts);
                const quote = await getQuoteFromLiFi(chainId, token, targetTokens[i], amountToConvert, helper.target, slippage, opt);
                conversions.push({
                    fromToken: token,
                    toToken: targetTokens[i],
                    fromAmount: BigInt(quote.estimate.fromAmount),
                    toAmount: BigInt(quote.estimate.toAmount),
                });

                conversionData.push(helper.interface.encodeFunctionData(
                    "swap",
                    [
                        token,
                        targetTokens[i],
                        quote.estimate.fromAmount,
                        quote.estimate.toAmountMin,
                        quote.transactionRequest.to,
                        quote.transactionRequest.data,
                    ]
                ));
            }
        }

        const totalSupply = await vault.totalSupply();
        estimatedShares = amount * totalSupply / totalAmounts;

        for (let i = 0; i < targetAmounts.length; i++) {
            estimatedComponents[i] = targetAmounts[i] * amount / totalAmounts;
        }

        // convert components
        for (let i = 0; i < estimatedComponents.length; i++) {
            if (estimatedComponents[i] != 0) {
                if (types[i] == 3n) {
                    conversionData.push(helper.interface.encodeFunctionData(
                        "v3PairDeposit",
                        [
                            targetTokens[i],
                            estimatedComponents[i],
                            UINT256_MAX,
                            UINT256_MAX,
                        ]
                    ));
                }
                else if (types[i] == 4n) {
                    // get token components
                    conversionData.push(helper.interface.encodeFunctionData(
                        "aaveSupply",
                        [
                            underlyingAssets[i],
                            estimatedComponents[i],
                        ]
                    ));
                }
            }
        }
    }

    // deposit
    const depositIndex = conversionData.push(helper.interface.encodeFunctionData("depositMax")) - 1;

    // if eth is not 0n, convert weth9 back to eth
    if (eth != 0n) {
        conversionData.push(helper.interface.encodeFunctionData("convertWETH"));
    }

    // convert conversions into calldata
    let minAmounts = new Array(targetTokens.length);
    for (let i = 0; i < targetTokens.length; i++) {
        minAmounts[i] = 0n;
    }

    const callData = helper.interface.encodeFunctionData(
        "multicall",
        [
            VAULT_TYPE_TEAVAULTV3PORTFOLIO,
            vault.target,
            [ token ],
            [ amount - eth ],
            minAmounts,
            conversionData,
        ]
    );

    return {
        originToken: token,
        originAmount: amount,
        eth: eth,
        conversions: conversions,
        estimatedShares: estimatedShares,
        componentTokens: targetTokens,
        estimatedComponents: estimatedComponents,
        helper: helper.target,
        callData: callData,
        depositIndex: depositIndex,
    };
}


/// Preview deposit in shares for TeaVaultV3Portfolio
/// Deposit using base and atomic tokens and automatically convert them into V3Pair and ATokens.
///
/// @param helper is a TeaVaultV3PortfolioHelper contract object created using ethers.js v6
/// @param vault is a TeaVaultV3Portfolio contract object created using ethers.js v6
/// @parma shares is the amount of shares to deposit
/// @param slippage is the slippage allowed, default to 0.005 (0.005 means 0.5%)
/// @param opt is optional parameters for li.fi
/// @return an object contains the followings
///   componentTokens is the array of the component token addresses
///   estimatedComponents is the array of the estimated amount of component tokens
///   requiredAmounts is the array of the estimated required amounts for each basic/atomic token
///   helper: address of the helper contract
///   callData: call data to perform the actual deposit process
///   depositIndex: multicall index of the actual deposit call, can be used in static call to retrive return value of deposit call
async function previewDepositV3PortfolioShares(helper, vault, shares, slippage = undefined, opt = {}) {
    const targetTokens = await vault.getAssets();
    const targetAmounts = await vault.getAssetsBalance();
    const manager = await vault.manager();

    if (slippage == undefined) {
        slippage = '0.005';
    }

    // check if the vault is empty
    let vaultIsEmpty = true;
    for (let i = 0; i < targetAmounts.length; i++) {
        if (targetAmounts[i] != 0n) {
            vaultIsEmpty = false;
            break;
        }
    }

    let estimatedComponents = new Array(targetAmounts.length);
    for (let i = 0; i < targetAmounts.length; i++) {
        estimatedComponents[i] = 0n;
    }

    let conversionData = [];
    let flattenAmounts = new Array(targetAmounts.length);
    for (let i = 0; i < targetAmounts.length; i++) {
        flattenAmounts[i] = 0n;
    }

    if (vaultIsEmpty) {
        // vault is empty, require the same amount of tokens as shares
        flattenAmounts[0] = BigInt(shares) * (10n ** BigInt(tokenDecimals)) / (10n ** BigInt(vaultDecimals));
    }
    else {
        // estimate composition of composite assets
        const vaultRead = vault.connect(vault.runner.provider); // get a read-only contract object which can be called statically from any address    
        let types = new Array(targetAmounts.length);
        let underlyingAssets = new Array(targetAmounts.length);

        for (let i = 0; i < targetAmounts.length; i++) {
            if (targetAmounts[i] == 0n) {
                continue;
            }
            
            const type = await vault.assetType(targetTokens[i]);
            types[i] = type;
            if (type == 1n || type == 2n) {
                flattenAmounts[i] += targetAmounts[i];
            }
            else if (type == 3n) {
                // get token components
                const v3pair = new ethers.Contract(targetTokens[i], V3PairABI, vault.runner.provider);
                const assetToken0 = await v3pair.assetToken0();
                const assetToken1 = await v3pair.assetToken1();
                // calculate how many tokens required for this component
                const results = await vaultRead.v3PairWithdraw.staticCall(targetTokens[i], targetAmounts[i], 0, 0, { from: manager });
                flattenAmounts[targetTokens.indexOf(assetToken0)] += results[0];
                flattenAmounts[targetTokens.indexOf(assetToken1)] += results[1];
            }
            else if (type == 4n) {
                // get token components
                const aToken = new ethers.Contract(targetTokens[i], ATokenABI, vault.runner.provider);
                const underlyingAsset = await aToken.UNDERLYING_ASSET_ADDRESS();
                underlyingAssets[i] = underlyingAsset;
                // calculate how many tokens required for this component
                const results = await vaultRead.aaveWithdraw.staticCall(targetTokens[i], targetAmounts[i], { from: manager });
                flattenAmounts[targetTokens.indexOf(underlyingAsset)] += results;
            }
        }

        const totalSupply = await vault.totalSupply();

        for (let i = 0; i < targetAmounts.length; i++) {
            estimatedComponents[i] = targetAmounts[i] * shares / totalSupply;
            flattenAmounts[i] = flattenAmounts[i] * shares / totalSupply;
        }

        // convert components
        for (let i = 0; i < estimatedComponents.length; i++) {
            if (estimatedComponents[i] != 0) {
                if (types[i] == 3n) {
                    conversionData.push(helper.interface.encodeFunctionData(
                        "v3PairDeposit",
                        [
                            targetTokens[i],
                            estimatedComponents[i],
                            UINT256_MAX,
                            UINT256_MAX,
                        ]
                    ));
                }
                else if (types[i] == 4n) {
                    // get token components
                    conversionData.push(helper.interface.encodeFunctionData(
                        "aaveSupply",
                        [
                            underlyingAssets[i],
                            estimatedComponents[i],
                        ]
                    ));
                }
            }
        }
    }

    // deposit
    const depositIndex = conversionData.push(helper.interface.encodeFunctionData("depositMax")) - 1;

    // convert conversions into calldata
    let minAmounts = new Array(targetTokens.length);
    for (let i = 0; i < targetTokens.length; i++) {
        minAmounts[i] = 0n;
    }

    const callData = helper.interface.encodeFunctionData(
        "multicall",
        [
            VAULT_TYPE_TEAVAULTV3PORTFOLIO,
            vault.target,
            targetTokens,
            flattenAmounts,
            minAmounts,
            conversionData,
        ]
    );

    return {
        componentTokens: targetTokens,
        estimatedComponents: estimatedComponents,
        requiredAmounts: flattenAmounts,
        helper: helper.target,
        callData: callData,
        depositIndex: depositIndex,
    };
}


/// Preview withdraw for TeaVaultV3Portfolio
///
/// @param helper is a TeaVaultV3PortfolioHelper contract object created using ethers.js v6
/// @param vault is a TeaVaultV3Portfolio contract object created using ethers.js v6
/// @param amount is the amount of shares to withdraw
/// @param slippage is the slippage allowed, default to 0.005 (0.005 means 0.5%)
/// @parma token is the address of target token (if undefined, no swap will happen)
/// @param opt is optional parameters for li.fi
/// @return an object contains the followings
///   shares is the amount of share tokens to withdraw
///   targetToken is the target token to convert to (could be undefined)
///   targetAmount is the estimated amount of target tokens after conversion (0n if targetToken is undefined)
///   conversions is an array contains objects describing conversion steps
///   componentTokens is the array of the component token addresses
///   estimatedComponents is the array of the estimated amount of component tokens before conversion
///   helper: address of the helper contract
///   callData: call data to perform the actual deposit process
async function previewWithdrawV3Portfolio(helper, vault, amount, slippage = undefined, token = undefined, opt = {}) {
    const network = await vault.runner.provider.getNetwork();
    const chainId = network.chainId;
    const targetTokens = await vault.getAssets();
    const manager = await vault.manager();
    const weth9 = await helper.weth9();
    const vaultRead = vault.connect(vault.runner.provider); // get a read-only contract object which can be called statically from any address    

    if (slippage == undefined) {
        slippage = '0.005';
    }

    amount = BigInt(amount);

    // preview withdraw to get assets
    const tokenAmounts = await vault.withdraw.staticCall(amount);
    let flattenAmounts = new Array(tokenAmounts.length);
    for (let i = 0; i < tokenAmounts.length; i++) {
        flattenAmounts[i] = 0n;
    }

    let conversions = [];
    let conversionData = [];
    let targetAmount = 0n;

    // withdraw
    conversionData.push(helper.interface.encodeFunctionData("withdraw", [ amount ]));

    for (let i = 0; i < tokenAmounts.length; i++) {
        if (tokenAmounts[i] == 0n) {
            continue;
        }
        
        const type = await vault.assetType(targetTokens[i]);
        if (type == 1n || type == 2n) {
            flattenAmounts[i] += tokenAmounts[i];
        }
        else if (type == 3n) {
            // get token components
            const v3pair = new ethers.Contract(targetTokens[i], V3PairABI, vault.runner.provider);
            const assetToken0 = await v3pair.assetToken0();
            const assetToken1 = await v3pair.assetToken1();
            // calculate how many tokens will be withdrawn
            const results = await vaultRead.v3PairWithdraw.staticCall(targetTokens[i], tokenAmounts[i], 0, 0, { from: manager });
            flattenAmounts[targetTokens.indexOf(assetToken0)] += results[0];
            flattenAmounts[targetTokens.indexOf(assetToken1)] += results[1];

            // withdraw composite tokens
            conversionData.push(helper.interface.encodeFunctionData("v3PairWithdrawMax", [ targetTokens[i] ]));
        }
        else if (type == 4n) {
            // get token components
            const aToken = new ethers.Contract(targetTokens[i], ATokenABI, vault.runner.provider);
            const underlyingAsset = await aToken.UNDERLYING_ASSET_ADDRESS();
            // calculate how many tokens required for this component
            const results = await vaultRead.aaveWithdraw.staticCall(targetTokens[i], tokenAmounts[i], { from: manager });
            flattenAmounts[targetTokens.indexOf(underlyingAsset)] += results;

            // withdraw composite tokens
            conversionData.push(helper.interface.encodeFunctionData("aaveWithdrawMax", [ underlyingAsset ]));
        }
    }

    if (token != undefined) {
        // swap all tokens to token
        for (let i = 0; i < flattenAmounts.length; i++) {
            if (flattenAmounts[i] == 0n) {
                continue;
            }

            if (targetTokens[i] != token) {
                // swap targetTokens[i] into token
                const quote = await getQuoteFromLiFi(chainId, targetTokens[i], token, flattenAmounts[i], helper.target, slippage, opt);
                conversions.push({
                    fromToken: targetTokens[i],
                    toToken: token,
                    fromAmount: BigInt(quote.estimate.fromAmount),
                    toAmount: BigInt(quote.estimate.toAmount),
                });

                conversionData.push(helper.interface.encodeFunctionData(
                    "swap",
                    [
                        targetTokens[i],
                        token,
                        quote.estimate.fromAmount,
                        quote.estimate.toAmountMin,
                        quote.transactionRequest.to,
                        quote.transactionRequest.data,
                    ]
                ));

                targetAmount += BigInt(quote.estimate.toAmount);
            }
            else {
                targetAmount += flattenAmounts[i];
            }
        }

        // if token is weth9, convert to eth
        conversionData.push(helper.interface.encodeFunctionData("convertWETH"));
    }
    else {
        // if there's weth9, convert to eth
        for (let i = 0; i < flattenAmounts.length; i++) {
            if (flattenAmounts[i] != 0n && targetTokens[i] == weth9) {
                conversionData.push(helper.interface.encodeFunctionData("convertWETH"));
                break;
            }
        }
    }

    // convert conversions into calldata
    let minAmounts = new Array(targetTokens.length);
    for (let i = 0; i < targetTokens.length; i++) {
        minAmounts[i] = 0n;
    }

    const callData = helper.interface.encodeFunctionData(
        "multicall",
        [
            VAULT_TYPE_TEAVAULTV3PORTFOLIO,
            vault.target,
            token != undefined ? [ token ] : [ ],
            token != undefined ? [ 0n ] : [ ],
            minAmounts,
            conversionData,
        ]
    );

    return {
        shares: amount,
        targetToken: token,
        targetAmount: targetAmount,
        conversions: conversions,
        componentTokens: targetTokens,
        estimatedComponents: flattenAmounts,
        helper: helper.target,
        callData: callData,
    };
}


/// Preview deposit for TeaVaultV3Pair
///
/// @param helper is a TeaVaultV3PortfolioHelper contract object created using ethers.js v6
/// @param vault is a TeaVaultV3Pair contract object created using ethers.js v6
/// @parma token is the address of original token
/// @param amount is the amount of original token in BigInt
/// @param slippage is the slippage allowed (0.005 means 0.5%)
/// @param eth is the total amount of eth to use (token must be WETH9 if eth is not 0n)
/// @param opt is optional parameters for li.fi
/// @return an object contains the followings
///   originToken is the address of original token
///   originAmount is the amount of original Token in BigInt
///   eth is the amount of eth to be used in BigInt
///   conversions is an array contains objects describing conversion steps
///   estimatedShares is the estimated amount of shares to be minted
///   componentTokens is the array of the component token addresses
///   estimatedComponents is the array of the estimated amount of component tokens
///   helper: address of the helper contract
///   callData: call data to perform the actual deposit process
///   depositIndex: multicall index of the actual deposit call, can be used in static call to retrive return value of deposit call
async function previewDepositV3Pair(helper, vault, token, amount, slippage = '0.005', eth = undefined, opt = {}) {
    const network = await vault.runner.provider.getNetwork();
    const chainId = network.chainId;
    const targetTokens = [ await vault.assetToken0(), await vault.assetToken1() ];
    const underlyingAssets = await vault.vaultAllUnderlyingAssets();
    const targetAmounts = [ underlyingAssets.amount0, underlyingAssets.amount1 ];
    const weth9 = await helper.weth9();
    let conversions = [];

    amount = BigInt(amount);
    eth = BigInt(eth == undefined ? 0n : eth);

    // if eth is not 0, token must be WETH9
    // and add eth to amount
    if (eth != 0n) {
        if (token != weth9) {
            throw new Error("token must be WETH9 when eth is not 0");
        }
        else {
            // add all eth to amount
            amount += eth;
        }
    }

    // check if the vault is empty
    let vaultIsEmpty = true;
    for (let i = 0; i < targetAmounts.length; i++) {
        if (targetAmounts[i] != 0n) {
            vaultIsEmpty = false;
            break;
        }
    }

    let estimatedShares;
    let estimatedComponents = new Array(targetAmounts.length);
    for (let i = 0; i < targetAmounts.length; i++) {
        estimatedComponents[i] = 0n;
    }

    let conversionData = [];
    if (vaultIsEmpty) {
        // convert all tokens to base token, if necessary
        const vaultDecimals = await vault.decimals();
        const tokenERC20 = new ethers.Contract(targetTokens[0], ERC20ABI, vault.runner.provider);
        const tokenDecimals = await tokenERC20.decimals();
        if (token != targetTokens[0]) {
            const quote = await getQuoteFromLiFi(chainId, token, targetTokens[0], amount, helper.target, slippage, opt);
            conversions.push({
                fromToken: token,
                toToken: targetTokens[0],
                fromAmount: BigInt(quote.estimate.fromAmount),
                toAmount: BigInt(quote.estimate.toAmount),
            });

            conversionData.push(helper.interface.encodeFunctionData(
                "swap",
                [
                    token,
                    targetTokens[0],
                    quote.estimate.fromAmount,
                    quote.estimate.toAmountMin,
                    quote.transactionRequest.to,
                    quote.transactionRequest.data,
                ]
            ));

            estimatedShares = BigInt(quote.estimate.toAmount) * (10n ** BigInt(vaultDecimals)) / (10n ** BigInt(tokenDecimals));
            estimatedComponents[0] = quote.estimate.toAmount;
        }
        else {
            estimatedShares = BigInt(amount) * (10n ** BigInt(vaultDecimals)) / (10n ** BigInt(tokenDecimals));
            estimatedComponents[0] = amount;
        }
    }
    else {
        // get quotes for each token required for conversion
        let rates = new Array(targetAmounts.length);
        for (let i = 0; i < targetAmounts.length; i++) {
            if (targetAmounts[i] != 0n && targetTokens[i] != token) {
                const quote = await getQuoteFromLiFi(chainId, token, targetTokens[i], amount, helper.target, slippage, opt);
                rates[i] = BigInt(quote.estimate.toAmount);
            }
            else if (targetTokens[i] == token) {
                // no conversion needed, rates set to 1:1
                rates[i] = amount;
            }
        }

        // estimate amount of tokens for each conversion
        let totalAmounts = 0n;
        for (let i = 0; i < targetAmounts.length; i++) {
            if (targetAmounts[i] != 0n) {
                totalAmounts += targetAmounts[i] * amount / rates[i];
            }
        }

        // swap tokens into components
        for (let i = 0; i < targetAmounts.length; i++) {
            if (targetAmounts[i] != 0n && targetTokens[i] != token) {
                const amountToConvert = targetAmounts[i] * amount * amount / (rates[i] * totalAmounts);
                const quote = await getQuoteFromLiFi(chainId, token, targetTokens[i], amountToConvert, helper.target, slippage, opt);
                conversions.push({
                    fromToken: token,
                    toToken: targetTokens[i],
                    fromAmount: BigInt(quote.estimate.fromAmount),
                    toAmount: BigInt(quote.estimate.toAmount),
                });

                conversionData.push(helper.interface.encodeFunctionData(
                    "swap",
                    [
                        token,
                        targetTokens[i],
                        quote.estimate.fromAmount,
                        quote.estimate.toAmountMin,
                        quote.transactionRequest.to,
                        quote.transactionRequest.data,
                    ]
                ));
            }
        }

        const totalSupply = await vault.totalSupply();
        estimatedShares = amount * totalSupply / totalAmounts;

        for (let i = 0; i < targetAmounts.length; i++) {
            estimatedComponents[i] = targetAmounts[i] * amount / totalAmounts;
        }
    }

    // deposit
    const depositIndex = conversionData.push(helper.interface.encodeFunctionData("depositV3PairMax", [ UINT256_MAX, UINT256_MAX ])) - 1;

    // if eth is not 0n, convert weth9 back to eth
    if (eth != 0n) {
        conversionData.push(helper.interface.encodeFunctionData("convertWETH"));
    }

    // convert conversions into calldata
    const callData = helper.interface.encodeFunctionData(
        "multicall",
        [
            VAULT_TYPE_TEAVAULTV3PAIR,
            vault.target,
            [ token ],
            [ amount - eth ],
            [ 0n, 0n ],
            conversionData,
        ]
    );

    return {
        originToken: token,
        originAmount: amount,
        eth: eth,
        conversions: conversions,
        estimatedShares: estimatedShares,
        componentTokens: targetTokens,
        estimatedComponents: estimatedComponents,
        helper: helper.target,
        callData: callData,
        depositIndex: depositIndex,
    };
}


/// Preview deposit for TeaVaultV3Pair using UniswapV3 SwapRouter
///
/// @param helper is a TeaVaultV3PortfolioHelper contract object created using ethers.js v6
/// @param vault is a TeaVaultV3Pair contract object created using ethers.js v6
/// @param routerAddr is the address of the UniswapV3 SwapRouter
/// @parma token is the address of original token, must be either asset0 or asset1 in vault
/// @param amount is the amount of original token in BigInt
/// @param slippage is the slippage allowed (0.005 means 0.5%)
/// @param eth is the total amount of eth to use (token must be WETH9 if eth is not 0n)
/// @return an object contains the followings
///   originToken is the address of original token
///   originAmount is the amount of original Token in BigInt
///   eth is the amount of eth to be used in BigInt
///   conversions is an array contains objects describing conversion steps
///   estimatedShares is the estimated amount of shares to be minted
///   componentTokens is the array of the component token addresses
///   estimatedComponents is the array of the estimated amount of component tokens
///   helper: address of the helper contract
///   callData: call data to perform the actual deposit process
///   depositIndex: multicall index of the actual deposit call, can be used in static call to retrive return value of deposit call
async function previewDepositV3PairUniV3(helper, vault, routerAddr, token, amount, slippage = '0.005', eth = undefined) {
    const targetTokens = [ await vault.assetToken0(), await vault.assetToken1() ];
    const underlyingAssets = await vault.vaultAllUnderlyingAssets();
    const targetAmounts = [ underlyingAssets.amount0, underlyingAssets.amount1 ];
    const weth9 = await helper.weth9();
    const router = new ethers.Contract(routerAddr, uniswapRouterABI, vault.runner.provider);
    const poolAddr = await vault.pool();
    const pool = new ethers.Contract(poolAddr, uniswapPoolABI, vault.runner.provider);
    const fee = await pool.fee();
    let conversions = [];

    // check if token is either token0 or token1
    if (token != targetTokens[0] && token != targetTokens[1]) {
        throw new Error("Invalid token, token must be either assetToken0 or assetToken1");
    }

    amount = BigInt(amount);
    eth = BigInt(eth == undefined ? 0n : eth);

    // if eth is not 0, token must be WETH9
    // and add eth to amount
    if (eth != 0n) {
        if (token != weth9) {
            throw new Error("token must be WETH9 when eth is not 0");
        }
        else {
            // add all eth to amount
            amount += eth;
        }
    }

    // check if the vault is empty
    let vaultIsEmpty = true;
    for (let i = 0; i < targetAmounts.length; i++) {
        if (targetAmounts[i] != 0n) {
            vaultIsEmpty = false;
            break;
        }
    }

    let estimatedShares;
    let estimatedComponents = new Array(targetAmounts.length);
    for (let i = 0; i < targetAmounts.length; i++) {
        estimatedComponents[i] = 0n;
    }

    let conversionData = [];
    if (vaultIsEmpty) {
        // convert all tokens to base token, if necessary
        const vaultDecimals = await vault.decimals();
        const tokenERC20 = new ethers.Contract(targetTokens[0], ERC20ABI, vault.runner.provider);
        const tokenDecimals = await tokenERC20.decimals();
        console.log(token, targetTokens[0]);
        if (token != targetTokens[0]) {
            const token0 = await pool.token0();
            const token0Amount = await getPriceFromUniV3Pool(pool, token == token0, amount);
            conversions.push({
                fromToken: token,
                toToken: targetTokens[0],
                fromAmount: amount,
                toAmount: token0Amount,
            });

            const amountOutMin = minAmountWithSlippage(token0Amount, slippage);
            const txData = router.interface.encodeFunctionData(
                "exactInputSingle",
                [[
                    token,
                    targetTokens[0],
                    fee,
                    helper.target,
                    UINT64_MAX,
                    amount,
                    amountOutMin,
                    0,
                ]]
            );

            conversionData.push(helper.interface.encodeFunctionData(
                "swap",
                [
                    token,
                    targetTokens[0],
                    amount,
                    amountOutMin,
                    routerAddr,
                    txData,
                ]
            ));

            estimatedShares = token0Amount * (10n ** BigInt(vaultDecimals)) / (10n ** BigInt(tokenDecimals));
            estimatedComponents[0] = token0Amount;
        }
        else {
            estimatedShares = BigInt(amount) * (10n ** BigInt(vaultDecimals)) / (10n ** BigInt(tokenDecimals));
            estimatedComponents[0] = amount;
        }
    }
    else {
        // get quotes for each token required for conversion
        let rates = new Array(targetAmounts.length);
        const token0 = await pool.token0();
        for (let i = 0; i < targetAmounts.length; i++) {
            if (targetAmounts[i] != 0n && targetTokens[i] != token) {
                rates[i] = await getPriceFromUniV3Pool(pool, token == token0, amount);
            }
            else if (targetTokens[i] == token) {
                // no conversion needed, rates set to 1:1
                rates[i] = amount;
            }
        }

        // estimate amount of tokens for each conversion
        let totalAmounts = 0n;
        for (let i = 0; i < targetAmounts.length; i++) {
            if (targetAmounts[i] != 0n) {
                totalAmounts += targetAmounts[i] * amount / rates[i];
            }
        }

        // swap tokens into components
        for (let i = 0; i < targetAmounts.length; i++) {
            if (targetAmounts[i] != 0n && targetTokens[i] != token) {
                const amountToConvert = targetAmounts[i] * amount * amount / (rates[i] * totalAmounts);
                const token0Amount = await getPriceFromUniV3Pool(pool, token == token0, amountToConvert);
                conversions.push({
                    fromToken: token,
                    toToken: targetTokens[i],
                    fromAmount: amountToConvert,
                    toAmount: token0Amount,
                });

                const amountOutMin = minAmountWithSlippage(token0Amount, slippage);
                const txData = router.interface.encodeFunctionData(
                    "exactInputSingle",
                    [[
                        token,
                        targetTokens[i],
                        fee,
                        helper.target,
                        UINT64_MAX,
                        amountToConvert,
                        amountOutMin,
                        0,
                    ]]
                );

                conversionData.push(helper.interface.encodeFunctionData(
                    "swap",
                    [
                        token,
                        targetTokens[i],
                        amountToConvert,
                        amountOutMin,
                        routerAddr,
                        txData,
                    ]
                ));
            }
        }

        const totalSupply = await vault.totalSupply();
        estimatedShares = amount * totalSupply / totalAmounts;

        for (let i = 0; i < targetAmounts.length; i++) {
            estimatedComponents[i] = targetAmounts[i] * amount / totalAmounts;
        }
    }

    // deposit
    const depositIndex = conversionData.push(helper.interface.encodeFunctionData("depositV3PairMax", [ UINT256_MAX, UINT256_MAX ])) - 1;

    // if eth is not 0n, convert weth9 back to eth
    if (eth != 0n) {
        conversionData.push(helper.interface.encodeFunctionData("convertWETH"));
    }

    // convert conversions into calldata
    const callData = helper.interface.encodeFunctionData(
        "multicall",
        [
            VAULT_TYPE_TEAVAULTV3PAIR,
            vault.target,
            [ token ],
            [ amount - eth ],
            [ 0n, 0n ],
            conversionData,
        ]
    );

    return {
        originToken: token,
        originAmount: amount,
        eth: eth,
        conversions: conversions,
        estimatedShares: estimatedShares,
        componentTokens: targetTokens,
        estimatedComponents: estimatedComponents,
        helper: helper.target,
        callData: callData,
        depositIndex: depositIndex,
    };
}


/// Preview withdraw for TeaVaultV3Pair
///
/// @param helper is a TeaVaultV3PortfolioHelper contract object created using ethers.js v6
/// @param vault is a TeaVaultV3Pair contract object created using ethers.js v6
/// @param amount is the amount of shares to withdraw
/// @param slippage is the slippage allowed (0.005 means 0.5%)
/// @parma token is the address of target token (if undefined, no swap will happen)
/// @param opt is optional parameters for li.fi
/// @return an object contains the followings
///   shares is the amount of share tokens to withdraw
///   targetToken is the target token to convert to (could be undefined)
///   targetAmount is the estimated amount of target tokens after conversion (0n if targetToken is undefined)
///   conversions is an array contains objects describing conversion steps
///   componentTokens is the array of the component token addresses
///   estimatedComponents is the array of the estimated amount of component tokens before conversion
///   helper: address of the helper contract
///   callData: call data to perform the actual deposit process
async function previewWithdrawV3Pair(helper, vault, amount, slippage = '0.005', token = undefined, opt = {}) {
    const network = await vault.runner.provider.getNetwork();
    const chainId = network.chainId;
    const targetTokens = [ await vault.assetToken0(), await vault.assetToken1() ];
    const weth9 = await helper.weth9();

    amount = BigInt(amount);

    // preview withdraw to get assets
    const tokenAmounts = await vault.withdraw.staticCall(amount, 0, 0);

    let conversions = [];
    let conversionData = [];
    let targetAmount = 0n;

    // withdraw
    conversionData.push(helper.interface.encodeFunctionData("withdrawV3Pair", [ amount, 0, 0 ]));

    if (token != undefined) {
        // swap all tokens to token
        for (let i = 0; i < tokenAmounts.length; i++) {
            if (tokenAmounts[i] == 0n) {
                continue;
            }

            if (targetTokens[i] != token) {
                // swap targetTokens[i] into token
                const quote = await getQuoteFromLiFi(chainId, targetTokens[i], token, tokenAmounts[i], helper.target, slippage, opt);
                conversions.push({
                    fromToken: targetTokens[i],
                    toToken: token,
                    fromAmount: BigInt(quote.estimate.fromAmount),
                    toAmount: BigInt(quote.estimate.toAmount),
                });

                conversionData.push(helper.interface.encodeFunctionData(
                    "swap",
                    [
                        targetTokens[i],
                        token,
                        quote.estimate.fromAmount,
                        quote.estimate.toAmountMin,
                        quote.transactionRequest.to,
                        quote.transactionRequest.data,
                    ]
                ));

                targetAmount += BigInt(quote.estimate.toAmount);
            }
            else {
                targetAmount += tokenAmounts[i];
            }
        }

        // if token is weth9, convert to eth
        conversionData.push(helper.interface.encodeFunctionData("convertWETH"));
    }
    else {
        // if there's weth9, convert to eth
        for (let i = 0; i < tokenAmounts.length; i++) {
            if (tokenAmounts[i] != 0n && targetTokens[i] == weth9) {
                conversionData.push(helper.interface.encodeFunctionData("convertWETH"));
                break;
            }
        }
    }

    // convert conversions into calldata
    const callData = helper.interface.encodeFunctionData(
        "multicall",
        [
            VAULT_TYPE_TEAVAULTV3PAIR,
            vault.target,
            token != undefined ? [ token ] : [ ],
            token != undefined ? [ 0n ] : [ ],
            [ 0n, 0n ],
            conversionData,
        ]
    );

    return {
        shares: amount,
        targetToken: token,
        targetAmount: targetAmount,
        conversions: conversions,
        componentTokens: targetTokens,
        estimatedComponents: tokenAmounts,
        helper: helper.target,
        callData: callData,
    };
}

/// Preview withdraw for TeaVaultV3Pair using UniswapV3 SwapRouter
///
/// @param helper is a TeaVaultV3PortfolioHelper contract object created using ethers.js v6
/// @param vault is a TeaVaultV3Pair contract object created using ethers.js v6
/// @param routerAddr is the address of the UniswapV3 SwapRouter
/// @param amount is the amount of shares to withdraw
/// @param slippage is the slippage allowed (0.005 means 0.5%)
/// @parma token is the address of target token (if undefined, no swap will happen)
/// @return an object contains the followings
///   shares is the amount of share tokens to withdraw
///   targetToken is the target token to convert to (could be undefined)
///   targetAmount is the estimated amount of target tokens after conversion (0n if targetToken is undefined)
///   conversions is an array contains objects describing conversion steps
///   componentTokens is the array of the component token addresses
///   estimatedComponents is the array of the estimated amount of component tokens before conversion
///   helper: address of the helper contract
///   callData: call data to perform the actual deposit process
async function previewWithdrawV3PairUniV3(helper, vault, routerAddr, amount, slippage = '0.005', token = undefined) {
    const targetTokens = [ await vault.assetToken0(), await vault.assetToken1() ];
    const weth9 = await helper.weth9();
    const router = new ethers.Contract(routerAddr, uniswapRouterABI, vault.runner.provider);
    const poolAddr = await vault.pool();
    const pool = new ethers.Contract(poolAddr, uniswapPoolABI, vault.runner.provider);
    const fee = await pool.fee();

    // check if token is either token0 or token1
    if (token != undefined && token != targetTokens[0] && token != targetTokens[1]) {
        throw new Error("Invalid token, token must be either assetToken0 or assetToken1");
    }

    amount = BigInt(amount);

    // preview withdraw to get assets
    const tokenAmounts = await vault.withdraw.staticCall(amount, 0, 0);

    let conversions = [];
    let conversionData = [];
    let targetAmount = 0n;

    // withdraw
    conversionData.push(helper.interface.encodeFunctionData("withdrawV3Pair", [ amount, 0, 0 ]));

    if (token != undefined) {
        // swap all tokens to token
        const token0 = await pool.token0();
        for (let i = 0; i < tokenAmounts.length; i++) {
            if (tokenAmounts[i] == 0n) {
                continue;
            }

            if (targetTokens[i] != token) {
                // swap targetTokens[i] into token
                const convertedAmount = await getPriceFromUniV3Pool(pool, targetTokens[i] == token0, tokenAmounts[i]);
                conversions.push({
                    fromToken: targetTokens[i],
                    toToken: token,
                    fromAmount: tokenAmounts[i],
                    toAmount: convertedAmount,
                });

                const amountOutMin = minAmountWithSlippage(convertedAmount, slippage);
                const txData = router.interface.encodeFunctionData(
                    "exactInputSingle",
                    [[
                        targetTokens[i],
                        token,
                        fee,
                        helper.target,
                        UINT64_MAX,
                        tokenAmounts[i],
                        amountOutMin,
                        0,
                    ]]
                );                

                conversionData.push(helper.interface.encodeFunctionData(
                    "swap",
                    [
                        targetTokens[i],
                        token,
                        tokenAmounts[i],
                        amountOutMin,
                        routerAddr,
                        txData,
                    ]
                ));

                targetAmount += convertedAmount;
            }
            else {
                targetAmount += tokenAmounts[i];
            }
        }

        // if token is weth9, convert to eth
        conversionData.push(helper.interface.encodeFunctionData("convertWETH"));
    }
    else {
        // if there's weth9, convert to eth
        for (let i = 0; i < tokenAmounts.length; i++) {
            if (tokenAmounts[i] != 0n && targetTokens[i] == weth9) {
                conversionData.push(helper.interface.encodeFunctionData("convertWETH"));
                break;
            }
        }
    }

    // convert conversions into calldata
    const callData = helper.interface.encodeFunctionData(
        "multicall",
        [
            VAULT_TYPE_TEAVAULTV3PAIR,
            vault.target,
            token != undefined ? [ token ] : [ ],
            token != undefined ? [ 0n ] : [ ],
            [ 0n, 0n ],
            conversionData,
        ]
    );

    return {
        shares: amount,
        targetToken: token,
        targetAmount: targetAmount,
        conversions: conversions,
        componentTokens: targetTokens,
        estimatedComponents: tokenAmounts,
        helper: helper.target,
        callData: callData,
    };
}
