-- Fix timezone issues in database functions
-- All calculations should use UTC to match application code

-- Update initialize_user_quota function to use UTC
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
    -- Support legacy and yearly plan IDs
    WHEN 'plus-yearly' THEN
      monthly_limit := 4000000;
      sessions_limit := -1;
      web_searches_limit := 200;
    WHEN 'pro-yearly' THEN
      monthly_limit := 15000000;
      sessions_limit := -1;
      web_searches_limit := -1;
    WHEN 'enterprise' THEN
      monthly_limit := 15000000;
      sessions_limit := -1;
      web_searches_limit := -1;
    ELSE
      monthly_limit := 500000; -- default to free plan limits
      sessions_limit := 3;
      web_searches_limit := 10;
  END CASE;

  -- Calculate next month's reset date at UTC midnight
  -- Use AT TIME ZONE 'UTC' to ensure UTC calculation
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
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update other functions to use UTC as well
-- update_token_usage function
CREATE OR REPLACE FUNCTION update_token_usage(user_id UUID, tokens_used INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
  current_usage INTEGER;
  current_limit INTEGER;
  next_reset_date TIMESTAMPTZ;
BEGIN
  -- Calculate next month's reset date at UTC midnight
  next_reset_date := (date_trunc('month', NOW() AT TIME ZONE 'UTC') + interval '1 month') AT TIME ZONE 'UTC';

  -- Get current usage and limit
  SELECT monthly_tokens_used, monthly_tokens_limit
  INTO current_usage, current_limit
  FROM usage_quotas
  WHERE usage_quotas.user_id = update_token_usage.user_id
    AND reset_date = next_reset_date;

  -- If no quota record exists, initialize with free plan
  IF NOT FOUND THEN
    PERFORM initialize_user_quota(user_id, 'free');
    SELECT monthly_tokens_used, monthly_tokens_limit
    INTO current_usage, current_limit
    FROM usage_quotas
    WHERE usage_quotas.user_id = update_token_usage.user_id
      AND reset_date = next_reset_date;
  END IF;

  -- Check if adding tokens would exceed limit (-1 means unlimited)
  IF current_limit != -1 AND (current_usage + tokens_used) > current_limit THEN
    RETURN FALSE; -- Usage would exceed limit
  END IF;

  -- Update usage
  UPDATE usage_quotas
  SET monthly_tokens_used = monthly_tokens_used + tokens_used,
      updated_at = NOW()
  WHERE usage_quotas.user_id = update_token_usage.user_id
    AND reset_date = next_reset_date;

  RETURN TRUE; -- Usage updated successfully
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- can_use_web_search function
CREATE OR REPLACE FUNCTION can_use_web_search(user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  searches_used INTEGER;
  searches_limit INTEGER;
  next_reset_date TIMESTAMPTZ;
BEGIN
  -- Calculate next month's reset date at UTC midnight
  next_reset_date := (date_trunc('month', NOW() AT TIME ZONE 'UTC') + interval '1 month') AT TIME ZONE 'UTC';

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

-- increment_web_search_usage function
CREATE OR REPLACE FUNCTION increment_web_search_usage(user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  searches_used INTEGER;
  searches_limit INTEGER;
  next_reset_date TIMESTAMPTZ;
BEGIN
  -- Calculate next month's reset date at UTC midnight
  next_reset_date := (date_trunc('month', NOW() AT TIME ZONE 'UTC') + interval '1 month') AT TIME ZONE 'UTC';

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
