-- Add missing columns to existing user_profiles table
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS default_model TEXT,
ADD COLUMN IF NOT EXISTS default_temperature FLOAT DEFAULT 0.7,
ADD COLUMN IF NOT EXISTS default_max_tokens INTEGER DEFAULT 1000;