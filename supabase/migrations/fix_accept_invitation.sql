-- Fix: replace ON CONFLICT (partial index) with explicit upsert logic
-- This resolves "no unique or exclusion constraint matching ON CONFLICT specification"

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
  WHERE portfolio_id     = v_inv.portfolio_id
    AND partner_user_id  = auth.uid();

  IF FOUND THEN
    -- Update existing record
    UPDATE partners
    SET percentage = v_inv.percentage,
        color      = v_inv.color
    WHERE id = v_pid;
  ELSE
    -- Insert new record
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
