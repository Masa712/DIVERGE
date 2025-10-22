/**
 * Test profile API response for divergeai.info@gmail.com
 */

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

async function testProfileAPI() {
  console.log('🧪 Testing profile API logic for divergeai.info@gmail.com\n')

  const userId = '84e667f6-59c3-4af9-a10a-00a92e98a5bf' // divergeai.info@gmail.com

  try {
    // 1. Get user profile
    console.log('1️⃣ Fetching user profile...')
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (profileError) {
      console.error('❌ Profile error:', profileError)
      return
    }

    console.log('✅ Profile data:')
    console.log('   subscription_plan:', profile.subscription_plan)
    console.log('')

    // 2. Check for active subscription
    console.log('2️⃣ Checking active subscription...')
    const { data: subscription, error: subError } = await supabase
      .from('user_subscriptions')
      .select('plan_id, status')
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle()

    if (subError) {
      console.error('❌ Subscription error:', subError)
    } else if (subscription) {
      console.log('✅ Active subscription found:')
      console.log('   plan_id:', subscription.plan_id)
      console.log('   status:', subscription.status)
    } else {
      console.log('⚠️  No active subscription found')
    }
    console.log('')

    // 3. Determine final subscription plan (mimicking API logic)
    console.log('3️⃣ Determining final subscription plan...')
    const finalPlan = subscription?.plan_id || profile.subscription_plan || 'free'
    console.log('✅ Final plan:', finalPlan)
    console.log('')

    // 4. Check usage quota
    console.log('4️⃣ Checking usage quota...')
    const nextMonth = new Date()
    nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1)
    nextMonth.setUTCDate(1)
    nextMonth.setUTCHours(0, 0, 0, 0)

    const { data: quota, error: quotaError } = await supabase
      .from('usage_quotas')
      .select('*')
      .eq('user_id', userId)
      .eq('reset_date', nextMonth.toISOString())
      .maybeSingle()

    if (quotaError) {
      console.error('❌ Quota error:', quotaError)
    } else if (quota) {
      console.log('✅ Usage quota:')
      console.log('   plan_id:', quota.plan_id)
      console.log('   tokens:', quota.monthly_tokens_used, '/', quota.monthly_tokens_limit)
      console.log('   sessions:', quota.sessions_this_month, '/', quota.sessions_limit)
      console.log('   web_searches:', quota.web_searches_used, '/', quota.web_searches_limit)
    } else {
      console.log('⚠️  No usage quota found for current period')
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error)
  }
}

testProfileAPI()
  .then(() => {
    console.log('\n✅ Test complete')
    process.exit(0)
  })
  .catch(error => {
    console.error('\n❌ Fatal error:', error)
    process.exit(1)
  })
