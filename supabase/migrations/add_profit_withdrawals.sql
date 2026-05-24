-- Migration: add profit_withdrawals table
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

ALTER TABLE profit_withdrawals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profit_withdrawals"
  ON profit_withdrawals FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profit_withdrawals"
  ON profit_withdrawals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own profit_withdrawals"
  ON profit_withdrawals FOR DELETE
  USING (auth.uid() = user_id);
