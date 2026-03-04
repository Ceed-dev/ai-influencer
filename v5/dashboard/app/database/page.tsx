"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/swr-config";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table";
import { RefreshCw, ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";
import { TABLE_GROUPS } from "@/lib/database-tables";

// ---- Types ----
interface ColumnMeta {
  name: string;
  type: string;
  isVector: boolean;
  isJsonb: boolean;
  isNullable: boolean;
}
interface TableMeta {
  name: string;
  rowCount: number;
  category: string;
  columns: ColumnMeta[];
}
interface TableData {
  rows: Record<string, unknown>[];
  total: number;
  page: number;
  limit: number;
}

// ---- Constants ----
const MASKED_COLUMNS: Record<string, string[]> = {
  accounts: ["auth_credentials"],
};

// ---- Sub-components ----

/** JSONB: 100文字プレビュー + クリックで全JSON展開 */
function JsonPreviewCell({ value }: { value: unknown }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const str = typeof value === "string" ? value : JSON.stringify(value);
  const preview = str.length > 100 ? str.slice(0, 100) + "…" : str;
  let formatted = str;
  try { formatted = JSON.stringify(JSON.parse(str), null, 2); } catch { /* keep original */ }

  return (
    <div className="relative">
      <button
        className="text-xs text-left font-mono text-muted-foreground hover:text-foreground underline underline-offset-2 max-w-[200px] truncate block"
        onClick={() => setExpanded(!expanded)}
        title={t("database.viewJson")}
      >
        {preview}
      </button>
      {expanded && (
        <div className="absolute z-50 top-full left-0 mt-1 w-96 max-h-80 overflow-auto bg-popover border rounded-md shadow-lg p-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-muted-foreground">{t("database.viewJson")}</p>
            <button
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setExpanded(false)}
            >
              ✕
            </button>
          </div>
          <pre className="text-xs font-mono whitespace-pre-wrap break-all">{formatted}</pre>
        </div>
      )}
    </div>
  );
}

/** Vector: 先頭5値プレビュー + クリックで全次元値を展開 */
function VectorPreviewCell({ value }: { value: unknown }) {
  const [expanded, setExpanded] = useState(false);
  const raw = String(value);

  // pgvector が返す形式: "[0.1234,-0.5678,...]"
  const inner = raw.replace(/^\[|\]$/g, "");
  const nums = inner.split(",").map((s) => parseFloat(s.trim())).filter((n) => !isNaN(n));
  const dims = nums.length;
  if (dims === 0) return <Badge variant="secondary" className="text-xs">[invalid vector]</Badge>;
  const preview = nums.slice(0, 5).map((n) => n.toFixed(4)).join(", ") + (dims > 5 ? ", …" : "");

  return (
    <div className="relative">
      <button
        className="text-xs font-mono text-blue-400 hover:text-blue-300 underline underline-offset-2 whitespace-nowrap"
        onClick={() => setExpanded(!expanded)}
        title={`${dims} dimensions — click to expand`}
      >
        [{preview}] ({dims}d)
      </button>
      {expanded && (
        <div className="absolute z-50 top-full left-0 mt-1 w-72 max-h-72 overflow-auto bg-popover border rounded-md shadow-lg p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground font-semibold">{dims} dimensions</span>
            <button
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setExpanded(false)}
            >
              ✕
            </button>
          </div>
          <pre className="text-xs font-mono whitespace-pre leading-5">
            {nums.map((n, i) => `[${String(i).padStart(4, " ")}] ${n.toFixed(8)}`).join("\n")}
          </pre>
        </div>
      )}
    </div>
  );
}

function renderCell(
  tableName: string,
  col: ColumnMeta,
  value: unknown,
  row: Record<string, unknown>
): React.ReactNode {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground text-xs italic">null</span>;
  }
  // vector column — expandable numeric display
  if (col.isVector) {
    return <VectorPreviewCell value={value} />;
  }
  // masked columns (e.g. auth_credentials)
  if (MASKED_COLUMNS[tableName]?.includes(col.name)) {
    return <Badge variant="outline" className="text-xs">[MASKED]</Badge>;
  }
  // system_settings CRED_ masking
  if (
    tableName === "system_settings" &&
    col.name === "setting_value" &&
    typeof row["setting_key"] === "string" &&
    (row["setting_key"] as string).startsWith("CRED_")
  ) {
    return <span className="text-muted-foreground text-xs">••••••••</span>;
  }
  // JSONB preview
  if (col.isJsonb) {
    return <JsonPreviewCell value={value} />;
  }
  // timestamp
  if (col.type === "timestamp with time zone" || col.type === "timestamp without time zone") {
    try {
      return <span className="text-xs whitespace-nowrap">{new Date(String(value)).toLocaleString()}</span>;
    } catch { /* fall through */ }
  }
  // long string
  const str = String(value);
  if (str.length > 80) {
    return <span className="text-xs font-mono" title={str}>{str.slice(0, 80)}…</span>;
  }
  return <span className="text-xs font-mono">{str}</span>;
}

