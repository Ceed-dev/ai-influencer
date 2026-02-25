import { NextRequest, NextResponse } from "next/server";
import { query, queryCount } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/individual-learnings
 * List agent individual learnings with agent_type/category filter.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const agentType = searchParams.get("agent_type");
  const category = searchParams.get("category");
  const page = parseInt(searchParams.get("page") ?? "1", 10);
  const limit = parseInt(searchParams.get("limit") ?? "50", 10);

  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIdx = 1;

  if (agentType) {
    conditions.push(`agent_type = $${paramIdx++}`);
    params.push(agentType);
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
      `SELECT id, agent_type, category, content, context, confidence, times_applied, times_successful, success_rate, is_active, created_at, updated_at
       FROM agent_individual_learnings ${whereClause}
       ORDER BY confidence DESC, created_at DESC
       LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
      [...params, limit, offset]
    ),
    queryCount(
      `SELECT COUNT(*) as count FROM agent_individual_learnings ${whereClause}`,
      params
    ),
  ]);

  return NextResponse.json({ learnings, total });
}
