-- ============================================
-- Stockify — PSX Portfolio Manager
-- Supabase Database Schema
-- ============================================

-- 1. PROFILES TABLE
-- Linked to auth.users via foreign key
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. STOCKS CACHE TABLE
-- Stores cached PSX stock data
CREATE TABLE IF NOT EXISTS stocks (
  symbol TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sector TEXT,
  last_price NUMERIC(12,2) DEFAULT 0,
  change NUMERIC(12,2) DEFAULT 0,
  change_percent NUMERIC(8,4) DEFAULT 0,
  volume BIGINT DEFAULT 0,
  high NUMERIC(12,2) DEFAULT 0,
  low NUMERIC(12,2) DEFAULT 0,
  open NUMERIC(12,2) DEFAULT 0,
  close NUMERIC(12,2) DEFAULT 0,
  market_cap NUMERIC(20,2),
  last_updated TIMESTAMPTZ DEFAULT now()
);

-- 3a. PORTFOLIOS TABLE
-- Each user can have multiple named portfolios
CREATE TABLE IF NOT EXISTS portfolios (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL DEFAULT 'My Portfolio',
  description TEXT,
  color       TEXT        NOT NULL DEFAULT '#10b981',
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portfolios_user_id ON portfolios(user_id);

-- 3. TRANSACTIONS TABLE
-- Records user buy/sell transactions
CREATE TABLE IF NOT EXISTS transactions (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  portfolio_id UUID        NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  symbol       TEXT        NOT NULL REFERENCES stocks(symbol),
  type TEXT NOT NULL CHECK (type IN ('BUY', 'SELL', 'DIVIDEND')),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  price_per_share NUMERIC(12,2) NOT NULL CHECK (price_per_share >= 0),
  fees NUMERIC(12,2) DEFAULT 0,
  -- Weighted avg cost per share at the time of the sell (NULL for BUY rows).
  -- Realized P&L for a sell = qty × (price_per_share − cost_basis) − fees
  cost_basis NUMERIC(12,4) DEFAULT NULL,
  notes TEXT,
  executed_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Migration: add cost_basis to existing deployments
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS cost_basis NUMERIC(12,4) DEFAULT NULL;

-- Migration: allow DIVIDEND type
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_type_check CHECK (type IN ('BUY', 'SELL', 'DIVIDEND'));

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_portfolio_id ON transactions(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_transactions_symbol ON transactions(symbol);
CREATE INDEX IF NOT EXISTS idx_transactions_executed_at ON transactions(executed_at DESC);

-- 4. INVESTMENTS TABLE
-- Records cash/fund movements in and out of the account
CREATE TABLE IF NOT EXISTS investments (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  portfolio_id UUID        NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  type         TEXT        NOT NULL CHECK (type IN ('ADD', 'WITHDRAW')),
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  notes TEXT,
  invested_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_investments_user_id ON investments(user_id);
CREATE INDEX IF NOT EXISTS idx_investments_portfolio_id ON investments(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_investments_invested_at ON investments(invested_at DESC);

-- 5. PORTFOLIO HOLDINGS VIEW
-- Calculates average cost, current value, and unrealized gain/loss per symbol.
--
-- FIFO lot tracking: sells consume the oldest purchased shares first.
-- avg_cost reflects only the UNSOLD shares' weighted-average purchase price,
-- so partial sells correctly raise (or lower) the displayed avg cost to match
-- the remaining lots rather than keeping the overall weighted average.
--
-- A new "lot" begins whenever a BUY happens after the running net quantity has
-- dropped to 0 (position fully closed), so a fresh buy after a full sell-off
-- is treated as a brand-new position.
CREATE OR REPLACE VIEW portfolio_holdings AS
WITH buy_sell_only AS (
  -- Exclude DIVIDEND rows from holdings calculations
  SELECT * FROM transactions WHERE type IN ('BUY', 'SELL')
),
tx_ordered AS (
  SELECT
    t.*,
    COALESCE(
      SUM(CASE WHEN t.type = 'BUY' THEN t.quantity ELSE -t.quantity END)
        OVER (
          PARTITION BY t.user_id, t.portfolio_id, t.symbol
          ORDER BY t.executed_at, t.created_at, t.id
          ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
        ),
      0
    ) AS prev_net_qty
  FROM buy_sell_only t
),
tx_with_lot AS (
  SELECT
    *,
    SUM(CASE WHEN type = 'BUY' AND prev_net_qty <= 0 THEN 1 ELSE 0 END)
      OVER (
        PARTITION BY user_id, portfolio_id, symbol
        ORDER BY executed_at, created_at, id
      ) AS lot_id
  FROM tx_ordered
),
current_lot AS (
  SELECT user_id, portfolio_id, symbol, MAX(lot_id) AS max_lot_id
  FROM tx_with_lot
  GROUP BY user_id, portfolio_id, symbol
),
-- Weighted-average cost: total cost of ALL buys in current lot / total buy qty.
-- This stays constant regardless of partial sells (only resets on full close).
lot_buy_avg AS (
  SELECT
    t.user_id,
    t.portfolio_id,
    t.symbol,
    SUM(CASE WHEN t.type = 'BUY' THEN t.quantity ELSE 0 END)::NUMERIC AS total_buy_qty,
    SUM(CASE WHEN t.type = 'BUY' THEN t.quantity * t.price_per_share ELSE 0 END)::NUMERIC AS total_buy_cost,
    SUM(CASE WHEN t.type = 'BUY' THEN t.quantity ELSE -t.quantity END)::NUMERIC AS net_qty
  FROM tx_with_lot t
  JOIN current_lot cl
    ON cl.user_id = t.user_id
   AND cl.portfolio_id = t.portfolio_id
   AND cl.symbol = t.symbol
   AND t.lot_id = cl.max_lot_id
  GROUP BY t.user_id, t.portfolio_id, t.symbol
)
SELECT
  t.user_id,
  t.portfolio_id,
  t.symbol,
  s.name AS stock_name,
  s.sector,
  s.last_price AS current_price,
  s.change AS price_change,
  s.change_percent AS price_change_percent,
  SUM(CASE WHEN t.type = 'BUY' THEN t.quantity ELSE -t.quantity END) AS net_quantity,
  -- Weighted avg cost of all buys in the current lot (does NOT change on partial sells)
  CASE
    WHEN lba.total_buy_qty > 0
    THEN ROUND(lba.total_buy_cost / lba.total_buy_qty, 2)
    ELSE 0
  END AS avg_cost,
  -- total_invested: net_qty × weighted avg cost
  CASE
    WHEN lba.total_buy_qty > 0
    THEN SUM(CASE WHEN t.type = 'BUY' THEN t.quantity ELSE -t.quantity END)
         * ROUND(lba.total_buy_cost / lba.total_buy_qty, 2)
    ELSE 0
  END AS total_invested,
  SUM(CASE WHEN t.type = 'BUY' THEN t.quantity ELSE -t.quantity END) * s.last_price AS current_value,
  -- unrealized_gain_loss
  CASE
    WHEN lba.total_buy_qty > 0
     AND SUM(CASE WHEN t.type = 'BUY' THEN t.quantity ELSE -t.quantity END) > 0
    THEN (SUM(CASE WHEN t.type = 'BUY' THEN t.quantity ELSE -t.quantity END) * s.last_price)
         - (SUM(CASE WHEN t.type = 'BUY' THEN t.quantity ELSE -t.quantity END)
            * ROUND(lba.total_buy_cost / lba.total_buy_qty, 2))
    ELSE 0
  END AS unrealized_gain_loss,
  -- unrealized_gain_loss_percent
  CASE
    WHEN lba.total_buy_qty > 0
     AND lba.total_buy_cost > 0
     AND SUM(CASE WHEN t.type = 'BUY' THEN t.quantity ELSE -t.quantity END) > 0
    THEN ROUND(
      (
        (SUM(CASE WHEN t.type = 'BUY' THEN t.quantity ELSE -t.quantity END) * s.last_price)
        - (SUM(CASE WHEN t.type = 'BUY' THEN t.quantity ELSE -t.quantity END)
           * ROUND(lba.total_buy_cost / lba.total_buy_qty, 2))
      ) / (SUM(CASE WHEN t.type = 'BUY' THEN t.quantity ELSE -t.quantity END)
           * ROUND(lba.total_buy_cost / lba.total_buy_qty, 2)) * 100,
      2
    )
    ELSE 0
  END AS unrealized_gain_loss_percent,
  SUM(t.fees) AS total_fees,
  COUNT(t.id) AS transaction_count
FROM tx_with_lot t
JOIN current_lot cl
  ON cl.user_id = t.user_id
 AND cl.portfolio_id = t.portfolio_id
 AND cl.symbol = t.symbol
JOIN stocks s ON s.symbol = t.symbol
JOIN lot_buy_avg lba
  ON lba.user_id = t.user_id
 AND lba.portfolio_id = t.portfolio_id
 AND lba.symbol = t.symbol
GROUP BY
  t.user_id, t.portfolio_id, t.symbol,
  s.name, s.sector, s.last_price, s.change, s.change_percent,
  cl.max_lot_id, lba.total_buy_qty, lba.total_buy_cost;


-- 5b. PARTNERS TABLE
-- Records profit-sharing partners and their percentage split.
-- partner_user_id is set once the invited user accepts the invitation.
CREATE TABLE IF NOT EXISTS partners (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  portfolio_id     UUID         NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  name             TEXT         NOT NULL,
  percentage       NUMERIC(6,3) NOT NULL CHECK (percentage > 0 AND percentage <= 100),
  color            TEXT         NOT NULL DEFAULT '#10b981',
  notes            TEXT,
  -- set when the invited partner accepts (links to their Supabase auth account)
  partner_user_id  UUID         REFERENCES auth.users(id) ON DELETE SET NULL,
  email            TEXT,
  created_at       TIMESTAMPTZ  DEFAULT now(),
  updated_at       TIMESTAMPTZ  DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partners_user_id ON partners(user_id);
CREATE INDEX IF NOT EXISTS idx_partners_portfolio_id ON partners(portfolio_id);

-- Prevent the same partner account from appearing twice on one portfolio
CREATE UNIQUE INDEX IF NOT EXISTS idx_partners_portfolio_user
  ON partners(portfolio_id, partner_user_id)
  WHERE partner_user_id IS NOT NULL;

-- 5c. PARTNER INVITATIONS TABLE
-- Tracks email invitations sent to prospective partners
CREATE TABLE IF NOT EXISTS partner_invitations (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id     UUID         NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  inviter_user_id  UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_email    TEXT         NOT NULL,
  percentage       NUMERIC(6,3) NOT NULL CHECK (percentage > 0 AND percentage <= 100),
  color            TEXT         NOT NULL DEFAULT '#10b981',
  notes            TEXT,
  status           TEXT         NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending', 'accepted', 'declined')),
  token            UUID         NOT NULL DEFAULT gen_random_uuid(),
  expires_at       TIMESTAMPTZ  NOT NULL DEFAULT (now() + interval '7 days'),
  created_at       TIMESTAMPTZ  DEFAULT now(),
  accepted_at      TIMESTAMPTZ
);

-- Only one live invite per (portfolio, email)
CREATE UNIQUE INDEX IF NOT EXISTS idx_partner_invitations_unique_pending
  ON partner_invitations(portfolio_id, invited_email)
  WHERE status = 'pending';

CREATE UNIQUE INDEX IF NOT EXISTS idx_partner_invitations_token ON partner_invitations(token);
CREATE INDEX IF NOT EXISTS idx_partner_invitations_portfolio_id ON partner_invitations(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_partner_invitations_email ON partner_invitations(invited_email);

-- 5c. PROFIT WITHDRAWALS TABLE
-- Records per-partner profit withdrawals
CREATE TABLE IF NOT EXISTS profit_withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  notes TEXT,
  withdrawn_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profit_withdrawals_user_id ON profit_withdrawals(user_id);
CREATE INDEX IF NOT EXISTS idx_profit_withdrawals_partner_id ON profit_withdrawals(partner_id);

-- ============================================
-- 6. ROW LEVEL SECURITY (RLS)
-- ============================================

-- Profiles: users can only access their own profile
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Transactions: users can only CRUD their own transactions
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transactions"
  ON transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transactions"
  ON transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own transactions"
  ON transactions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own transactions"
  ON transactions FOR DELETE
  USING (auth.uid() = user_id);

-- Investments: users can only CRUD their own fund entries
ALTER TABLE investments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own investments"
  ON investments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own investments"
  ON investments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own investments"
  ON investments FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own investments"
  ON investments FOR DELETE
  USING (auth.uid() = user_id);

-- Portfolios: owners full CRUD; accepted partners can read
ALTER TABLE portfolios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can select own portfolios"
  ON portfolios FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Partners can select shared portfolios"
  ON portfolios FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM partners
      WHERE partners.portfolio_id = portfolios.id
        AND partners.partner_user_id = auth.uid()
    )
  );

CREATE POLICY "Owners can insert own portfolios"
  ON portfolios FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owners can update own portfolios"
  ON portfolios FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Owners can delete own portfolios"
  ON portfolios FOR DELETE
  USING (auth.uid() = user_id);

-- Partners: owners CRUD; invited partner can read their own record
ALTER TABLE partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view own partners"
  ON partners FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Partners can select their own record"
  ON partners FOR SELECT
  USING (auth.uid() = partner_user_id);

CREATE POLICY "Owners can insert own partners"
  ON partners FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owners can update own partners"
  ON partners FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Owners can delete own partners"
  ON partners FOR DELETE
  USING (auth.uid() = user_id);

-- Partner invitations: owner CRUD; invitee can read by email
ALTER TABLE partner_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can select own invitations"
  ON partner_invitations FOR SELECT
  USING (auth.uid() = inviter_user_id);

CREATE POLICY "Invited users can select their invitations"
  ON partner_invitations FOR SELECT
  USING (invited_email = auth.email());

CREATE POLICY "Owners can insert invitations"
  ON partner_invitations FOR INSERT
  WITH CHECK (auth.uid() = inviter_user_id);

CREATE POLICY "Owners can update invitations"
  ON partner_invitations FOR UPDATE
  USING (auth.uid() = inviter_user_id);

CREATE POLICY "Owners can delete invitations"
  ON partner_invitations FOR DELETE
  USING (auth.uid() = inviter_user_id);

-- Transactions: partners get read-only access to portfolios they are in
CREATE POLICY "Partners can select portfolio transactions"
  ON transactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM partners
      WHERE partners.portfolio_id = transactions.portfolio_id
        AND partners.partner_user_id = auth.uid()
    )
  );

-- Investments: partners get read-only access to portfolios they are in
CREATE POLICY "Partners can select portfolio investments"
  ON investments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM partners
      WHERE partners.portfolio_id = investments.portfolio_id
        AND partners.partner_user_id = auth.uid()
    )
  );

-- Profit withdrawals: owners CRUD; partners can see their own rows
ALTER TABLE profit_withdrawals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profit_withdrawals"
  ON profit_withdrawals FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Partners can select own withdrawals"
  ON profit_withdrawals FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM partners
      WHERE partners.id = profit_withdrawals.partner_id
        AND partners.partner_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own profit_withdrawals"
  ON profit_withdrawals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own profit_withdrawals"
  ON profit_withdrawals FOR DELETE
  USING (auth.uid() = user_id);

-- Stocks: public read, authenticated users can write
ALTER TABLE stocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read stocks"
  ON stocks FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert stocks"
  ON stocks FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update stocks"
  ON stocks FOR UPDATE
  USING (auth.role() = 'authenticated');


-- ============================================
-- 7. TRIGGERS & FUNCTIONS
-- ============================================

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Auto-update updated_at on profiles
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER partners_updated_at
  BEFORE UPDATE ON partners
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER portfolios_updated_at
  BEFORE UPDATE ON portfolios
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Accept a partner invitation by token (called by the invited user after login)
CREATE OR REPLACE FUNCTION accept_partner_invitation(invitation_token UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv    partner_invitations%ROWTYPE;
  v_pid    UUID;
  v_email  TEXT;
  v_name   TEXT;
BEGIN
  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();

  SELECT * INTO v_inv
  FROM partner_invitations
  WHERE token         = invitation_token
    AND status        = 'pending'
    AND expires_at    > now()
    AND invited_email = v_email;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error',   'Invitation not found, already used, or expired'
    );
  END IF;

  SELECT COALESCE(full_name, v_email) INTO v_name
  FROM profiles WHERE id = auth.uid();

  -- Check if a partners row already exists for this (portfolio, user)
  SELECT id INTO v_pid
  FROM partners
  WHERE portfolio_id    = v_inv.portfolio_id
    AND partner_user_id = auth.uid();

  IF FOUND THEN
    UPDATE partners
    SET percentage = v_inv.percentage,
        color      = v_inv.color
    WHERE id = v_pid;
  ELSE
    INSERT INTO partners (
      user_id, portfolio_id, name, percentage, color, notes,
      partner_user_id, email
    ) VALUES (
      v_inv.inviter_user_id,
      v_inv.portfolio_id,
      v_name,
      v_inv.percentage,
      v_inv.color,
      v_inv.notes,
      auth.uid(),
      v_email
    )
    RETURNING id INTO v_pid;
  END IF;

  UPDATE partner_invitations
  SET status = 'accepted', accepted_at = now()
  WHERE id = v_inv.id;

  RETURN jsonb_build_object('success', true, 'partner_id', v_pid);
END;
$$;


-- ============================================
-- 8. SEED DATA (Popular PSX Stocks)
-- ============================================

INSERT INTO stocks (symbol, name, sector, last_price) VALUES
  ('OGDC', 'Oil & Gas Development Company', 'Oil & Gas Exploration', 95.50),
  ('PPL', 'Pakistan Petroleum Limited', 'Oil & Gas Exploration', 78.00),
  ('PSO', 'Pakistan State Oil', 'Oil & Gas Marketing', 285.00),
  ('HBL', 'Habib Bank Limited', 'Commercial Banks', 125.00),
  ('UBL', 'United Bank Limited', 'Commercial Banks', 138.00),
  ('MCB', 'MCB Bank Limited', 'Commercial Banks', 175.00),
  ('ENGRO', 'Engro Corporation', 'Fertilizer', 265.00),
  ('FFC', 'Fauji Fertilizer Company', 'Fertilizer', 110.00),
  ('LUCK', 'Lucky Cement', 'Cement', 520.00),
  ('DGKC', 'D.G. Khan Cement', 'Cement', 72.00),
  ('HUBC', 'Hub Power Company', 'Power Generation', 85.00),
  ('KEL', 'K-Electric Limited', 'Power Generation', 4.50),
  ('EFERT', 'Engro Fertilizers', 'Fertilizer', 92.00),
  ('MARI', 'Mari Petroleum Company', 'Oil & Gas Exploration', 1650.00),
  ('SYS', 'Systems Limited', 'Technology & Communication', 395.00),
  ('TRG', 'TRG Pakistan', 'Technology & Communication', 135.00),
  ('MEBL', 'Meezan Bank Limited', 'Commercial Banks', 185.00),
  ('BAHL', 'Bank AL Habib', 'Commercial Banks', 68.00),
  ('ATRL', 'Attock Refinery', 'Refinery', 230.00),
  ('NRL', 'National Refinery', 'Refinery', 295.00),
  ('POL', 'Pakistan Oilfields', 'Oil & Gas Exploration', 410.00),
  ('SEARL', 'Searle Company', 'Pharmaceuticals', 68.00),
  ('AGP', 'AGP Limited', 'Pharmaceuticals', 58.00),
  ('NESTLE', 'Nestle Pakistan', 'Food & Personal Care', 6200.00),
  ('COLG', 'Colgate Palmolive', 'Food & Personal Care', 2350.00)
ON CONFLICT (symbol) DO NOTHING;