// ---- Main Page ----
export default function DatabasePage() {
  const { t } = useTranslation();
  const [selectedTable, setSelectedTable] = useState<string>("characters");
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);
  const [sortCol, setSortCol] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const [secondsAgo, setSecondsAgo] = useState(0);

  // Tables metadata (60s refresh)
  const { data: tablesData } = useSWR<{ tables: TableMeta[] }>(
    "/api/database/tables",
    fetcher,
    { refreshInterval: 60000 }
  );

  // Selected table data (60s refresh)
  const { data: tableData, isLoading: isTableLoading, error: tableError, mutate: refreshData } = useSWR<TableData>(
    selectedTable
      ? `/api/database/${selectedTable}?page=${page}&sort=${sortCol}&order=${sortOrder}`
      : null,
    fetcher,
    {
      refreshInterval: 60000,
      onSuccess: () => {
        setLastUpdatedAt(Date.now());
        setSecondsAgo(0);
      },
    }
  );

  // 1-second ticker for LIVE indicator
  useEffect(() => {
    if (lastUpdatedAt === null) return;
    const interval = setInterval(() => {
      setSecondsAgo(Math.floor((Date.now() - lastUpdatedAt) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [lastUpdatedAt]);

  const handleTableSelect = useCallback((name: string) => {
    setSelectedTable(name);
    setPage(1);
    setSortCol("");
    setSortOrder("desc");
    setLastUpdatedAt(null);
    setSecondsAgo(0);
  }, []);

  const handleSort = useCallback((colName: string) => {
    setSortOrder(prev => sortCol === colName ? (prev === "asc" ? "desc" : "asc") : "desc");
    setSortCol(colName);
    setPage(1);
  }, [sortCol]);

  const selectedMeta = useMemo(
    () => tablesData?.tables.find(tbl => tbl.name === selectedTable),
    [tablesData, selectedTable]
  );
  const columns = selectedMeta?.columns ?? [];
  const rows = tableData?.rows ?? [];
  const total = tableData?.total ?? 0;
  const limit = tableData?.limit ?? 100;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  // Filter tables for left panel
  const filteredGroups = useMemo(() =>
    TABLE_GROUPS.map(group => ({
      ...group,
      tables: group.tables.filter(name =>
        !filter || name.toLowerCase().includes(filter.toLowerCase())
      ),
    })).filter(group => group.tables.length > 0),
  [filter]);

  return (
    <div className="flex h-[calc(100vh-120px)] gap-0">
      {/* Left panel: table list */}
      <div className="w-64 shrink-0 border-r flex flex-col">
        <div className="p-3 border-b">
          <Input
            placeholder={t("database.filterTables")}
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="h-8 text-sm"
          />
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {filteredGroups.map(group => {
            return (
              <div key={group.key} className="mb-3">
                <p className="px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  {t(`database.groups.${group.key}`)}
                </p>
                {group.tables.map(name => {
                  const meta = tablesData?.tables.find(m => m.name === name);
                  const isSelected = selectedTable === name;
                  return (
                    <button
                      key={name}
                      onClick={() => handleTableSelect(name)}
                      className={cn(
                        "w-full text-left px-2 py-1.5 rounded text-sm flex items-center justify-between gap-2 hover:bg-accent transition-colors",
                        isSelected && "bg-accent font-semibold text-accent-foreground"
                      )}
                    >
                      <span className="truncate font-mono text-xs">{name}</span>
                      {meta !== undefined && (
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {meta.rowCount.toLocaleString()}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Right panel: data table */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b shrink-0 flex-wrap">
          <h2 className="font-mono font-bold text-base">{selectedTable}</h2>
          {selectedMeta && (
            <Badge variant="secondary" className="text-xs">
              {selectedMeta.rowCount.toLocaleString()} {t("database.rows")}
            </Badge>
          )}
          {/* LIVE indicator */}
          <div className="flex items-center gap-1.5 ml-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
            <span className="text-xs font-semibold text-red-500">{t("database.live")}</span>
          </div>
          {lastUpdatedAt !== null && (
            <span className="text-xs text-muted-foreground">
              {t("database.lastUpdated").replace("{s}", String(secondsAgo))}
            </span>
          )}
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1"
              onClick={() => refreshData()}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {t("database.refresh")}
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {tableError ? (
            <div className="flex items-center justify-center h-full text-destructive text-sm">
              {t("common.error")}
            </div>
          ) : isTableLoading && rows.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              {t("common.loading")}
            </div>
          ) : columns.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              {t("common.loading")}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map(col => (
                    <TableHead
                      key={col.name}
                      className={cn(
                        "whitespace-nowrap select-none",
                        col.isVector ? "cursor-default" : "cursor-pointer hover:bg-accent/50"
                      )}
                      onClick={() => { if (!col.isVector) handleSort(col.name); }}
                    >
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-semibold">{col.name}</span>
                        {col.isVector && (
                          <span className="text-[9px] text-blue-400 font-mono">vec</span>
                        )}
                        {sortCol === col.name ? (
                          sortOrder === "asc"
                            ? <ChevronUp className="h-3 w-3" />
                            : <ChevronDown className="h-3 w-3" />
                        ) : null}
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="text-center text-muted-foreground py-8 text-sm">
                      {t("database.noData")}
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row, rowIdx) => (
                    <TableRow key={row["id"] !== undefined ? String(row["id"]) : rowIdx}>
                      {columns.map(col => (
                        <TableCell key={col.name} className="py-1.5 px-3 align-top max-w-[300px]">
                          {renderCell(selectedTable, col, row[col.name], row)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t shrink-0 text-sm">
          <span className="text-muted-foreground text-xs">
            {t("database.page")
              .replace("{n}", String(page))
              .replace("{total}", String(totalPages))}
            {" "}{t("database.totalCount").replace("{n}", total.toLocaleString())}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-7"
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
            >
              {t("common.prev")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7"
              disabled={page >= totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            >
              {t("common.next")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
