# Social Login Setup Guide for Diverge

This guide explains how to configure OAuth providers (Google, X/Twitter, Apple) in Supabase for social login functionality.

## Prerequisites

- Access to your Supabase project dashboard
- Developer accounts for each OAuth provider you want to enable

## Important URLs

Your callback URL for all providers will be:
```
https://YOUR_PROJECT_ID.supabase.co/auth/v1/callback
```

For local development:
```
http://localhost:3000/auth/callback
```

## 1. Google OAuth Setup

### Step 1: Create Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Navigate to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth client ID**
5. Select **Web application**
6. Add the following:
   - **Authorized JavaScript origins**:
     - `https://YOUR_PROJECT_ID.supabase.co`
     - `http://localhost:3000` (for local development)
   - **Authorized redirect URIs**:
     - `https://YOUR_PROJECT_ID.supabase.co/auth/v1/callback`
     - `http://localhost:3000/auth/callback` (for local development)
7. Save and copy your **Client ID** and **Client Secret**

### Step 2: Configure in Supabase

1. Go to your [Supabase Dashboard](https://app.supabase.com)
2. Navigate to **Authentication** → **Providers**
3. Find **Google** and click **Enable**
4. Enter your:
   - **Client ID** (from Google)
   - **Client Secret** (from Google)
5. Save the configuration

## 2. X (Twitter) OAuth Setup

### Step 1: Create X Developer App

1. Go to [X Developer Portal](https://developer.twitter.com/en/portal/dashboard)
2. Apply for a developer account if you don't have one
3. Create a new app or use an existing one
4. In your app dashboard, go to the **Settings** tab

### Step 2: Configure App Settings

1. Under **App Settings**, click **Set up** for **User authentication settings**
2. Configure the following:
   - **App permissions**: Read
   - **Type of App**: Web App
   - **App info**:
     - **Callback URI / Redirect URL**: `https://YOUR_PROJECT_ID.supabase.co/auth/v1/callback`
     - **Website URL**: Your application URL
3. Save your settings

### Step 3: Get API Keys

1. Go to the **Keys and tokens** tab
2. Copy your **API Key** (Client ID)
3. Copy your **API Key Secret** (Client Secret)
4. If regenerating tokens, make sure to update Supabase configuration

### Step 4: Configure in Supabase

1. In Supabase Dashboard, go to **Authentication** → **Providers**
2. Find **Twitter** and click **Enable**
3. Enter your:
   - **API Key** (as Client ID)
   - **API Key Secret** (as Client Secret)
4. Save the configuration

## 3. Apple OAuth Setup

### Step 1: Apple Developer Account Setup

1. Go to [Apple Developer](https://developer.apple.com)
2. Navigate to **Certificates, Identifiers & Profiles**
3. Create a new **App ID**:
   - Platform: iOS (even for web apps)
   - Description: Diverge
   - Bundle ID: com.yourcompany.diverge
   - Enable **Sign In with Apple**
4. Create a new **Service ID**:
   - Description: Diverge Web
   - Identifier: com.yourcompany.diverge.web
   - Enable **Sign In with Apple**
   - Configure domains:
     - Domain: `YOUR_PROJECT_ID.supabase.co`
     - Return URL: `https://YOUR_PROJECT_ID.supabase.co/auth/v1/callback`
5. Create a new **Key**:
   - Enable **Sign In with Apple**
   - Download the `.p8` file (keep it secure!)

### Step 2: Configure in Supabase

1. In Supabase Dashboard, go to **Authentication** → **Providers**
2. Find **Apple** and click **Enable**
3. Enter your:
   - **Service ID** (Identifier from Step 1.4)
   - **Team ID** (found in Apple Developer account)
   - **Key ID** (from the Key you created)
   - **Private Key** (contents of the `.p8` file)
4. Save the configuration

## 4. Supabase URL Configuration

### Update Redirect URLs

1. In Supabase Dashboard, go to **Authentication** → **URL Configuration**
2. Add your application URLs to:
   - **Site URL**: `https://your-app-domain.com` or `http://localhost:3000`
   - **Redirect URLs**:
     - `http://localhost:3000/auth/callback`
     - `https://your-production-domain.com/auth/callback`
     - Add any other environments (staging, preview, etc.)

## 5. Environment Variables

Make sure your `.env.local` file has the correct Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## Testing

1. **Local Testing**:
   - Ensure `http://localhost:3000` is in your OAuth provider's allowed origins
   - Test each provider login button
   - Verify successful redirect to `/chat` after authentication

2. **Production Testing**:
   - Deploy your application
   - Update OAuth providers with production URLs
   - Test each provider in production environment

## Troubleshooting

### Common Issues

1. **"Redirect URI mismatch"**:
   - Ensure the redirect URI in your OAuth provider matches exactly with Supabase
   - Check for trailing slashes or protocol differences (http vs https)

2. **"Invalid client"**:
   - Verify Client ID and Client Secret are correctly copied
   - Ensure the OAuth provider is enabled in Supabase

3. **X (Twitter) OAuth issues**:
   - Ensure your X Developer app has the correct callback URL
   - Verify API keys are correctly copied to Supabase
   - Check that your X Developer account has the necessary permissions

4. **Apple Sign In not working**:
   - Verify all Apple certificates and keys are valid
   - Ensure Service ID matches exactly
   - Check that domains are verified in Apple Developer Console

5. **User not redirected after login**:
   - Check that `/auth/callback` route is properly implemented
   - Verify Site URL and Redirect URLs in Supabase settings

## Security Notes

1. **Never commit OAuth credentials** to version control
2. **Use environment variables** for all sensitive configuration
3. **Regularly rotate** OAuth client secrets
4. **Monitor** OAuth app usage in provider dashboards
5. **Implement rate limiting** for authentication endpoints

## Additional Resources

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [X API Documentation](https://developer.twitter.com/en/docs/authentication/oauth-2-0)
- [Apple Sign In Documentation](https://developer.apple.com/sign-in-with-apple/)

## Support

If you encounter issues:
1. Check Supabase Dashboard logs
2. Verify all URLs match exactly
3. Ensure OAuth providers are properly configured
4. Test with browser developer tools open to see any error messages