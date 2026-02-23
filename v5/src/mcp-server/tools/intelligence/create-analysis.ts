/**
 * MCI-011: create_analysis — INSERT into analyses
 * Spec: 04-agent-design.md §4.3 #4
 */
import type {
  CreateAnalysisInput,
  CreateAnalysisOutput,
} from '@/types/mcp-tools';
import { getPool } from '../../db';
import { McpValidationError } from '../../errors';

export async function createAnalysis(
  input: CreateAnalysisInput,
): Promise<CreateAnalysisOutput> {
  if (!input.findings || input.findings.trim().length === 0) {
    throw new McpValidationError('findings is required');
  }
  if (!input.recommendations || input.recommendations.trim().length === 0) {
    throw new McpValidationError('recommendations is required');
  }
  if (!input.analysis_type || input.analysis_type.trim().length === 0) {
    throw new McpValidationError('analysis_type is required');
  }

  const pool = getPool();

  const res = await pool.query(
    `INSERT INTO analyses (cycle_id, analysis_type, findings, recommendations)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [
      input.cycle_id,
      input.analysis_type,
      JSON.stringify({ text: input.findings }),
      JSON.stringify([{ action: input.recommendations }]),
    ],
  );

  return { id: res.rows[0]['id'] as number };
}
