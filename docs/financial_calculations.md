# Financial Calculations

## Source: `src/actions/portfolio.ts` → `getPortfolioSummary()`

### Cost Basis (Weighted Average, Lot-Based)
- Computed in-memory by `enrichWithCostBasis()` — always overwrites stored DB value
- Weighted avg = total buy cost / total buy qty within current lot
- Lot resets when net_qty drops to 0 and a new BUY comes in (fresh position)
- DIVIDEND rows do not affect cost basis
- SELL rows get `cost_basis` set to the weighted avg at time of sell

### Realized P&L (per SELL)
```
grossPnL = (qty × sellPrice − fees) − (qty × costBasis)
tax      = grossPnL × 15%  [only if grossPnL > 0]
realizedPnL += grossPnL − tax
```

### Total Invested (`totalInvested`)
- Sum of `net_quantity × avg_cost` for all **currently open** holdings (from `portfolio_holdings` view)
- Represents cost of shares still held — NOT total historical buy spend

### Current Value (`currentValue`)
- Sum of `net_quantity × current_price` for all open holdings

### Potential P&L (`potentialGainLoss`)
```
potentialGainLoss = currentValue - totalInvested
```

### Total P&L (`totalPNL`)
```
totalPNL = potentialGainLoss + realizedGainLoss + totalDividends
```
- Does NOT subtract profitWithdrawn — withdrawn profit was already earned

### Total Portfolio Value (`totalPortfolioValue`)
```
totalPortfolioValue = fundsAdded - fundsWithdrawn
                    + realizedGainLoss
                    - totalProfitWithdrawn
                    + totalDividends
                    - totalInvested
                    + currentValue
```
- `fundsAdded / fundsWithdrawn` = ADD/WITHDRAW entries from `investments` table
- `totalProfitWithdrawn` = sum of all `profit_withdrawals` rows
- `totalInvested` = open position cost (subtracts locked-up capital)
- `currentValue` = adds back market value of open positions

### Cash Available (`investmentAvailable`)
```
investmentAvailable = totalPortfolioValue - totalInvested
```
- Represents liquid cash (not locked in stocks)
- When no open positions: `investmentAvailable = totalPortfolioValue`

### No-Holdings Edge Case
When `portfolio_holdings` returns no rows (no open positions):
- `totalInvested = 0`, `currentValue = 0`
- `totalPortfolioValue = fundsAdded - fundsWithdrawn + realizedGainLoss - totalProfitWithdrawn + totalDividends`
- `investmentAvailable = totalPortfolioValue`

### Dividends
- Stored as DIVIDEND transactions
- `price_per_share` column holds the **total** dividend amount (not per-share)
- Included in: `totalPNL`, `totalPortfolioValue`, `investmentAvailable`

### Tax
- 15% capital gains tax on profitable SELLs only
- Subtracted from realized P&L per sell
- Tracked separately as `totalTaxPaid`

## Dashboard Cards (`src/components/dashboard/PortfolioSummary.tsx`)
Order and meaning of the 10 summary cards:

| # | Label | Field |
|---|-------|-------|
| 1 | Total Portfolio | `totalPortfolioValue` |
| 2 | Cash Available | `investmentAvailable` |
| 3 | Invested Amount | `totalInvested` (open positions at cost) |
| 4 | Stock Value | `currentValue` (open positions at market price) |
| 5 | Realized P&L | `realizedGainLoss` (net of 15% tax) |
| 6 | Dividends | `totalDividends` |
| 7 | Profit Withdrawn | `totalProfitWithdrawn` |
| 8 | Potential P&L | `potentialGainLoss` + percent |
| 9 | Total P&L | `totalPNL` |
| 10 | Holdings | `holdingsCount` |
