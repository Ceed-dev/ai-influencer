export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { query, queryCount } from "@/lib/db";
import { ALLOWED_TABLES } from "@/lib/database-tables";

export async function GET(
  request: NextRequest,
  { params }: { params: { table: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tableName = params.table;
  if (!ALLOWED_TABLES.has(tableName)) {
    return NextResponse.json({ error: "Table not found" }, { status: 404 });
  }

  const url = new URL(request.url);

  // parseInt + Math.max の NaN バグ対策: Number.isFinite でガード
  const pageRaw = parseInt(url.searchParams.get("page") ?? "1", 10);
  const limitRaw = parseInt(url.searchParams.get("limit") ?? "100", 10);
  const page = Number.isFinite(pageRaw) ? Math.max(1, pageRaw) : 1;
  const limit = Number.isFinite(limitRaw) ? Math.min(200, Math.max(1, limitRaw)) : 100;

  const sort = url.searchParams.get("sort") ?? "";
  const order = url.searchParams.get("order") ?? "";
  const safeOrder = order.toUpperCase() === "ASC" ? "ASC" : "DESC";

  try {
    const columnRows = await query<{ column_name: string; udt_name: string }>(
      `SELECT column_name, udt_name
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1
       ORDER BY ordinal_position`,
      [tableName]
    );

    // vector 型は比較演算子を持たないため ORDER BY 不可 → ソート対象から除外
    const sortableColumns = columnRows
      .filter((r) => r.udt_name !== "vector")
      .map((r) => r.column_name);

    let sortCol: string;
    if (sort && sortableColumns.includes(sort)) {
      sortCol = sort;
    } else if (sortableColumns.includes("created_at")) {
      sortCol = "created_at";
    } else if (sortableColumns.length > 0) {
      sortCol = sortableColumns[0];
    } else {
      // 全列が vector という極端なケース (現実的には発生しないが安全策)
      sortCol = "id";
    }

    const offset = (page - 1) * limit;

    const [rows, total] = await Promise.all([
      query(
        `SELECT * FROM "${tableName}" ORDER BY "${sortCol}" ${safeOrder} LIMIT $1 OFFSET $2`,
        [limit, offset]
      ),
      queryCount(`SELECT COUNT(*) as count FROM "${tableName}"`),
    ]);

    return NextResponse.json({ rows, total, page, limit });
  } catch (err) {
    console.error(`[database/[table]] Error querying ${tableName}:`, err);
    return NextResponse.json(
      { error: "Failed to query table" },
      { status: 500 }
    );
  }
}
