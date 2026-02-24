import { NextRequest, NextResponse } from "next/server";
import { query, queryCount } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/learnings
 * List learnings with confidence/category filter.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const minConfidence = searchParams.get("min_confidence");
  const category = searchParams.get("category");
  const page = parseInt(searchParams.get("page") ?? "1", 10);
  const limit = parseInt(searchParams.get("limit") ?? "50", 10);

  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIdx = 1;

  if (minConfidence) {
    const conf = parseFloat(minConfidence);
    if (isNaN(conf) || conf < 0 || conf > 1) {
      return NextResponse.json(
        { error: "min_confidence must be a number between 0 and 1" },
        { status: 400 }
      );
    }
    conditions.push(`confidence >= $${paramIdx++}`);
    params.push(conf);
  }

  if (category) {
    conditions.push(`category = $${paramIdx++}`);
    params.push(category);
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const offset = (page - 1) * limit;

  const [learnings, total] = await Promise.all([
    query(
      `SELECT * FROM learnings ${whereClause} ORDER BY confidence DESC, created_at DESC LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
      [...params, limit, offset]
    ),
    queryCount(
      `SELECT COUNT(*) as count FROM learnings ${whereClause}`,
      params
    ),
  ]);

  return NextResponse.json({ learnings, total });
}
