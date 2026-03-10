import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";

export const dynamic = "force-dynamic";

const REDIRECT_URI = "https://ai-dash.0xqube.xyz/api/auth/youtube/callback";
const RESULT_BASE = "https://ai-dash.0xqube.xyz/auth/youtube/result";

interface SettingRow { setting_value: unknown; }
interface AccountRow { account_id: string; }
interface NextNumRow { next_num: string; }
interface YouTubeTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
}
interface YouTubeChannelResponse {
  items?: Array<{
    id: string;
    snippet?: { title?: string };
  }>;
}

function buildResultUrl(params: Record<string, string>): string {
  const url = new URL(RESULT_BASE);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return url.toString();
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (!code || !state) {
    const r = NextResponse.redirect(buildResultUrl({ success: "false", error: "missing_params" }));
    r.cookies.delete("youtube_oauth_nonce");
    return r;
  }

  // Decode state and verify CSRF nonce
  let stateNonce = "";
  try {
    const decoded = JSON.parse(Buffer.from(state, "base64").toString("utf-8")) as { nonce?: string };
    stateNonce = decoded.nonce ?? "";
  } catch {
    const r = NextResponse.redirect(buildResultUrl({ success: "false", error: "invalid_state" }));
    r.cookies.delete("youtube_oauth_nonce");
    return r;
  }

  const cookieNonce = request.cookies.get("youtube_oauth_nonce")?.value;
  if (!cookieNonce || cookieNonce !== stateNonce) {
    console.error("[youtube-callback] CSRF nonce mismatch");
    const r = NextResponse.redirect(buildResultUrl({ success: "false", error: "csrf_mismatch" }));
    r.cookies.delete("youtube_oauth_nonce");
    return r;
  }

  // Get credentials from system_settings
  const clientIdSetting = await queryOne<SettingRow>(
    `SELECT setting_value FROM system_settings WHERE setting_key = 'YOUTUBE_CLIENT_ID'`
  );
  const clientSecretSetting = await queryOne<SettingRow>(
    `SELECT setting_value FROM system_settings WHERE setting_key = 'YOUTUBE_CLIENT_SECRET'`
  );
  if (!clientIdSetting || !clientSecretSetting) {
    const r = NextResponse.redirect(buildResultUrl({ success: "false", error: "missing_credentials" }));
    r.cookies.delete("youtube_oauth_nonce");
    return r;
  }
  const clientId = String(clientIdSetting.setting_value);
  const clientSecret = String(clientSecretSetting.setting_value);

  // Exchange code for tokens
  let tokenData: YouTubeTokenResponse;
  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });
    tokenData = (await tokenRes.json()) as YouTubeTokenResponse;
  } catch (err) {
    console.error("[youtube-callback] Token exchange error:", err);
    const r = NextResponse.redirect(buildResultUrl({ success: "false", error: "token_exchange_failed" }));
    r.cookies.delete("youtube_oauth_nonce");
    return r;
  }

  if (tokenData.error || !tokenData.access_token || !tokenData.refresh_token) {
    console.error("[youtube-callback] Token exchange failed:", tokenData.error);
    const r = NextResponse.redirect(buildResultUrl({ success: "false", error: "token_exchange_failed" }));
    r.cookies.delete("youtube_oauth_nonce");
    return r;
  }

  const { access_token, refresh_token, expires_in } = tokenData;
  const expiresAt = new Date(Date.now() + (expires_in ?? 3600) * 1000).toISOString();

  // Get channel info
  let channelId = "";
  let channelTitle = "";
  try {
    const channelRes = await fetch(
      "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
      { headers: { Authorization: `Bearer ${access_token}` } }
    );
    if (!channelRes.ok) {
      console.warn("[youtube-callback] Channel info fetch returned", channelRes.status);
    } else {
      const channelData = (await channelRes.json()) as YouTubeChannelResponse;
      const item = channelData.items?.[0];
      if (item) {
        channelId = item.id;
        channelTitle = item.snippet?.title ?? "";
      }
    }
  } catch (err) {
    console.warn("[youtube-callback] Channel info fetch failed:", err);
  }

  const authCredentials = {
    oauth: { refresh_token, access_token, expires_at: expiresAt },
    channel_id: channelId,
  };

  // Upsert account
  let accountId: string;
  try {
    const existing = channelId
      ? await queryOne<AccountRow>(
          `SELECT account_id FROM accounts WHERE platform = 'youtube' AND auth_credentials->>'channel_id' = $1`,
          [channelId]
        )
      : null;

    if (existing) {
      accountId = existing.account_id;
      await query(
        `UPDATE accounts SET auth_credentials = $1::jsonb, platform_username = $2, status = 'active', updated_at = NOW() WHERE account_id = $3`,
        [JSON.stringify(authCredentials), channelTitle || channelId, accountId]
      );
    } else {
      const nextRow = await queryOne<NextNumRow>(
        `SELECT COALESCE(MAX(SUBSTRING(account_id FROM 5)::integer), 0) + 1 AS next_num FROM accounts WHERE account_id ~ '^ACC_[0-9]{4}$'`
      );
      const nextNum = parseInt(nextRow?.next_num ?? "1", 10);
      accountId = "ACC_" + String(nextNum).padStart(4, "0");
      await query(
        `INSERT INTO accounts (account_id, platform, platform_username, status, auth_credentials, created_at, updated_at) VALUES ($1, 'youtube', $2, 'active', $3::jsonb, NOW(), NOW())`,
        [accountId, channelTitle || channelId, JSON.stringify(authCredentials)]
      );
    }
  } catch (err) {
    console.error("[youtube-callback] DB upsert error:", err);
    const r = NextResponse.redirect(buildResultUrl({ success: "false", error: "db_error" }));
    r.cookies.delete("youtube_oauth_nonce");
    return r;
  }

  const r = NextResponse.redirect(
    buildResultUrl({ success: "true", account_id: accountId, username: channelTitle || channelId })
  );
  r.cookies.delete("youtube_oauth_nonce");
  return r;
}
