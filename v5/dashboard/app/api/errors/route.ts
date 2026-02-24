import { NextRequest, NextResponse } from "next/server";
import { query, queryCount } from "@/lib/db";

/**
 * GET /api/errors
 * List error logs with period/task_type filter.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const period = searchParams.get("period");
  const taskType = searchParams.get("task_type");
  const page = parseInt(searchParams.get("page") ?? "1", 10);
  const limit = parseInt(searchParams.get("limit") ?? "50", 10);

  const validPeriods = ["24h", "7d", "30d"];
  if (period && !validPeriods.includes(period)) {
    return NextResponse.json(
      { error: `Invalid period. Must be one of: ${validPeriods.join(", ")}` },
      { status: 400 }
    );
  }

  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIdx = 1;

  if (period) {
    const intervalMap: Record<string, string> = {
      "24h": "24 hours",
      "7d": "7 days",
      "30d": "30 days",
    };
    conditions.push(`tq.created_at >= NOW() - $${paramIdx++}::interval`);
    params.push(intervalMap[period]!);
  }

  if (taskType) {
    conditions.push(`tq.task_type = $${paramIdx++}`);
    params.push(taskType);
  }

  // Only show failed tasks
  conditions.push(`tq.status IN ('failed', 'retrying')`);

  const whereClause = `WHERE ${conditions.join(" AND ")}`;
  const offset = (page - 1) * limit;

  const [errors, total] = await Promise.all([
    query(
      `SELECT tq.id, tq.task_type, tq.id as task_id, tq.error_message,
              tq.retry_count, tq.status, tq.created_at, tq.completed_at as resolved_at
       FROM task_queue tq
       ${whereClause}
       ORDER BY tq.created_at DESC
       LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
      [...params, limit, offset]
    ),
    queryCount(
      `SELECT COUNT(*) as count FROM task_queue tq ${whereClause}`,
      params
    ),
  ]);

  return NextResponse.json({ errors, total });
}

/**
 * PUT /api/errors
 * Retry or abandon a failed task.
 * Body: { task_id: number, action: "retry" | "abandon" }
 */
export async function PUT(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { task_id, action } = body;

  if (!task_id || !action) {
    return NextResponse.json(
      { error: "task_id and action are required" },
      { status: 400 }
    );
  }

  if (action !== "retry" && action !== "abandon") {
    return NextResponse.json(
      { error: 'action must be "retry" or "abandon"' },
      { status: 400 }
    );
  }

  if (action === "retry") {
    // Reset task to pending so it will be picked up again
    const result = await query(
      `UPDATE task_queue
       SET status = 'pending', error_message = NULL, started_at = NULL, completed_at = NULL
       WHERE id = $1 AND status IN ('failed', 'retrying')
       RETURNING id, status`,
      [task_id]
    );
    if (result.length === 0) {
      return NextResponse.json(
        { error: "Task not found or not in retryable state" },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, task: result[0] });
  }

  // action === "abandon"
  const result = await query(
    `UPDATE task_queue
     SET status = 'failed_permanent', completed_at = NOW()
     WHERE id = $1 AND status IN ('failed', 'retrying')
     RETURNING id, status`,
    [task_id]
  );
  if (result.length === 0) {
    return NextResponse.json(
      { error: "Task not found or not in abandonable state" },
      { status: 404 }
    );
  }
  return NextResponse.json({ success: true, task: result[0] });
}
