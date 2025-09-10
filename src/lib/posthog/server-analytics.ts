import { trackServerEvent } from './server'

// Server-side analytics functions
export const serverAnalytics = {
  trackAPICall: async (userId: string, endpoint: string, properties?: Record<string, any>) => {
    await trackServerEvent(userId, 'api_call', {
      endpoint,
      ...properties
    })
  },

  trackModelUsage: async (userId: string, model: string, properties?: Record<string, any>) => {
    await trackServerEvent(userId, 'model_used', {
      model,
      ...properties
    })
  },

  trackError: async (userId: string, error: string, properties?: Record<string, any>) => {
    await trackServerEvent(userId, 'server_error', {
      error,
      ...properties
    })
  }
}