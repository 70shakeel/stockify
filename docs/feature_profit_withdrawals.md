# Feature: Profit Withdrawals

**Added:** May 2026

## What It Does
Partners can withdraw their share of profits. Each withdrawal is recorded and deducted from:
- Their net balance shown in the Profit Split page
- `totalProfitWithdrawn` in the portfolio summary
- `totalPortfolioValue` and `investmentAvailable` calculations

## Files
| File | Role |
|------|------|
| `src/actions/profitWithdrawals.ts` | Server actions: `getProfitWithdrawals`, `addProfitWithdrawal`, `deleteProfitWithdrawal` |
| `src/components/partners/ProfitSplitPanel.tsx` | Withdraw button per partner, withdrawal modal, history list, net balance row |
| `src/app/profit-split/page.tsx` | Fetches withdrawals, passes as `initialWithdrawals` prop |
| `supabase/migrations/add_profit_withdrawals.sql` | DB migration to run on existing deployments |

## DB Table: `profit_withdrawals`
```sql
CREATE TABLE profit_withdrawals (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  partner_id   UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  amount       NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  notes        TEXT,
  withdrawn_at TIMESTAMPTZ DEFAULT now(),
  created_at   TIMESTAMPTZ DEFAULT now()
);
```

## Per-Partner Display in ProfitSplitPanel
Each partner row shows 5 breakdown cells:

| Cell | Value |
|------|-------|
| Total P&L Share | `totalPNL × partnerPct / 100` |
| Realized | `realizedGainLoss × partnerPct / 100` |
| Dividends | `totalDividends × partnerPct / 100` |
| Unrealized | `potentialGainLoss × partnerPct / 100` |
| Withdrawn | sum of this partner's `profit_withdrawals.amount` |

**Net balance row** = Total P&L Share − Withdrawn

**Withdrawal history** shown per partner with date, notes, amount, and delete button.

## Effect on Calculations
- `totalProfitWithdrawn` = sum of all `profit_withdrawals.amount` for the user
- Subtracted from `totalPortfolioValue`
- Subtracted from `investmentAvailable` (via totalPortfolioValue)
- Does **NOT** affect `totalPNL` — withdrawn profit was already earned

## ProfitSplitPanel Props
```ts
interface ProfitSplitPanelProps {
  initialPartners: Partner[]
  summary: PortfolioSummaryData | null
  initialWithdrawals: ProfitWithdrawal[]  // added with this feature
}
```
