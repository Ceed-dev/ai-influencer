import { NextRequest, NextResponse } from "next/server";
import { query, queryCount } from "@/lib/db";

const VALID_STATUSES = [
  "pending", "queued", "waiting", "processing", "retrying",
  "completed", "failed", "failed_permanent",
] as const;

const VALID_TASK_TYPES = ["produce", "publish", "measure", "curate"] as const;

/**
 * GET /api/production
 * List task_queue entries with optional status/task_type filter and pagination.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const taskType = searchParams.get("task_type");
  const page = parseInt(searchParams.get("page") ?? "1", 10);
  const limit = parseInt(searchParams.get("limit") ?? "50", 10);

  if (status && !VALID_STATUSES.includes(status as typeof VALID_STATUSES[number])) {
    return NextResponse.json(
      { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` },
      { status: 400 }
    );
  }

  if (taskType && !VALID_TASK_TYPES.includes(taskType as typeof VALID_TASK_TYPES[number])) {
    return NextResponse.json(
      { error: `Invalid task_type. Must be one of: ${VALID_TASK_TYPES.join(", ")}` },
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

  if (taskType) {
    conditions.push(`task_type = $${paramIdx++}`);
    params.push(taskType);
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const offset = (page - 1) * limit;

  const [tasks, total] = await Promise.all([
    query(
      `SELECT id, task_type, payload, status, priority, assigned_worker,
              retry_count, max_retries, error_message, last_error_at,
              created_at, started_at, completed_at
       FROM task_queue ${whereClause}
       ORDER BY
         CASE WHEN status IN ('processing', 'retrying', 'pending', 'queued', 'waiting') THEN 0 ELSE 1 END,
         priority DESC,
         created_at DESC
       LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
      [...params, limit, offset]
    ),
    queryCount(
      `SELECT COUNT(*) as count FROM task_queue ${whereClause}`,
      params
    ),
  ]);

  // Status counts for filter badges
  const statusCounts = await query<{ status: string; count: string }>(
    `SELECT status, COUNT(*) as count FROM task_queue GROUP BY status`
  );

  const counts: Record<string, number> = {};
  for (const sc of statusCounts) {
    counts[sc.status] = parseInt(sc.count, 10);
  }

  return NextResponse.json({ tasks, total, status_counts: counts });
}
