import { NextRequest, NextResponse } from "next/server";
import { query, queryCount } from "@/lib/db";

/**
 * GET /api/weights/audit
 * Returns weight change audit log entries.
 * Spec: api-schemas.ts #17 (GetWeightAuditRequest/Response)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const platform = searchParams.get("platform");
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? Math.min(parseInt(limitParam, 10) || 50, 200) : 50;

  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIdx = 1;

  if (platform) {
    conditions.push(`platform = $${paramIdx++}`);
    params.push(platform);
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  // Get total count
  const total = await queryCount(
    `SELECT COUNT(*) AS count FROM weight_audit_log ${whereClause}`,
    params
  );

  // Get audit log entries
  const countParams = [...params, limit];
  const data = await query(
    `SELECT id, platform, factor_name, old_weight, new_weight,
            data_count, metrics_count, calculated_at
     FROM weight_audit_log ${whereClause}
     ORDER BY calculated_at DESC
     LIMIT $${paramIdx}`,
    countParams
  );

  const auditLogs = data.map((row) => {
    const r = row as Record<string, unknown>;
    return {
      id: r.id as number,
      platform: r.platform as string,
      factor_name: r.factor_name as string,
      old_weight: Number(r.old_weight),
      new_weight: Number(r.new_weight),
      data_count: r.data_count as number,
      metrics_count: r.metrics_count as number,
      calculated_at: r.calculated_at
        ? (r.calculated_at as Date).toISOString()
        : new Date().toISOString(),
    };
  });

  return NextResponse.json({
    audit_logs: auditLogs,
    total,
  });
}
