"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTranslation } from "@/lib/i18n";

interface Character {
  id: number;
  character_id: string;
  name: string;
  description: string | null;
  appearance: Record<string, unknown> | null;
  personality: Record<string, unknown> | null;
  voice_id: string;
  image_drive_id: string | null;
  status: string;
  created_by: string;
  generation_metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

const STATUSES = ["draft", "pending_review", "active", "archived"] as const;

export default function CharactersPage() {
  const { t } = useTranslation();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const limit = 20;

  const fetchCharacters = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    params.set("page", page.toString());
    params.set("limit", limit.toString());

    fetch(`/api/characters?${params}`)
      .then((res) => res.json())
      .then((data) => {
        setCharacters(data.characters || []);
        setTotal(data.total || 0);
      })
      .catch((err) => console.error("Failed to fetch characters:", err))
      .finally(() => setLoading(false));
  }, [statusFilter, page]);

  useEffect(() => {
    fetchCharacters();
  }, [fetchCharacters]);

  const totalPages = Math.ceil(total / limit);

  const statusVariant = (status: string) => {
    switch (status) {
      case "active":
        return "success" as const;
      case "archived":
        return "secondary" as const;
      case "pending_review":
        return "warning" as const;
      default:
        return "outline" as const;
    }
  };

  const formatAppearance = (appearance: Record<string, unknown> | null): string => {
    if (!appearance) return "-";
    const parts: string[] = [];
    if (appearance.gender) parts.push(String(appearance.gender));
    if (appearance.age_range) parts.push(String(appearance.age_range));
    if (appearance.style) parts.push(String(appearance.style));
    if (appearance.hair_color) parts.push(`hair: ${appearance.hair_color}`);
    return parts.length > 0 ? parts.join(", ") : "-";
  };

  const formatPersonality = (personality: Record<string, unknown> | null): string => {
    if (!personality) return "-";
    const traits = personality.traits as string[] | undefined;
    if (traits && traits.length > 0) {
      return traits.slice(0, 3).join(", ");
    }
    if (personality.speaking_style) return String(personality.speaking_style);
    return "-";
  };

  return (
    <div>
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("characters.total")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{total}</div>
          </CardContent>
        </Card>
        {STATUSES.map((s) => {
          const count = characters.filter((c) => c.status === s).length;
          return (
            <Card key={s}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground capitalize">
                  {s.replace("_", " ")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Badge variant={statusVariant(s)}>{statusFilter === "" ? count : count}</Badge>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Status Filter */}
      <div className="flex gap-4 mb-4">
        <NativeSelect
          className="w-auto"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          aria-label="Status filter"
        >
          <option value="">{t("common.allStatuses")}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace("_", " ")}
            </option>
          ))}
        </NativeSelect>
      </div>

      {/* Character Table */}
      {loading ? (
        <div role="progressbar">{t("common.loading")}</div>
      ) : characters.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          {t("characters.noCharactersFound")}
        </div>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("characters.characterId")}</TableHead>
                <TableHead>{t("characters.name")}</TableHead>
                <TableHead>{t("characters.voiceId")}</TableHead>
                <TableHead>{t("characters.appearance")}</TableHead>
                <TableHead>{t("characters.personality")}</TableHead>
                <TableHead>{t("characters.status")}</TableHead>
                <TableHead>{t("characters.createdBy")}</TableHead>
                <TableHead>{t("characters.created")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {characters.map((chr) => (
                <TableRow key={chr.character_id}>
                  <TableCell className="font-mono text-xs">
                    {chr.character_id}
                  </TableCell>
                  <TableCell className="font-medium">{chr.name}</TableCell>
                  <TableCell className="font-mono text-xs truncate max-w-[120px]" title={chr.voice_id}>
                    {chr.voice_id}
                  </TableCell>
                  <TableCell className="text-xs max-w-[200px] truncate" title={formatAppearance(chr.appearance)}>
                    {formatAppearance(chr.appearance)}
                  </TableCell>
                  <TableCell className="text-xs max-w-[200px] truncate" title={formatPersonality(chr.personality)}>
                    {formatPersonality(chr.personality)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(chr.status)}>
                      {chr.status.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={chr.created_by === "curator" ? "default" : "secondary"}>
                      {chr.created_by}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">
                    {new Date(chr.created_at).toLocaleString("ja-JP")}
                  </TableCell>
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
