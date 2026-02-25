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

interface Tool {
  id: number;
  tool_name: string;
  tool_type: string;
  provider: string | null;
  api_endpoint: string | null;
  cost_per_use: number | null;
  strengths: string[] | null;
  weaknesses: string[] | null;
  is_active: boolean;
  max_resolution: string | null;
  external_docs_url: string | null;
  created_at: string;
  updated_at: string;
  usage_count: number;
  success_rate: number;
  avg_quality: number;
}

interface Recipe {
  id: number;
  recipe_name: string;
  content_format: string;
  target_platform: string | null;
  steps: Array<{ order: number; step_name: string; tool_name: string }>;
  avg_quality_score: number | null;
  times_used: number;
  success_rate: number | null;
  created_by: string | null;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
}

const TOOL_TYPES = [
  "video_generation", "tts", "lipsync", "image_generation",
  "embedding", "llm", "search", "social_api", "analytics_api",
  "storage", "other",
] as const;

type ViewMode = "tools" | "recipes";

export default function ToolsPage() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [total, setTotal] = useState(0);
  const [typeCounts, setTypeCounts] = useState<Record<string, number>>({});
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [viewMode, setViewMode] = useState<ViewMode>("tools");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const limit = 20;

  const fetchTools = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (typeFilter) params.set("tool_type", typeFilter);
    params.set("page", page.toString());
    params.set("limit", limit.toString());

    fetch(`/api/tools?${params}`)
      .then((res) => res.json())
      .then((data) => {
        setTools(data.tools || []);
        setRecipes(data.recipes || []);
        setTotal(data.total || 0);
        setTypeCounts(data.type_counts || {});
      })
      .catch((err) => console.error("Failed to fetch tools:", err))
      .finally(() => setLoading(false));
  }, [typeFilter, page]);

  useEffect(() => {
    fetchTools();
  }, [fetchTools]);

  const totalPages = Math.ceil(total / limit);

  const formatPercent = (val: number) => `${(Number(val) * 100).toFixed(1)}%`;

  const totalTools = Object.values(typeCounts).reduce((a, b) => a + b, 0);

  return (
    <div>
      {/* View Mode Toggle */}
      <div className="flex gap-2 mb-6">
        <Button
          variant={viewMode === "tools" ? "default" : "secondary"}
          size="sm"
          onClick={() => setViewMode("tools")}
        >
          Tools ({totalTools})
        </Button>
        <Button
          variant={viewMode === "recipes" ? "default" : "secondary"}
          size="sm"
          onClick={() => setViewMode("recipes")}
        >
          Recipes ({recipes.length})
        </Button>
      </div>

      {viewMode === "tools" ? (
        <>
          {/* Type Filter */}
          <div className="flex gap-4 mb-4">
            <NativeSelect
              className="w-auto"
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setPage(1);
              }}
              aria-label="Tool type filter"
            >
              <option value="">All types ({totalTools})</option>
              {TOOL_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, " ")} ({typeCounts[t] || 0})
                </option>
              ))}
            </NativeSelect>
          </div>

          {/* Tools Table */}
          {loading ? (
            <div role="progressbar">Loading...</div>
          ) : tools.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No tools found
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tool Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Cost/Use</TableHead>
                    <TableHead>Usage</TableHead>
                    <TableHead>Success Rate</TableHead>
                    <TableHead>Avg Quality</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Resolution</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tools.map((tool) => (
                    <TableRow key={tool.id}>
                      <TableCell className="font-medium">
                        {tool.external_docs_url ? (
                          <a
                            href={tool.external_docs_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:underline"
                          >
                            {tool.tool_name}
                          </a>
                        ) : (
                          tool.tool_name
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {tool.tool_type.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {tool.provider || "-"}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {tool.cost_per_use != null
                          ? `$${Number(tool.cost_per_use).toFixed(4)}`
                          : "-"}
                      </TableCell>
                      <TableCell className="font-mono">
                        {Number(tool.usage_count)}
                      </TableCell>
                      <TableCell>
                        {Number(tool.usage_count) > 0 ? (
                          <Badge
                            variant={
                              Number(tool.success_rate) >= 0.9
                                ? "success"
                                : Number(tool.success_rate) >= 0.7
                                  ? "warning"
                                  : "destructive"
                            }
                          >
                            {formatPercent(tool.success_rate)}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">
                            N/A
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {Number(tool.usage_count) > 0
                          ? formatPercent(tool.avg_quality)
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={tool.is_active ? "success" : "destructive"}
                        >
                          {tool.is_active ? "active" : "inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {tool.max_resolution || "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Tool Strengths/Weaknesses Detail */}
              {tools.some(
                (t) =>
                  (t.strengths && t.strengths.length > 0) ||
                  (t.weaknesses && t.weaknesses.length > 0)
              ) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                  {tools
                    .filter(
                      (t) =>
                        (t.strengths && t.strengths.length > 0) ||
                        (t.weaknesses && t.weaknesses.length > 0)
                    )
                    .slice(0, 6)
                    .map((tool) => (
                      <Card key={`detail-${tool.id}`}>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">
                            {tool.tool_name}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="text-xs space-y-2">
                          {tool.strengths && tool.strengths.length > 0 && (
                            <div>
                              <span className="font-semibold text-green-400">
                                Strengths:{" "}
                              </span>
                              {tool.strengths.join(", ")}
                            </div>
                          )}
                          {tool.weaknesses && tool.weaknesses.length > 0 && (
                            <div>
                              <span className="font-semibold text-red-400">
                                Weaknesses:{" "}
                              </span>
                              {tool.weaknesses.join(", ")}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                </div>
              )}

              {totalPages > 1 && (
                <div className="flex gap-2 mt-4 justify-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                  >
                    Prev
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
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </>
      ) : (
        /* Recipes View */
        <>
          {loading ? (
            <div role="progressbar">Loading...</div>
          ) : recipes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No recipes found
            </div>
          ) : (
            <div className="space-y-4">
              {recipes.map((recipe) => (
                <Card key={recipe.id}>
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-base">
                        {recipe.recipe_name}
                      </CardTitle>
                      <div className="flex gap-2">
                        {recipe.is_default && (
                          <Badge variant="default">default</Badge>
                        )}
                        <Badge
                          variant={recipe.is_active ? "success" : "destructive"}
                        >
                          {recipe.is_active ? "active" : "inactive"}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm mb-3">
                      <div>
                        <span className="text-muted-foreground">Format: </span>
                        <Badge variant="secondary">
                          {recipe.content_format.replace(/_/g, " ")}
                        </Badge>
                      </div>
                      <div>
                        <span className="text-muted-foreground">
                          Platform:{" "}
                        </span>
                        {recipe.target_platform || "all"}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Used: </span>
                        {recipe.times_used}x
                      </div>
                      <div>
                        <span className="text-muted-foreground">
                          Quality:{" "}
                        </span>
                        {recipe.avg_quality_score != null
                          ? formatPercent(recipe.avg_quality_score)
                          : "N/A"}
                      </div>
                      <div>
                        <span className="text-muted-foreground">
                          Success:{" "}
                        </span>
                        {recipe.success_rate != null
                          ? formatPercent(recipe.success_rate)
                          : "N/A"}
                      </div>
                    </div>
                    {/* Steps */}
                    <div className="text-xs">
                      <span className="font-semibold text-muted-foreground">
                        Steps:{" "}
                      </span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {recipe.steps.map((step, idx) => (
                          <Badge
                            key={idx}
                            variant="outline"
                            className="font-mono"
                          >
                            {step.order}. {step.step_name} ({step.tool_name})
                          </Badge>
                        ))}
                      </div>
                    </div>
                    {recipe.created_by && (
                      <div className="text-xs text-muted-foreground mt-2">
                        Created by: {recipe.created_by}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
