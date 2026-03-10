import { NextRequest, NextResponse } from "next/server";
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
 * POST /api/demo/youtube/upload
 * Uploads a video to YouTube via resumable upload (youtube.upload scope).
 * Body: FormData { file: File, title: string }
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  const title = formData.get("title") as string | null;

  if (!file || !title?.trim()) {
    return NextResponse.json({ error: "Missing file or title" }, { status: 400 });
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

  const videoBuffer = Buffer.from(await file.arrayBuffer());
  const videoSize = videoBuffer.byteLength;

  // Step 1: Initiate resumable upload
  const metadata = {
    snippet: {
      title: title.trim(),
      description: "Uploaded via AI-Influencer Dashboard demo",
      categoryId: "22",
    },
    status: {
      privacyStatus: "private",
      selfDeclaredMadeForKids: false,
    },
  };

  let uploadUrl: string;
  try {
    const initRes = await fetch(
      "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "X-Upload-Content-Type": "video/mp4",
          "X-Upload-Content-Length": String(videoSize),
        },
        body: JSON.stringify(metadata),
      }
    );
    if (!initRes.ok) {
      const body = await initRes.text();
      console.error("[youtube-upload] Initiate failed:", initRes.status, body);
      return NextResponse.json(
        { error: `Upload initiation failed (${initRes.status})` },
        { status: 502 }
      );
    }
    const loc = initRes.headers.get("Location");
    if (!loc) {
      return NextResponse.json({ error: "No upload URL returned" }, { status: 502 });
    }
    uploadUrl = loc;
  } catch (err) {
    return NextResponse.json({ error: `Upload initiation request failed: ${String(err)}` }, { status: 502 });
  }

  // Step 2: Upload video data
  let videoData: { id?: string };
  try {
    const uploadRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "video/mp4",
        "Content-Length": String(videoSize),
      },
      body: videoBuffer,
    });
    if (!uploadRes.ok) {
      const body = await uploadRes.text();
      console.error("[youtube-upload] Upload failed:", uploadRes.status, body);
      return NextResponse.json(
        { error: `Upload failed (${uploadRes.status})` },
        { status: 502 }
      );
    }
    videoData = (await uploadRes.json()) as { id?: string };
  } catch (err) {
    return NextResponse.json({ error: `Upload request failed: ${String(err)}` }, { status: 502 });
  }
  if (!videoData.id) {
    return NextResponse.json({ error: "No video ID in response" }, { status: 502 });
  }

  return NextResponse.json({
    video_id: videoData.id,
    url: `https://www.youtube.com/watch?v=${videoData.id}`,
  });
}
