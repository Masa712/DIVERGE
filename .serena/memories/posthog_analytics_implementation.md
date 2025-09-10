# PostHog Analytics Implementation

## Overview
Implemented comprehensive PostHog analytics system for AI application with specialized tracking for chat interactions, model usage, performance monitoring, and user behavior analysis.

## Implementation Details

### Configuration Files
- `/src/lib/posthog/client.tsx` - Client-side PostHog initialization with user identification
- `/src/lib/posthog/server.ts` - Server-side PostHog client for API tracking
- `/src/lib/posthog/server-analytics.ts` - Server-side analytics functions (separated to avoid bundling issues)
- `/src/lib/posthog/analytics.ts` - Client-side analytics utility functions
- `/src/lib/posthog/pageview-tracker.tsx` - Automatic pageview tracking component
- `/src/app/api/debug/posthog-check/route.ts` - Diagnostic endpoint for PostHog configuration
- `/src/app/debug/posthog/page.tsx` - Test page for PostHog validation

### Environment Variables
Required for all environments:
- `NEXT_PUBLIC_POSTHOG_KEY` - Project API key (client-accessible)
- `NEXT_PUBLIC_POSTHOG_HOST` - PostHog instance URL (default: https://us.i.posthog.com)

### Configuration Optimizations
- **Ad blocker compatibility**: `autocapture: false`, `disable_session_recording: true`
- **Performance optimization**: `persistence: 'localStorage'`
- **Development debugging**: `debug: true` in development only
- **Global access**: `window.posthog` available for debugging

### AI-Specific Analytics Functions

#### Chat & AI Interactions
- `trackChatStart(data)` - Track chat session initialization
- `trackMessageSent(data)` - Track user message submissions
- `trackAIResponse(data)` - Track AI responses with token count and response time
- `trackError(data)` - Track AI-related errors

#### User Behavior Tracking
- `trackFeatureUsage(feature, properties)` - Track feature adoption
- `trackNodeInteraction(action, nodeId, properties)` - Track node manipulations
- `trackPerformance(data)` - Track component performance metrics
- `setUserProperties(properties)` - Update user attributes

#### Conversion & Retention
- `trackSignup(method)` - Track user registration
- `trackLogin(method)` - Track user authentication
- `trackSessionDuration(duration)` - Track engagement time

### Server-Side Analytics
- `trackAPICall(userId, endpoint, properties)` - Track API usage
- `trackModelUsage(userId, model, properties)` - Track AI model utilization
- `trackError(userId, error, properties)` - Track server errors

### Feature Flags Support
- `isEnabled(flag)` - Check feature flag status
- `getVariant(flag)` - Get A/B test variant

### Integration Points
- **Layout Integration**: PostHogProvider wraps entire app in layout.tsx
- **User Identification**: Automatic user identification via Supabase auth integration
- **Pageview Tracking**: Automatic page navigation tracking
- **Error Integration**: Works alongside Sentry for comprehensive monitoring

### Webpack Configuration
Updated `next.config.js` to prevent client-side bundling of Node.js modules:
```javascript
// Prevent posthog-node from being bundled on client side
if (!isServer) {
  config.resolve.fallback = {
    fs: false,
    net: false,
    tls: false,
    crypto: false,
  }
}
```

### PostHog Dashboard Setup
Configured Actions for key events:
- "AI Chat Started" (chat_started)
- "Message Sent to AI" (message_sent)  
- "AI Response Received" (ai_response_received)
- "User Signup" (user_signed_up)
- "Feature Used" (feature_used)
- "Error Occurred" (error_occurred)

### Testing and Validation
- Test page at `/debug/posthog` with comprehensive event testing
- Diagnostic endpoint at `/api/debug/posthog-check` for configuration verification
- Console debugging with `window.posthog` access
- Dashboard integration confirmed with live event tracking

## Usage Examples

### Client-side tracking
```typescript
import { analytics } from '@/lib/posthog/analytics'

// Track AI interaction
analytics.trackChatStart({
  sessionId: 'session-123',
  model: 'gpt-4',
  nodeId: 'node-456'
})

// Track performance
analytics.trackPerformance({
  component: 'tree_view',
  loadTime: 1200,
  interactionType: 'resize'
})
```

### Server-side tracking
```typescript
import { serverAnalytics } from '@/lib/posthog/server-analytics'

// Track API usage
await serverAnalytics.trackModelUsage(userId, 'gpt-4', {
  tokenCount: 150,
  responseTime: 2500
})
```

## Production Deployment
- All environment variables configured in Vercel
- Debug mode automatically disabled in production
- Authorized domains configured in PostHog settings
- Integration with existing Sentry error tracking system