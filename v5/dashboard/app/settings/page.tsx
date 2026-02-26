"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface SystemSetting {
  setting_key: string;
  setting_value: unknown;
  category: string;
  description: string;
  default_value: unknown;
  value_type: string;
  constraints: Record<string, unknown> | null;
  updated_at: string;
  updated_by: string;
}

const CATEGORIES = [
  "production",
  "posting",
  "review",
  "agent",
  "measurement",
  "cost_control",
  "dashboard",
  "credentials",
] as const;

function formatValueType(type: string): string {
  if (type === "json") return "JSON";
  return type.charAt(0).toUpperCase() + type.slice(1);
}

export default function SettingsPage() {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>("production");
  const [loading, setLoading] = useState(true);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>("");

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings");
      const data = await res.json();
      setSettings(data.settings || []);
    } catch (err) {
      console.error("Failed to fetch settings:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async (key: string) => {
    try {
      let parsedValue: unknown;
      try {
        parsedValue = JSON.parse(editValue);
      } catch {
        parsedValue = editValue;
      }

      const res = await fetch(`/api/settings/${key}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: parsedValue }),
      });

      if (res.ok) {
        setEditingKey(null);
        fetchSettings();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to save");
      }
    } catch (err) {
      console.error("Save failed:", err);
    }
  };

  const filteredSettings = settings.filter(
    (s) => s.category === activeCategory
  );

  const getDescription = (s: SystemSetting): string => {
    const i18nKey = `settings.descriptions.${s.setting_key}`;
    const translated = t(i18nKey);
    // If t() returns the key itself, fall back to DB description
    return translated !== i18nKey ? translated : s.description;
  };

  return (
    <div>
      {/* Category Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {CATEGORIES.map((cat) => (
          <Button
            key={cat}
            variant={activeCategory === cat ? "default" : "secondary"}
            size="sm"
            onClick={() => setActiveCategory(cat)}
          >
            {t(`settings.categories.${cat}`)}
          </Button>
        ))}
      </div>

      {/* Settings <table> via Shadcn Table component */}
      {loading ? (
        <p>{t("common.loading")}</p>
      ) : (
        <Table className="table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[22%]">{t("settings.key")}</TableHead>
              <TableHead className="w-[18%]">{t("settings.value")}</TableHead>
              <TableHead className="w-[8%]">{t("settings.type")}</TableHead>
              <TableHead className="w-[40%]">{t("settings.description")}</TableHead>
              <TableHead className="w-[12%]">{t("settings.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSettings.map((s) => (
              <TableRow key={s.setting_key}>
                <TableCell className="font-mono text-xs truncate">
                  {s.setting_key}
                </TableCell>
                <TableCell className="truncate">
                  {editingKey === s.setting_key ? (
                    <Input
                      className="h-8"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                    />
                  ) : (
                    <span className="font-mono text-xs">
                      {JSON.stringify(s.setting_value)}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{formatValueType(s.value_type)}</Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {getDescription(s)}
                </TableCell>
                <TableCell>
                  {editingKey === s.setting_key ? (
                    <div className="flex flex-col gap-1">
                      <Button
                        variant="success"
                        size="sm"
                        className="w-full"
                        onClick={() => handleSave(s.setting_key)}
                      >
                        {t("common.save")}
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="w-full"
                        onClick={() => setEditingKey(null)}
                      >
                        {t("common.cancel")}
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => {
                        setEditingKey(s.setting_key);
                        setEditValue(JSON.stringify(s.setting_value));
                      }}
                    >
                      {t("common.edit")}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
