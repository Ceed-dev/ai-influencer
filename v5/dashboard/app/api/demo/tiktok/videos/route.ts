import { NextResponse } from "next/server";
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
}

interface TikTokVideo {
  id?: string;
  title?: string;
  create_time?: number;
  cover_image_url?: string;
  share_url?: string;
  view_count?: number;
  like_count?: number;
}

interface TikTokVideoListResponse {
  data?: {
    videos?: TikTokVideo[];
    cursor?: number;
    has_more?: boolean;
  };
  error?: {
    code?: string;
    message?: string;
    log_id?: string;
  };
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const account = await queryOne<AccountRow>(
    `SELECT auth_credentials
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

  let listData: TikTokVideoListResponse;
  try {
    const res = await fetch(
      "https://open.tiktokapis.com/v2/video/list/?fields=id,title,create_time,cover_image_url,share_url,view_count,like_count",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json; charset=UTF-8",
        },
        body: JSON.stringify({ max_count: 20 }),
      }
    );
    listData = (await res.json()) as TikTokVideoListResponse;
    console.log("[demo/tiktok/videos] TikTok response:", JSON.stringify(listData));
  } catch (err) {
    console.error("[demo/tiktok/videos] Request failed:", err);
    return NextResponse.json({ error: "TikTok video list request failed" }, { status: 502 });
  }

  if (listData.error?.code && listData.error.code !== "ok") {
    console.error("[demo/tiktok/videos] API error:", JSON.stringify(listData.error));
    return NextResponse.json(
      { error: `TikTok error: ${listData.error.message ?? listData.error.code}` },
      { status: 502 }
    );
  }

  return NextResponse.json({ videos: listData.data?.videos ?? [] });
}
