import { NextRequest, NextResponse } from "next/server";
import { query, queryCount } from "@/lib/db";

export const dynamic = "force-dynamic";

const VALID_TOOL_TYPES = [
  "video_generation", "tts", "lipsync", "image_generation",
  "embedding", "llm", "search", "social_api", "analytics_api",
  "storage", "other",
] as const;

/**
 * GET /api/tools
 * List tool_catalog entries and production_recipes with optional type filter.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const toolType = searchParams.get("tool_type");
  const includeRecipes = searchParams.get("include_recipes") !== "false";
  const page = parseInt(searchParams.get("page") ?? "1", 10);
  const limit = parseInt(searchParams.get("limit") ?? "50", 10);

  if (toolType && !VALID_TOOL_TYPES.includes(toolType as typeof VALID_TOOL_TYPES[number])) {
    return NextResponse.json(
      { error: `Invalid tool_type. Must be one of: ${VALID_TOOL_TYPES.join(", ")}` },
      { status: 400 }
    );
  }

  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIdx = 1;

  if (toolType) {
    conditions.push(`tool_type = $${paramIdx++}`);
    params.push(toolType);
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const offset = (page - 1) * limit;

  // Fetch tools with usage stats from tool_experiences
  const [tools, total] = await Promise.all([
    query(
      `SELECT tc.id, tc.tool_name, tc.tool_type, tc.provider, tc.api_endpoint,
              tc.cost_per_use, tc.strengths, tc.weaknesses, tc.is_active,
              tc.max_resolution, tc.external_docs_url, tc.created_at, tc.updated_at,
              COALESCE(stats.usage_count, 0) as usage_count,
              COALESCE(stats.success_rate, 0) as success_rate,
              COALESCE(stats.avg_quality, 0) as avg_quality
       FROM tool_catalog tc
       LEFT JOIN LATERAL (
         SELECT COUNT(*) as usage_count,
                CASE WHEN COUNT(*) > 0
                  THEN ROUND(SUM(CASE WHEN success THEN 1 ELSE 0 END)::numeric / COUNT(*)::numeric, 4)
                  ELSE 0
                END as success_rate,
                ROUND(COALESCE(AVG(quality_score), 0)::numeric, 4) as avg_quality
         FROM tool_experiences te
         WHERE te.tool_id = tc.id
       ) stats ON true
       ${whereClause}
       ORDER BY tc.tool_type ASC, tc.tool_name ASC
       LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
      [...params, limit, offset]
    ),
    queryCount(
      `SELECT COUNT(*) as count FROM tool_catalog ${whereClause}`,
      params
    ),
  ]);

  // Tool type counts for filter
  const typeCounts = await query<{ tool_type: string; count: string }>(
    `SELECT tool_type, COUNT(*) as count FROM tool_catalog GROUP BY tool_type ORDER BY tool_type`
  );

  const typeCountMap: Record<string, number> = {};
  for (const tc of typeCounts) {
    typeCountMap[tc.tool_type] = parseInt(tc.count, 10);
  }

  // Optionally include recipes
  let recipes: unknown[] = [];
  if (includeRecipes) {
    recipes = await query(
      `SELECT id, recipe_name, content_format, target_platform, steps,
              recommended_for, avg_quality_score, times_used, success_rate,
              created_by, is_default, is_active, created_at, updated_at
       FROM production_recipes
       ORDER BY is_default DESC, times_used DESC
       LIMIT 50`
    );
  }

  return NextResponse.json({
    tools,
    total,
    type_counts: typeCountMap,
    recipes,
  });
}
