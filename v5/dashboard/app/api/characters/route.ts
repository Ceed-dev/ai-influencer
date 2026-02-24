import { NextRequest, NextResponse } from "next/server";
import { query, queryCount } from "@/lib/db";

const VALID_STATUSES = ["draft", "pending_review", "active", "archived"] as const;

/**
 * GET /api/characters
 * List characters with optional status filter and pagination.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const page = parseInt(searchParams.get("page") ?? "1", 10);
  const limit = parseInt(searchParams.get("limit") ?? "50", 10);

  if (status && !VALID_STATUSES.includes(status as typeof VALID_STATUSES[number])) {
    return NextResponse.json(
      { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` },
      { status: 400 }
    );
  }

  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIdx = 1;

  if (status) {
    conditions.push(`status = $${paramIdx++}`);
    params.push(status);
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const offset = (page - 1) * limit;

  const [characters, total] = await Promise.all([
    query(
      `SELECT id, character_id, name, description, appearance, personality, voice_id,
              image_drive_id, status, created_by, generation_metadata, created_at, updated_at
       FROM characters ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
      [...params, limit, offset]
    ),
    queryCount(
      `SELECT COUNT(*) as count FROM characters ${whereClause}`,
      params
    ),
  ]);

  return NextResponse.json({ characters, total });
}
