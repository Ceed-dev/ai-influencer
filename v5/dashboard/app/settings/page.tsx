"use client";

import { useState, useEffect, useCallback } from "react";

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

export default function SettingsPage() {
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

  return (
    <main className="min-h-screen p-8">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      {/* Category Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            className="px-3 py-1 rounded text-sm font-medium"
            style={{
              backgroundColor:
                activeCategory === cat
                  ? "var(--accent-blue)"
                  : "var(--card-bg)",
              color: activeCategory === cat ? "#fff" : "var(--fg)",
            }}
            onClick={() => setActiveCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <th className="text-left p-2">Key</th>
                <th className="text-left p-2">Value</th>
                <th className="text-left p-2">Type</th>
                <th className="text-left p-2">Description</th>
                <th className="text-left p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSettings.map((s) => (
                <tr
                  key={s.setting_key}
                  style={{ borderBottom: "1px solid var(--border)" }}
                >
                  <td className="p-2 font-mono text-xs">{s.setting_key}</td>
                  <td className="p-2">
                    {editingKey === s.setting_key ? (
                      <input
                        type="text"
                        className="w-full p-1 rounded text-sm"
                        style={{
                          backgroundColor: "var(--bg)",
                          color: "var(--fg)",
                        }}
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                      />
                    ) : (
                      <span className="font-mono text-xs">
                        {JSON.stringify(s.setting_value)}
                      </span>
                    )}
                  </td>
                  <td className="p-2">
                    <span
                      className="px-2 py-1 rounded text-xs"
                      style={{
                        backgroundColor: "var(--card-bg)",
                      }}
                    >
                      {s.value_type}
                    </span>
                  </td>
                  <td className="p-2 text-xs" style={{ color: "var(--muted)" }}>
                    {s.description}
                  </td>
                  <td className="p-2">
                    {editingKey === s.setting_key ? (
                      <div className="flex gap-1">
                        <button
                          className="px-2 py-1 rounded text-xs"
                          style={{
                            backgroundColor: "var(--success)",
                            color: "#fff",
                          }}
                          onClick={() => handleSave(s.setting_key)}
                        >
                          Save
                        </button>
                        <button
                          className="px-2 py-1 rounded text-xs"
                          style={{
                            backgroundColor: "var(--muted)",
                            color: "#fff",
                          }}
                          onClick={() => setEditingKey(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        className="px-2 py-1 rounded text-xs"
                        style={{
                          backgroundColor: "var(--accent-blue)",
                          color: "#fff",
                        }}
                        onClick={() => {
                          setEditingKey(s.setting_key);
                          setEditValue(JSON.stringify(s.setting_value));
                        }}
                      >
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
