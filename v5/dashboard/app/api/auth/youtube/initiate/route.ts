import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

const REDIRECT_URI = "https://ai-dash.0xqube.xyz/api/auth/youtube/callback";
const SCOPES = [
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/yt-analytics.readonly",
].join(" ");
const STATE_COOKIE = "youtube_oauth_nonce";

interface SettingRow {
  setting_value: unknown;
}

/**
 * POST /api/auth/youtube/initiate
 * Generates a CSRF nonce, stores it in an httpOnly cookie, and returns the Google OAuth URL.
 * Admin-only.
 */
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const clientIdSetting = await queryOne<SettingRow>(
    `SELECT setting_value FROM system_settings WHERE setting_key = 'YOUTUBE_CLIENT_ID'`
  );
  if (!clientIdSetting) {
    return NextResponse.json({ error: "YouTube Client ID not configured" }, { status: 500 });
  }
  const clientId = String(clientIdSetting.setting_value);

  const nonce = randomUUID();
  const state = Buffer.from(JSON.stringify({ nonce })).toString("base64");

  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", SCOPES);
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");
  authUrl.searchParams.set("state", state);

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
