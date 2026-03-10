import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { queryOne } from "@/lib/db";

export const dynamic = "force-dynamic";

const GRAPH_API = "https://graph.facebook.com/v21.0";

interface AccountRow {
  auth_credentials: {
    oauth: { long_lived_token: string };
    ig_user_id: string;
  };
}

interface ContainerResponse {
  id?: string;
  error?: { message: string; code: number };
}

interface ContainerStatusResponse {
  id: string;
  status_code?: string;
  error?: { message: string; code: number };
}

interface PublishResponse {
  id?: string;
  error?: { message: string; code: number };
}

interface ShortcodeResponse {
  id: string;
  shortcode?: string;
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let imageUrl: string;
  let caption: string;
  try {
    const body = (await request.json()) as { imageUrl?: unknown; caption?: unknown };
    if (typeof body.imageUrl !== "string") {
      return NextResponse.json({ error: "imageUrl must be a string" }, { status: 400 });
    }
    imageUrl = body.imageUrl.trim();
    caption = typeof body.caption === "string" ? body.caption.trim() : "";
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!imageUrl) {
    return NextResponse.json({ error: "imageUrl is required" }, { status: 400 });
  }

  // Validate imageUrl is a valid HTTPS URL
  try {
    const parsed = new URL(imageUrl);
    if (parsed.protocol !== "https:") {
      return NextResponse.json({ error: "imageUrl must use HTTPS" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "imageUrl is not a valid URL" }, { status: 400 });
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

  if (!token || !igUserId) {
    return NextResponse.json({ error: "Missing token or ig_user_id" }, { status: 400 });
  }

  const bearerHeaders = { Authorization: `Bearer ${token}` };

  // Step 1: Create image media container (instagram_content_publish)
  // IMAGE containers typically process instantly, so no media_type param needed (defaults to IMAGE)
  console.log("[demo/instagram/publish] Creating image container...");
  const containerParams = new URLSearchParams({
    image_url: imageUrl,
    caption: caption.slice(0, 2200),
  });

  let containerData: ContainerResponse;
  try {
    const res = await fetch(
      `${GRAPH_API}/${igUserId}/media`,
      {
        method: "POST",
        headers: { ...bearerHeaders, "Content-Type": "application/x-www-form-urlencoded" },
        body: containerParams,
      }
    );
    containerData = (await res.json()) as ContainerResponse;
    console.log("[demo/instagram/publish] Container id:", containerData.id);
  } catch (err) {
    console.error("[demo/instagram/publish] Container create failed:", err);
    return NextResponse.json({ error: "Instagram container creation failed" }, { status: 502 });
  }

  if (containerData.error || !containerData.id) {
    return NextResponse.json(
      { error: `Container error: ${containerData.error?.message ?? "No container ID returned"}` },
      { status: 502 }
    );
  }

  const containerId = containerData.id;

  // Step 2: Poll container status until FINISHED
  // IMAGE containers are usually ready immediately; poll up to 10 times with 3s interval
  console.log(`[demo/instagram/publish] Polling container ${containerId}...`);
  let containerFinished = false;
  for (let i = 0; i < 10; i++) {
    // For IMAGE type, check immediately on first iteration (no initial sleep)
    if (i > 0) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }

    try {
      const statusRes = await fetch(
        `${GRAPH_API}/${containerId}?fields=status_code`,
        { headers: bearerHeaders }
      );
      if (!statusRes.ok) {
        const status = statusRes.status;
        if (status === 401 || status === 403) {
          return NextResponse.json({ error: "Instagram token invalid or expired" }, { status: 502 });
        }
        continue;
      }
      const statusData = (await statusRes.json()) as ContainerStatusResponse;
      console.log(`[demo/instagram/publish] Poll ${i + 1}: status_code=${statusData.status_code}`);

      if (statusData.status_code === "FINISHED") {
        containerFinished = true;
        break;
      }
      if (statusData.status_code === "ERROR") {
        return NextResponse.json({ error: "Instagram container processing failed" }, { status: 502 });
      }
    } catch {
      // Continue polling on transient network errors
    }
  }

  if (!containerFinished) {
    return NextResponse.json({ error: "Instagram container processing timed out" }, { status: 504 });
  }

  // Step 3: Publish the container (instagram_content_publish)
  console.log(`[demo/instagram/publish] Publishing container ${containerId}...`);
  const publishParams = new URLSearchParams({ creation_id: containerId });

  let publishData: PublishResponse;
  try {
    const res = await fetch(
      `${GRAPH_API}/${igUserId}/media_publish`,
      {
        method: "POST",
        headers: { ...bearerHeaders, "Content-Type": "application/x-www-form-urlencoded" },
        body: publishParams,
      }
    );
    publishData = (await res.json()) as PublishResponse;
    console.log("[demo/instagram/publish] Published media_id:", publishData.id);
  } catch (err) {
    console.error("[demo/instagram/publish] Publish failed:", err);
    return NextResponse.json({ error: "Instagram publish failed" }, { status: 502 });
  }

  if (publishData.error || !publishData.id) {
    return NextResponse.json(
      { error: `Publish error: ${publishData.error?.message ?? "No media ID returned"}` },
      { status: 502 }
    );
  }

  const mediaId = publishData.id;

  // Fetch shortcode for permalink (IMAGE posts use /p/ path)
  let permalink = `https://www.instagram.com/p/${mediaId}/`;
  try {
    const scRes = await fetch(
      `${GRAPH_API}/${mediaId}?fields=shortcode`,
      { headers: bearerHeaders }
    );
    if (scRes.ok) {
      const scData = (await scRes.json()) as ShortcodeResponse;
      if (scData.shortcode) {
        permalink = `https://www.instagram.com/p/${scData.shortcode}/`;
      }
    }
  } catch {
    // Non-critical — use media ID URL as fallback
  }

  return NextResponse.json({ media_id: mediaId, permalink });
}
