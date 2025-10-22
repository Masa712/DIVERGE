'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/components/providers/auth-provider'
import {
  UserIcon,
  KeyIcon,
  CpuChipIcon,
  ChatBubbleLeftRightIcon,
  ArrowLeftIcon,
  CheckIcon,
  ExclamationCircleIcon,
  CreditCardIcon,
  ArrowTrendingUpIcon,
  StarIcon
} from '@heroicons/react/24/outline'
import { SystemPromptSettings } from '@/components/settings/system-prompt-settings'
import { AVAILABLE_MODELS, ModelId } from '@/types'
import { AnimatedBackground } from '@/components/ui/AnimatedBackground'
import { SubscriptionPlan, UserSubscription, UsageQuota, formatPrice } from '@/types/subscription'

interface UserProfile {
  display_name: string
  default_model: ModelId | null
  default_temperature: number
  default_max_tokens: number
  email: string
}

interface BillingData {
  subscription: UserSubscription | null
  usage: UsageQuota | null
  plan: SubscriptionPlan | null
}

function normalizeToUtcMidnight(date: Date) {
  return new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    0,
    0,
    0,
    0
  ))
}

function getDaysInMonthUtc(year: number, month: number) {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
}

function addMonthsUtc(date: Date, monthsToAdd: number, referenceDay: number) {
  const target = new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth() + monthsToAdd,
    1,
    0,
    0,
    0,
    0
  ))

  const clampedDay = Math.min(referenceDay, getDaysInMonthUtc(
    target.getUTCFullYear(),
    target.getUTCMonth()
  ))

  target.setUTCDate(clampedDay)
  return target
}

function addYearsUtc(date: Date, yearsToAdd: number, referenceDay: number) {
  const year = date.getUTCFullYear() + yearsToAdd
  const month = date.getUTCMonth()
  const clampedDay = Math.min(referenceDay, getDaysInMonthUtc(year, month))

  return new Date(Date.UTC(year, month, clampedDay, 0, 0, 0, 0))
}

function calculateNextResetDate(
  baseDate: Date,
  interval: 'month' | 'year',
  now: Date
) {
  const normalizedStart = normalizeToUtcMidnight(baseDate)
  const referenceDay = normalizedStart.getUTCDate()
  let candidate = normalizedStart

  while (candidate <= now) {
    candidate = interval === 'year'
      ? addYearsUtc(candidate, 1, referenceDay)
      : addMonthsUtc(candidate, 1, referenceDay)
  }

  return candidate
}

