"use client";

import { useState } from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NativeSelect } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fetcher, swrConfig } from "@/lib/swr-config";
import { useTranslation } from "@/lib/i18n";

interface ContentItem {
  content_id: string;
  title: string;
  content_format: string;
  review_status: string;
  quality_score: number;
  created_at: string;
}

interface ContentResponse {
  content: ContentItem[];
  total: number;
}

export default function ContentPage() {
  const { t } = useTranslation();
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const limit = 20;

  // Build SWR key from filter params
  const params = new URLSearchParams();
  if (statusFilter) params.set("status", statusFilter);
  params.set("page", page.toString());
  params.set("limit", limit.toString());
  const swrKey = `/api/content?${params.toString()}`;

  const { data, isLoading } = useSWR<ContentResponse>(swrKey, fetcher, {
    refreshInterval: swrConfig.refreshInterval,
    revalidateOnFocus: swrConfig.revalidateOnFocus,
    dedupingInterval: swrConfig.dedupingInterval,
  });

  const content = data?.content ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      <div className="mb-4">
        <NativeSelect
          className="w-auto"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          aria-label={t("content.statusFilter")}
        >
          <option value="">{t("common.allStatuses")}</option>
          <option value="draft">draft</option>
          <option value="pending_approval">pending_approval</option>
          <option value="planned">planned</option>
          <option value="published">published</option>
        </NativeSelect>
      </div>
      {isLoading ? (
        <div role="progressbar">{t("common.loading")}</div>
      ) : content.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          {t("content.noContent")}
        </div>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("content.id")}</TableHead>
                <TableHead>{t("content.title")}</TableHead>
                <TableHead>{t("content.format")}</TableHead>
                <TableHead>{t("content.status")}</TableHead>
                <TableHead>{t("content.qualityScore")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {content.map((item) => (
                <TableRow key={item.content_id}>
                  <TableCell>{item.content_id}</TableCell>
                  <TableCell className="truncate max-w-xs">
                    {item.title}
                  </TableCell>
                  <TableCell>{item.content_format}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{item.review_status}</Badge>
                  </TableCell>
                  <TableCell>{item.quality_score}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {totalPages > 1 && (
            <div className="flex gap-2 mt-4 justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
              >
                {t("common.prev")}
              </Button>
              <span className="px-3 py-1 text-sm">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
              >
                {t("common.next")}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
