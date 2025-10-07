-- Add web search tracking columns to usage_quotas table
ALTER TABLE usage_quotas
ADD COLUMN IF NOT EXISTS web_searches_used INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS web_searches_limit INTEGER DEFAULT 10;

-- Update existing records with default web search limits based on plan
UPDATE usage_quotas
SET web_searches_limit = CASE
  WHEN plan_id = 'free' THEN 10
  WHEN plan_id = 'plus' THEN 200
  WHEN plan_id = 'pro' THEN -1 -- unlimited
  ELSE 10 -- default to free plan
END
WHERE web_searches_limit = 10; -- Only update if still default value

-- Update initialize_user_quota function to include web search limits
CREATE OR REPLACE FUNCTION initialize_user_quota(user_id UUID, plan_id TEXT DEFAULT 'free')
RETURNS VOID AS $$
DECLARE
  monthly_limit INTEGER;
  sessions_limit INTEGER;
  web_searches_limit INTEGER;
  next_reset_date TIMESTAMPTZ;
BEGIN
  -- Set limits based on plan
  CASE plan_id
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
    user_id,
    plan_id,
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

-- Function to check if user can perform web search
CREATE OR REPLACE FUNCTION can_use_web_search(user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  searches_used INTEGER;
  searches_limit INTEGER;
  next_reset_date TIMESTAMPTZ;
BEGIN
  -- Calculate next month's reset date
  next_reset_date := date_trunc('month', NOW()) + interval '1 month';

  -- Get current usage and limit
  SELECT web_searches_used, web_searches_limit
  INTO searches_used, searches_limit
  FROM usage_quotas
  WHERE usage_quotas.user_id = can_use_web_search.user_id
    AND reset_date = next_reset_date;

  -- If no quota record exists, initialize with free plan
  IF NOT FOUND THEN
    PERFORM initialize_user_quota(user_id, 'free');
    SELECT web_searches_used, web_searches_limit
    INTO searches_used, searches_limit
    FROM usage_quotas
    WHERE usage_quotas.user_id = can_use_web_search.user_id
      AND reset_date = next_reset_date;
  END IF;

  -- Check if user has reached limit (-1 means unlimited)
  IF searches_limit = -1 THEN
    RETURN TRUE; -- Unlimited
  END IF;

  IF searches_used >= searches_limit THEN
    RETURN FALSE; -- Limit reached
  END IF;

  RETURN TRUE; -- Can use web search
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment web search usage
CREATE OR REPLACE FUNCTION increment_web_search_usage(user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  searches_used INTEGER;
  searches_limit INTEGER;
  next_reset_date TIMESTAMPTZ;
BEGIN
  -- Calculate next month's reset date
  next_reset_date := date_trunc('month', NOW()) + interval '1 month';

  -- Get current usage and limit
  SELECT web_searches_used, web_searches_limit
  INTO searches_used, searches_limit
  FROM usage_quotas
  WHERE usage_quotas.user_id = increment_web_search_usage.user_id
    AND reset_date = next_reset_date;

  -- If no quota record exists, initialize with free plan
  IF NOT FOUND THEN
    PERFORM initialize_user_quota(user_id, 'free');
    SELECT web_searches_used, web_searches_limit
    INTO searches_used, searches_limit
    FROM usage_quotas
    WHERE usage_quotas.user_id = increment_web_search_usage.user_id
      AND reset_date = next_reset_date;
  END IF;

  -- Check if user has reached limit (-1 means unlimited)
  IF searches_limit != -1 AND searches_used >= searches_limit THEN
    RETURN FALSE; -- Limit reached, cannot increment
  END IF;

  -- Increment usage
  UPDATE usage_quotas
  SET web_searches_used = web_searches_used + 1,
      updated_at = NOW()
  WHERE usage_quotas.user_id = increment_web_search_usage.user_id
    AND reset_date = next_reset_date;

  RETURN TRUE; -- Usage incremented successfully
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_usage_quotas_web_searches ON usage_quotas(user_id, web_searches_used, web_searches_limit);