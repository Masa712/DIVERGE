-- Create user_subscriptions table
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL,
  stripe_subscription_id TEXT UNIQUE NOT NULL,
  stripe_customer_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'canceled', 'past_due', 'unpaid', 'trialing')),
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create usage_quotas table
CREATE TABLE IF NOT EXISTS usage_quotas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL,
  monthly_tokens_used INTEGER DEFAULT 0,
  monthly_tokens_limit INTEGER NOT NULL,
  sessions_this_month INTEGER DEFAULT 0,
  sessions_limit INTEGER NOT NULL, -- -1 for unlimited
  reset_date TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, reset_date)
);

-- Add subscription fields to user_profiles table
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
ADD COLUMN IF NOT EXISTS subscription_status TEXT,
ADD COLUMN IF NOT EXISTS subscription_plan TEXT DEFAULT 'free';

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_stripe_subscription_id ON user_subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_usage_quotas_user_id ON usage_quotas(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_quotas_reset_date ON usage_quotas(reset_date);

-- Create RLS policies
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_quotas ENABLE ROW LEVEL SECURITY;

-- Users can only see their own subscription data
CREATE POLICY "Users can view own subscriptions" ON user_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own usage quotas" ON usage_quotas
  FOR SELECT USING (auth.uid() = user_id);

-- Service role can manage all subscription data
CREATE POLICY "Service role can manage subscriptions" ON user_subscriptions
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage usage quotas" ON usage_quotas
  FOR ALL USING (auth.role() = 'service_role');

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers to automatically update updated_at
CREATE TRIGGER update_user_subscriptions_updated_at 
  BEFORE UPDATE ON user_subscriptions 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_usage_quotas_updated_at 
  BEFORE UPDATE ON usage_quotas 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to initialize usage quota for new users
CREATE OR REPLACE FUNCTION initialize_user_quota(user_id UUID, plan_id TEXT DEFAULT 'free')
RETURNS VOID AS $$
DECLARE
  monthly_limit INTEGER;
  sessions_limit INTEGER;
  next_reset_date TIMESTAMPTZ;
BEGIN
  -- Set limits based on plan
  CASE plan_id
    WHEN 'free' THEN
      monthly_limit := 10000;
      sessions_limit := 5;
    WHEN 'pro' THEN
      monthly_limit := 100000;
      sessions_limit := -1; -- unlimited
    WHEN 'enterprise' THEN
      monthly_limit := -1; -- unlimited
      sessions_limit := -1; -- unlimited
    ELSE
      monthly_limit := 10000; -- default to free plan limits
      sessions_limit := 5;
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
    reset_date
  ) VALUES (
    user_id,
    plan_id,
    0,
    monthly_limit,
    0,
    sessions_limit,
    next_reset_date
  )
  ON CONFLICT (user_id, reset_date) 
  DO UPDATE SET
    plan_id = EXCLUDED.plan_id,
    monthly_tokens_limit = EXCLUDED.monthly_tokens_limit,
    sessions_limit = EXCLUDED.sessions_limit,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update token usage
CREATE OR REPLACE FUNCTION update_token_usage(user_id UUID, tokens_used INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
  current_usage INTEGER;
  current_limit INTEGER;
  next_reset_date TIMESTAMPTZ;
BEGIN
  -- Calculate next month's reset date
  next_reset_date := date_trunc('month', NOW()) + interval '1 month';
  
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