import { NextRequest, NextResponse } from "next/server";
import { query, queryCount } from "@/lib/db";

const VALID_VERDICTS = [
  "pending", "confirmed", "rejected", "inconclusive",
] as const;

/**
 * GET /api/hypotheses
 * List hypotheses with verdict/category filter.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const verdict = searchParams.get("verdict");
  const category = searchParams.get("category");
  const page = parseInt(searchParams.get("page") ?? "1", 10);
  const limit = parseInt(searchParams.get("limit") ?? "50", 10);

  if (verdict && !VALID_VERDICTS.includes(verdict as typeof VALID_VERDICTS[number])) {
    return NextResponse.json(
      { error: `Invalid verdict. Must be one of: ${VALID_VERDICTS.join(", ")}` },
      { status: 400 }
    );
  }

  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIdx = 1;

  if (verdict) {
    conditions.push(`verdict = $${paramIdx++}`);
    params.push(verdict);
  }
  if (category) {
    conditions.push(`category = $${paramIdx++}`);
    params.push(category);
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const offset = (page - 1) * limit;

  const [hypotheses, total] = await Promise.all([
    query(
      `SELECT * FROM hypotheses ${whereClause} ORDER BY created_at DESC LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
      [...params, limit, offset]
    ),
    queryCount(
      `SELECT COUNT(*) as count FROM hypotheses ${whereClause}`,
      params
    ),
  ]);

  return NextResponse.json({ hypotheses, total });
}
