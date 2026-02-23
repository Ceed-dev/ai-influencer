/**
 * FEAT-STR-006: Agent self_score 1-10 recording
 * Spec: 04-agent-design.md §4.12 (#1, #2), 02-architecture.md §7
 *
 * Records agent self-reflection with a 1-10 self_score.
 * Stored in agent_reflections table.
 * All config from DB system_settings — no hardcoding.
 */
import type { PoolClient } from 'pg';
import type { AgentType } from '@/types/database';

/** Input for recording a reflection */
export interface ReflectionInput {
  agentType: AgentType;
  cycleId: number | null;
  taskDescription: string;
  selfScore: number; // 1-10
  scoreReasoning: string;
  whatWentWell: string[];
  whatToImprove: string[];
  nextActions: string[];
  metricsSnapshot?: Record<string, unknown> | null;
}

/** Result of recording a reflection */
export interface ReflectionResult {
  reflectionId: string;
  selfScore: number;
  createdAt: string;
}

/**
 * Validate self_score is within valid range (1-10).
 */
export function validateSelfScore(score: number): boolean {
  return Number.isInteger(score) && score >= 1 && score <= 10;
}

/**
 * Record an agent's self-reflection.
 */
export async function recordReflection(
  client: PoolClient,
  input: ReflectionInput,
): Promise<ReflectionResult> {
  if (!validateSelfScore(input.selfScore)) {
    throw new Error(`Invalid self_score: ${input.selfScore}. Must be integer 1-10.`);
  }

  const res = await client.query(
    `INSERT INTO agent_reflections
       (agent_type, cycle_id, task_description, self_score, score_reasoning,
        what_went_well, what_to_improve, next_actions, metrics_snapshot)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id, created_at`,
    [
      input.agentType,
      input.cycleId,
      input.taskDescription,
      input.selfScore,
      input.scoreReasoning,
      input.whatWentWell,
      input.whatToImprove,
      input.nextActions,
      input.metricsSnapshot ? JSON.stringify(input.metricsSnapshot) : null,
    ],
  );

  const row = res.rows[0] as Record<string, unknown>;
  return {
    reflectionId: row['id'] as string,
    selfScore: input.selfScore,
    createdAt: String(row['created_at']),
  };
}

/**
 * Get recent reflections for an agent type.
 */
export async function getRecentReflections(
  client: PoolClient,
  agentType: AgentType,
  limit: number = 5,
): Promise<Array<{
  reflectionId: string;
  selfScore: number;
  scoreReasoning: string;
  nextActions: string[];
  createdAt: string;
}>> {
  const res = await client.query(
    `SELECT id, self_score, score_reasoning, next_actions, created_at
     FROM agent_reflections
     WHERE agent_type = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [agentType, limit],
  );

  return res.rows.map((row) => {
    const r = row as Record<string, unknown>;
    return {
      reflectionId: r['id'] as string,
      selfScore: Number(r['self_score']),
      scoreReasoning: r['score_reasoning'] as string,
      nextActions: (r['next_actions'] ?? []) as string[],
      createdAt: String(r['created_at']),
    };
  });
}
