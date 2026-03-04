-- 010: Auth settings for Google OAuth (NextAuth.js)
-- Adds email whitelist and role mapping to system_settings

INSERT INTO system_settings (setting_key, setting_value, category, description, default_value, value_type)
VALUES
  ('AUTH_ALLOWED_EMAILS', '["pochi@0xqube.xyz", "zach@0xqube.xyz", "badhan@0xqube.xyz", "T.S.0131.1998@gmail.com"]'::jsonb, 'dashboard',
   'JSON array of email addresses allowed to sign in via Google OAuth',
   '[]'::jsonb, 'json'),
  ('AUTH_USER_ROLES', '{"pochi@0xqube.xyz": "admin", "zach@0xqube.xyz": "viewer", "badhan@0xqube.xyz": "viewer", "T.S.0131.1998@gmail.com": "viewer"}'::jsonb, 'dashboard',
   'JSON object mapping email addresses to roles (admin or viewer)',
   '{}'::jsonb, 'json')
ON CONFLICT (setting_key) DO UPDATE
  SET setting_value = EXCLUDED.setting_value,
      description = EXCLUDED.description;
