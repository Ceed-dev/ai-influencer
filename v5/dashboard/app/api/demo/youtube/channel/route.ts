import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { queryOne } from "@/lib/db";

export const dynamic = "force-dynamic";

interface AccountRow {
  auth_credentials: {
    oauth: { refresh_token: string; access_token: string; expires_at: string };
    channel_id: string;
  };
}
interface SettingRow { setting_value: unknown; }
interface YouTubeChannelResponse {
  items?: Array<{
    id: string;
    snippet?: {
      title?: string;
      description?: string;
      thumbnails?: { medium?: { url?: string }; default?: { url?: string } };
    };
    statistics?: {
      subscriberCount?: string;
      videoCount?: string;
      viewCount?: string;
    };
  }>;
  error?: { message: string };
}

async function getAccessToken(
  oauth: { refresh_token: string; access_token: string; expires_at: string },
  clientId: string,
  clientSecret: string
): Promise<string> {
  const expiry = new Date(oauth.expires_at).getTime();
  if (Date.now() < expiry - 5 * 60 * 1000) return oauth.access_token;
  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: oauth.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  const data = (await resp.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("Token refresh failed");
  return data.access_token;
}

/**
 * GET /api/demo/youtube/channel
 * Returns channel info for the connected YouTube account.
 * Uses youtube.readonly scope (required for channels.list?mine=true).
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const account = await queryOne<AccountRow>(
    `SELECT auth_credentials FROM accounts WHERE platform = 'youtube' AND status = 'active' ORDER BY updated_at DESC LIMIT 1`
  );
  if (!account) {
    return NextResponse.json({ error: "No active YouTube account found" }, { status: 404 });
  }

  const clientIdRow = await queryOne<SettingRow>(
    `SELECT setting_value FROM system_settings WHERE setting_key = 'YOUTUBE_CLIENT_ID'`
  );
  const clientSecretRow = await queryOne<SettingRow>(
    `SELECT setting_value FROM system_settings WHERE setting_key = 'YOUTUBE_CLIENT_SECRET'`
  );
  if (!clientIdRow || !clientSecretRow) {
    return NextResponse.json({ error: "YouTube credentials not configured" }, { status: 500 });
  }

  let accessToken: string;
  try {
    accessToken = await getAccessToken(
      account.auth_credentials.oauth,
      String(clientIdRow.setting_value),
      String(clientSecretRow.setting_value)
    );
  } catch (err) {
    return NextResponse.json({ error: `Token refresh failed: ${String(err)}` }, { status: 502 });
  }

  let data: YouTubeChannelResponse;
  try {
    const res = await fetch(
      "https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    data = (await res.json()) as YouTubeChannelResponse;
  } catch (err) {
    return NextResponse.json({ error: `YouTube API request failed: ${String(err)}` }, { status: 502 });
  }

  if (data.error) {
    return NextResponse.json({ error: data.error.message }, { status: 502 });
  }

  const item = data.items?.[0];
  if (!item) {
    return NextResponse.json({ error: "No channel found" }, { status: 404 });
  }

  return NextResponse.json({
    channel: {
      id: item.id,
      title: item.snippet?.title ?? "",
      description: item.snippet?.description ?? "",
      thumbnail:
        item.snippet?.thumbnails?.medium?.url ??
        item.snippet?.thumbnails?.default?.url ??
        "",
      subscriberCount: parseInt(item.statistics?.subscriberCount ?? "0", 10),
      videoCount: parseInt(item.statistics?.videoCount ?? "0", 10),
      viewCount: parseInt(item.statistics?.viewCount ?? "0", 10),
    },
  });
}
