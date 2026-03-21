-- Add cost-based quota columns to usage_quotas
-- Existing token columns are kept for analytics

ALTER TABLE usage_quotas
ADD COLUMN IF NOT EXISTS monthly_cost_used NUMERIC(10,4) DEFAULT 0.0000,
ADD COLUMN IF NOT EXISTS monthly_cost_limit NUMERIC(10,4) DEFAULT 1.0000;

-- Backfill existing records with cost limits based on plan
UPDATE usage_quotas SET monthly_cost_limit = CASE
  WHEN plan_id IN ('pro', 'pro-yearly') THEN 40.0000
  WHEN plan_id IN ('plus', 'plus-yearly') THEN 15.0000
  WHEN plan_id IN ('enterprise', 'enterprise-yearly') THEN -1
  ELSE 1.0000
END;

-- Create update_cost_usage function (atomic cost tracking)
CREATE OR REPLACE FUNCTION update_cost_usage(p_user_id UUID, p_cost_usd NUMERIC(10,4))
RETURNS BOOLEAN AS $$
DECLARE
  current_cost NUMERIC(10,4);
  cost_limit NUMERIC(10,4);
  next_reset_date TIMESTAMPTZ;
BEGIN
  next_reset_date := (date_trunc('month', NOW() AT TIME ZONE 'UTC') + interval '1 month') AT TIME ZONE 'UTC';

  SELECT monthly_cost_used, monthly_cost_limit
  INTO current_cost, cost_limit
  FROM usage_quotas
  WHERE usage_quotas.user_id = p_user_id
    AND reset_date = next_reset_date;

  IF NOT FOUND THEN
    PERFORM initialize_user_quota(p_user_id, 'free');
    SELECT monthly_cost_used, monthly_cost_limit
    INTO current_cost, cost_limit
    FROM usage_quotas
    WHERE usage_quotas.user_id = p_user_id
      AND reset_date = next_reset_date;
  END IF;

  -- -1 means unlimited
  IF cost_limit != -1 AND (current_cost + p_cost_usd) > cost_limit THEN
    RETURN FALSE;
  END IF;

  UPDATE usage_quotas
  SET monthly_cost_used = monthly_cost_used + p_cost_usd,
      updated_at = NOW()
  WHERE usage_quotas.user_id = p_user_id
    AND reset_date = next_reset_date;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update initialize_user_quota to include cost limits
CREATE OR REPLACE FUNCTION initialize_user_quota(p_user_id UUID, p_plan_id TEXT DEFAULT 'free')
RETURNS VOID AS $$
DECLARE
  monthly_limit INTEGER;
  sessions_limit INTEGER;
  web_searches_limit INTEGER;
  cost_limit NUMERIC(10,4);
  next_reset_date TIMESTAMPTZ;
BEGIN
  CASE p_plan_id
    WHEN 'free' THEN
      monthly_limit := 500000;
      sessions_limit := 3;
      web_searches_limit := 10;
      cost_limit := 1.0000;
    WHEN 'plus' THEN
      monthly_limit := 4000000;
      sessions_limit := -1;
      web_searches_limit := 200;
      cost_limit := 15.0000;
    WHEN 'pro' THEN
      monthly_limit := 15000000;
      sessions_limit := -1;
      web_searches_limit := -1;
      cost_limit := 40.0000;
    WHEN 'plus-yearly' THEN
      monthly_limit := 4000000;
      sessions_limit := -1;
      web_searches_limit := 200;
      cost_limit := 15.0000;
    WHEN 'pro-yearly' THEN
      monthly_limit := 15000000;
      sessions_limit := -1;
      web_searches_limit := -1;
      cost_limit := 40.0000;
    WHEN 'enterprise' THEN
      monthly_limit := 15000000;
      sessions_limit := -1;
      web_searches_limit := -1;
      cost_limit := -1;
    ELSE
      monthly_limit := 500000;
      sessions_limit := 3;
      web_searches_limit := 10;
      cost_limit := 1.0000;
  END CASE;

  next_reset_date := (date_trunc('month', NOW() AT TIME ZONE 'UTC') + interval '1 month') AT TIME ZONE 'UTC';

  INSERT INTO usage_quotas (
    user_id, plan_id,
    monthly_tokens_used, monthly_tokens_limit,
    sessions_this_month, sessions_limit,
    web_searches_used, web_searches_limit,
    monthly_cost_used, monthly_cost_limit,
    reset_date
  ) VALUES (
    p_user_id, p_plan_id,
    0, monthly_limit,
    0, sessions_limit,
    0, web_searches_limit,
    0.0000, cost_limit,
    next_reset_date
  )
  ON CONFLICT (user_id, reset_date)
  DO UPDATE SET
    plan_id = EXCLUDED.plan_id,
    monthly_tokens_limit = EXCLUDED.monthly_tokens_limit,
    sessions_limit = EXCLUDED.sessions_limit,
    web_searches_limit = EXCLUDED.web_searches_limit,
    monthly_cost_limit = EXCLUDED.monthly_cost_limit,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
