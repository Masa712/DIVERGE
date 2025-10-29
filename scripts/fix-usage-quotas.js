/**
 * Fix usage_quotas for users with active subscriptions
 * This script syncs usage_quotas.plan_id with user_subscriptions.plan_id
 */

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
)

/**
 * Get plan limits based on plan ID
 */
function getPlanLimits(planId) {
  const plans = {
    free: {
      monthly_tokens_limit: 500000,
      sessions_limit: -1,
      web_searches_limit: 10,
    },
    plus: {
      monthly_tokens_limit: 4000000,
      sessions_limit: -1,
      web_searches_limit: 200,
    },
    'plus-yearly': {
      monthly_tokens_limit: 4000000,
      sessions_limit: -1,
      web_searches_limit: 200,
    },
    pro: {
      monthly_tokens_limit: 15000000,
      sessions_limit: -1,
      web_searches_limit: -1,
    },
    'pro-yearly': {
      monthly_tokens_limit: 15000000,
      sessions_limit: -1,
      web_searches_limit: -1,
    },
  }

  return plans[planId] || plans.free
}

async function fixUsageQuotas() {
  const userId = process.argv[2]

  if (!userId) {
    console.error('❌ Usage: node scripts/fix-usage-quotas.js <user_id>')
    process.exit(1)
  }

  console.log(`🔧 Fixing usage_quotas for user: ${userId}\n`)

  try {
    // Get active subscription
    const { data: subscription, error: subError } = await supabaseAdmin
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle()

    if (subError) {
      console.error('❌ Error fetching subscription:', subError)
      process.exit(1)
    }

    if (!subscription) {
      console.log('⚠️  No active subscription found for this user')
      process.exit(0)
    }

    console.log('📋 Active subscription found:')
    console.log(`   Plan ID: ${subscription.plan_id}`)
    console.log(`   Status: ${subscription.status}`)
    console.log(`   Period: ${subscription.current_period_start} to ${subscription.current_period_end}\n`)

    // Calculate next month's reset date in UTC
    const now = new Date()
    const nextMonth = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth() + 1,
      1,
      0, 0, 0, 0
    ))

    console.log(`📅 Reset date: ${nextMonth.toISOString()}\n`)

    // Get current usage_quotas
    const { data: currentQuota, error: quotaError } = await supabaseAdmin
      .from('usage_quotas')
      .select('*')
      .eq('user_id', userId)
      .eq('reset_date', nextMonth.toISOString())
      .maybeSingle()

    if (quotaError && quotaError.code !== 'PGRST116') {
      console.error('❌ Error fetching usage quota:', quotaError)
      process.exit(1)
    }

    const limits = getPlanLimits(subscription.plan_id)

    if (currentQuota) {
      console.log('📊 Current usage_quotas:')
      console.log(`   Plan ID: ${currentQuota.plan_id} (should be: ${subscription.plan_id})`)
      console.log(`   Token limit: ${currentQuota.monthly_tokens_limit} (should be: ${limits.monthly_tokens_limit})`)
      console.log(`   Web search limit: ${currentQuota.web_searches_limit} (should be: ${limits.web_searches_limit})`)
      console.log(`   Tokens used: ${currentQuota.monthly_tokens_used}`)
      console.log(`   Web searches used: ${currentQuota.web_searches_used}\n`)

      // Update existing quota
      console.log('🔄 Updating usage_quotas...')
      const { error: updateError } = await supabaseAdmin
        .from('usage_quotas')
        .update({
          plan_id: subscription.plan_id,
          monthly_tokens_limit: limits.monthly_tokens_limit,
          sessions_limit: limits.sessions_limit,
          web_searches_limit: limits.web_searches_limit,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .eq('reset_date', nextMonth.toISOString())

      if (updateError) {
        console.error('❌ Failed to update usage quota:', updateError)
        process.exit(1)
      }

      console.log('✅ Usage quota updated successfully!')
    } else {
      console.log('⚠️  No usage_quotas record found, creating new one...')

      // Create new quota record
      const { error: insertError } = await supabaseAdmin
        .from('usage_quotas')
        .insert({
          user_id: userId,
          plan_id: subscription.plan_id,
          monthly_tokens_used: 0,
          monthly_tokens_limit: limits.monthly_tokens_limit,
          sessions_this_month: 0,
          sessions_limit: limits.sessions_limit,
          web_searches_used: 0,
          web_searches_limit: limits.web_searches_limit,
          reset_date: nextMonth.toISOString(),
        })

      if (insertError) {
        console.error('❌ Failed to create usage quota:', insertError)
        process.exit(1)
      }

      console.log('✅ Usage quota created successfully!')
    }

    // Verify the fix
    console.log('\n🔍 Verifying fix...')
    const { data: updatedQuota } = await supabaseAdmin
      .from('usage_quotas')
      .select('*')
      .eq('user_id', userId)
      .eq('reset_date', nextMonth.toISOString())
      .maybeSingle()

    if (updatedQuota) {
      console.log('✅ Verified:')
      console.log(`   Plan ID: ${updatedQuota.plan_id}`)
      console.log(`   Token limit: ${updatedQuota.monthly_tokens_limit}`)
      console.log(`   Web search limit: ${updatedQuota.web_searches_limit}`)
      console.log(`   Tokens used: ${updatedQuota.monthly_tokens_used}`)
      console.log(`   Web searches used: ${updatedQuota.web_searches_used}`)
    }

    console.log('\n✅ Done! Please refresh the settings page to see the changes.')
  } catch (error) {
    console.error('❌ Unexpected error:', error)
    process.exit(1)
  }
}

fixUsageQuotas()
