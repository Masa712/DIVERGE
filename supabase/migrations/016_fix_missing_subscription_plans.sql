-- Fix missing subscription_plan values in user_profiles
-- This ensures all users have a subscription_plan set

-- Update all user_profiles with NULL or missing subscription_plan to 'free'
UPDATE user_profiles
SET subscription_plan = 'free',
    updated_at = NOW()
WHERE subscription_plan IS NULL;

-- Sync subscription_plan from usage_quotas for all users
UPDATE user_profiles up
SET subscription_plan = uq.plan_id,
    updated_at = NOW()
FROM usage_quotas uq
WHERE up.user_id = uq.user_id
  AND uq.reset_date >= date_trunc('month', NOW()) + interval '1 month'
  AND (up.subscription_plan IS NULL OR up.subscription_plan != uq.plan_id);
