"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/select";
import { useTranslation } from "@/lib/i18n";

interface Component {
  id: number;
  component_id: string;
  type: string;
  subtype: string;
  name: string;
  description: string;
  niche: string;
  score: number;
  curated_by: string;
  curation_confidence: number;
  review_status: string;
  created_at: string;
}

export default function CurationReviewPage() {
  const { t } = useTranslation();
  const [components, setComponents] = useState<Component[]>([]);
  const [total, setTotal] = useState(0);
  const [typeFilter, setTypeFilter] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchComponents = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ review_status: "pending_review" });
    if (typeFilter) params.set("type", typeFilter);

    fetch(`/api/components?${params}`)
      .then((res) => res.json())
      .then((data) => {
        setComponents(data.components || []);
        setTotal(data.total || 0);
      })
      .finally(() => setLoading(false));
  }, [typeFilter]);

  useEffect(() => {
    fetchComponents();
  }, [fetchComponents]);

  const handleApprove = async (id: number) => {
    setComponents((prev) => prev.filter((c) => c.id !== id));
  };

  return (
    <div>
      <p className="mb-4 text-muted-foreground">
        {t("curation.pendingComponents").replace("{count}", String(total))}
      </p>

      <div className="mb-4">
        <NativeSelect
          className="w-auto"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          aria-label={t("curation.componentType")}
        >
          <option value="">{t("curation.allTypes")}</option>
          <option value="scenario">scenario</option>
          <option value="motion">motion</option>
          <option value="audio">audio</option>
          <option value="image">image</option>
        </NativeSelect>
      </div>

      {loading ? (
        <div role="progressbar">{t("common.loading")}</div>
      ) : components.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          {t("curation.noPendingComponents")}
        </div>
      ) : (
        <div className="space-y-3">
          {components.map((comp) => (
            <Card key={comp.id} data-component-id={comp.component_id}>
              <CardContent className="pt-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold">{comp.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {comp.type}
                      {comp.subtype ? ` / ${comp.subtype}` : ""}
                    </p>
                    {comp.description && (
                      <p className="text-sm mt-1">{comp.description}</p>
                    )}
                  </div>
                  <div className="text-right text-sm">
                    <p>{t("curation.confidenceLabel")} {comp.curation_confidence ?? "-"}</p>
                    <p>{t("curation.scoreLabel")} {comp.score ?? "-"}</p>
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <Button
                    variant="success"
                    size="sm"
                    onClick={() => handleApprove(comp.id)}
                  >
                    {t("common.approve")}
                  </Button>
                  <Button variant="destructive" size="sm">
                    {t("common.reject")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
