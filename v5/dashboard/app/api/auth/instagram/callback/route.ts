import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";

export const dynamic = "force-dynamic";

const REDIRECT_URI = "https://ai-dash.0xqube.xyz/api/auth/instagram/callback";
const RESULT_BASE = "/auth/instagram/result";
const GRAPH_API = "https://graph.facebook.com/v21.0";

interface FacebookTokenResponse {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  error?: {
    message: string;
    type: string;
    code: number;
  };
}

interface FacebookPage {
  id: string;
  name: string;
  access_token: string;
  instagram_business_account?: { id: string };
}

interface FacebookPagesResponse {
  data?: FacebookPage[];
  error?: { message: string; code: number };
}

interface IGUserResponse {
  id: string;
  username?: string;
  error?: { message: string; code: number };
}

interface PageIGResponse {
  instagram_business_account?: { id: string };
  error?: { message: string; code: number };
}

interface SettingRow {
  setting_value: unknown;
}

interface AccountRow {
  account_id: string;
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
    return NextResponse.redirect(
      buildResultUrl(base, { success: "false", error: "invalid_state" })
    );
  }

  // Verify CSRF nonce against httpOnly cookie set by /api/auth/instagram/initiate
  const cookieNonce = request.cookies.get("instagram_oauth_nonce")?.value;
  if (!cookieNonce || cookieNonce !== stateNonce) {
    console.error("[instagram-callback] CSRF nonce mismatch — possible CSRF attack");
    const csrfResponse = NextResponse.redirect(
      buildResultUrl(base, { success: "false", error: "csrf_mismatch" })
    );
    csrfResponse.cookies.delete("instagram_oauth_nonce");
    return csrfResponse;
  }

  // Get credentials from system_settings
  const appIdSetting = await queryOne<SettingRow>(
    `SELECT setting_value FROM system_settings WHERE setting_key = 'INSTAGRAM_APP_ID'`
  );
  const appSecretSetting = await queryOne<SettingRow>(
    `SELECT setting_value FROM system_settings WHERE setting_key = 'INSTAGRAM_APP_SECRET'`
  );

  if (!appIdSetting || !appSecretSetting) {
    console.error("[instagram-callback] INSTAGRAM_APP_ID or INSTAGRAM_APP_SECRET not found in system_settings");
    return NextResponse.redirect(
      buildResultUrl(base, { success: "false", error: "missing_credentials" })
    );
  }

  const appId = String(appIdSetting.setting_value);
  const appSecret = String(appSecretSetting.setting_value);

  // Step 1: Exchange code for short-lived token
  let shortLivedToken: string;
  try {
    const tokenUrl = `${GRAPH_API}/oauth/access_token?client_id=${encodeURIComponent(appId)}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&client_secret=${encodeURIComponent(appSecret)}&code=${encodeURIComponent(code)}`;
    const tokenRes = await fetch(tokenUrl);
    const tokenData = (await tokenRes.json()) as FacebookTokenResponse;

    if (tokenData.error || !tokenData.access_token) {
      console.error("[instagram-callback] Short-lived token exchange failed:", tokenData.error?.message);
      return NextResponse.redirect(
        buildResultUrl(base, { success: "false", error: "token_exchange_failed" })
      );
    }
    shortLivedToken = tokenData.access_token;
  } catch (err) {
    console.error("[instagram-callback] Token exchange network error:", err);
    return NextResponse.redirect(
      buildResultUrl(base, { success: "false", error: "token_exchange_failed" })
    );
  }

  // Step 2: Exchange for long-lived token (60 days)
  let longLivedToken: string;
  let expiresIn: number;
  try {
    const llUrl = `${GRAPH_API}/oauth/access_token?grant_type=fb_exchange_token&client_id=${encodeURIComponent(appId)}&client_secret=${encodeURIComponent(appSecret)}&fb_exchange_token=${encodeURIComponent(shortLivedToken)}`;
    const llRes = await fetch(llUrl);
    const llData = (await llRes.json()) as FacebookTokenResponse;

    if (llData.error || !llData.access_token) {
      console.error("[instagram-callback] Long-lived token exchange failed:", llData.error?.message);
      return NextResponse.redirect(
        buildResultUrl(base, { success: "false", error: "long_lived_token_failed" })
      );
    }
    longLivedToken = llData.access_token;
    expiresIn = llData.expires_in ?? 5184000; // default 60 days
  } catch (err) {
    console.error("[instagram-callback] Long-lived token exchange network error:", err);
    return NextResponse.redirect(
      buildResultUrl(base, { success: "false", error: "long_lived_token_failed" })
    );
  }

  // Step 3: Get Facebook Pages and find Instagram Business Account
  let igUserId = "";
  let pageId = "";
  try {
    const pagesRes = await fetch(
      `${GRAPH_API}/me/accounts?fields=id,name,access_token,instagram_business_account&access_token=${encodeURIComponent(longLivedToken)}`
    );
    const pagesData = (await pagesRes.json()) as FacebookPagesResponse;

    if (pagesData.error || !pagesData.data) {
      console.error("[instagram-callback] Failed to fetch pages:", pagesData.error?.message);
      return NextResponse.redirect(
        buildResultUrl(base, { success: "false", error: "pages_fetch_failed" })
      );
    }

    // Find first page with Instagram Business Account
    for (const page of pagesData.data) {
      if (page.instagram_business_account?.id) {
        igUserId = page.instagram_business_account.id;
        pageId = page.id;
        break;
      }

      // Some pages need a separate query to check for IG account
      const pageIgRes = await fetch(
        `${GRAPH_API}/${page.id}?fields=instagram_business_account&access_token=${encodeURIComponent(page.access_token)}`
      );
      const pageIgData = (await pageIgRes.json()) as PageIGResponse;
      if (pageIgData.instagram_business_account?.id) {
        igUserId = pageIgData.instagram_business_account.id;
        pageId = page.id;
        break;
      }
    }

    if (!igUserId || !pageId) {
      console.error("[instagram-callback] No Instagram Business Account found on any page");
      return NextResponse.redirect(
        buildResultUrl(base, { success: "false", error: "no_instagram_business_account" })
      );
    }
  } catch (err) {
    console.error("[instagram-callback] Pages/IG account fetch error:", err);
    return NextResponse.redirect(
      buildResultUrl(base, { success: "false", error: "pages_fetch_failed" })
    );
  }

  // Step 4: Get IG username — non-fatal fallback to platformUsername
  let displayName = platformUsername;
  try {
    const igUserRes = await fetch(
      `${GRAPH_API}/${igUserId}?fields=id,username&access_token=${encodeURIComponent(longLivedToken)}`
    );
    const igUserData = (await igUserRes.json()) as IGUserResponse;
    if (igUserData.username) {
      displayName = igUserData.username;
    }
  } catch (err) {
    console.warn("[instagram-callback] IG username fetch failed, using platform_username:", err);
  }

  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
  const authCredentials = {
    ig_user_id: igUserId,
    page_id: pageId,
    oauth: {
      long_lived_token: longLivedToken,
      ig_user_id: igUserId,
      expires_at: expiresAt,
    },
  };

  // Upsert account
  let accountId: string;
  try {
    const existing = await queryOne<AccountRow>(
      `SELECT account_id FROM accounts WHERE platform = 'instagram' AND auth_credentials->>'ig_user_id' = $1`,
      [igUserId]
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
         VALUES ($1, 'instagram', $2, $3, 'active', $4::jsonb, NOW(), NOW())`,
        [accountId, displayName || platformUsername, characterId || null, JSON.stringify(authCredentials)]
      );
    }
  } catch (err) {
    console.error("[instagram-callback] DB upsert error:", err);
    return NextResponse.redirect(
      buildResultUrl(base, { success: "false", error: "db_error" })
    );
  }

  // Delete CSRF nonce cookie after successful auth
  const successResponse = NextResponse.redirect(
    buildResultUrl(base, {
      success: "true",
      account_id: accountId,
      username: displayName || platformUsername,
    })
  );
  successResponse.cookies.delete("instagram_oauth_nonce");
  return successResponse;
}
