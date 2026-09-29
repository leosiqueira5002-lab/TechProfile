-- Add one privileged, atomic payment processor. No table or existing policy is replaced.
CREATE FUNCTION public.apply_mercado_pago_payment(
  p_user_id uuid,
  p_provider_payment_id text,
  p_amount numeric,
  p_currency text,
  p_status text,
  p_access_days integer
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_inserted boolean;
  v_payment public.payments%ROWTYPE;
  v_profile_updated boolean;
BEGIN
  IF p_user_id IS NULL
    OR p_provider_payment_id IS NULL
    OR pg_catalog.length(p_provider_payment_id) = 0
    OR pg_catalog.length(p_provider_payment_id) > 128
    OR p_amount IS DISTINCT FROM 19.90::numeric
    OR p_currency IS DISTINCT FROM 'BRL'
    OR p_access_days IS DISTINCT FROM 30
    OR p_status IS NULL
    OR p_status NOT IN ('approved', 'pending', 'in_process', 'rejected', 'cancelled', 'refunded', 'charged_back', 'authorized')
  THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid verified payment data';
  END IF;

  INSERT INTO public.payments (
    user_id,
    provider,
    provider_payment_id,
    amount,
    currency,
    status,
    access_days
  )
  VALUES (
    p_user_id,
    'mercado_pago',
    p_provider_payment_id,
    p_amount,
    p_currency,
    p_status,
    p_access_days
  )
  ON CONFLICT (provider, provider_payment_id) DO NOTHING
  RETURNING true INTO v_inserted;

  IF COALESCE(v_inserted, false) THEN
    IF p_status <> 'approved' THEN
      RETURN 'not-approved';
    END IF;

    UPDATE public.profiles AS profile
    SET plan = 'pro',
        pro_expires_at = CASE
          WHEN profile.plan = 'pro' AND profile.pro_expires_at > pg_catalog.transaction_timestamp()
            THEN profile.pro_expires_at + pg_catalog.make_interval(days => p_access_days)
          ELSE pg_catalog.transaction_timestamp() + pg_catalog.make_interval(days => p_access_days)
        END
    WHERE profile.user_id = p_user_id
    RETURNING true INTO v_profile_updated;

    IF NOT COALESCE(v_profile_updated, false) THEN
      RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'Profile required before granting Pro';
    END IF;

    RETURN 'granted';
  END IF;

  SELECT payment.*
  INTO v_payment
  FROM public.payments AS payment
  WHERE payment.provider = 'mercado_pago'
    AND payment.provider_payment_id = p_provider_payment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'Payment changed during processing';
  END IF;

  IF v_payment.user_id IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'Payment already belongs to another user';
  END IF;

  IF v_payment.amount IS DISTINCT FROM p_amount OR v_payment.currency IS DISTINCT FROM p_currency THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Payment details changed during processing';
  END IF;

  -- Once approved, late or duplicate events cannot downgrade status or grant again.
  IF v_payment.status = 'approved' THEN
    RETURN 'duplicate';
  END IF;

  UPDATE public.payments AS payment
  SET status = p_status
  WHERE payment.provider = 'mercado_pago'
    AND payment.provider_payment_id = p_provider_payment_id;

  IF p_status <> 'approved' THEN
    RETURN 'not-approved';
  END IF;

  UPDATE public.profiles AS profile
  SET plan = 'pro',
      pro_expires_at = CASE
        WHEN profile.plan = 'pro' AND profile.pro_expires_at > pg_catalog.transaction_timestamp()
          THEN profile.pro_expires_at + pg_catalog.make_interval(days => p_access_days)
        ELSE pg_catalog.transaction_timestamp() + pg_catalog.make_interval(days => p_access_days)
      END
  WHERE profile.user_id = p_user_id
  RETURNING true INTO v_profile_updated;

  IF NOT COALESCE(v_profile_updated, false) THEN
    RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'Profile required before granting Pro';
  END IF;

  RETURN 'granted';
END;
$$;

REVOKE ALL ON FUNCTION public.apply_mercado_pago_payment(uuid, text, numeric, text, text, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_mercado_pago_payment(uuid, text, numeric, text, text, integer)
  TO service_role;
