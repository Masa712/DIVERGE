# Sentry Error Tracking Implementation

## Overview
Implemented comprehensive Sentry error tracking for market deployment readiness using Next.js 14 instrumentation pattern.

## Implementation Details

### Configuration Files
- `/src/instrumentation.ts` - Server-side and edge runtime Sentry initialization
- `/src/instrumentation-client.ts` - Client-side Sentry initialization with router transition hooks
- `/src/lib/utils/error-reporting.ts` - Utility functions for error reporting, performance monitoring
- `/src/app/api/debug/sentry-check/route.ts` - Diagnostic endpoint for configuration verification
- `/src/app/debug/sentry/page.tsx` - Test page for Sentry integration validation

### Environment Variables
Required for production deployment in Vercel:
- `NEXT_PUBLIC_SENTRY_DSN` - Public DSN for client/server (all environments)
- `SENTRY_ORG` - Organization slug (all environments) 
- `SENTRY_PROJECT` - Project slug (all environments)
- `SENTRY_AUTH_TOKEN` - Authentication token (production only for source maps)

### Environment-Based Optimization
- **Development**: `debug: true`, `tracesSampleRate: 1.0` (100% tracing)
- **Production**: `debug: false`, `tracesSampleRate: 0.1` (10% tracing for performance)

### Features Implemented
- Error reporting with context (userId, sessionId, model, feature tags)
- Custom message reporting with severity levels
- Breadcrumb tracking for user actions
- Performance monitoring with transaction tracking
- User feedback capture
- Session replay (client-side with privacy settings)

### Key Functions in error-reporting.ts
- `reportError(error, context)` - Report exceptions with rich context
- `reportMessage(message, level, context)` - Send custom messages
- `addBreadcrumb(message, category, data)` - Track user interactions
- `withSentryPerformance(operation, fn, context)` - Wrap async operations for performance monitoring
- `captureUserFeedback(eventId, name, email, comments)` - Collect user feedback

### Configuration Migration
Migrated from deprecated Next.js 12 pattern (`sentry.*.config.js`) to Next.js 14 instrumentation pattern for better compatibility and performance.

### Testing and Validation
- Diagnostic endpoint confirms proper initialization
- Test page validates client/server error reporting
- Dashboard integration confirmed working
- Source map upload configured for production debugging

## Usage in Application Code
```typescript
import { reportError, reportMessage, addBreadcrumb, withSentryPerformance } from '@/lib/utils/error-reporting'

// Report errors
reportError(error, { userId: 'user123', feature: 'chat', model: 'gpt-4' })

// Performance monitoring
await withSentryPerformance('api-call', async () => {
  return await fetch('/api/chat')
}, { feature: 'chat' })
```

## Production Deployment
All environment variables configured in Vercel. Sentry will automatically optimize for production with reduced sampling and disabled debug logging.