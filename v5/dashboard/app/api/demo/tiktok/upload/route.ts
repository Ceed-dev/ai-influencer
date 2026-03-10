import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { queryOne } from "@/lib/db";

export const dynamic = "force-dynamic";

interface AccountRow {
  auth_credentials: {
    oauth: {
      access_token: string;
    };
  };
  platform_username: string;
}

interface TikTokInitResponse {
  data?: {
    publish_id?: string;
    upload_url?: string;
  };
  error?: {
    code?: string;
    message?: string;
    log_id?: string;
  };
}

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

  const file = formData.get("file");
  const title = formData.get("title");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }
  if (typeof title !== "string" || !title.trim()) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  const account = await queryOne<AccountRow>(
    `SELECT auth_credentials, platform_username
     FROM accounts
     WHERE platform = 'tiktok' AND status = 'active'
     ORDER BY updated_at DESC
     LIMIT 1`
  );

  if (!account) {
    return NextResponse.json({ error: "No active TikTok account found" }, { status: 404 });
  }

  const accessToken = account.auth_credentials?.oauth?.access_token;
  if (!accessToken) {
    return NextResponse.json({ error: "No access token found" }, { status: 400 });
  }

  const videoBytes = await file.arrayBuffer();
  const videoSize = videoBytes.byteLength;

  if (videoSize === 0) {
    return NextResponse.json({ error: "Video file is empty" }, { status: 400 });
  }

  // Step 1: Init Direct Post
  let initData: TikTokInitResponse;
  try {
    const initRes = await fetch("https://open.tiktokapis.com/v2/post/publish/video/init/", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify({
        post_info: {
          title: title.trim(),
          privacy_level: "SELF_ONLY",
          disable_duet: false,
          disable_comment: false,
          disable_stitch: false,
          video_cover_timestamp_ms: 1000,
        },
        source_info: {
          source: "FILE_UPLOAD",
          video_size: videoSize,
          chunk_size: videoSize,
          total_chunk_count: 1,
        },
      }),
    });
    initData = (await initRes.json()) as TikTokInitResponse;
  } catch (err) {
    console.error("[demo/tiktok/upload] Init request failed:", err);
    return NextResponse.json({ error: "TikTok init request failed" }, { status: 502 });
  }

  if (initData.error?.code && initData.error.code !== "ok") {
    console.error("[demo/tiktok/upload] Init API error:", JSON.stringify(initData.error));
    return NextResponse.json(
      { error: `TikTok error: ${initData.error.message ?? initData.error.code}` },
      { status: 502 }
    );
  }

  const publishId = initData.data?.publish_id;
  const uploadUrl = initData.data?.upload_url;

  if (!publishId || !uploadUrl) {
    console.error("[demo/tiktok/upload] Missing publish_id or upload_url:", JSON.stringify(initData));
    return NextResponse.json({ error: "Invalid init response from TikTok" }, { status: 502 });
  }

  // Step 2: Upload video bytes
  try {
    const uploadRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "video/mp4",
        "Content-Range": `bytes 0-${videoSize - 1}/${videoSize}`,
        "Content-Length": String(videoSize),
      },
      body: videoBytes,
    });

    if (!uploadRes.ok) {
      const text = await uploadRes.text();
      console.error("[demo/tiktok/upload] Upload PUT failed:", uploadRes.status, text);
      return NextResponse.json({ error: `Upload failed: HTTP ${uploadRes.status}` }, { status: 502 });
    }
  } catch (err) {
    console.error("[demo/tiktok/upload] Upload PUT network error:", err);
    return NextResponse.json({ error: "Video upload network error" }, { status: 502 });
  }

  return NextResponse.json({ publish_id: publishId });
}
