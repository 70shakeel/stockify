-- Returns all partner rows for a portfolio if the calling user is either the
-- portfolio owner OR an accepted partner in that portfolio.
-- SECURITY DEFINER bypasses RLS, so no additional policy is needed.

CREATE OR REPLACE FUNCTION get_portfolio_partners(p_portfolio_id UUID)
RETURNS SETOF partners
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Caller must be the owner or an accepted partner
  IF NOT EXISTS (
    SELECT 1 FROM portfolios
    WHERE id = p_portfolio_id AND user_id = auth.uid()
  ) AND NOT EXISTS (
    SELECT 1 FROM partners
    WHERE portfolio_id = p_portfolio_id AND partner_user_id = auth.uid()
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
    SELECT * FROM partners
    WHERE portfolio_id = p_portfolio_id
    ORDER BY created_at ASC;
END;
$$;
