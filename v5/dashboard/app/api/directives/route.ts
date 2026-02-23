import { NextRequest, NextResponse } from "next/server";
import { query, queryCount } from "@/lib/db";

/**
 * GET /api/directives
 * List human directives with status/priority filter.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const priority = searchParams.get("priority");
  const page = parseInt(searchParams.get("page") ?? "1", 10);
  const limit = parseInt(searchParams.get("limit") ?? "50", 10);

  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIdx = 1;

  if (status) {
    conditions.push(`status = $${paramIdx++}`);
    params.push(status);
  }

  if (priority) {
    conditions.push(`priority = $${paramIdx++}`);
    params.push(priority);
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const offset = (page - 1) * limit;

  const [directives, total] = await Promise.all([
    query(
      `SELECT id, directive_type, content, target_accounts, target_niches, target_agents, status, priority, created_by, acknowledged_at, created_at
       FROM human_directives ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
      [...params, limit, offset]
    ),
    queryCount(
      `SELECT COUNT(*) as count FROM human_directives ${whereClause}`,
      params
    ),
  ]);

  return NextResponse.json({ directives, total });
}

/**
 * POST /api/directives
 * Create a new human directive.
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { directive_type, content, target_agents, priority } = body;

  if (!directive_type || !content) {
    return NextResponse.json(
      { error: "directive_type and content are required" },
      { status: 400 }
    );
  }

  const result = await query(
    `INSERT INTO human_directives (directive_type, content, target_agents, priority, status, created_by)
     VALUES ($1, $2, $3, $4, 'pending', 'dashboard')
     RETURNING *`,
    [directive_type, content, target_agents || null, priority || "normal"]
  );

  return NextResponse.json(result[0], { status: 201 });
}
