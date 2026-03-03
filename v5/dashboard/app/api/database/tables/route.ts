export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { query } from "@/lib/db";
import { TABLE_GROUPS, ALLOWED_TABLES } from "@/lib/database-tables";

interface ColumnInfo {
  name: string;
  type: string;
  isVector: boolean;
  isJsonb: boolean;
  isNullable: boolean;
}

interface TableInfo {
  name: string;
  rowCount: number;
  category: string;
  columns: ColumnInfo[];
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allTables = [...ALLOWED_TABLES];

  try {
    const [countRows, columnRows] = await Promise.all([
      // pg_stat_user_tables.n_live_tup: autovacuum が更新する実行時統計。
      // pg_class.reltuples は ANALYZE 未実行だと -1 になるため不適。
      query<{ relname: string; row_count: string }>(
        `SELECT relname, n_live_tup::bigint AS row_count
         FROM pg_stat_user_tables
         WHERE schemaname = 'public' AND relname = ANY($1)`,
        [allTables]
      ),
      query<{
        table_name: string;
        column_name: string;
        data_type: string;
        udt_name: string;
        is_nullable: string;
      }>(
        `SELECT table_name, column_name, data_type, udt_name, is_nullable
         FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = ANY($1)
         ORDER BY table_name, ordinal_position`,
        [allTables]
      ),
    ]);

    const rowCountMap = new Map<string, number>();
    for (const row of countRows) {
      rowCountMap.set(row.relname, Number(row.row_count));
    }

    const columnMap = new Map<string, ColumnInfo[]>();
    for (const row of columnRows) {
      const cols = columnMap.get(row.table_name) ?? [];
      cols.push({
        name: row.column_name,
        type: row.data_type,
        isVector: row.udt_name === "vector",
        isJsonb: row.data_type === "jsonb",
        isNullable: row.is_nullable === "YES",
      });
      columnMap.set(row.table_name, cols);
    }

    const tables: TableInfo[] = [];
    for (const group of TABLE_GROUPS) {
      for (const tableName of group.tables) {
        tables.push({
          name: tableName,
          rowCount: rowCountMap.get(tableName) ?? 0,
          category: group.key,
          columns: columnMap.get(tableName) ?? [],
        });
      }
    }

    return NextResponse.json({ tables });
  } catch (err) {
    console.error("[database/tables] Error fetching table metadata:", err);
    return NextResponse.json(
      { error: "Failed to fetch table metadata" },
      { status: 500 }
    );
  }
}
