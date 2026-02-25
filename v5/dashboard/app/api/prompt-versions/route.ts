import { NextRequest, NextResponse } from "next/server";
import { query, queryCount } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/prompt-versions
 * List agent prompt versions with agent_type filter.
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

  const [versions, total] = await Promise.all([
    query(
      `SELECT id, agent_type, version, prompt_content, change_summary, changed_by, performance_before, performance_after, active, created_at
       FROM agent_prompt_versions ${whereClause}
       ORDER BY version DESC
       LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
      [...params, limit, offset]
    ),
    queryCount(
      `SELECT COUNT(*) as count FROM agent_prompt_versions ${whereClause}`,
      params
    ),
  ]);

  return NextResponse.json({ versions, total });
}
