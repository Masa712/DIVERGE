# OAuth Custom Domain Configuration Guide

## Issue Overview
When deploying to Vercel with a custom domain, OAuth authentication (Google, X/Twitter, Apple) returns 404 errors while email/password authentication works fine.

## Root Cause
OAuth providers redirect to callback URLs that must be pre-registered. When switching from Vercel domain (`*.vercel.app`) to custom domain, these callback URLs need to be updated in multiple locations.

## Solution Requirements

### 1. Supabase Dashboard Configuration
**Location**: Supabase Dashboard → Authentication → URL Configuration

**Required Settings**:
```
Site URL: https://your-custom-domain.com

Redirect URLs (Add all):
- https://your-custom-domain.com/auth/callback
- https://www.your-custom-domain.com/auth/callback
- https://your-app.vercel.app/auth/callback (keep existing)
```

### 2. OAuth Provider Settings

#### Google Cloud Console
- Navigate to: APIs & Services → Credentials → OAuth 2.0 Client ID
- Add to Authorized redirect URIs:
  ```
  https://YOUR_SUPABASE_PROJECT_ID.supabase.co/auth/v1/callback
  ```

#### X/Twitter Developer Portal
- Navigate to: Project → Authentication settings
- Add to Callback URLs:
  ```
  https://YOUR_SUPABASE_PROJECT_ID.supabase.co/auth/v1/callback
  ```

#### Apple Developer Portal
- Navigate to: Certificates, Identifiers & Profiles → Service IDs
- Add to Return URLs:
  ```
  https://YOUR_SUPABASE_PROJECT_ID.supabase.co/auth/v1/callback
  ```

### 3. Vercel Environment Variables (Optional)
Add to Vercel Dashboard → Settings → Environment Variables:
```
NEXT_PUBLIC_BASE_URL = https://your-custom-domain.com
```

## Important Notes
- Keep both Vercel domain and custom domain URLs in Supabase configuration
- Changes may take a few minutes to propagate
- Clear browser cache/cookies after configuration changes
- Test in incognito/private browsing mode first

## Debugging Tips
1. Check OAuth redirect_uri parameter in browser Network tab
2. Verify Supabase URL is correctly set in environment variables
3. Ensure all provider dashboards have been updated
4. Check for typos in domain URLs (https vs http, www vs non-www)

## Common Errors
- `404: NOT_FOUND` - Missing callback URL configuration
- `redirect_uri_mismatch` - URL mismatch between provider and Supabase
- `DEPLOYMENT_NOT_FOUND` - DNS propagation or Vercel domain configuration issue

## Resolution Confirmation
Once properly configured, users should be able to:
- Login via OAuth on custom domain
- Get redirected back to custom domain after authentication
- Maintain session across domain navigation