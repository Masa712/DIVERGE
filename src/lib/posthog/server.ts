import { PostHog } from 'posthog-node'

// Server-side PostHog client
let posthogClient: PostHog | null = null

export function getPostHogClient(): PostHog | null {
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    console.warn('PostHog key not found in environment variables')
    return null
  }

  if (!posthogClient) {
    posthogClient = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
      flushAt: 1, // Flush events immediately in development
      flushInterval: 30000, // Flush every 30 seconds in production
    })
  }

  return posthogClient
}

// Server-side event tracking
export async function trackServerEvent(
  distinctId: string,
  event: string,
  properties?: Record<string, any>
) {
  const client = getPostHogClient()
  
  if (client) {
    try {
      client.capture({
        distinctId,
        event,
        properties: {
          ...properties,
          $timestamp: new Date().toISOString(),
          server_side: true
        }
      })

      // In development, flush immediately
      if (process.env.NODE_ENV === 'development') {
        await client.flush()
      }
    } catch (error) {
      console.error('Error tracking server event:', error)
    }
  }
}

// Shutdown PostHog client gracefully
export async function shutdownPostHog() {
  if (posthogClient) {
    await posthogClient.shutdown()
  }
}