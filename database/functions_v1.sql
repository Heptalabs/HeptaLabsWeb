BEGIN;

CREATE OR REPLACE FUNCTION fn_apply_ledger_delta(
  p_user_id BIGINT,
  p_entry_type ledger_entry_type,
  p_amount NUMERIC,
  p_delta_available NUMERIC,
  p_delta_withdraw_locked NUMERIC,
  p_delta_product_principal NUMERIC,
  p_reference_type VARCHAR,
  p_reference_id BIGINT,
  p_business_date DATE,
  p_idempotency_key TEXT,
  p_note TEXT,
  p_created_by BIGINT
)
RETURNS BIGINT
LANGUAGE plpgsql
AS $$
DECLARE
  v_existing_id BIGINT;
  v_ledger_id BIGINT;
  v_available NUMERIC;
  v_withdraw_locked NUMERIC;
  v_product_principal NUMERIC;
  v_next_available NUMERIC;
  v_next_withdraw_locked NUMERIC;
  v_next_product_principal NUMERIC;
BEGIN
  SELECT id
  INTO v_existing_id
  FROM ledger_entries
  WHERE idempotency_key = p_idempotency_key
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN v_existing_id;
  END IF;

  SELECT
    balance_available,
    balance_withdraw_locked,
    balance_product_principal
  INTO
    v_available,
    v_withdraw_locked,
    v_product_principal
  FROM users
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found: %', p_user_id;
  END IF;

  v_next_available := COALESCE(v_available, 0) + COALESCE(p_delta_available, 0);
  v_next_withdraw_locked := COALESCE(v_withdraw_locked, 0) + COALESCE(p_delta_withdraw_locked, 0);
  v_next_product_principal := COALESCE(v_product_principal, 0) + COALESCE(p_delta_product_principal, 0);

  IF v_next_available < 0 OR v_next_withdraw_locked < 0 OR v_next_product_principal < 0 THEN
    RAISE EXCEPTION 'Insufficient balance for ledger delta (user_id=%).', p_user_id;
  END IF;

  INSERT INTO ledger_entries (
    user_id,
    entry_type,
    amount,
    delta_available,
    delta_withdraw_locked,
    delta_product_principal,
    reference_type,
    reference_id,
    business_date,
    idempotency_key,
    note,
    created_by
  )
  VALUES (
    p_user_id,
    p_entry_type,
    COALESCE(p_amount, 0),
    COALESCE(p_delta_available, 0),
    COALESCE(p_delta_withdraw_locked, 0),
    COALESCE(p_delta_product_principal, 0),
    p_reference_type,
    p_reference_id,
    COALESCE(p_business_date, CURRENT_DATE),
    p_idempotency_key,
    p_note,
    p_created_by
  )
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING id INTO v_ledger_id;

  IF v_ledger_id IS NULL THEN
    SELECT id
    INTO v_existing_id
    FROM ledger_entries
    WHERE idempotency_key = p_idempotency_key
    LIMIT 1;
    RETURN v_existing_id;
  END IF;

  UPDATE users
  SET
    balance_available = v_next_available,
    balance_withdraw_locked = v_next_withdraw_locked,
    balance_product_principal = v_next_product_principal,
    updated_at = NOW()
  WHERE id = p_user_id;

  RETURN v_ledger_id;
END;
$$;

CREATE OR REPLACE FUNCTION fn_get_product_policy_for_date(
  p_product_id BIGINT,
  p_business_date DATE
)
RETURNS TABLE (
  product_id BIGINT,
  daily_rate NUMERIC,
  profit_occurrence_limit INTEGER,
  profit_weekdays SMALLINT[],
  return_principal BOOLEAN
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    p.id AS product_id,
    p.daily_rate,
    p.profit_occurrence_limit,
    p.profit_weekdays,
    p.return_principal
  FROM products p
  WHERE p.id = p_product_id
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION fn_run_daily_batch(
  p_business_date DATE,
  p_actor_id BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_target_date DATE := COALESCE(p_business_date, CURRENT_DATE);
BEGIN
  RETURN jsonb_build_object(
    'businessDate', v_target_date,
    'status', 'skipped',
    'message', 'Daily batch worker is not yet enabled in this build.',
    'actorId', p_actor_id
  );
END;
$$;

COMMIT;
