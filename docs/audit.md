# Updates according to recommendations from Omniscia's audit report

## Static Analysis

### AssetOracle

#### AOE-01S: Data Location Optimization

Updated as recommended.

### TeaVaultV3PairOracle

#### TVP-01S: Inexistent Visibility Specifier

Updated as recommended.

### TeaVaultV3Portfolio

#### TVV-01S: Illegible Numeric Value Representation

Updated as recommended.

#### TVV-02S: Inexistent Sanitization of Input Addresses

In some chains, some of the protocols, such as Aave, might not exist. So it's possible that some of the addresses might be 0.

The swapper and assetOracle are essential so checks for them are added.

### TeaVaultV3PortfolioHelper

#### TVH-01S: Inexistent Sanitization of Input Addresses

In some chains, Aave might not exist, so it's possible that this address might be 0.

weth9 should always exist so check for it is added.

## Manual Review

### AaveATokenOracle

#### AAT-01M: Inexistent Validation of Array Lengths

Updated as recommended.

### AssetOracle

#### AOE-01M: Potential Misconception of Asset Invariance

The TeaVaultV3Portfolio vault uses this asset valuation solely for the purpose of calculating performance fee, and since the performance fee is based on the base token, this behvaior is by design.

#### AOE-02M: Inexistent Protection of Multiplication Overflow

This calculation uses UniswapV3's FullMath library which should be able to handle cases where AxB is more than 256 bits (as long the final result is within 256 bits).

This code
```
relativePrice.mulDiv(10 ** DECIMALS, sqrtPriceX96 * 10 ** (_poolInfo.decimals0 - _poolInfo.decimals1));
```
could be problematic if 10 ** (_poolInfo.decimals0 - _poolInfo.decimals1) is very large but since sqrtPriceX96 is up to 160 bits, this allows up to 28 digits differences in decimals, which should be enough for most cases.

##### Update

Updated as recommended.

#### AOE-03M: Inexistent Validation of Array Lengths

Updated as recommended.

### Swapper

#### SRE-01M: Potentially Dangerous Low-Level Call

Updated to verify _swapRouter is non-zero.

#### SRE-02M: Insecure Arbitrary Interactions

Updated to make swap function only callable from a whitelist.

### TeaVaultV3PairOracle

#### TVP-01M: External Security Requirements

`TeaVaultV3PairOracle` is designed for `TeaVaultV3Pair` which is the share price oracle of the audited `Uniswap V3`-based vault. Hence, we assume that `TeaVaultV3Pair` is externally secure and use its infos to calculate price.

#### TVP-02M: Inexistent Validation of Array Lengths

Updated as recommended.

#### TVP-03M: Unsafe Casting Operation

Updated as recommended.

### TeaVaultV3Portfolio

#### TVV-01M: Non-Standard Gap Size Specification

Updated as recommended.

#### TVV-02M: Discrepant Management of Fee Times

Updated as recommended.

#### TVV-03M: Improper Fee Acquisition Methodology

Calculating share price and deposit cost is performed before deposit, hence user will not over-approve in this process.

##### Update

We believe it's important for deposit function to mint the exact amount of shares indicated by the user, so the design of the function is that it returns the amounts of each asset token required to mint the amount of shares. So, the proper procedure is to use static call to simulate deposit function to calculate the amounts of each asset token required, approve each token for appropriate amounts, then actually call deposit function to deposit.

#### TVV-04M: Improper Order of Performance Fee Evaluation

The performance fee mechanism is designed to incentivize long-term performance. Therefore, the performance fees earned will not be unlocked immediately, but will be unlocked exponentially by time. If we re-order the statements here, some of the newly generated performance fees will be immediately unlocked which is unexpected.

#### TVV-05M: Insufficient Validation of Oracle Compatibility

Updated as recommended.

#### TVV-06M: Improper Assumptions of Asset Maintenance

1. There may be needs for manager to add/remove assets into/from the managed portfolio.
2. Only the owner can perform this operation and balance check is a sanity check to ensure users don't suffer unexpected losses after asset removal.
3. Manager can always convert asset to be removed to another asset before removal.
Based on the above points, we decide to retain the functionality of dynamically adjusting the asset list.

##### Update

We add a function `swapAndRemoveAsset` which will convert asset to be removed into other supported asset before removal.

#### TVV-07M: Potential Hijack of High Water Mark Initialization

Updated as recommended.


### TeaVaultV3PortfolioHelper

#### TVH-01M: Inexplicable Implementations of Uniswap V3 Interactions

