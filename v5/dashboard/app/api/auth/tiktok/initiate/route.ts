import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

const REDIRECT_URI = "https://ai-dash.0xqube.xyz/api/auth/tiktok/callback";
const SCOPES = "video.publish,video.upload,video.list,user.info.basic";
const STATE_COOKIE = "tiktok_oauth_nonce";

interface SettingRow {
  setting_value: unknown;
}

/**
 * POST /api/auth/tiktok/initiate
 * Generates a CSRF nonce, stores it in an httpOnly cookie, and returns the TikTok OAuth URL.
 * Admin-only.
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { platform_username?: string; character_id?: string };
  try {
    body = (await request.json()) as { platform_username?: string; character_id?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { platform_username = "", character_id = "" } = body;

  const clientKeySetting = await queryOne<SettingRow>(
    `SELECT setting_value FROM system_settings WHERE setting_key = 'TIKTOK_CLIENT_KEY'`
  );
  if (!clientKeySetting) {
    return NextResponse.json({ error: "TikTok client key not configured" }, { status: 500 });
  }
  const clientKey = String(clientKeySetting.setting_value);

  // Generate CSRF nonce
  const nonce = randomUUID();

  // Build state with nonce included
  const state = Buffer.from(
    JSON.stringify({ platform_username, character_id, nonce })
  ).toString("base64");

  const authUrl = new URL("https://www.tiktok.com/v2/auth/authorize/");
  authUrl.searchParams.set("client_key", clientKey);
  authUrl.searchParams.set("scope", SCOPES);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
  authUrl.searchParams.set("state", state);

  // Store nonce in httpOnly cookie (5 min TTL)
  const response = NextResponse.json({ authUrl: authUrl.toString() });
  response.cookies.set(STATE_COOKIE, nonce, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    maxAge: 300,
    path: "/",
  });

  return response;
}
