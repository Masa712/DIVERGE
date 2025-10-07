-- Update initialize_user_quota function to support new 3-tier plan system
-- Free: 500K tokens, 3 sessions, 10 web searches
-- Plus: 4M tokens, unlimited sessions, 200 web searches
-- Pro: 15M tokens, unlimited sessions, unlimited web searches

-- Drop existing function first to allow parameter name changes
DROP FUNCTION IF EXISTS initialize_user_quota(UUID, TEXT);

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
      monthly_limit := 500000; -- 500K tokens
      sessions_limit := 3;
      web_searches_limit := 10;
    WHEN 'plus', 'plus-monthly' THEN
      monthly_limit := 4000000; -- 4M tokens
      sessions_limit := -1; -- unlimited
      web_searches_limit := 200;
    WHEN 'plus-yearly' THEN
      monthly_limit := 4000000; -- 4M tokens
      sessions_limit := -1; -- unlimited
      web_searches_limit := 200;
    WHEN 'pro', 'pro-monthly' THEN
      monthly_limit := 15000000; -- 15M tokens
      sessions_limit := -1; -- unlimited
      web_searches_limit := -1; -- unlimited
    WHEN 'pro-yearly' THEN
      monthly_limit := 15000000; -- 15M tokens
      sessions_limit := -1; -- unlimited
      web_searches_limit := -1; -- unlimited
    WHEN 'enterprise', 'enterprise-monthly', 'enterprise-yearly' THEN
      monthly_limit := -1; -- unlimited
      sessions_limit := -1; -- unlimited
      web_searches_limit := -1; -- unlimited
    ELSE
      -- Default to free plan limits
      monthly_limit := 500000;
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

  -- Also update user_profiles subscription_plan to keep them in sync
  UPDATE user_profiles
  SET subscription_plan = p_plan_id,
      updated_at = NOW()
  WHERE user_profiles.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reset all existing free plan users to correct limits
UPDATE usage_quotas
SET
  monthly_tokens_limit = 500000,
  sessions_limit = 3,
  web_searches_limit = 10,
  updated_at = NOW()
WHERE plan_id = 'free';

-- Ensure all existing users have a quota record
-- This will create quota records for any users who don't have one yet
DO $$
DECLARE
  user_record RECORD;
BEGIN
  FOR user_record IN SELECT id FROM auth.users LOOP
    PERFORM initialize_user_quota(user_record.id, 'free');
  END LOOP;
END $$;
