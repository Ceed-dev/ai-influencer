import { NextRequest, NextResponse } from "next/server";
import { query, queryCount } from "@/lib/db";

/**
 * GET /api/reflections
 * List agent reflections with agent_type filter.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const agentType = searchParams.get("agent_type");
  const page = parseInt(searchParams.get("page") ?? "1", 10);
  const limit = parseInt(searchParams.get("limit") ?? "50", 10);

  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIdx = 1;

  if (agentType) {
    conditions.push(`agent_type = $${paramIdx++}`);
    params.push(agentType);
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const offset = (page - 1) * limit;

  const [reflections, total] = await Promise.all([
    query(
      `SELECT id, agent_type, cycle_id, task_description, self_score, score_reasoning, what_went_well, what_to_improve, next_actions, metrics_snapshot, applied_in_next_cycle, created_at
       FROM agent_reflections ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
      [...params, limit, offset]
    ),
    queryCount(
      `SELECT COUNT(*) as count FROM agent_reflections ${whereClause}`,
      params
    ),
  ]);

  return NextResponse.json({ reflections, total });
}
