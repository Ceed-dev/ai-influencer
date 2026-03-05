import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";

export const dynamic = "force-dynamic";

const REDIRECT_URI = "https://ai-dash.0xqube.xyz/api/auth/tiktok/callback";
const RESULT_BASE = "/auth/tiktok/result";

interface TikTokTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  open_id: string;
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
  setting_value: string;
}

interface NextNumRow {
  next_num: string;
}

function buildResultUrl(base: URL, params: Record<string, string>): string {
  const url = new URL(RESULT_BASE, base);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return url.toString();
}

export async function GET(request: NextRequest) {
  const base = request.nextUrl;
  const code = base.searchParams.get("code");
  const state = base.searchParams.get("state");

  if (!code || !state) {
    return NextResponse.redirect(
      buildResultUrl(base, { success: "false", error: "missing_params" })
    );
  }

  // Decode state
  let platformUsername = "";
  let characterId = "";
  try {
    const decoded = JSON.parse(Buffer.from(state, "base64").toString("utf-8")) as {
      platform_username?: string;
      character_id?: string;
    };
    platformUsername = decoded.platform_username ?? "";
    characterId = decoded.character_id ?? "";
  } catch {
    return NextResponse.redirect(
      buildResultUrl(base, { success: "false", error: "invalid_state" })
    );
  }

  // Get credentials from system_settings
  const clientKeySetting = await queryOne<SettingRow>(
    `SELECT setting_value FROM system_settings WHERE setting_key = 'TIKTOK_CLIENT_KEY'`
  );
  const clientSecretSetting = await queryOne<SettingRow>(
    `SELECT setting_value FROM system_settings WHERE setting_key = 'TIKTOK_CLIENT_SECRET'`
  );

  if (!clientKeySetting || !clientSecretSetting) {
    return NextResponse.redirect(
      buildResultUrl(base, { success: "false", error: "missing_credentials" })
    );
  }

  const clientKey = String(clientKeySetting.setting_value).replace(/^"|"$/g, "");
  const clientSecret = String(clientSecretSetting.setting_value).replace(/^"|"$/g, "");

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
    return NextResponse.redirect(
      buildResultUrl(base, { success: "false", error: "token_exchange_failed" })
    );
  }

  if (tokenData.error) {
    return NextResponse.redirect(
      buildResultUrl(base, {
        success: "false",
        error: `token_error:${tokenData.error_description ?? tokenData.error}`,
      })
    );
  }

  const { access_token, refresh_token, expires_in, open_id } = tokenData;

  // Get user info
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
  } catch {
    // Non-fatal: use platformUsername as fallback
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
             username = $2,
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
        `INSERT INTO accounts (account_id, platform, username, character_id, status, auth_credentials, created_at, updated_at)
         VALUES ($1, 'tiktok', $2, $3, 'active', $4::jsonb, NOW(), NOW())`,
        [accountId, displayName || platformUsername, characterId || null, JSON.stringify(authCredentials)]
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "db_error";
    return NextResponse.redirect(
      buildResultUrl(base, { success: "false", error: `db_error:${message}` })
    );
  }

  return NextResponse.redirect(
    buildResultUrl(base, {
      success: "true",
      account_id: accountId,
      username: displayName || platformUsername,
    })
  );
}
