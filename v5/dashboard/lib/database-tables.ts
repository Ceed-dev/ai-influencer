export const TABLE_GROUPS = [
  { key: "entity", tables: ["characters", "accounts", "components"] },
  {
    key: "production",
    tables: ["content", "content_sections", "publications"],
  },
  {
    key: "intelligence",
    tables: [
      "hypotheses",
      "market_intel",
      "metrics",
      "analyses",
      "learnings",
      "content_learnings",
      "prediction_weights",
      "weight_audit_log",
      "prediction_snapshots",
      "kpi_snapshots",
      "account_baselines",
      "adjustment_factor_cache",
    ],
  },
  {
    key: "operations",
    tables: [
      "cycles",
      "human_directives",
      "task_queue",
      "algorithm_performance",
    ],
  },
  {
    key: "observability",
    tables: [
      "agent_prompt_versions",
      "agent_thought_logs",
      "agent_reflections",
      "agent_individual_learnings",
      "agent_communications",
    ],
  },
  {
    key: "tool_management",
    tables: [
      "tool_catalog",
      "tool_experiences",
      "tool_external_sources",
      "production_recipes",
      "prompt_suggestions",
    ],
  },
  { key: "system", tables: ["system_settings"] },
];

export const ALLOWED_TABLES = new Set(TABLE_GROUPS.flatMap((g) => g.tables));