export default function SettingsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  // Profile state
  const [profile, setProfile] = useState<UserProfile>({
    display_name: '',
    default_model: null,
    default_temperature: 0.7,
    default_max_tokens: 1000,
    email: ''
  })

  // Billing state
  const [billingData, setBillingData] = useState<BillingData | null>(null)
  const [billingLoading, setBillingLoading] = useState(true)
  const [portalLoading, setPortalLoading] = useState(false)

  // Password state
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })

  // Active tab
  const [activeTab, setActiveTab] = useState<'profile' | 'password' | 'model' | 'prompt'>('profile')

  const nextUsageResetDate = useMemo(() => {
    if (!billingData) return null

    const now = new Date()
    const baseDate = billingData.subscription
      ? billingData.subscription.createdAt
      : user?.created_at
        ? new Date(user.created_at)
        : null

    if (!baseDate) {
      return billingData.usage?.resetDate ?? null
    }

    const interval = billingData.subscription
      ? billingData.plan?.interval ?? 'month'
      : 'month'

    try {
      return calculateNextResetDate(baseDate, interval, now)
    } catch (error) {
      console.error('Failed to calculate next usage reset date:', error)
      return billingData.usage?.resetDate ?? null
    }
  }, [billingData, user])

  const fetchProfile = async () => {
    try {
      const response = await fetch('/api/profile')
      if (!response.ok) throw new Error('Failed to fetch profile')

      const data = await response.json()
      setProfile(data.data)
    } catch (error) {
      console.error('Error fetching profile:', error)
      setMessage({ type: 'error', text: 'Failed to load profile' })
    } finally {
      setLoading(false)
    }
  }

  const fetchBillingData = async () => {
    if (!user) return

    try {
      setBillingLoading(true)

      console.log('🔍 [Settings] Fetching billing data via API...')

      // Use the new billing API endpoint (server-side)
      const response = await fetch('/api/billing')

      if (!response.ok) {
        throw new Error('Failed to fetch billing data')
      }

      const result = await response.json()
      const { subscription, usage, plan } = result.data

      console.log('✅ [Settings] API response:', result.data)

      // Convert snake_case to camelCase for usage data
      let finalUsageData: UsageQuota | null = null
      if (usage) {
        finalUsageData = {
          userId: usage.user_id,
          planId: usage.plan_id,
          monthlyTokensUsed: usage.monthly_tokens_used,
          monthlyTokensLimit: usage.monthly_tokens_limit,
          sessionsThisMonth: usage.sessions_this_month,
          sessionsLimit: usage.sessions_limit,
          webSearchesUsed: usage.web_searches_used || 0,
          webSearchesLimit: usage.web_searches_limit || 10,
          resetDate: new Date(usage.reset_date),
        }
      }

      // Convert snake_case to camelCase for subscription data
      let finalSubscriptionData: UserSubscription | null = null
      if (subscription) {
        finalSubscriptionData = {
          id: subscription.id,
          userId: subscription.user_id,
          planId: subscription.plan_id,
          stripeSubscriptionId: subscription.stripe_subscription_id,
          stripeCustomerId: subscription.stripe_customer_id,
          status: subscription.status,
          currentPeriodStart: new Date(subscription.current_period_start),
          currentPeriodEnd: new Date(subscription.current_period_end),
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          createdAt: new Date(subscription.created_at),
          updatedAt: new Date(subscription.updated_at),
        }
      }

      setBillingData({
        subscription: finalSubscriptionData,
        usage: finalUsageData,
        plan: plan,
      })

      console.log('✅ [Settings] Billing data set successfully')
    } catch (error) {
      console.error('❌ [Settings] Error fetching billing data:', error)
      setMessage({ type: 'error', text: 'Failed to load billing information' })
    } finally {
      setBillingLoading(false)
    }
  }

  useEffect(() => {
    if (!user) {
      router.push('/auth')
      return
    }
    fetchProfile()
    fetchBillingData()
  }, [user])

  const saveProfile = async () => {
    setSaving(true)
    setMessage(null)
    
    try {
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: profile.display_name,
          default_model: profile.default_model,
          default_temperature: profile.default_temperature,
          default_max_tokens: profile.default_max_tokens
        })
      })
      
      if (!response.ok) throw new Error('Failed to save profile')
      
      const data = await response.json()
      setProfile(data.data)
      setMessage({ type: 'success', text: 'Profile updated successfully' })
      
      // Clear message after 3 seconds
      setTimeout(() => setMessage(null), 3000)
    } catch (error) {
      console.error('Error saving profile:', error)
      setMessage({ type: 'error', text: 'Failed to save profile' })
    } finally {
      setSaving(false)
    }
  }

  const changePassword = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match' })
      return
    }

    setSaving(true)
    setMessage(null)

    try {
      const response = await fetch('/api/profile/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.userMessage || 'Failed to change password')
      }

      setMessage({ type: 'success', text: 'Password changed successfully' })
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })

      // Clear message after 3 seconds
      setTimeout(() => setMessage(null), 3000)
    } catch (error) {
      console.error('Error changing password:', error)
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to change password' })
    } finally {
      setSaving(false)
    }
  }

  const handleManageBilling = async () => {
    if (!billingData?.subscription) {
      router.push('/pricing')
      return
    }

    setPortalLoading(true)

    try {
      const response = await fetch('/api/stripe/create-portal', {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error('Failed to create portal session')
      }

      const { url } = await response.json()
      window.location.href = url
    } catch (error) {
      console.error('Error creating portal session:', error)
      setMessage({ type: 'error', text: 'Failed to open billing portal' })
    } finally {
      setPortalLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="relative min-h-screen flex items-center justify-center">
        <AnimatedBackground opacity={0.3} />
        <div className="text-gray-600">Loading...</div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen p-8">
      <AnimatedBackground opacity={0.2} />
      {/* Back Button */}
      <button
        onClick={() => router.push('/chat')}
        className="mb-6 flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
      >
        <ArrowLeftIcon className="w-5 h-5" />
        Back to Chat
      </button>

      {/* Main Settings Container */}
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Settings</h1>

        {/* Message Alert */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg glass-blur border ${
            message.type === 'success' 
              ? 'border-green-200 bg-green-50/50 text-green-800' 
              : 'border-red-200 bg-red-50/50 text-red-800'
          } flex items-center gap-2`}>
            {message.type === 'success' ? (
              <CheckIcon className="w-5 h-5" />
            ) : (
              <ExclamationCircleIcon className="w-5 h-5" />
            )}
            {message.text}
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-4 py-2 rounded-lg transition-all ${
              activeTab === 'profile'
                ? 'bg-white/80 shadow-lg border border-white/20'
                : 'bg-white/40 hover:bg-white/60 border border-white/10'
            }`}
          >
            <UserIcon className="w-5 h-5 inline mr-2" />
            Profile
          </button>
          <button
            onClick={() => setActiveTab('password')}
            className={`px-4 py-2 rounded-lg transition-all ${
              activeTab === 'password'
                ? 'bg-white/80 shadow-lg border border-white/20'
                : 'bg-white/40 hover:bg-white/60 border border-white/10'
            }`}
          >
            <KeyIcon className="w-5 h-5 inline mr-2" />
            Password
          </button>
          <button
            onClick={() => setActiveTab('model')}
            className={`px-4 py-2 rounded-lg transition-all ${
              activeTab === 'model'
                ? 'bg-white/80 shadow-lg border border-white/20'
                : 'bg-white/40 hover:bg-white/60 border border-white/10'
            }`}
          >
            <CpuChipIcon className="w-5 h-5 inline mr-2" />
            AI Model
          </button>
          <button
            onClick={() => setActiveTab('prompt')}
            className={`px-4 py-2 rounded-lg transition-all ${
              activeTab === 'prompt'
                ? 'bg-white/80 shadow-lg border border-white/20'
                : 'bg-white/40 hover:bg-white/60 border border-white/10'
            }`}
          >
            <ChatBubbleLeftRightIcon className="w-5 h-5 inline mr-2" />
            AI Behavior
          </button>
        </div>

        {/* Tab Content */}
        <div className="glass-test glass-blur border border-white/20 shadow-[0_20px_50px_rgba(0,0,0,0.3)] rounded-2xl p-8">
          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Profile Settings</h2>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={profile.email}
                  disabled
                  className="w-full px-4 py-2 rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Display Name
                </label>
                <input
                  type="text"
                  value={profile.display_name}
                  onChange={(e) => setProfile({ ...profile, display_name: e.target.value })}
                  placeholder="Enter your display name"
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:border-blue-400 focus:outline-none transition-colors"
                />
              </div>

              <button
                onClick={saveProfile}
                disabled={saving}
                className="px-6 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Profile'}
              </button>

              {/* Divider */}
              <div className="border-t border-gray-200 my-8"></div>

              {/* Current Plan Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                    <CreditCardIcon className="w-5 h-5 text-blue-500" />
                    Current Plan
                  </h3>
                  {billingData?.plan && billingData.plan.id !== 'free' && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleManageBilling}
                        disabled={portalLoading}
                        className="px-4 py-2 text-sm bg-white border border-blue-500 text-blue-500 rounded-lg hover:bg-blue-50 transition-all disabled:opacity-50"
                      >
                        {portalLoading ? 'Loading...' : 'Manage Billing'}
                      </button>
                      <button
                        onClick={() => router.push('/pricing')}
                        className="px-4 py-2 text-sm bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all"
                      >
                        Change Plan
                      </button>
                    </div>
                  )}
                </div>

                {billingLoading ? (
                  <div className="h-24 bg-gray-100 rounded-lg animate-pulse"></div>
                ) : billingData?.plan ? (
                  <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg p-6 border border-blue-200">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-2xl font-bold text-gray-900">{billingData.plan.name}</h4>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-gray-900">
                          {formatPrice(billingData.plan.price)}
                        </div>
                        {billingData.plan.price > 0 && (
                          <div className="text-sm text-gray-600">/{billingData.plan.interval}</div>
                        )}
                      </div>
                    </div>
                    <p className="text-gray-700 mb-4">{billingData.plan.description}</p>

                    {billingData.plan.id === 'free' && (
                      <button
                        onClick={() => router.push('/pricing')}
                        className="w-full px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all flex items-center justify-center gap-2"
                      >
                        <StarIcon className="w-4 h-4" />
                        Upgrade to Plus or Pro
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    No plan information available
                  </div>
                )}
              </div>

              {/* Usage This Month Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                  <ArrowTrendingUpIcon className="w-5 h-5 text-green-500" />
                  Usage This Month
                </h3>

                {billingLoading ? (
                  <div className="h-32 bg-gray-100 rounded-lg animate-pulse"></div>
                ) : billingData?.usage ? (
                  <div className="bg-gray-50 rounded-lg p-6 border border-gray-200 space-y-4">
                    {/* Token Usage */}
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-gray-700">Tokens Used</span>
                        <span className="text-sm font-semibold text-gray-900">
                          {billingData.usage.monthlyTokensUsed.toLocaleString()} / {' '}
                          {billingData.usage.monthlyTokensLimit === -1
                            ? 'Unlimited'
                            : billingData.usage.monthlyTokensLimit.toLocaleString()
                          }
                        </span>
                      </div>
                      {billingData.usage.monthlyTokensLimit !== -1 && (
                        <div className="w-full bg-gray-300 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all duration-300 ${
                              ((billingData.usage.monthlyTokensUsed / billingData.usage.monthlyTokensLimit) * 100) < 50
                                ? 'bg-green-500'
                                : ((billingData.usage.monthlyTokensUsed / billingData.usage.monthlyTokensLimit) * 100) < 80
                                ? 'bg-yellow-500'
                                : 'bg-red-500'
                            }`}
                            style={{
                              width: `${Math.min((billingData.usage.monthlyTokensUsed / billingData.usage.monthlyTokensLimit) * 100, 100)}%`
                            }}
                          />
                        </div>
                      )}
                    </div>

                    {/* Session Usage */}
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-gray-700">Sessions Used</span>
                        <span className="text-sm font-semibold text-gray-900">
                          {billingData.usage.sessionsThisMonth} / {' '}
                          {billingData.usage.sessionsLimit === -1
                            ? 'Unlimited'
                            : billingData.usage.sessionsLimit
                          }
                        </span>
                      </div>
                      {billingData.usage.sessionsLimit !== -1 && (
                        <div className="w-full bg-gray-300 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all duration-300 ${
                              ((billingData.usage.sessionsThisMonth / billingData.usage.sessionsLimit) * 100) < 50
                                ? 'bg-green-500'
                                : ((billingData.usage.sessionsThisMonth / billingData.usage.sessionsLimit) * 100) < 80
                                ? 'bg-yellow-500'
                                : 'bg-red-500'
                            }`}
                            style={{
                              width: `${Math.min((billingData.usage.sessionsThisMonth / billingData.usage.sessionsLimit) * 100, 100)}%`
                            }}
                          />
                        </div>
                      )}
                    </div>

                    {/* Web Search Usage */}
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-gray-700">Web Searches Used</span>
                        <span className="text-sm font-semibold text-gray-900">
                          {billingData.usage.webSearchesUsed || 0} / {' '}
                          {billingData.usage.webSearchesLimit === -1
                            ? 'Unlimited'
                            : billingData.usage.webSearchesLimit || 0
                          }
                        </span>
                      </div>
                      {billingData.usage.webSearchesLimit !== -1 && (
                        <div className="w-full bg-gray-300 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all duration-300 ${
                              (((billingData.usage.webSearchesUsed || 0) / (billingData.usage.webSearchesLimit || 10)) * 100) < 50
                                ? 'bg-green-500'
                                : (((billingData.usage.webSearchesUsed || 0) / (billingData.usage.webSearchesLimit || 10)) * 100) < 80
                                ? 'bg-yellow-500'
                                : 'bg-red-500'
                            }`}
                            style={{
                              width: `${Math.min(((billingData.usage.webSearchesUsed || 0) / (billingData.usage.webSearchesLimit || 10)) * 100, 100)}%`
                            }}
                          />
                        </div>
                      )}
                    </div>

                    {nextUsageResetDate && (
                      <div className="text-xs text-gray-500 pt-2 border-t border-gray-300">
                        Usage resets on {nextUsageResetDate.toLocaleDateString()}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    No usage data available
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Password Tab */}
          {activeTab === 'password' && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Change Password</h2>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Current Password
                </label>
                <input
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                  placeholder="Enter current password"
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:border-blue-400 focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  New Password
                </label>
                <input
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  placeholder="Enter new password (min 6 characters)"
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:border-blue-400 focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  placeholder="Confirm new password"
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:border-blue-400 focus:outline-none transition-colors"
                />
              </div>

              <button
                onClick={changePassword}
                disabled={saving || !passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword}
                className="px-6 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all disabled:opacity-50"
              >
                {saving ? 'Changing...' : 'Change Password'}
              </button>
            </div>
          )}

          {/* Model Settings Tab */}
          {activeTab === 'model' && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">AI Model Settings</h2>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Default Model
                </label>
                <select
                  value={profile.default_model || ''}
                  onChange={(e) => setProfile({ ...profile, default_model: e.target.value as ModelId })}
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:border-blue-400 focus:outline-none transition-colors"
                >
                  <option value="">No default (select each time)</option>
                  {AVAILABLE_MODELS.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name} ({model.provider})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Default Temperature: {profile.default_temperature}
                </label>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={profile.default_temperature}
                  onChange={(e) => setProfile({ ...profile, default_temperature: parseFloat(e.target.value) })}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Precise</span>
                  <span>Balanced</span>
                  <span>Creative</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Default Max Tokens: {profile.default_max_tokens}
                </label>
                <input
                  type="range"
                  min="100"
                  max="16000"
                  step="100"
                  value={profile.default_max_tokens}
                  onChange={(e) => setProfile({ ...profile, default_max_tokens: parseInt(e.target.value) })}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>100</span>
                  <span>8000</span>
                  <span>16000</span>
                </div>
              </div>

              <button
                onClick={saveProfile}
                disabled={saving}
                className="px-6 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Model Settings'}
              </button>
            </div>
          )}

          {/* System Prompt Tab */}
          {activeTab === 'prompt' && (
            <div>
              <SystemPromptSettings />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
  useEffect(() => {
    const billingSuccess = searchParams.get('billing_success')
    const billingCanceled = searchParams.get('billing_canceled')

    if (billingSuccess === 'true') {
      setActiveTab('profile')
      setMessage({ type: 'success', text: 'Payment successful! Your subscription has been updated.' })
      setTimeout(() => setMessage(null), 3000)
      router.replace('/settings', { scroll: false })
    } else if (billingCanceled === 'true') {
      setActiveTab('profile')
      setMessage({ type: 'error', text: 'Payment was canceled. You can try again anytime.' })
      setTimeout(() => setMessage(null), 3000)
      router.replace('/settings', { scroll: false })
    }
  }, [searchParams, router])
