import { NextRequest, NextResponse } from "next/server";
import { query, queryCount } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/prompt-suggestions
 * List prompt improvement suggestions with status/agent_type filter.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const agentType = searchParams.get("agent_type");
  const page = parseInt(searchParams.get("page") ?? "1", 10);
  const limit = parseInt(searchParams.get("limit") ?? "50", 10);

  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIdx = 1;

  if (status) {
    conditions.push(`status = $${paramIdx++}`);
    params.push(status);
  }

  if (agentType) {
    conditions.push(`agent_type = $${paramIdx++}`);
    params.push(agentType);
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const offset = (page - 1) * limit;

  const [suggestions, total] = await Promise.all([
    query(
      `SELECT id, agent_type, trigger_type, trigger_details, suggestion, target_prompt_section, confidence, status, human_feedback, created_at, resolved_at
       FROM prompt_suggestions ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
      [...params, limit, offset]
    ),
    queryCount(
      `SELECT COUNT(*) as count FROM prompt_suggestions ${whereClause}`,
      params
    ),
  ]);

  return NextResponse.json({ suggestions, total });
}
