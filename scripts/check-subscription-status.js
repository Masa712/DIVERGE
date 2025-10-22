/**
 * Check subscription status for a specific user
 */

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

async function checkAccount() {
  const email = process.argv[2]

  if (!email) {
    console.log('❌ Usage: node scripts/check-subscription-status.js <email>')
    process.exit(1)
  }

  console.log(`🔍 Checking subscription status for: ${email}\n`)

  try {
    // Get user from auth
    const { data: { users }, error: authError } = await supabase.auth.admin.listUsers()

    if (authError) {
      console.error('❌ Auth error:', authError)
      return
    }

    const user = users.find(u => u.email === email)

    if (!user) {
      console.log('⚠️  User not found in auth system')
      return
    }

    console.log('✅ User found')
    console.log(`   User ID: ${user.id}\n`)

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    if (profileError && profileError.code !== 'PGRST116') {
      console.error('❌ Profile error:', profileError)
    } else if (profile) {
      console.log('📝 User Profile:')
      console.log(`   Display name: ${profile.display_name || 'Not set'}`)
      console.log(`   Subscription plan: ${profile.subscription_plan || 'free'}`)
      console.log(`   Subscription status: ${profile.subscription_status || 'N/A'}`)
      console.log(`   Stripe customer ID: ${profile.stripe_customer_id || 'Not set'}\n`)
    } else {
      console.log('⚠️  No profile found\n')
    }

    // Get ALL subscriptions (not just active)
    const { data: subscriptions, error: subError } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (subError && subError.code !== 'PGRST116') {
      console.error('❌ Subscription error:', subError)
    } else if (subscriptions && subscriptions.length > 0) {
      console.log(`💳 Subscriptions (${subscriptions.length} found):`)
      subscriptions.forEach((sub, index) => {
        console.log(`\n   [${index + 1}] ${sub.status.toUpperCase()}`)
        console.log(`       Plan: ${sub.plan_id}`)
        console.log(`       Stripe subscription ID: ${sub.stripe_subscription_id}`)
        console.log(`       Stripe customer ID: ${sub.stripe_customer_id}`)
        console.log(`       Current period: ${new Date(sub.current_period_start).toLocaleDateString()} - ${new Date(sub.current_period_end).toLocaleDateString()}`)
        console.log(`       Cancel at period end: ${sub.cancel_at_period_end}`)
        console.log(`       Created: ${new Date(sub.created_at).toLocaleString()}`)
        console.log(`       Updated: ${new Date(sub.updated_at).toLocaleString()}`)
      })
      console.log()
    } else {
      console.log('📭 No subscriptions found in database\n')
    }

    // Get usage quota
    const nextMonth = new Date()
    nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1)
    nextMonth.setUTCDate(1)
    nextMonth.setUTCHours(0, 0, 0, 0)

    const { data: usage, error: usageError } = await supabase
      .from('usage_quotas')
      .select('*')
      .eq('user_id', user.id)
      .eq('reset_date', nextMonth.toISOString())
      .maybeSingle()

    if (usageError && usageError.code !== 'PGRST116') {
      console.error('❌ Usage error:', usageError)
    } else if (usage) {
      console.log('📊 Current Usage Quota:')
      console.log(`   Plan: ${usage.plan_id}`)
      console.log(`   Tokens: ${usage.monthly_tokens_used || 0} / ${usage.monthly_tokens_limit === -1 ? 'Unlimited' : usage.monthly_tokens_limit.toLocaleString()}`)
      console.log(`   Sessions: ${usage.sessions_this_month || 0} / ${usage.sessions_limit === -1 ? 'Unlimited' : usage.sessions_limit}`)
      console.log(`   Web searches: ${usage.web_searches_used || 0} / ${usage.web_searches_limit === -1 ? 'Unlimited' : usage.web_searches_limit}`)
      console.log(`   Reset date: ${new Date(usage.reset_date).toLocaleDateString()}`)
    } else {
      console.log('⚠️  No usage quota found for current period')
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error)
  }
}

checkAccount()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Fatal error:', error)
    process.exit(1)
  })
