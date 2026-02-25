import { NextRequest, NextResponse } from "next/server";
import { query, queryCount } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/components
 * List components with review_status/type filter.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const reviewStatus = searchParams.get("review_status");
  const type = searchParams.get("type");
  const page = parseInt(searchParams.get("page") ?? "1", 10);
  const limit = parseInt(searchParams.get("limit") ?? "50", 10);

  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIdx = 1;

  if (reviewStatus) {
    conditions.push(`review_status = $${paramIdx++}`);
    params.push(reviewStatus);
  }

  if (type) {
    conditions.push(`type = $${paramIdx++}`);
    params.push(type);
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const offset = (page - 1) * limit;

  const [components, total] = await Promise.all([
    query(
      `SELECT id, component_id, type, subtype, name, description, niche, tags, score, usage_count, curated_by, curation_confidence, review_status, created_at, updated_at
       FROM components ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
      [...params, limit, offset]
    ),
    queryCount(
      `SELECT COUNT(*) as count FROM components ${whereClause}`,
      params
    ),
  ]);

  return NextResponse.json({ components, total });
}
