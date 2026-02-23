import { NextRequest, NextResponse } from "next/server";
import { query, queryCount } from "@/lib/db";

/**
 * GET /api/thought-logs
 * List agent thought logs with agent_type/cycle_id filter.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const agentType = searchParams.get("agent_type");
  const cycleId = searchParams.get("cycle_id");
  const page = parseInt(searchParams.get("page") ?? "1", 10);
  const limit = parseInt(searchParams.get("limit") ?? "50", 10);

  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIdx = 1;

  if (agentType) {
    conditions.push(`agent_type = $${paramIdx++}`);
    params.push(agentType);
  }

  if (cycleId) {
    conditions.push(`cycle_id = $${paramIdx++}`);
    params.push(parseInt(cycleId, 10));
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const offset = (page - 1) * limit;

  const [logs, total] = await Promise.all([
    query(
      `SELECT id, agent_type, cycle_id, graph_name, node_name, input_summary, reasoning, decision, output_summary, tools_used, llm_model, token_usage, duration_ms, created_at
       FROM agent_thought_logs ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
      [...params, limit, offset]
    ),
    queryCount(
      `SELECT COUNT(*) as count FROM agent_thought_logs ${whereClause}`,
      params
    ),
  ]);

  return NextResponse.json({ logs, total });
}
