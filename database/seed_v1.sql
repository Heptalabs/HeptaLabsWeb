BEGIN;

INSERT INTO asset_policies (
  network,
  min_withdraw_amount,
  withdraw_allowed_weekdays,
  is_active,
  effective_from
)
VALUES (
  'TRC20',
  1,
  ARRAY[0, 1, 2, 3, 4, 5, 6]::SMALLINT[],
  TRUE,
  '2026-01-01T00:00:00Z'::TIMESTAMPTZ
)
ON CONFLICT DO NOTHING;

INSERT INTO products (
  name,
  guide_text,
  daily_rate,
  profit_occurrence_limit,
  profit_weekdays,
  return_principal,
  is_visible
)
VALUES
  (
    'Daily Yield 30',
    'Example product for rehearsal and smoke testing.',
    0.0008,
    30,
    ARRAY[1, 2, 3, 4, 5]::SMALLINT[],
    TRUE,
    TRUE
  ),
  (
    'Daily Yield 60',
    'Example medium-term product for rehearsal and smoke testing.',
    0.0010,
    60,
    ARRAY[1, 2, 3, 4, 5]::SMALLINT[],
    TRUE,
    TRUE
  )
ON CONFLICT DO NOTHING;

COMMIT;
