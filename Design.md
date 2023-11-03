# Teavault V3 Port

### Design
1. Holds multiple pure ERC20 and composite assets.
2. Maintains asset to descriptor mapping to distinguish the type of the asset (pure ERC20 or compisite).
3. Struct descriptor
    - type: composite or not
    - oracle: TWAP of Uniswap V3 pool
4. Functions
    - Deposit: 
        1. based on share/_totalSupploy with zap/helper to improve UX.
        2. collect performance, management, and entry/exit fees.
    - Withdraw: 
        1. based on share/_totalSupploy with zap/helper to improve UX.
        2. collect performance, management, and entry/exit fees.
    - CollectManagementFee: mint shares by time difference.
    - CollectPerformanceFee: 
        1. calculate value.
        2. mint/burn reserve and collect unlocked shares.
        3. high watermark.
    - Rebalance:
        - compoDeposit
        - compoWithdraw
        - swap: in-pool and 1inch router