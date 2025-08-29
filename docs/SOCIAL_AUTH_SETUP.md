# Social Authentication Setup Guide

## Overview
Configure OAuth providers for Google, GitHub, and Apple Sign-In.

## 1. Google OAuth Setup

### Google Cloud Console
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable **Google+ API**
4. Go to **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
5. Configure:
   ```
   Application type: Web application
   Authorized redirect URIs:
   - https://[YOUR-SUPABASE-PROJECT].supabase.co/auth/v1/callback
   - http://localhost:3000/auth/callback (for development)
   ```

### Supabase Configuration
1. Go to Supabase Dashboard → **Authentication** → **Providers**
2. Enable **Google**
3. Add your Client ID and Client Secret
4. Save

### Environment Variables
```bash
# .env.local
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_client_id
```

## 2. GitHub OAuth Setup

### GitHub Developer Settings
1. Go to GitHub → **Settings** → **Developer settings** → **OAuth Apps**
2. Click **New OAuth App**
3. Configure:
   ```
   Application name: Diverge
   Homepage URL: https://your-domain.com
   Authorization callback URL: 
   https://[YOUR-SUPABASE-PROJECT].supabase.co/auth/v1/callback
   ```

### Supabase Configuration
1. Enable **GitHub** provider
2. Add Client ID and Client Secret
3. Configure scopes: `user:email`

## 3. Apple Sign-In Setup

### Apple Developer Account
1. Go to [Apple Developer](https://developer.apple.com/)
2. Create an **App ID** with Sign in with Apple capability
3. Create a **Service ID** for web authentication
4. Configure:
   ```
   Domains: your-domain.com
   Return URLs: 
   https://[YOUR-SUPABASE-PROJECT].supabase.co/auth/v1/callback
   ```

### Generate Private Key
1. Go to **Keys** → **Create a Key**
2. Enable **Sign in with Apple**
3. Download the .p8 file

### Supabase Configuration
1. Enable **Apple** provider
2. Add:
   - Service ID (Client ID)
   - Team ID
   - Key ID
   - Private Key (contents of .p8 file)

## 4. Implementation Code

### Auth Component Update
```typescript
// src/components/auth/social-login.tsx
import { createClient } from '@/lib/supabase/client'

export function SocialLogin() {
  const supabase = createClient()

  const handleOAuthLogin = async (provider: 'google' | 'github' | 'apple') => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: provider === 'github' ? 'user:email' : undefined,
      },
    })
    
    if (error) console.error('OAuth error:', error)
  }

  return (
    <div className="space-y-3">
      <button
        onClick={() => handleOAuthLogin('google')}
        className="w-full flex items-center justify-center gap-3 px-4 py-2 border rounded-lg hover:bg-gray-50"
      >
        <GoogleIcon />
        Continue with Google
      </button>
      
      <button
        onClick={() => handleOAuthLogin('github')}
        className="w-full flex items-center justify-center gap-3 px-4 py-2 border rounded-lg hover:bg-gray-50"
      >
        <GitHubIcon />
        Continue with GitHub
      </button>
      
      <button
        onClick={() => handleOAuthLogin('apple')}
        className="w-full flex items-center justify-center gap-3 px-4 py-2 border rounded-lg hover:bg-gray-50"
      >
        <AppleIcon />
        Continue with Apple
      </button>
    </div>
  )
}
```

### Callback Handler
```typescript
// src/app/auth/callback/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')

  if (code) {
    const supabase = createClient()
    await supabase.auth.exchangeCodeForSession(code)
  }

  return NextResponse.redirect(new URL('/chat', requestUrl.origin))
}
```

### Profile Sync on OAuth Login
```sql
-- Trigger to sync OAuth profile data
CREATE OR REPLACE FUNCTION sync_oauth_profile()
RETURNS TRIGGER AS $$
BEGIN
  -- Update profile with OAuth data
  UPDATE user_profiles
  SET 
    display_name = COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      display_name
    ),
    avatar_url = COALESCE(
      NEW.raw_user_meta_data->>'avatar_url',
      NEW.raw_user_meta_data->>'picture',
      avatar_url
    ),
    settings = jsonb_set(
      COALESCE(settings, '{}'::jsonb),
      '{oauth_provider}',
      to_jsonb(NEW.raw_app_meta_data->>'provider')
    )
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sync_oauth_on_login
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  WHEN (OLD.last_sign_in_at IS DISTINCT FROM NEW.last_sign_in_at)
  EXECUTE FUNCTION sync_oauth_profile();
```

## 5. Testing Checklist

- [ ] Google login works and syncs profile
- [ ] GitHub login works and gets email
- [ ] Apple login works (test on Safari)
- [ ] Profile image from OAuth is saved
- [ ] Display name from OAuth is used
- [ ] Existing users can link accounts
- [ ] New users auto-create profiles

## 6. Security Considerations

1. **Redirect URLs**: Always validate redirect URLs
2. **State Parameter**: Use for CSRF protection
3. **Scope Limitations**: Request minimal scopes
4. **Token Storage**: Never store tokens client-side
5. **Rate Limiting**: Implement on callback endpoint

## 7. Deployment Notes

For production:
1. Update all redirect URLs to production domain
2. Verify all OAuth apps are in production mode
3. Set up proper error handling and logging
4. Monitor OAuth quota limits
5. Implement fallback for OAuth failures