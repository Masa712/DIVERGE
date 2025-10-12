-- Fix initialize_user_quota function parameter recognition
-- This migration drops and recreates the function to ensure proper parameter binding

-- Drop the existing function
DROP FUNCTION IF EXISTS initialize_user_quota(UUID, TEXT);

-- Recreate the function with explicit parameter names
CREATE OR REPLACE FUNCTION initialize_user_quota(
  p_user_id UUID,
  p_plan_id TEXT DEFAULT 'free'
)
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
      sessions_limit := 3;
      web_searches_limit := 10;
    WHEN 'plus' THEN
      monthly_limit := 4000000;
      sessions_limit := -1; -- unlimited
      web_searches_limit := 200;
    WHEN 'pro' THEN
      monthly_limit := 15000000;
      sessions_limit := -1; -- unlimited
      web_searches_limit := -1; -- unlimited
    -- Support legacy plan IDs
    WHEN 'enterprise' THEN
      monthly_limit := 15000000;
      sessions_limit := -1;
      web_searches_limit := -1;
    ELSE
      monthly_limit := 500000; -- default to free plan limits
      sessions_limit := 3;
      web_searches_limit := 10;
  END CASE;

  -- Calculate next month's reset date
  next_reset_date := date_trunc('month', NOW()) + interval '1 month';

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
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verification: Call the function for testing (optional)
-- SELECT initialize_user_quota('00000000-0000-0000-0000-000000000000'::UUID, 'free');
