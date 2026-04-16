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

-- 3. TRANSACTIONS TABLE
-- Records user buy/sell transactions
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL REFERENCES stocks(symbol),
  type TEXT NOT NULL CHECK (type IN ('BUY', 'SELL')),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  price_per_share NUMERIC(12,2) NOT NULL CHECK (price_per_share >= 0),
  fees NUMERIC(12,2) DEFAULT 0,
  notes TEXT,
  executed_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_symbol ON transactions(symbol);
CREATE INDEX IF NOT EXISTS idx_transactions_executed_at ON transactions(executed_at DESC);

-- 4. INVESTMENTS TABLE
-- Records cash/fund movements in and out of the account
CREATE TABLE IF NOT EXISTS investments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('ADD', 'WITHDRAW')),
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  notes TEXT,
  invested_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_investments_user_id ON investments(user_id);
CREATE INDEX IF NOT EXISTS idx_investments_invested_at ON investments(invested_at DESC);

-- 5. PORTFOLIO HOLDINGS VIEW
-- Calculates average cost, current value, and unrealized gain/loss per symbol
CREATE OR REPLACE VIEW portfolio_holdings AS
SELECT
  t.user_id,
  t.symbol,
  s.name AS stock_name,
  s.sector,
  s.last_price AS current_price,
  s.change AS price_change,
  s.change_percent AS price_change_percent,
  -- Net quantity (BUY adds, SELL subtracts)
  SUM(CASE WHEN t.type = 'BUY' THEN t.quantity ELSE -t.quantity END) AS net_quantity,
  -- Average buy cost (weighted average of all BUY transactions)
  CASE
    WHEN SUM(CASE WHEN t.type = 'BUY' THEN t.quantity ELSE 0 END) > 0
    THEN ROUND(
      SUM(CASE WHEN t.type = 'BUY' THEN t.quantity * t.price_per_share ELSE 0 END)::NUMERIC
      / SUM(CASE WHEN t.type = 'BUY' THEN t.quantity ELSE 0 END)::NUMERIC,
      2
    )
    ELSE 0
  END AS avg_cost,
  -- Total invested (sum of all BUY costs minus SELL proceeds)
  SUM(CASE WHEN t.type = 'BUY' THEN t.quantity * t.price_per_share ELSE 0 END) AS total_invested,
  -- Current market value
  SUM(CASE WHEN t.type = 'BUY' THEN t.quantity ELSE -t.quantity END) * s.last_price AS current_value,
  -- Unrealized gain/loss
  (SUM(CASE WHEN t.type = 'BUY' THEN t.quantity ELSE -t.quantity END) * s.last_price)
    - SUM(CASE
        WHEN t.type = 'BUY' THEN t.quantity * t.price_per_share
        ELSE -t.quantity * t.price_per_share
      END) AS unrealized_gain_loss,
  -- Unrealized gain/loss percentage
  CASE
    WHEN SUM(CASE WHEN t.type = 'BUY' THEN t.quantity * t.price_per_share ELSE 0 END) > 0
    THEN ROUND(
      (
        (SUM(CASE WHEN t.type = 'BUY' THEN t.quantity ELSE -t.quantity END) * s.last_price)
        - SUM(CASE
            WHEN t.type = 'BUY' THEN t.quantity * t.price_per_share
            ELSE -t.quantity * t.price_per_share
          END)
      )::NUMERIC
      / SUM(CASE WHEN t.type = 'BUY' THEN t.quantity * t.price_per_share ELSE 0 END)::NUMERIC
      * 100,
      2
    )
    ELSE 0
  END AS unrealized_gain_loss_percent,
  -- Total fees paid
  SUM(t.fees) AS total_fees,
  -- Number of transactions
  COUNT(t.id) AS transaction_count
FROM transactions t
JOIN stocks s ON s.symbol = t.symbol
GROUP BY t.user_id, t.symbol, s.name, s.sector, s.last_price, s.change, s.change_percent;


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
