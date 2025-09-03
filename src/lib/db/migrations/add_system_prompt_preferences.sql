-- Add system prompt preferences to user_profiles table
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS system_prompt_preset VARCHAR(50) DEFAULT 'default',
ADD COLUMN IF NOT EXISTS system_prompt_style VARCHAR(20) DEFAULT 'friendly',
ADD COLUMN IF NOT EXISTS system_prompt_language VARCHAR(20) DEFAULT 'auto',
ADD COLUMN IF NOT EXISTS system_prompt_format VARCHAR(20) DEFAULT 'markdown',
ADD COLUMN IF NOT EXISTS system_prompt_specializations TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS custom_instructions TEXT,
ADD COLUMN IF NOT EXISTS system_prompt_enabled BOOLEAN DEFAULT true;

-- Add comments for documentation
COMMENT ON COLUMN user_profiles.system_prompt_preset IS 'Preset configuration: default, technical, business, creative, educational';
COMMENT ON COLUMN user_profiles.system_prompt_style IS 'Response style: professional, friendly, concise, detailed';
COMMENT ON COLUMN user_profiles.system_prompt_language IS 'Language preference: auto, en, ja, multilingual';
COMMENT ON COLUMN user_profiles.system_prompt_format IS 'Output format: markdown, plain, structured';
COMMENT ON COLUMN user_profiles.system_prompt_specializations IS 'Array of specialization areas';
COMMENT ON COLUMN user_profiles.custom_instructions IS 'User-defined custom instructions for AI';
COMMENT ON COLUMN user_profiles.system_prompt_enabled IS 'Whether to use custom system prompt settings';