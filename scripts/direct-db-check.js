/**
 * Direct database check for usage_quotas
 */

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

async function checkDatabase() {
  const userId = '84e667f6-59c3-4af9-a10a-00a92e98a5bf'

  console.log('🔍 Direct database check for user:', userId)
  console.log('')

  // Calculate reset dates
  const nextMonth = new Date()
  nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1)
  nextMonth.setUTCDate(1)
  nextMonth.setUTCHours(0, 0, 0, 0)

  console.log('Expected reset_date:', nextMonth.toISOString())
  console.log('')

  // Check ALL usage_quotas for this user
  const { data: allQuotas, error } = await supabase
    .from('usage_quotas')
    .select('*')
    .eq('user_id', userId)
    .order('reset_date', { ascending: false })

  if (error) {
    console.error('❌ Error:', error)
    return
  }

  console.log(`Found ${allQuotas.length} quota record(s):`)
  console.log('')

  allQuotas.forEach((quota, index) => {
    console.log(`Record ${index + 1}:`)
    console.log('  user_id:', quota.user_id)
    console.log('  plan_id:', quota.plan_id)
    console.log('  reset_date:', quota.reset_date)
    console.log('  monthly_tokens_limit:', quota.monthly_tokens_limit)
    console.log('  sessions_limit:', quota.sessions_limit)
    console.log('  web_searches_limit:', quota.web_searches_limit)
    console.log('  updated_at:', quota.updated_at)
    console.log('  is_current_period:', quota.reset_date === nextMonth.toISOString() ? '✅ YES' : '❌ NO')
    console.log('')
  })
}

checkDatabase()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
