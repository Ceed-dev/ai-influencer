/**
 * FEAT-STR-008: Agent thought log recording
 * Spec: 04-agent-design.md §4.12, 02-architecture.md §7
 *
 * Records agent reasoning/decisions into agent_thought_logs.
 * Every LLM call by any agent should log its input, reasoning, decision, and output.
 * All config from DB system_settings — no hardcoding.
 */
import type { PoolClient } from 'pg';
import type { AgentType, TokenUsage } from '@/types/database';

/** Input for recording a thought log */
export interface ThoughtLogInput {
  agentType: AgentType;
  cycleId: number | null;
  graphName: string;
  nodeName: string;
  inputSummary?: Record<string, unknown> | null;
  reasoning: string;
  decision: string;
  outputSummary?: Record<string, unknown> | null;
  toolsUsed?: string[] | null;
  llmModel?: string | null;
  tokenUsage?: TokenUsage | null;
  durationMs?: number | null;
}

/** Result of recording a thought log */
export interface ThoughtLogResult {
  thoughtLogId: string;
  createdAt: string;
}

/**
 * Record an agent's thought process (reasoning + decision).
 */
export async function recordThoughtLog(
  client: PoolClient,
  input: ThoughtLogInput,
): Promise<ThoughtLogResult> {
  const res = await client.query(
    `INSERT INTO agent_thought_logs
       (agent_type, cycle_id, graph_name, node_name, input_summary,
        reasoning, decision, output_summary, tools_used, llm_model,
        token_usage, duration_ms)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING id, created_at`,
    [
      input.agentType,
      input.cycleId,
      input.graphName,
      input.nodeName,
      input.inputSummary ? JSON.stringify(input.inputSummary) : null,
      input.reasoning,
      input.decision,
      input.outputSummary ? JSON.stringify(input.outputSummary) : null,
      input.toolsUsed ?? null,
      input.llmModel ?? null,
      input.tokenUsage ? JSON.stringify(input.tokenUsage) : null,
      input.durationMs ?? null,
    ],
  );

  const row = res.rows[0] as Record<string, unknown>;
  return {
    thoughtLogId: row['id'] as string,
    createdAt: String(row['created_at']),
  };
}

/**
 * Get recent thought logs for an agent type.
 */
export async function getRecentThoughtLogs(
  client: PoolClient,
  agentType: AgentType,
  limit: number = 20,
): Promise<Array<{
  thoughtLogId: string;
  graphName: string;
  nodeName: string;
  decision: string;
  durationMs: number | null;
  createdAt: string;
}>> {
  const res = await client.query(
    `SELECT id, graph_name, node_name, decision, duration_ms, created_at
     FROM agent_thought_logs
     WHERE agent_type = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [agentType, limit],
  );

  return res.rows.map((row) => {
    const r = row as Record<string, unknown>;
    return {
      thoughtLogId: r['id'] as string,
      graphName: r['graph_name'] as string,
      nodeName: r['node_name'] as string,
      decision: r['decision'] as string,
      durationMs: r['duration_ms'] != null ? Number(r['duration_ms']) : null,
      createdAt: String(r['created_at']),
    };
  });
}

/**
 * Calculate total token usage and cost for a cycle.
 */
export async function getCycleTokenUsage(
  client: PoolClient,
  cycleId: number,
): Promise<{
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number;
  logCount: number;
}> {
  const res = await client.query(
    `SELECT
       COALESCE(SUM((token_usage->>'input_tokens')::int), 0) AS total_input,
       COALESCE(SUM((token_usage->>'output_tokens')::int), 0) AS total_output,
       COALESCE(SUM((token_usage->>'cost_usd')::numeric), 0) AS total_cost,
       COUNT(*) AS log_count
     FROM agent_thought_logs
     WHERE cycle_id = $1 AND token_usage IS NOT NULL`,
    [cycleId],
  );

  const row = res.rows[0] as Record<string, unknown>;
  return {
    totalInputTokens: Number(row['total_input'] ?? 0),
    totalOutputTokens: Number(row['total_output'] ?? 0),
    totalCostUsd: Number(row['total_cost'] ?? 0),
    logCount: Number(row['log_count'] ?? 0),
  };
}
