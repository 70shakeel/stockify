# Stockify — Project Overview

## Stack
- **Framework:** Next.js (App Router) — read `node_modules/next/dist/docs/` before writing any Next.js code per AGENTS.md
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Backend:** Next.js Server Actions (`'use server'`)
- **Database:** Supabase (PostgreSQL + Auth + RLS)
- **State:** Zustand (client-side only)
- **UI:** Lucide icons, custom components in `src/components/ui/`

## Folder Structure
```
src/
  app/                  # Next.js App Router pages
    page.tsx            # Dashboard (home)
    portfolio/          # Holdings + positions tabs
    transactions/       # Transaction list + add modal
    profit-split/       # Partner profit split management
    stocks/             # PSX stock search
    auth/               # Login / signup
  actions/              # Server actions (data fetching + mutations)
    portfolio.ts        # getPortfolioSummary, getPortfolioHoldings, getPortfolioPositions
    transactions.ts     # addTransaction, updateTransaction, deleteTransaction, getTransactions
    investments.ts      # getInvestments, addInvestment, deleteInvestment
    partners.ts         # getPartners, addPartner, updatePartner, deletePartner
    profitWithdrawals.ts # getProfitWithdrawals, addProfitWithdrawal, deleteProfitWithdrawal
    stocks.ts           # searchStocks, getStockBySymbol, refreshStockPrice
  components/
    dashboard/          # PortfolioSummary, HoldingsTable, PositionsTable, InvestmentsTable, ProfitSplitSummary
    partners/           # ProfitSplitPanel
    transactions/       # AddTransactionModal, TransactionList
    stocks/             # StockList
    news/               # NewsFeed
    layout/             # Navbar, MobileNav
    ui/                 # Card, Button, Input, Modal, Badge, Spinner
  lib/
    psx/types.ts        # All TypeScript interfaces
    supabase/           # server.ts + client.ts Supabase clients
    utils.ts            # formatCurrency, formatCurrencyNoDecimals, formatPercent, getChangeColor, cn
supabase/
  schema.sql            # Full schema (for fresh installs only — running on existing DBs errors on duplicate policies)
  migrations/           # Incremental migration SQL files to run on existing deployments
```

## Key Conventions
- All data fetching is done via server actions, not API routes
- Every server action checks `supabase.auth.getUser()` and returns `{ data, error }` shape
- `revalidatePath('/')` and `revalidatePath('/portfolio')` called after mutations
- Stock prices cached in `stocks` table, refreshed if stale >15 min via `ensureFreshPrices()`
- PSX stock scraping via Cheerio in `refreshStockPrice()`
- Cost basis computed in-memory via `enrichWithCostBasis()` — always overwrites DB value to fix backdated inserts
- Capital gains tax hardcoded at 15% (`CAPITAL_GAINS_TAX_RATE = 0.15`)
- `price_per_share` column stores total dividend amount for DIVIDEND transaction rows (not per-share)

## Transaction Types
- `BUY` — stock purchase
- `SELL` — stock sale (cost_basis column populated)
- `DIVIDEND` — dividend received (price_per_share = total amount, quantity ignored in calculations)
