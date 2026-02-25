"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/select";
import { useTranslation } from "@/lib/i18n";

interface Directive {
  id: number;
  directive_type: string;
  content: string;
  target_agents: string[];
  status: string;
  priority: string;
  created_at: string;
}

const DIRECTIVE_TYPES = [
  "strategy",
  "production",
  "posting",
  "measurement",
  "learning_guidance",
] as const;

const TARGET_AGENTS = [
  "strategy",
  "planner",
  "analyst",
  "researcher",
  "all",
] as const;

const PRIORITIES = ["urgent", "high", "normal", "low"] as const;

export default function DirectivesPage() {
  const { t } = useTranslation();
  const [directives, setDirectives] = useState<Directive[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form fields
  const [directiveType, setDirectiveType] = useState<string>(DIRECTIVE_TYPES[0]);
  const [content, setContent] = useState("");
  const [targetAgent, setTargetAgent] = useState<string>("all");
  const [priority, setPriority] = useState<string>("normal");

  const fetchDirectives = useCallback(() => {
    setLoading(true);
    fetch("/api/directives")
      .then((res) => res.json())
      .then((data) => setDirectives(data.directives || []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchDirectives();
  }, [fetchDirectives]);

  const resetForm = () => {
    setDirectiveType(DIRECTIVE_TYPES[0]);
    setContent("");
    setTargetAgent("all");
    setPriority("normal");
    setFormError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!content.trim()) {
      setFormError("Content is required");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/directives", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          directive_type: directiveType,
          content: content.trim(),
          target_agents: [targetAgent],
          priority,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create directive");
      }

      resetForm();
      setShowForm(false);
      fetchDirectives();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading)
    return (
      <div>
        <div role="progressbar">{t("common.loading")}</div>
      </div>
    );

  return (
    <div>
      {/* New Directive Button / Form Toggle */}
      <div className="mb-4">
        {!showForm ? (
          <Button onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            {t("directives.newDirective")}
          </Button>
        ) : (
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">{t("directives.createNewDirective")}</h3>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setShowForm(false);
                    resetForm();
                  }}
                  aria-label="Close form"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      {t("directives.directiveType")}
                    </label>
                    <NativeSelect
                      value={directiveType}
                      onChange={(e) => setDirectiveType(e.target.value)}
                      aria-label="Directive type"
                    >
                      {DIRECTIVE_TYPES.map((dt) => (
                        <option key={dt} value={dt}>
                          {dt}
                        </option>
                      ))}
                    </NativeSelect>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      {t("directives.targetAgent")}
                    </label>
                    <NativeSelect
                      value={targetAgent}
                      onChange={(e) => setTargetAgent(e.target.value)}
                      aria-label="Target agent"
                    >
                      {TARGET_AGENTS.map((a) => (
                        <option key={a} value={a}>
                          {a}
                        </option>
                      ))}
                    </NativeSelect>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      {t("directives.priority")}
                    </label>
                    <NativeSelect
                      value={priority}
                      onChange={(e) => setPriority(e.target.value)}
                      aria-label="Priority"
                    >
                      {PRIORITIES.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </NativeSelect>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    {t("directives.contentLabel")}
                  </label>
                  <Textarea
                    placeholder={t("directives.placeholder")}
                    rows={3}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    required
                  />
                </div>

                {formError && (
                  <p className="text-sm text-destructive">{formError}</p>
                )}

                <div className="flex gap-2">
                  <Button type="submit" disabled={submitting}>
                    {submitting ? t("directives.creating") : t("directives.createDirective")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowForm(false);
                      resetForm();
                    }}
                  >
                    {t("common.cancel")}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Directive List */}
      {directives.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          {t("common.noData")}
        </div>
      ) : (
        <div className="space-y-3">
          {directives.map((d) => (
            <Card key={d.id}>
              <CardContent className="pt-4">
                <div className="flex justify-between">
                  <span className="font-semibold">{d.directive_type}</span>
                  <Badge
                    variant={d.status === "applied" ? "success" : "warning"}
                  >
                    {d.status}
                  </Badge>
                </div>
                <p className="mt-1">{d.content}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Priority: {d.priority}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
