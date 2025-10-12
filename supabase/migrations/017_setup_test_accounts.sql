-- Setup Plus and Pro Test Accounts
-- Execute this SQL in Supabase SQL Editor

-- ==========================================
-- Plus Plan: seeks.and.noise@gmail.com
-- ==========================================

-- Update user_profiles to Plus plan
UPDATE user_profiles
SET subscription_plan = 'plus',
    updated_at = NOW()
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'seeks.and.noise@gmail.com'
);

-- Update usage_quotas for Plus plan
UPDATE usage_quotas
SET plan_id = 'plus',
    monthly_tokens_limit = 4000000,      -- 4M tokens
    sessions_limit = -1,                  -- Unlimited
    web_searches_limit = 200,             -- 200 searches/month
    monthly_tokens_used = 0,              -- Reset usage
    sessions_this_month = 0,
    web_searches_used = 0,
    reset_date = date_trunc('month', NOW()) + interval '1 month'
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'seeks.and.noise@gmail.com'
);

-- ==========================================
-- Pro Plan: masayuki.va@gmail.com
-- ==========================================

-- Update user_profiles to Pro plan
UPDATE user_profiles
SET subscription_plan = 'pro',
    updated_at = NOW()
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'masayuki.va@gmail.com'
);

-- Update usage_quotas for Pro plan
UPDATE usage_quotas
SET plan_id = 'pro',
    monthly_tokens_limit = 15000000,     -- 15M tokens
    sessions_limit = -1,                  -- Unlimited
    web_searches_limit = -1,              -- Unlimited
    monthly_tokens_used = 0,              -- Reset usage
    sessions_this_month = 0,
    web_searches_used = 0,
    reset_date = date_trunc('month', NOW()) + interval '1 month'
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'masayuki.va@gmail.com'
);

-- ==========================================
-- Verification Query
-- ==========================================

-- Run this to verify the changes
SELECT
  u.email,
  up.subscription_plan,
  uq.plan_id,
  uq.monthly_tokens_limit,
  uq.sessions_limit,
  uq.web_searches_limit
FROM auth.users u
JOIN user_profiles up ON u.id = up.user_id
JOIN usage_quotas uq ON u.id = uq.user_id
WHERE u.email IN ('seeks.and.noise@gmail.com', 'masayuki.va@gmail.com')
ORDER BY u.email;
