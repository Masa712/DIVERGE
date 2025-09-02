# User Settings Implementation

This memory documents the implementation of user settings functionality for the Diverge chat application.

## Overview
Added comprehensive user settings functionality including profile management, password changes, and AI model configuration with full integration into the chat system.

## Database Schema

### User Profiles Table
- **Migration**: `011_add_user_profiles.sql` and `012_add_missing_columns.sql`
- **Table**: `user_profiles`
- **Key Fields**:
  - `display_name`: User's display name
  - `default_model`: Default AI model selection
  - `default_temperature`: Default temperature setting (0-2)
  - `default_max_tokens`: Default max tokens (1-100,000)
  - `preferences`: JSONB field for additional settings

### RLS Security
- Row Level Security enabled with policies for SELECT, INSERT, UPDATE, DELETE
- Users can only access their own profile data
- Automatic profile creation on user signup via database triggers

## API Endpoints

### `/api/profile` (GET/PATCH)
- **GET**: Fetches user profile with automatic creation if not exists
- **PATCH**: Updates profile with comprehensive validation
- **Validation**: Temperature (0-2), Max tokens (1-100,000), Display name (non-empty)
- **Error Handling**: Uses `withErrorHandler` wrapper for consistent error responses

### `/api/profile/password` (POST)
- **Password Change**: Validates current password before updating
- **Security**: Requires current password verification via Supabase Auth
- **Validation**: Minimum 6 characters, must be different from current

## Frontend Implementation

### Settings Page (`/app/settings/page.tsx`)
- **Three-tab interface**: Profile, Password, AI Model
- **Glassmorphism design**: Consistent with app's visual style
- **Real-time validation**: Client-side form validation and error handling
- **Interactive controls**: Sliders for temperature and max tokens with live preview

### Chat Integration (`/app/chat/page.tsx`)
- **Profile loading**: Fetches user profile on component mount
- **Default model**: Sets selected model from user preferences
- **Parameter passing**: Sends temperature and max_tokens from profile to API

### Navigation (`/components/layout/left-sidebar.tsx`)
- **Settings access**: Added settings button in both collapsed and expanded states
- **Icon integration**: Uses Heroicons for consistent UI

## Chat API Enhancement (`/api/chat/route.ts`)
- **Profile fallback**: Fetches user profile when temperature/max_tokens not provided
- **Database integration**: Queries user_profiles table for defaults
- **Graceful handling**: Falls back to hardcoded defaults if profile fetch fails

## Key Features

### User Experience
1. **Seamless integration**: Settings changes immediately apply to new chat messages
2. **Persistent preferences**: User settings saved across sessions
3. **Intuitive controls**: Slider-based controls for temperature and token limits
4. **Visual feedback**: Success/error messages with automatic dismissal

### Technical Architecture
1. **Type safety**: Full TypeScript integration with proper interfaces
2. **Error handling**: Comprehensive error handling at all levels
3. **Performance**: Efficient database queries with proper indexing
4. **Security**: RLS policies ensure data privacy and access control

## Configuration Limits

### Max Tokens
- **UI Range**: 100 - 16,000 tokens (slider control)
- **API Maximum**: 100,000 tokens (validation limit)
- **Default**: 1,000 tokens

### Temperature
- **Range**: 0.0 - 2.0 (0.1 increments)
- **Default**: 0.7
- **Labels**: Precise (0) → Balanced (1) → Creative (2)

## Files Modified/Created

### Database
- `supabase/migrations/011_add_user_profiles.sql`
- `supabase/migrations/012_add_missing_columns.sql`

### API Routes
- `src/app/api/profile/route.ts` (new)
- `src/app/api/profile/password/route.ts` (new)
- `src/app/api/chat/route.ts` (enhanced)

### Frontend Components
- `src/app/settings/page.tsx` (new)
- `src/app/chat/page.tsx` (enhanced)
- `src/components/layout/left-sidebar.tsx` (enhanced)

## Testing Status
- ✅ Profile creation and updates working
- ✅ Password changes functional
- ✅ AI model settings properly applied to chat generation
- ✅ Settings persistence across sessions
- ✅ Database RLS policies working correctly
- ✅ Error handling and validation working

## Future Enhancements
- Theme preferences (dark/light mode)
- Advanced AI prompt templates
- Usage statistics and analytics
- Export/import settings functionality