import { NextRequest, NextResponse } from "next/server";
import { query, queryCount } from "@/lib/db";
import { DEMO_CONTENT, DEMO_CONTENT_TOTAL } from "@/lib/demo-data";

export const dynamic = "force-dynamic";

const VALID_STATUSES = [
  "planned", "producing", "ready", "pending_review", "pending_approval",
  "approved", "rejected", "revision_needed", "posted", "measured",
  "cancelled", "analyzed",
] as const;

const VALID_FORMATS = ["short_video", "text_post", "image_post"] as const;

/**
 * GET /api/content
 * List content with status/format filter and pagination.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const contentFormat = searchParams.get("content_format");
  const characterId = searchParams.get("character_id");
  const page = parseInt(searchParams.get("page") ?? "1", 10);
  const limit = parseInt(searchParams.get("limit") ?? "50", 10);

  if (status && !VALID_STATUSES.includes(status as typeof VALID_STATUSES[number])) {
    return NextResponse.json(
      { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` },
      { status: 400 }
    );
  }

  if (contentFormat && !VALID_FORMATS.includes(contentFormat as typeof VALID_FORMATS[number])) {
    return NextResponse.json(
      { error: `Invalid content_format. Must be one of: ${VALID_FORMATS.join(", ")}` },
      { status: 400 }
    );
  }

  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIdx = 1;

  if (status) {
    conditions.push(`status = $${paramIdx++}`);
    params.push(status);
  }
  if (contentFormat) {
    conditions.push(`content_format = $${paramIdx++}`);
    params.push(contentFormat);
  }
  if (characterId) {
    conditions.push(`character_id = $${paramIdx++}`);
    params.push(characterId);
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const offset = (page - 1) * limit;

  const [content, total] = await Promise.all([
    query(
      `SELECT * FROM content ${whereClause} ORDER BY created_at DESC LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
      [...params, limit, offset]
    ),
    queryCount(
      `SELECT COUNT(*) as count FROM content ${whereClause}`,
      params
    ),
  ]);

  // If no content exists, return demo data
  if (content.length === 0 && total === 0) {
    return NextResponse.json({ content: DEMO_CONTENT, total: DEMO_CONTENT_TOTAL });
  }

  return NextResponse.json({ content, total });
}
