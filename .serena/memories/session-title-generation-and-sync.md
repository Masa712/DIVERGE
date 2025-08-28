# AI-Generated Session Titles and Real-time Synchronization

## Overview
Implemented AI-powered session title generation and real-time synchronization between frontend and backend for the Diverge application.

## Key Features Implemented

### 1. AI Title Generation
- **Endpoint**: `/api/sessions/generate-title`
- **Model**: OpenRouter API with GPT-4o (`openai/gpt-4o-2024-11-20`)
- **Timing**: Automatically generates title after first AI response in a new session
- **Location**: `src/app/api/sessions/generate-title/route.ts`

### 2. Real-time Title Updates
- **Polling System**: Monitors session changes and updates UI without page refresh
- **Polling Intervals**: 
  - Initial: 500ms
  - First 10 attempts: 1 second
  - After 10 attempts: 3 seconds
- **Implementation**: `src/app/chat/page.tsx` (pollNodeStatus function)

### 3. Session Synchronization
- **Immediate UI Updates**: New sessions appear instantly in sidebar
- **Periodic Sync**: Every 30 seconds to catch any inconsistencies
- **Event-based Sync**: Custom event `session-sync-needed` for cross-component communication
- **Location**: `src/components/layout/left-sidebar.tsx`

### 4. Database Connection Pool Optimization
- **Increased Capacity**: From 10 to 20 connections
- **File**: `src/lib/supabase/connection-pool.ts`
- **Prevents**: "Connection pool at capacity" errors

### 5. Error Handling Improvements
- **404 Handling**: Gracefully handles non-existent sessions
- **UI Cleanup**: Removes orphaned sessions from UI when not in database
- **Detailed Logging**: Comprehensive console logs for debugging

## Technical Implementation Details

### Title Generation Flow
1. User sends first message to new session
2. AI response is generated
3. If `depth === 0` and no `parentNodeId`, title generation is triggered
4. Title API uses first 500 chars of response for context
5. Database is updated with new title
6. Query cache is cleared to ensure fresh data
7. Polling detects title change and updates UI

### Session Creation Flow
1. User clicks "New Session"
2. Session created with "New Chat" placeholder
3. Session immediately added to UI state
4. Background fetch ensures database consistency
5. User's first message triggers AI title generation
6. Title updates propagate through polling

### Cache Management
- Query cache cleared after title updates
- Session API configured with `skipCache: true` for fresh data
- Redis cache integration for distributed systems

## Files Modified
- `src/app/chat/page.tsx` - Added polling and title update detection
- `src/app/api/chat/route.ts` - Integrated title generation after AI response
- `src/app/api/sessions/[id]/route.ts` - Disabled caching for fresh data
- `src/app/api/sessions/generate-title/route.ts` - New endpoint for title generation
- `src/components/layout/left-sidebar.tsx` - Added instant UI updates and sync mechanisms
- `src/lib/supabase/connection-pool.ts` - Increased connection pool capacity

## Debugging Console Logs
- `✅ Session created` - New session successfully created
- `📝 Added new session to sidebar` - UI updated
- `🔍 Polling check` - Title comparison during polling
- `✨ Session title updated` - Title successfully updated
- `🔄 Updating sidebar session` - Sidebar reflecting new title
- `🔄 Periodic session sync` - 30-second sync triggered

## Known Issues Resolved
- Session list not updating after creation
- Titles requiring manual page refresh
- Connection pool capacity errors
- Database/UI synchronization issues
- Orphaned sessions in UI

## Future Improvements
- Consider WebSocket for real-time updates instead of polling
- Optimize polling intervals based on user activity
- Add retry logic for failed title generations
- Implement optimistic UI updates for better UX