The function depositV3Pair and v3PairDeposit, while similar, serves different purposes. depositV3Pair is designed for users who wants to use the helper contract to make a deposit into a TeaVaultV3Pair contract. On the other hand, v3PairDeposit is used as an intermediate step for a further deposit into a TeaVaultV3Portfolio contract. However, there are indeed some area where optimizations can be made.

Checks are added to v3PairDeposit and aaveSupply to make sure the relevant tokens are actually part of the TeaVaultV3Portfolio's asset portfolio.

#### TVH-02M: Deprecated Approval Operation

Updated as recommended.

#### TVH-03M: Inexistent Prevention of Default Vault Value

Updated as recommended.

#### TVH-04M: Insecure Uniswap V3 LP Provision

The function v3PairDeposit is designed to be called as an intermediate step for depositing into TeaVaultV3Portfolio, so the relevant shares should always be send back to the msg.sender in the multicall function. However, it's possible a misconfigured call could result in loss of funds.

The checks added for TVH-01M now make sure the share tokens are part of the vault's portfolio and thus will always be send back to the msg.sender in multicall.

#### TVH-05M: Insecure Uniswap V3 LP Withdrawal

Updated multicall function to add a final verification on expected minimal amount of tokens.

### UniswapV3PathRecommender

#### UVP-01M: Inexistent Sorting of Tokens

TokenA -> TokenB swap path may be different to the reversed one, so we don't sort tokens as a single key here.

## Code Style

### AaveATokenOracle

#### AAT-01C: Loop Iterator Optimizations

Updated as recommended.

### AssetOracle

#### AOE-01C: Inefficient mapping Lookups

Updated as recommended.

#### AOE-02C: Loop Iterator Optimizations

Updated as recommended.

#### AOE-03C: Redundant Initialization of Pool Information

Updated as recommended.

#### AOE-04C: Redundant Parenthesis Statements

Updated as recommended.

#### AOE-05C: Repetitive Value Literal

Updated as recommended.

### TeaVaultV3PairOracle

#### TVP-01C: Inefficient Square Root Implementation

Updated as recommended.

#### TVP-02C: Loop Iterator Optimizations

Updated as recommended.

#### TVP-03C: Redundant Parenthesis Statements

Updated as recommended.

#### TVP-04C: Redundant Type Cast Operations

Updated as recommended.

### TeaVaultV3Portfolio

#### TVV-01C: Deprecated Usage of Signature Value Literals

Updated as recommended.

#### TVV-02C: Inefficient Emission of Captured Fees

Updated as recommended.

#### TVV-03C: Inefficient Emissions of Contextual Variable

There may be needs to get swap timestamp when we analyze the fund performance afterwards. If we don't emit with timestamp, then we will need to get block data and extract timestamp from it which is inefficient.

#### TVV-04C: Inefficient On-Chain Path Calculation

Updated as recommended.

#### TVV-05C: Inefficient Ownership Transfer

Updated as recommended.

#### TVV-06C: Inefficient Removal of Array Element

We emit with the asset after removal, hence cache is needed here.

#### TVV-07C: Inefficient Shift Operation

Updated as recommended.

#### TVV-08C: Inefficient Variable Mutability (Constant)

Updated as recommended.

#### TVV-09C: Inefficient Variable Mutability (Immutable)

Placing immutable variables in the constructor will cause it to be specified every time the contract is upgraded, which is not our expected design.

#### TVV-10C: Loop Iterator Optimizations

Updated as recommended.

#### TVV-11C: Redundant Local Variables

Updated as recommended.

#### TVV-12C: Redundant Maintenance of Total Amounts

Updated as recommended.

#### TVV-13C: Repetitive Value Literal

Updated as recommended.

### TeaVaultV3PortfolioHelper

#### TVH-01C: Deprecated Revert Statements

These reverts are due to the nature of the simulated calls.

#### TVH-02C: Generic Typographic Mistake

Adding an underscore prefix to vault will cause a conflict with parameter in multicall.

#### TVH-03C: Loop Iterator Optimizations

Updated as recommended.

#### TVH-04C: Potentially Redundant Rescue Functions

Since the helper contract is not very big we feel it's fine to keep those functions.

#### TVH-05C: Unreachable Code

Updated as recommended.

### UniswapV3PathRecommender

#### UVP-01C: Generic Typographic Mistake

Updated as recommended.

#### UVP-02C: Ineffectual Usage of Safe Arithmetics

Updated as recommended.

#### UVP-03C: Inefficient Emissions of Contextual Variable

Updated as recommended.

#### UVP-04C: Loop Iterator Optimization

Updated as recommended.

#### UVP-05C: Potential Usability Enhancement

Updated as recommended.

#### UVP-06C: Redundant Recalculation of Value

Updated as recommended.
