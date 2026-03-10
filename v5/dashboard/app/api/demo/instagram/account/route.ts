import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { queryOne } from "@/lib/db";

export const dynamic = "force-dynamic";

const IG_API_VERSION = "v21.0";

interface AccountRow {
  auth_credentials: {
    oauth: { long_lived_token: string };
    ig_user_id: string;
    page_id: string;
  };
}

interface IgUserResponse {
  id: string;
  username?: string;
  name?: string;
  biography?: string;
  followers_count?: number;
  media_count?: number;
  profile_picture_url?: string;
  error?: { message: string; code: number };
}

interface FbPageResponse {
  id: string;
  name?: string;
  fan_count?: number;
  error?: { message: string; code: number };
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const account = await queryOne<AccountRow>(
    `SELECT auth_credentials
     FROM accounts
     WHERE platform = 'instagram' AND status = 'active'
     ORDER BY updated_at DESC
     LIMIT 1`
  );

  if (!account) {
    return NextResponse.json({ error: "No active Instagram account found" }, { status: 404 });
  }

  const token = account.auth_credentials?.oauth?.long_lived_token;
  const igUserId = account.auth_credentials?.ig_user_id;
  const pageId = account.auth_credentials?.page_id;

  if (!token || !igUserId) {
    return NextResponse.json({ error: "Missing token or ig_user_id" }, { status: 400 });
  }

  const bearerHeaders = { Authorization: `Bearer ${token}` };

  // Fetch Instagram user profile (instagram_basic)
  const igFields = "id,username,name,biography,followers_count,media_count,profile_picture_url";
  let igData: IgUserResponse;
  try {
    const res = await fetch(
      `https://graph.instagram.com/${IG_API_VERSION}/${igUserId}?fields=${igFields}`,
      { headers: bearerHeaders }
    );
    igData = (await res.json()) as IgUserResponse;
    console.log("[demo/instagram/account] IG user:", igData.id, igData.username);
  } catch (err) {
    console.error("[demo/instagram/account] IG user fetch failed:", err);
    return NextResponse.json({ error: "Instagram user fetch failed" }, { status: 502 });
  }

  if (igData.error) {
    return NextResponse.json(
      { error: `Instagram error: ${igData.error.message}` },
      { status: 502 }
    );
  }

  // Fetch Facebook page info (pages_show_list)
  let fbPageData: FbPageResponse | null = null;
  if (pageId) {
    try {
      const res = await fetch(
        `https://graph.facebook.com/${IG_API_VERSION}/${pageId}?fields=id,name,fan_count`,
        { headers: bearerHeaders }
      );
      fbPageData = (await res.json()) as FbPageResponse;
      console.log("[demo/instagram/account] FB page:", fbPageData.id, fbPageData.name);
      if (fbPageData.error) {
        console.warn("[demo/instagram/account] FB page error:", fbPageData.error.message);
        fbPageData = null;
      }
    } catch (err) {
      console.warn("[demo/instagram/account] FB page fetch failed:", err);
    }
  }

  return NextResponse.json({ account: igData, page: fbPageData });
}
