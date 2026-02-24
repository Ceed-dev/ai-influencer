import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

/**
 * GET /api/performance
 * Account-level performance summary: views, engagement rate per account.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get("account_id");

  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIdx = 1;

  if (accountId) {
    conditions.push(`a.account_id = $${paramIdx++}`);
    params.push(accountId);
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const performance = await query(
    `SELECT
       a.account_id,
       a.platform,
       a.platform_username,
       a.follower_count,
       a.status,
       COALESCE(stats.total_views, 0) as total_views,
       COALESCE(stats.total_likes, 0) as total_likes,
       COALESCE(stats.total_comments, 0) as total_comments,
       COALESCE(stats.total_shares, 0) as total_shares,
       COALESCE(stats.publication_count, 0) as publication_count,
       CASE WHEN COALESCE(stats.total_views, 0) > 0
         THEN ROUND((COALESCE(stats.total_likes, 0) + COALESCE(stats.total_comments, 0) + COALESCE(stats.total_shares, 0))::numeric / stats.total_views * 100, 2)
         ELSE 0
       END as engagement_rate
     FROM accounts a
     LEFT JOIN (
       SELECT
         p.account_id,
         COUNT(*)::int as publication_count,
         SUM(COALESCE(m.views, 0)) as total_views,
         SUM(COALESCE(m.likes, 0)) as total_likes,
         SUM(COALESCE(m.comments, 0)) as total_comments,
         SUM(COALESCE(m.shares, 0)) as total_shares
       FROM publications p
       LEFT JOIN metrics m ON m.publication_id = p.id
       GROUP BY p.account_id
     ) stats ON stats.account_id = a.account_id
     ${whereClause}
     ORDER BY COALESCE(stats.total_views, 0) DESC`,
    params
  );

  return NextResponse.json({ performance });
}
