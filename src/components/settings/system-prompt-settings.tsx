'use client'

import { useState, useEffect } from 'react'
import { useError } from '@/components/providers/error-provider'
import { 
  ChevronDownIcon, 
  ChatBubbleLeftRightIcon,
  GlobeAltIcon,
  DocumentTextIcon,
  AcademicCapIcon,
  PlusIcon,
  XMarkIcon
} from '@heroicons/react/24/outline'

interface SystemPromptPreferences {
  system_prompt_preset: 'default' | 'technical' | 'business' | 'creative' | 'educational'
  system_prompt_style: 'professional' | 'friendly' | 'concise' | 'detailed'
  system_prompt_language: 'auto' | 'en' | 'ja' | 'multilingual'
  system_prompt_format: 'markdown' | 'plain' | 'structured'
  system_prompt_specializations: string[]
  custom_instructions: string | null
  system_prompt_enabled: boolean
}

interface SystemPromptOptions {
  presets: string[]
  styles: string[]
  languages: string[]
  formats: string[]
  commonSpecializations: string[]
}

export function SystemPromptSettings() {
  const [preferences, setPreferences] = useState<SystemPromptPreferences>({
    system_prompt_preset: 'default',
    system_prompt_style: 'friendly',
    system_prompt_language: 'auto',
    system_prompt_format: 'markdown',
    system_prompt_specializations: [],
    custom_instructions: null,
    system_prompt_enabled: true
  })
  
  const [options, setOptions] = useState<SystemPromptOptions | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [newSpecialization, setNewSpecialization] = useState('')
  const { showError, showSuccess } = useError()

  // Load current preferences and available options
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load current preferences
        const prefsResponse = await fetch('/api/system-prompt')
        if (prefsResponse.ok) {
          const { data } = await prefsResponse.json()
          setPreferences(data)
        }

        // Load available options
        const optionsResponse = await fetch('/api/system-prompt', {
          method: 'OPTIONS'
        })
        if (optionsResponse.ok) {
          const { data } = await optionsResponse.json()
          setOptions(data)
        }
      } catch (error) {
        showError('Failed to load system prompt settings')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [showError])

  const handleSave = async () => {
    setSaving(true)
    try {
      const response = await fetch('/api/system-prompt', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(preferences)
      })

      const data = await response.json()
      console.log('API Response:', { status: response.status, ok: response.ok, data })
      
      if (response.ok) {
        showSuccess('System prompt preferences saved successfully!')
      } else {
        showError(data.error?.message || data.message || 'Failed to save preferences')
      }
    } catch (error) {
      console.error('Error saving preferences:', error)
      showError('Failed to save system prompt preferences')
    } finally {
      setSaving(false)
    }
  }

  const addSpecialization = () => {
    if (newSpecialization.trim() && !preferences.system_prompt_specializations.includes(newSpecialization.trim())) {
      setPreferences(prev => ({
        ...prev,
        system_prompt_specializations: [...prev.system_prompt_specializations, newSpecialization.trim()]
      }))
      setNewSpecialization('')
    }
  }

  const removeSpecialization = (spec: string) => {
    setPreferences(prev => ({
      ...prev,
      system_prompt_specializations: prev.system_prompt_specializations.filter(s => s !== spec)
    }))
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <ChatBubbleLeftRightIcon className="w-6 h-6 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">AI Response Customization</h2>
        </div>
        <p className="mt-2 text-sm text-gray-600">
          Customize how the AI assistant responds to your messages
        </p>
      </div>

      <div className="p-6 space-y-6">
        {/* Enable/Disable Toggle */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-gray-900">Enable Custom Settings</h3>
            <p className="text-sm text-gray-500">Use personalized AI behavior settings</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={preferences.system_prompt_enabled}
              onChange={(e) => setPreferences(prev => ({ ...prev, system_prompt_enabled: e.target.checked }))}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>

        {preferences.system_prompt_enabled && (
          <>
            {/* Preset */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Response Preset
              </label>
              <select
                value={preferences.system_prompt_preset}
                onChange={(e) => setPreferences(prev => ({ 
                  ...prev, 
                  system_prompt_preset: e.target.value as any 
                }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {options?.presets.map(preset => (
                  <option key={preset} value={preset}>
                    {preset.charAt(0).toUpperCase() + preset.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            {/* Style */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Response Style
              </label>
              <select
                value={preferences.system_prompt_style}
                onChange={(e) => setPreferences(prev => ({ 
                  ...prev, 
                  system_prompt_style: e.target.value as any 
                }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {options?.styles.map(style => (
                  <option key={style} value={style}>
                    {style.charAt(0).toUpperCase() + style.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            {/* Language */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <GlobeAltIcon className="w-4 h-4 inline mr-1" />
                Language Preference
              </label>
              <select
                value={preferences.system_prompt_language}
                onChange={(e) => setPreferences(prev => ({ 
                  ...prev, 
                  system_prompt_language: e.target.value as any 
                }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="auto">Auto-detect</option>
                <option value="en">English</option>
                <option value="ja">Japanese (日本語)</option>
                <option value="multilingual">Multilingual</option>
              </select>
            </div>

            {/* Output Format */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <DocumentTextIcon className="w-4 h-4 inline mr-1" />
                Output Format
              </label>
              <select
                value={preferences.system_prompt_format}
                onChange={(e) => setPreferences(prev => ({ 
                  ...prev, 
                  system_prompt_format: e.target.value as any 
                }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="markdown">Markdown (formatted)</option>
                <option value="plain">Plain text</option>
                <option value="structured">Structured sections</option>
              </select>
            </div>

            {/* Specializations */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <AcademicCapIcon className="w-4 h-4 inline mr-1" />
                Areas of Expertise
              </label>
              
              {/* Current specializations */}
              <div className="flex flex-wrap gap-2 mb-3">
                {preferences.system_prompt_specializations.map((spec, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800"
                  >
                    {spec}
                    <button
                      onClick={() => removeSpecialization(spec)}
                      className="ml-2 text-blue-600 hover:text-blue-800"
                    >
                      <XMarkIcon className="w-4 h-4" />
                    </button>
                  </span>
                ))}
              </div>

              {/* Add new specialization */}
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={newSpecialization}
                  onChange={(e) => setNewSpecialization(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addSpecialization()}
                  placeholder="Add expertise area..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  onClick={addSpecialization}
                  className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <PlusIcon className="w-4 h-4" />
                </button>
              </div>

              {/* Common suggestions */}
              <div className="mt-2">
                <p className="text-xs text-gray-500 mb-2">Suggestions:</p>
                <div className="flex flex-wrap gap-1">
                  {options?.commonSpecializations.filter(spec => 
                    !preferences.system_prompt_specializations.includes(spec)
                  ).slice(0, 6).map(spec => (
                    <button
                      key={spec}
                      onClick={() => setPreferences(prev => ({
                        ...prev,
                        system_prompt_specializations: [...prev.system_prompt_specializations, spec]
                      }))}
                      className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                    >
                      + {spec}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Custom Instructions */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Custom Instructions
              </label>
              <textarea
                value={preferences.custom_instructions || ''}
                onChange={(e) => setPreferences(prev => ({ 
                  ...prev, 
                  custom_instructions: e.target.value || null 
                }))}
                placeholder="Add specific instructions for how the AI should behave..."
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="mt-1 text-xs text-gray-500">
                Example: "Always provide code examples when discussing programming topics" or "Use bullet points for lists"
              </p>
            </div>
          </>
        )}

        {/* Save Button */}
        <div className="flex justify-end pt-4 border-t border-gray-200">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}