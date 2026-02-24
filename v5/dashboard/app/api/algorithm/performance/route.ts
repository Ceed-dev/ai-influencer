import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

/**
 * GET /api/algorithm/performance
 * List algorithm performance data with period filter.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const period = searchParams.get("period");

  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIdx = 1;

  if (period) {
    conditions.push(`period = $${paramIdx++}`);
    params.push(period);
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const data = await query(
    `SELECT id, measured_at, period, hypothesis_accuracy, prediction_error, learning_count, top_performing_niches, improvement_rate
     FROM algorithm_performance ${whereClause}
     ORDER BY measured_at ASC`,
    params
  );

  return NextResponse.json({ data });
}
