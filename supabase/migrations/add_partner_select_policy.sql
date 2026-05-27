-- Allow an accepted partner to read ALL partner rows for portfolios they belong to.
-- Uses a SECURITY DEFINER helper to avoid infinite-recursion when the partners
-- table policy references itself.

CREATE OR REPLACE FUNCTION is_portfolio_partner(p_portfolio_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM partners
    WHERE portfolio_id    = p_portfolio_id
      AND partner_user_id = auth.uid()
  );
$$;

CREATE POLICY "Partners can view all partners in their portfolio"
  ON partners FOR SELECT
  USING (is_portfolio_partner(portfolio_id));
