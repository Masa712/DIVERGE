'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/providers/auth-provider'
import { 
  UserIcon,
  KeyIcon,
  CpuChipIcon,
  ArrowLeftIcon,
  CheckIcon,
  ExclamationCircleIcon
} from '@heroicons/react/24/outline'
import { AVAILABLE_MODELS, ModelId } from '@/types'

interface UserProfile {
  display_name: string
  default_model: ModelId | null
  default_temperature: number
  default_max_tokens: number
  email: string
}

export default function SettingsPage() {
  const router = useRouter()
  const { user, signOut } = useAuth()
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
  
  // Password state
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  
  // Active tab
  const [activeTab, setActiveTab] = useState<'profile' | 'password' | 'model'>('profile')

  useEffect(() => {
    if (!user) {
      router.push('/auth')
      return
    }
    fetchProfile()
  }, [user])

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
      setShowPasswordForm(false)
      
      // Clear message after 3 seconds
      setTimeout(() => setMessage(null), 3000)
    } catch (error) {
      console.error('Error changing password:', error)
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to change password' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-8 bg-gradient-to-br from-blue-50 via-white to-purple-50">
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
        </div>
      </div>
    </div>
  )
}