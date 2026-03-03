-- Migration 011: YouTube OAuth app credentials
-- Moves client_id / client_secret from per-account auth_credentials
-- to system_settings where they belong (app-level, shared across all accounts).

INSERT INTO system_settings (setting_key, setting_value, category, description, default_value, value_type)
VALUES
  (
    'YOUTUBE_CLIENT_ID',
    '"YOUTUBE_CLIENT_ID_REMOVED"',
    'credentials',
    'YouTube OAuth2 client ID (app-level, shared across all YouTube accounts)',
    '""',
    'string'
  ),
  (
    'YOUTUBE_CLIENT_SECRET',
    '"YOUTUBE_CLIENT_SECRET_REMOVED"',
    'credentials',
    'YouTube OAuth2 client secret (app-level, shared across all YouTube accounts)',
    '""',
    'string'
  )
ON CONFLICT (setting_key) DO UPDATE
  SET setting_value = EXCLUDED.setting_value,
      updated_at    = NOW();
