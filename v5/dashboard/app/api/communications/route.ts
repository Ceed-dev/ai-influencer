import { NextRequest, NextResponse } from "next/server";
import { query, queryCount } from "@/lib/db";

/**
 * GET /api/communications
 * List agent communications with status/agent_type filter.
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

  const [messages, total] = await Promise.all([
    query(
      `SELECT id, agent_type, message_type, priority, content, context, human_response, human_responded_at, status, cycle_id, created_at
       FROM agent_communications ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
      [...params, limit, offset]
    ),
    queryCount(
      `SELECT COUNT(*) as count FROM agent_communications ${whereClause}`,
      params
    ),
  ]);

  return NextResponse.json({ messages, total });
}

/**
 * POST /api/communications
 * Create a new directive/message to an agent.
 */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { agent_type, message_type, priority, content } = body;

  if (!agent_type || !content) {
    return NextResponse.json(
      { error: "agent_type and content are required" },
      { status: 400 }
    );
  }

  const result = await query(
    `INSERT INTO agent_communications (agent_type, message_type, priority, content, status)
     VALUES ($1, $2, $3, $4, 'unread')
     RETURNING *`,
    [agent_type, message_type || "status_report", priority || "normal", content]
  );

  return NextResponse.json(result[0], { status: 201 });
}
