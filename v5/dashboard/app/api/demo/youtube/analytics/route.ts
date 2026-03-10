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
interface YouTubeAnalyticsResponse {
  rows?: number[][];
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
 * GET /api/demo/youtube/analytics
 * Returns channel analytics for the last 28 days (yt-analytics.readonly scope).
 * Metrics: views, estimatedMinutesWatched, likes, comments, shares
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

  const endDate = new Date().toISOString().split("T")[0]!;
  const startDate = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]!;

  let data: YouTubeAnalyticsResponse;
  try {
    const res = await fetch(
      `https://youtubeanalytics.googleapis.com/v2/reports?ids=channel%3D%3DMINE&startDate=${startDate}&endDate=${endDate}&metrics=views,estimatedMinutesWatched,likes,comments,shares`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    data = (await res.json()) as YouTubeAnalyticsResponse;
  } catch (err) {
    return NextResponse.json({ error: `YouTube Analytics API request failed: ${String(err)}` }, { status: 502 });
  }

  if (data.error) {
    return NextResponse.json({ error: data.error.message }, { status: 502 });
  }

  const row = data.rows?.[0] ?? [];
  return NextResponse.json({
    analytics: {
      views: row[0] ?? 0,
      estimatedMinutesWatched: Math.round(row[1] ?? 0),
      likes: row[2] ?? 0,
      comments: row[3] ?? 0,
      shares: row[4] ?? 0,
      startDate,
      endDate,
    },
  });
}
