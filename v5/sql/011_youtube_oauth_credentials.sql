-- Migration 011: YouTube OAuth app credentials
-- Moves client_id / client_secret from per-account auth_credentials
-- to system_settings where they belong (app-level, shared across all accounts).

INSERT INTO system_settings (setting_key, setting_value, category, description, default_value, value_type)
VALUES
  (
    'YOUTUBE_CLIENT_ID',
    '""',  -- Set actual value via dashboard Settings → credentials → YOUTUBE_CLIENT_ID
    'credentials',
    'YouTube OAuth2 client ID (app-level, shared across all YouTube accounts)',
    '""',
    'string'
  ),
  (
    'YOUTUBE_CLIENT_SECRET',
    '""',  -- Set actual value via dashboard Settings → credentials → YOUTUBE_CLIENT_SECRET
    'credentials',
    'YouTube OAuth2 client secret (app-level, shared across all YouTube accounts)',
    '""',
    'string'
  )
ON CONFLICT (setting_key) DO UPDATE
  SET setting_value = EXCLUDED.setting_value,
      updated_at    = NOW();
