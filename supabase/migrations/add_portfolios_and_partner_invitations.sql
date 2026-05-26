-- ============================================================
-- Migration: multiple portfolios + email-based partner invitations
-- ============================================================

-- ── 1. PORTFOLIOS TABLE ──────────────────────────────────────

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

-- Seed one default portfolio for every existing user
INSERT INTO portfolios (user_id, name)
SELECT id, 'My Portfolio'
FROM profiles
ON CONFLICT DO NOTHING;

-- ── 2. ADD portfolio_id TO EXISTING TABLES ───────────────────

-- transactions
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS portfolio_id UUID REFERENCES portfolios(id) ON DELETE CASCADE;

UPDATE transactions t
SET portfolio_id = p.id
FROM portfolios p
WHERE p.user_id = t.user_id
  AND t.portfolio_id IS NULL;

ALTER TABLE transactions ALTER COLUMN portfolio_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_portfolio_id ON transactions(portfolio_id);

-- investments
ALTER TABLE investments ADD COLUMN IF NOT EXISTS portfolio_id UUID REFERENCES portfolios(id) ON DELETE CASCADE;

UPDATE investments i
SET portfolio_id = p.id
FROM portfolios p
WHERE p.user_id = i.user_id
  AND i.portfolio_id IS NULL;

ALTER TABLE investments ALTER COLUMN portfolio_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_investments_portfolio_id ON investments(portfolio_id);

-- partners: add portfolio_id, linked-user fields
ALTER TABLE partners ADD COLUMN IF NOT EXISTS portfolio_id UUID REFERENCES portfolios(id) ON DELETE CASCADE;

UPDATE partners par
SET portfolio_id = p.id
FROM portfolios p
WHERE p.user_id = par.user_id
  AND par.portfolio_id IS NULL;

ALTER TABLE partners ALTER COLUMN portfolio_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_partners_portfolio_id ON partners(portfolio_id);

ALTER TABLE partners ADD COLUMN IF NOT EXISTS partner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS email TEXT;

-- one accepted partner per (portfolio, partner account)
CREATE UNIQUE INDEX IF NOT EXISTS idx_partners_portfolio_user
  ON partners(portfolio_id, partner_user_id)
  WHERE partner_user_id IS NOT NULL;

-- ── 3. PARTNER INVITATIONS TABLE ────────────────────────────

CREATE TABLE IF NOT EXISTS partner_invitations (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id     UUID        NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  inviter_user_id  UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_email    TEXT        NOT NULL,
  percentage       NUMERIC(6,3) NOT NULL CHECK (percentage > 0 AND percentage <= 100),
  color            TEXT        NOT NULL DEFAULT '#10b981',
  notes            TEXT,
  status           TEXT        NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('pending', 'accepted', 'declined')),
  token            UUID        NOT NULL DEFAULT gen_random_uuid(),
  expires_at       TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  created_at       TIMESTAMPTZ DEFAULT now(),
  accepted_at      TIMESTAMPTZ
);

-- Only one pending invite per (portfolio, email) at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_partner_invitations_unique_pending
  ON partner_invitations(portfolio_id, invited_email)
  WHERE status = 'pending';

CREATE UNIQUE INDEX IF NOT EXISTS idx_partner_invitations_token ON partner_invitations(token);
CREATE INDEX IF NOT EXISTS idx_partner_invitations_portfolio_id ON partner_invitations(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_partner_invitations_email ON partner_invitations(invited_email);

-- ── 4. UPDATE portfolio_holdings VIEW ───────────────────────

CREATE OR REPLACE VIEW portfolio_holdings AS
WITH buy_sell_only AS (
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
  s.name                                                          AS stock_name,
  s.sector,
  s.last_price                                                    AS current_price,
  s.change                                                        AS price_change,
  s.change_percent                                                AS price_change_percent,
  SUM(CASE WHEN t.type = 'BUY' THEN t.quantity ELSE -t.quantity END) AS net_quantity,
  CASE
    WHEN lba.total_buy_qty > 0
    THEN ROUND(lba.total_buy_cost / lba.total_buy_qty, 2)
    ELSE 0
  END AS avg_cost,
  CASE
    WHEN lba.total_buy_qty > 0
    THEN SUM(CASE WHEN t.type = 'BUY' THEN t.quantity ELSE -t.quantity END)
         * ROUND(lba.total_buy_cost / lba.total_buy_qty, 2)
    ELSE 0
  END AS total_invested,
  SUM(CASE WHEN t.type = 'BUY' THEN t.quantity ELSE -t.quantity END) * s.last_price AS current_value,
  CASE
    WHEN lba.total_buy_qty > 0
     AND SUM(CASE WHEN t.type = 'BUY' THEN t.quantity ELSE -t.quantity END) > 0
    THEN (SUM(CASE WHEN t.type = 'BUY' THEN t.quantity ELSE -t.quantity END) * s.last_price)
         - (SUM(CASE WHEN t.type = 'BUY' THEN t.quantity ELSE -t.quantity END)
            * ROUND(lba.total_buy_cost / lba.total_buy_qty, 2))
    ELSE 0
  END AS unrealized_gain_loss,
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
  SUM(t.fees)   AS total_fees,
  COUNT(t.id)   AS transaction_count
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

-- ── 5. RLS ───────────────────────────────────────────────────

-- portfolios
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

-- partners: add partner-self-view policy
CREATE POLICY "Partners can select their own record"
  ON partners FOR SELECT
  USING (auth.uid() = partner_user_id);

-- transactions: partners get read-only access to their portfolios
CREATE POLICY "Partners can select portfolio transactions"
  ON transactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM partners
      WHERE partners.portfolio_id = transactions.portfolio_id
        AND partners.partner_user_id = auth.uid()
    )
  );

-- investments: partners get read-only access
CREATE POLICY "Partners can select portfolio investments"
  ON investments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM partners
      WHERE partners.portfolio_id = investments.portfolio_id
        AND partners.partner_user_id = auth.uid()
    )
  );

-- profit_withdrawals: partners can see their own withdrawal records
CREATE POLICY "Partners can select own withdrawals"
  ON profit_withdrawals FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM partners
      WHERE partners.id = profit_withdrawals.partner_id
        AND partners.partner_user_id = auth.uid()
    )
  );

-- partner_invitations
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

-- ── 6. ACCEPT INVITATION FUNCTION ───────────────────────────

-- Called by the invited partner after they log in.
-- Looks up the token, creates the partners row, marks invite accepted.
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
  WHERE token        = invitation_token
    AND status       = 'pending'
    AND expires_at   > now()
    AND invited_email = v_email;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error',   'Invitation not found, already used, or expired'
    );
  END IF;

  -- Use the profile name if available, fall back to email
  SELECT COALESCE(full_name, v_email) INTO v_name
  FROM profiles WHERE id = auth.uid();

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

-- ── 7. TRIGGER: updated_at FOR portfolios ────────────────────

CREATE OR REPLACE TRIGGER portfolios_updated_at
  BEFORE UPDATE ON portfolios
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
