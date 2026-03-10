import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";

export const dynamic = "force-dynamic";

const REDIRECT_URI = "https://ai-dash.0xqube.xyz/api/auth/tiktok/callback";
const RESULT_BASE = "https://ai-dash.0xqube.xyz/auth/tiktok/result";

interface TikTokTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  open_id?: string;
  error?: string;
  error_description?: string;
}

interface TikTokUserInfoResponse {
  data?: {
    user?: {
      open_id: string;
      display_name: string;
    };
  };
  error?: {
    code: string;
    message: string;
  };
}

interface AccountRow {
  account_id: string;
}

interface SettingRow {
  setting_value: unknown;
}

interface NextNumRow {
  next_num: string;
}

function buildResultUrl(params: Record<string, string>): string {
  const url = new URL(RESULT_BASE);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return url.toString();
}

export async function GET(request: NextRequest) {
  const base = request.nextUrl;
  const code = base.searchParams.get("code");
  const state = base.searchParams.get("state");

  if (!code || !state) {
    const r = NextResponse.redirect(
      buildResultUrl({ success: "false", error: "missing_params" })
    );
    r.cookies.delete("tiktok_oauth_nonce");
    return r;
  }

  // Decode state
  let platformUsername = "";
  let characterId = "";
  let stateNonce = "";
  try {
    const decoded = JSON.parse(Buffer.from(state, "base64").toString("utf-8")) as {
      platform_username?: string;
      character_id?: string;
      nonce?: string;
    };
    platformUsername = decoded.platform_username ?? "";
    characterId = decoded.character_id ?? "";
    stateNonce = decoded.nonce ?? "";
  } catch {
    const r = NextResponse.redirect(
      buildResultUrl({ success: "false", error: "invalid_state" })
    );
    r.cookies.delete("tiktok_oauth_nonce");
    return r;
  }

  // Verify CSRF nonce against httpOnly cookie set by /api/auth/tiktok/initiate
  const cookieNonce = request.cookies.get("tiktok_oauth_nonce")?.value;
  if (!cookieNonce || cookieNonce !== stateNonce) {
    console.error("[tiktok-callback] CSRF nonce mismatch — possible CSRF attack");
    const csrfResponse = NextResponse.redirect(
      buildResultUrl({ success: "false", error: "csrf_mismatch" })
    );
    csrfResponse.cookies.delete("tiktok_oauth_nonce");
    return csrfResponse;
  }

  // Get credentials from system_settings
  // setting_value is jsonb — pg driver auto-parses to plain string, no manual unquoting needed
  const clientKeySetting = await queryOne<SettingRow>(
    `SELECT setting_value FROM system_settings WHERE setting_key = 'TIKTOK_CLIENT_KEY'`
  );
  const clientSecretSetting = await queryOne<SettingRow>(
    `SELECT setting_value FROM system_settings WHERE setting_key = 'TIKTOK_CLIENT_SECRET'`
  );

  if (!clientKeySetting || !clientSecretSetting) {
    console.error("[tiktok-callback] TIKTOK_CLIENT_KEY or TIKTOK_CLIENT_SECRET not found in system_settings");
    const r = NextResponse.redirect(
      buildResultUrl({ success: "false", error: "missing_credentials" })
    );
    r.cookies.delete("tiktok_oauth_nonce");
    return r;
  }

  const clientKey = String(clientKeySetting.setting_value);
  const clientSecret = String(clientSecretSetting.setting_value);

  // Exchange code for tokens
  let tokenData: TikTokTokenResponse;
  try {
    const tokenRes = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_key: clientKey,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: REDIRECT_URI,
      }),
    });
    tokenData = (await tokenRes.json()) as TikTokTokenResponse;
  } catch (err) {
    console.error("[tiktok-callback] Token exchange network error:", err);
    const r = NextResponse.redirect(
      buildResultUrl({ success: "false", error: "token_exchange_failed" })
    );
    r.cookies.delete("tiktok_oauth_nonce");
    return r;
  }

  if (tokenData.error) {
    console.error(`[tiktok-callback] Token exchange API error: ${tokenData.error} — ${tokenData.error_description}`);
    const r = NextResponse.redirect(
      buildResultUrl({ success: "false", error: "token_exchange_failed" })
    );
    r.cookies.delete("tiktok_oauth_nonce");
    return r;
  }

  // Validate all required token fields are present
  const { access_token, refresh_token, expires_in, open_id } = tokenData;
  if (!access_token || !refresh_token || !open_id || !expires_in) {
    console.error("[tiktok-callback] Incomplete token response:", JSON.stringify(tokenData));
    const r = NextResponse.redirect(
      buildResultUrl({ success: "false", error: "incomplete_token_response" })
    );
    r.cookies.delete("tiktok_oauth_nonce");
    return r;
  }

  // Get user info (display_name) — non-fatal fallback to platform_username
  let displayName = platformUsername;
  try {
    const userRes = await fetch(
      "https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name",
      { headers: { Authorization: `Bearer ${access_token}` } }
    );
    const userData = (await userRes.json()) as TikTokUserInfoResponse;
    if (userData.data?.user?.display_name) {
      displayName = userData.data.user.display_name;
    }
  } catch (err) {
    console.warn("[tiktok-callback] User info fetch failed, using platform_username:", err);
  }

  const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString();
  const authCredentials = {
    oauth: { access_token, refresh_token, expires_at: expiresAt },
    open_id,
  };

  // Upsert account
  let accountId: string;
  try {
    const existing = await queryOne<AccountRow>(
      `SELECT account_id FROM accounts WHERE platform = 'tiktok' AND auth_credentials->>'open_id' = $1`,
      [open_id]
    );

    if (existing) {
      accountId = existing.account_id;
      await query(
        `UPDATE accounts
         SET auth_credentials = $1::jsonb,
             platform_username = $2,
             status = 'active',
             updated_at = NOW()
         WHERE account_id = $3`,
        [JSON.stringify(authCredentials), displayName || platformUsername, accountId]
      );
    } else {
      // Generate next account_id
      const nextRow = await queryOne<NextNumRow>(
        `SELECT COALESCE(MAX(SUBSTRING(account_id FROM 5)::integer), 0) + 1 AS next_num
         FROM accounts WHERE account_id ~ '^ACC_[0-9]{4}$'`
      );
      const nextNum = parseInt(nextRow?.next_num ?? "1", 10);
      accountId = "ACC_" + String(nextNum).padStart(4, "0");

      await query(
        `INSERT INTO accounts (account_id, platform, platform_username, character_id, status, auth_credentials, created_at, updated_at)
         VALUES ($1, 'tiktok', $2, $3, 'active', $4::jsonb, NOW(), NOW())`,
        [accountId, displayName || platformUsername, characterId || null, JSON.stringify(authCredentials)]
      );
    }
  } catch (err) {
    console.error("[tiktok-callback] DB upsert error:", err);
    const r = NextResponse.redirect(
      buildResultUrl({ success: "false", error: "db_error" })
    );
    r.cookies.delete("tiktok_oauth_nonce");
    return r;
  }

  // Delete CSRF nonce cookie after successful auth
  const successResponse = NextResponse.redirect(
    buildResultUrl({
      success: "true",
      account_id: accountId,
      username: displayName || platformUsername,
    })
  );
  successResponse.cookies.delete("tiktok_oauth_nonce");
  return successResponse;
}
