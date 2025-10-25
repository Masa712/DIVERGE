-- Make session quotas unlimited for all plans
-- 1. Drop and recreate initialize_user_quota so sessions_limit is always -1
-- 2. Ensure existing usage_quotas records reflect the new unlimited policy

DROP FUNCTION IF EXISTS initialize_user_quota(UUID, TEXT);
DROP FUNCTION IF EXISTS initialize_user_quota(UUID);

CREATE OR REPLACE FUNCTION initialize_user_quota(p_user_id UUID, p_plan_id TEXT DEFAULT 'free')
RETURNS VOID AS $$
DECLARE
  monthly_limit INTEGER;
  sessions_limit INTEGER;
  web_searches_limit INTEGER;
  next_reset_date TIMESTAMPTZ;
BEGIN
  -- Set limits based on plan
  CASE p_plan_id
    WHEN 'free' THEN
      monthly_limit := 500000;
      sessions_limit := -1; -- unlimited sessions
      web_searches_limit := 10;
    WHEN 'plus', 'plus-monthly', 'plus-yearly' THEN
      monthly_limit := 4000000;
      sessions_limit := -1;
      web_searches_limit := 200;
    WHEN 'pro', 'pro-monthly', 'pro-yearly' THEN
      monthly_limit := 15000000;
      sessions_limit := -1;
      web_searches_limit := -1;
    WHEN 'enterprise', 'enterprise-monthly', 'enterprise-yearly' THEN
      monthly_limit := -1;
      sessions_limit := -1;
      web_searches_limit := -1;
    ELSE
      -- Default to free plan limits
      monthly_limit := 500000;
      sessions_limit := -1;
      web_searches_limit := 10;
  END CASE;

  -- Calculate next month's reset date at UTC midnight
  next_reset_date := (date_trunc('month', NOW() AT TIME ZONE 'UTC') + interval '1 month') AT TIME ZONE 'UTC';

  -- Insert or update usage quota
  INSERT INTO usage_quotas (
    user_id,
    plan_id,
    monthly_tokens_used,
    monthly_tokens_limit,
    sessions_this_month,
    sessions_limit,
    web_searches_used,
    web_searches_limit,
    reset_date
  ) VALUES (
    p_user_id,
    p_plan_id,
    0,
    monthly_limit,
    0,
    sessions_limit,
    0,
    web_searches_limit,
    next_reset_date
  )
  ON CONFLICT (user_id, reset_date)
  DO UPDATE SET
    plan_id = EXCLUDED.plan_id,
    monthly_tokens_limit = EXCLUDED.monthly_tokens_limit,
    sessions_limit = EXCLUDED.sessions_limit,
    web_searches_limit = EXCLUDED.web_searches_limit,
    updated_at = NOW();

  -- Keep user profile in sync with plan selection
  UPDATE user_profiles
  SET subscription_plan = p_plan_id,
      updated_at = NOW()
  WHERE user_profiles.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply unlimited sessions to existing quota records
UPDATE usage_quotas
SET sessions_limit = -1,
    updated_at = NOW()
WHERE sessions_limit IS DISTINCT FROM -1;
