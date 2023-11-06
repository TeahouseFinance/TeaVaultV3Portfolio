# TeaVault V3 TeaVaultV3Portfolio

TeaVault v3 portfolio (hereinafter simplified as PORT) is an portfolio strategy infrastructure designed specifically for managing multiple ERC20 assets including typical fungiable tokens, AAVE aTokens and [TeaVault v3 pair](https://github.com/TeahouseFinance/TeaVaultV3Pair/tree/main) (hereinafter simplified as PAIR) shares. Strategy managers can manage the funds through the vault and adjust the proportion of each asset. Our design makes the funds tokenized and more self-custodial for investers, enabling them to participate in or exit a strategy at any time. Since managers do not hold the funds directly, PORT can make portfolio management more transparent while supporting manually and algorithmic management of large fund.

Key Features:

1. Fungible ERC20 shares for composability.
2. Support holding AAVE aTokens to earn interest.
3. Support holding tokenized liquidity positions (PAIR).
4. Support rebalancing using various aggregators with exchange rate protection.
5. Performance fee calculation with carefully designed Uniswap v3-based TWAP oracle.
6. Vault-level high water mark performance fee mechanism.

## Design

![.imgs/fig.png](.imgs/fig.png)

### Roles

#### TeaVault V3 Portfolio (PORT)

- UUPS upgradable pattern.
- Specify the Uniswap v3-based oracles, AAVE pool, Uniswap v3 swap router and path recommender while initializing.
- Hold multiple ERC20 fungable assets.
- Swap assets via swap aggregators and Uniswap v3 swap router.
- Calculate protocol fees including entry, exit, management and performance fee.
- Helper functions for frontend and strategy automation.

#### Fee Vault

- Collect protocol fees.
- Entry fee: collect a ratio of token0 and token1 from inverstors' depositing.
- Exit fee: collect a ratio of investors' shares before burning and withdrawing funds.
- Management fee: collect by minting new shares while investors depositing and withdrawing. For example, the current status of the TeaVault is as follows.
  - Total supply of share is $n$
  - Management fee is $1.2\%/year$
  - It has been one month since last collect management fee. ($0.1\%$ of management fee to be collected) then the TeaVault will mint $0.1n/(100-0.1)$ shares as management fee.
- Performance fee: collect a ratio of profit by inflating share similar to the management fee.
  - Calculate high water mark by querying asset value from the oracles.
  - Exponentially unlocked performance fee makes the mechanism closer to the typical high water mark.

#### Manager

- Determine the proportion of assets held by PORT.
- Support supply assets to the AAVE pool.
- Support rebalancing PORT funds through the Uniswap v3 swap router or aggregators.

#### Investor

- Deposit funds based on the proportion of underlying assets in the PORT and mint shares.
- Withdraw funds from the vault by burning held PORT shares.

For example, the current status of the PORT is as follows.

- Total supply of share is $n$
- Holds underlying asset of 70 token0 and 40 token1
  - 70 token0
  - 40 token1

If the investor would like to mint $0.1n$ shares, then it needs to add 7 token0 and 4 token1 to the vault. That is, the mint costs 7 token0 and 4 token1 in total.

If the investor holds $0.1n$ and would like to withdraw funds from the PORT, the PORT will return 7 token0 and 4 token1 to it in total.

#### Uniswap V3-based Oracle

- Calculate asset price and value with TWAP from the Uniswap V3 pool.
- Three types of oracle
  - Asset oracle: price from Uniswap v3 pool TWAP.
  - PAIR oracle: calculate total token0 and token1 amount with Uniswap v3 pool TWAP and multiply them by the TWAP respectively to get the PAIR share price.
  - AAVE aToken oracle: convert aToken to underlying asset and query price from asset oracle.

#### Path Recommender

- Recommend a pre-set baseline Uniswap v3 swap route for the swap.
