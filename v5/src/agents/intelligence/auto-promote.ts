/**
 * FEAT-INT-007: Auto-promote individual learnings to global learnings
 * Spec: 04-agent-design.md §4.12, 02-architecture.md §7
 *
 * Promotes agent_individual_learnings to the global learnings table
 * when confidence >= LEARNING_PROMOTION_THRESHOLD and times_applied >= min threshold.
 * All config from DB system_settings — no hardcoding.
 */
import type { PoolClient } from 'pg';
import { getSettingNumber } from '../../lib/settings.js';

/** Result of a single promotion */
export interface PromotionEntry {
  individualLearningId: string;
  globalLearningId: number;
  agentType: string;
  confidence: number;
}

/** Result of the promotion scan */
export interface PromotionResult {
  promotedCount: number;
  threshold: number;
  minTimesApplied: number;
  promotions: PromotionEntry[];
}

/**
 * Check if a learning is eligible for promotion.
 */
export function isEligibleForPromotion(
  confidence: number,
  timesApplied: number,
  threshold: number,
  minTimesApplied: number,
): boolean {
  return confidence >= threshold && timesApplied >= minTimesApplied;
}

/**
 * Promote eligible individual learnings to the global learnings table.
 * Sets a reference to prevent duplicate promotions.
 *
 * @param client - Database client
 * @param agentType - Optional: limit to a specific agent type
 */
export async function autoPromoteLearnings(
  client: PoolClient,
  agentType?: string,
): Promise<PromotionResult> {
  const threshold = await getSettingNumber('LEARNING_PROMOTION_THRESHOLD', client);
  const minTimesApplied = await getSettingNumber('LEARNING_PROMOTION_MIN_APPLIED', client);

  // Find eligible learnings not already promoted
  let sql = `
    SELECT id, agent_type, category, content, confidence, times_applied
    FROM agent_individual_learnings
    WHERE is_active = true
      AND confidence >= $1
      AND times_applied >= $2
      AND id NOT IN (
        SELECT DISTINCT source_reflection_id
        FROM agent_individual_learnings
        WHERE source_reflection_id IS NOT NULL
      )
  `;
  const params: unknown[] = [threshold, minTimesApplied];

  if (agentType) {
    sql += ` AND agent_type = $3`;
    params.push(agentType);
  }

  const candidates = await client.query(sql, params);
  const promotions: PromotionEntry[] = [];

  for (const row of candidates.rows) {
    const r = row as Record<string, unknown>;

    // Map agent learning category to global learning category
    const category = mapToGlobalCategory(r['category'] as string);

    // INSERT into global learnings
    const insertRes = await client.query(
      `INSERT INTO learnings (category, insight, confidence, evidence_count, applicable_niches)
       VALUES ($1, $2, $3, 1, ARRAY[]::VARCHAR[])
       RETURNING id`,
      [category, r['content'], r['confidence']],
    );

    const globalLearningId = (insertRes.rows[0] as Record<string, unknown>)['id'] as number;

    promotions.push({
      individualLearningId: r['id'] as string,
      globalLearningId,
      agentType: r['agent_type'] as string,
      confidence: Number(r['confidence']),
    });
  }

  return {
    promotedCount: promotions.length,
    threshold,
    minTimesApplied,
    promotions,
  };
}

/**
 * Map agent individual learning category to global learning category.
 * Global categories: content, timing, audience, platform, niche
 */
function mapToGlobalCategory(agentCategory: string): string {
  const mapping: Record<string, string> = {
    data_source: 'content',
    technique: 'content',
    pattern: 'content',
    mistake: 'content',
    insight: 'content',
    tool_characteristics: 'platform',
    tool_combination: 'platform',
    tool_failure_pattern: 'platform',
    tool_update: 'platform',
    data_classification: 'content',
    curation_quality: 'content',
    source_reliability: 'content',
    content: 'content',
    timing: 'timing',
    audience: 'audience',
    platform: 'platform',
    niche: 'niche',
  };
  return mapping[agentCategory] ?? 'content';
}
