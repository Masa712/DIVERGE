# Supabase Storage Setup Guide

## Profile Images Storage Configuration

### 1. Create Storage Bucket

1. Go to your Supabase Dashboard
2. Navigate to **Storage** section
3. Click **Create Bucket**
4. Configure as follows:

```
Bucket name: avatars
Public bucket: ✅ Yes (for CDN access)
File size limit: 5MB
Allowed MIME types: image/jpeg, image/png, image/gif, image/webp
```

### 2. Set Up Storage Policies

Run these SQL commands in Supabase SQL Editor:

```sql
-- Storage policies for avatars bucket
INSERT INTO storage.policies (bucket_id, name, definition, action)
VALUES 
  ('avatars', 'Users can upload their own avatar', 
   'auth.uid() = owner', 'INSERT'),
  ('avatars', 'Users can update their own avatar', 
   'auth.uid() = owner', 'UPDATE'),
  ('avatars', 'Anyone can view avatars', 
   'true', 'SELECT'),
  ('avatars', 'Users can delete their own avatar',
   'auth.uid() = owner', 'DELETE');
```

### 3. Profile Image Upload Function

```sql
-- Function to get avatar URL
CREATE OR REPLACE FUNCTION get_avatar_url(user_id UUID)
RETURNS TEXT AS $$
DECLARE
  base_url TEXT;
BEGIN
  SELECT 
    CASE 
      WHEN avatar_url IS NOT NULL THEN avatar_url
      WHEN avatar_url LIKE 'avatars/%' THEN 
        format('%s/storage/v1/object/public/%s', 
          current_setting('app.supabase_url'), avatar_url)
      ELSE NULL
    END INTO base_url
  FROM user_profiles
  WHERE id = user_id;
  
  RETURN base_url;
END;
$$ LANGUAGE plpgsql;
```

### 4. Environment Variables

Add to your `.env.local`:

```bash
# Storage
NEXT_PUBLIC_SUPABASE_STORAGE_URL=https://[PROJECT_ID].supabase.co/storage/v1
NEXT_PUBLIC_AVATAR_MAX_SIZE=5242880 # 5MB in bytes
```

### 5. Frontend Helper Functions

Create `/src/lib/storage/avatars.ts`:

```typescript
import { createClient } from '@/lib/supabase/client'

export async function uploadAvatar(userId: string, file: File) {
  const supabase = createClient()
  const fileExt = file.name.split('.').pop()
  const fileName = `${userId}-${Date.now()}.${fileExt}`
  const filePath = `avatars/${fileName}`

  const { data, error } = await supabase.storage
    .from('avatars')
    .upload(filePath, file, {
      upsert: true,
      cacheControl: '3600',
    })

  if (error) throw error

  // Update user profile with new avatar URL
  const { error: updateError } = await supabase
    .from('user_profiles')
    .update({ avatar_url: filePath })
    .eq('id', userId)

  if (updateError) throw updateError

  return data.path
}

export function getAvatarUrl(path: string) {
  if (!path) return '/default-avatar.png'
  if (path.startsWith('http')) return path
  
  const supabase = createClient()
  return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl
}
```

## Recommended Profile Fields

Beyond `display_name` and `avatar_url`, consider adding:

1. **Bio/Description** - Short user description
2. **Timezone** - For collaboration scheduling
3. **Preferred Language** - For UI localization
4. **Notification Preferences** - Email, in-app settings
5. **Privacy Settings** - Profile visibility
6. **Social Links** - GitHub, Twitter, LinkedIn
7. **AI Preferences** - Default model, temperature
8. **Theme Preferences** - Dark/light mode

These are already included in the migration file `010_prepare_for_production.sql`.