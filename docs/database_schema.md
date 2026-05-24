# Database Schema

## Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `profiles` | User profiles | id (FK auth.users), full_name, avatar_url |
| `stocks` | PSX stock price cache | symbol (PK), name, sector, last_price, last_updated |
| `transactions` | BUY/SELL/DIVIDEND records | id, user_id, symbol (FK stocks), type, quantity, price_per_share, fees, cost_basis, executed_at |
| `investments` | Cash ADD/WITHDRAW entries | id, user_id, type ('ADD'\|'WITHDRAW'), amount, invested_at |
| `partners` | Profit-sharing partners | id, user_id, name, percentage, color, notes |
| `profit_withdrawals` | Per-partner profit withdrawals | id, user_id, partner_id (FK partners), amount, notes, withdrawn_at |

## Views

### `portfolio_holdings`
Materialized calculation per user per symbol:
- Computes `net_quantity`, `avg_cost`, `total_invested`, `current_value`, `unrealized_gain_loss`
- Uses lot tracking: new lot starts when BUY happens after position fully closed (net_qty=0)
- `avg_cost` = weighted average of ALL buys in current lot (does not change on partial sells)
- `total_invested` = `net_quantity × avg_cost`
- Excludes DIVIDEND rows
- Joined to `stocks` for live price

## Transaction Constraints
- `type` CHECK: `('BUY', 'SELL', 'DIVIDEND')`
- `quantity` > 0
- `price_per_share` >= 0 (dividends use this field for total amount)
- `cost_basis` nullable — only populated for SELL rows, computed in-memory by `enrichWithCostBasis()`

## RLS
All tables use Row Level Security — every policy checks `auth.uid() = user_id`.
`stocks` is publicly readable; authenticated users can write.

## Migration Strategy
**IMPORTANT:** `supabase/schema.sql` is for fresh installs only.
Running it on an existing DB will error with "policy already exists".

New migrations go in `supabase/migrations/` as separate SQL files.

### Applied Migrations
| File | Description | Date |
|------|-------------|------|
| `add_profit_withdrawals.sql` | Adds `profit_withdrawals` table + RLS | May 2026 |
