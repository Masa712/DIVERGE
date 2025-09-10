import posthog from './client'

// Types for analytics events
export interface ChatAnalyticsData {
  sessionId: string
  nodeId?: string
  model: string
  messageCount?: number
  tokenCount?: number
  responseTime?: number
  errorType?: string
}

export interface UserAnalyticsData {
  userId?: string
  email?: string
  plan?: string
  feature?: string
}

export interface PerformanceData {
  component: string
  loadTime: number
  interactionType?: string
}

// Client-side analytics functions
export const analytics = {
  // Chat and AI interactions
  trackChatStart: (data: ChatAnalyticsData) => {
    if (typeof window !== 'undefined') {
      posthog?.capture('chat_started', {
        session_id: data.sessionId,
        model: data.model,
        node_id: data.nodeId
      })
    }
  },

  trackMessageSent: (data: ChatAnalyticsData) => {
    if (typeof window !== 'undefined') {
      posthog?.capture('message_sent', {
        session_id: data.sessionId,
        model: data.model,
        node_id: data.nodeId,
        message_count: data.messageCount
      })
    }
  },

  trackAIResponse: (data: ChatAnalyticsData) => {
    if (typeof window !== 'undefined') {
      posthog?.capture('ai_response_received', {
        session_id: data.sessionId,
        model: data.model,
        token_count: data.tokenCount,
        response_time_ms: data.responseTime,
        node_id: data.nodeId
      })
    }
  },

  trackError: (data: ChatAnalyticsData & { errorMessage?: string }) => {
    if (typeof window !== 'undefined') {
      posthog?.capture('error_occurred', {
        session_id: data.sessionId,
        model: data.model,
        error_type: data.errorType,
        error_message: data.errorMessage,
        node_id: data.nodeId
      })
    }
  },

  // User behavior tracking
  trackFeatureUsage: (feature: string, properties?: Record<string, any>) => {
    if (typeof window !== 'undefined') {
      posthog?.capture('feature_used', {
        feature_name: feature,
        ...properties
      })
    }
  },

  trackNodeInteraction: (action: string, nodeId: string, properties?: Record<string, any>) => {
    if (typeof window !== 'undefined') {
      posthog?.capture('node_interaction', {
        action,
        node_id: nodeId,
        ...properties
      })
    }
  },

  // Performance tracking
  trackPerformance: (data: PerformanceData) => {
    if (typeof window !== 'undefined') {
      posthog?.capture('performance_metric', {
        component: data.component,
        load_time_ms: data.loadTime,
        interaction_type: data.interactionType
      })
    }
  },

  // Conversion events
  trackSignup: (method: string) => {
    if (typeof window !== 'undefined') {
      posthog?.capture('user_signed_up', {
        signup_method: method
      })
    }
  },

  trackLogin: (method: string) => {
    if (typeof window !== 'undefined') {
      posthog?.capture('user_logged_in', {
        login_method: method
      })
    }
  },

  // Custom properties and user attributes
  setUserProperties: (properties: Record<string, any>) => {
    if (typeof window !== 'undefined') {
      posthog?.people?.set(properties)
    }
  },

  // Session and retention
  trackSessionDuration: (duration: number) => {
    if (typeof window !== 'undefined') {
      posthog?.capture('session_duration', {
        duration_minutes: Math.round(duration / 60000)
      })
    }
  }
}


// Feature flags (for A/B testing)
export const featureFlags = {
  isEnabled: (flag: string): boolean => {
    if (typeof window !== 'undefined') {
      return posthog?.isFeatureEnabled(flag) || false
    }
    return false
  },

  getVariant: (flag: string): string | boolean => {
    if (typeof window !== 'undefined') {
      return posthog?.getFeatureFlag(flag) || false
    }
    return false
  }
}