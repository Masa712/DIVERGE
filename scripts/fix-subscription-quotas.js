/**
 * Fix usage_quotas for users with active subscriptions
 * Run with: node scripts/fix-subscription-quotas.js
 */

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

// Plan limits based on subscription.ts
const PLAN_LIMITS = {
  free: {
    monthly_tokens_limit: 500000,
    sessions_limit: 3,
    web_searches_limit: 10
  },
  plus: {
    monthly_tokens_limit: 4000000,
    sessions_limit: -1, // unlimited
    web_searches_limit: 200
  },
  'plus-yearly': {
    monthly_tokens_limit: 4000000,
    sessions_limit: -1, // unlimited
    web_searches_limit: 200
  },
  pro: {
    monthly_tokens_limit: 15000000,
    sessions_limit: -1, // unlimited
    web_searches_limit: -1 // unlimited
  },
  'pro-yearly': {
    monthly_tokens_limit: 15000000,
    sessions_limit: -1, // unlimited
    web_searches_limit: -1 // unlimited
  }
}

async function fixSubscriptionQuotas() {
  console.log('🔧 Fixing usage_quotas for subscribed users...\n')

  try {
    // 1. Get all active subscriptions
    const { data: subscriptions, error: subError } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('status', 'active')

    if (subError) {
      console.error('❌ Error fetching subscriptions:', subError)
      return
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log('ℹ️  No active subscriptions found.')
      return
    }

    console.log(`✅ Found ${subscriptions.length} active subscription(s)\n`)

    // Calculate next month's reset date
    const nextMonth = new Date()
    nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1)
    nextMonth.setUTCDate(1)
    nextMonth.setUTCHours(0, 0, 0, 0)

    // 2. Process each subscription
    for (const sub of subscriptions) {
      console.log(`📝 Processing user: ${sub.user_id}`)
      console.log(`   Subscription plan: ${sub.plan_id}`)

      // Get user email for logging
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('email')
        .eq('user_id', sub.user_id)
        .single()

      console.log(`   Email: ${profile?.email || 'unknown'}`)

      // Get current usage quota
      const { data: currentQuota, error: quotaError } = await supabase
        .from('usage_quotas')
        .select('*')
        .eq('user_id', sub.user_id)
        .eq('reset_date', nextMonth.toISOString())
        .maybeSingle()

      if (quotaError) {
        console.error(`   ❌ Error fetching quota:`, quotaError)
        continue
      }

      if (!currentQuota) {
        console.log('   ⚠️  No quota record found, creating new one...')

        const limits = PLAN_LIMITS[sub.plan_id] || PLAN_LIMITS.free

        const { error: insertError } = await supabase
          .from('usage_quotas')
          .insert({
            user_id: sub.user_id,
            plan_id: sub.plan_id,
            monthly_tokens_used: 0,
            monthly_tokens_limit: limits.monthly_tokens_limit,
            sessions_this_month: 0,
            sessions_limit: limits.sessions_limit,
            web_searches_used: 0,
            web_searches_limit: limits.web_searches_limit,
            reset_date: nextMonth.toISOString()
          })

        if (insertError) {
          console.error(`   ❌ Error creating quota:`, insertError)
        } else {
          console.log(`   ✅ Created new quota with plan: ${sub.plan_id}`)
        }
        continue
      }

      console.log(`   Current quota plan: ${currentQuota.plan_id}`)

      // Check if quota needs updating
      if (currentQuota.plan_id === sub.plan_id) {
        console.log(`   ✅ Quota already correct, skipping.\n`)
        continue
      }

      console.log(`   ⚠️  MISMATCH DETECTED: ${currentQuota.plan_id} → ${sub.plan_id}`)

      // Get new limits
      const newLimits = PLAN_LIMITS[sub.plan_id] || PLAN_LIMITS.free

      // Update quota
      const { error: updateError } = await supabase
        .from('usage_quotas')
        .update({
          plan_id: sub.plan_id,
          monthly_tokens_limit: newLimits.monthly_tokens_limit,
          sessions_limit: newLimits.sessions_limit,
          web_searches_limit: newLimits.web_searches_limit,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', sub.user_id)
        .eq('reset_date', nextMonth.toISOString())

      if (updateError) {
        console.error(`   ❌ Error updating quota:`, updateError)
      } else {
        console.log(`   ✅ Updated quota to plan: ${sub.plan_id}`)
        console.log(`      - Tokens: ${currentQuota.monthly_tokens_limit.toLocaleString()} → ${newLimits.monthly_tokens_limit.toLocaleString()}`)
        console.log(`      - Sessions: ${currentQuota.sessions_limit} → ${newLimits.sessions_limit}`)
        console.log(`      - Web Searches: ${currentQuota.web_searches_limit} → ${newLimits.web_searches_limit}`)
      }

      console.log('')
    }

    console.log('✅ Fix complete!')
    console.log('\n📊 Summary:')
    console.log(`   - Processed ${subscriptions.length} subscription(s)`)
    console.log(`   - Reset date: ${nextMonth.toISOString()}`)

  } catch (error) {
    console.error('❌ Unexpected error:', error)
  }
}

fixSubscriptionQuotas()
  .then(() => {
    console.log('\n✅ Script completed successfully')
    process.exit(0)
  })
  .catch(error => {
    console.error('\n❌ Fatal error:', error)
    process.exit(1)
  })
