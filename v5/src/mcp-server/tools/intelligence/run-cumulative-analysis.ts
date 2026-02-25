/**
 * MCI-046: run_cumulative_analysis
 * Spec: 04-agent-design.md §4.3 #22
 *
 * Wraps src/workers/algorithm/cumulative-analysis.ts runCumulativeAnalysis.
 * pgvector 5-table search -> structured aggregation -> AI interpretation -> cumulative_context write.
 */
import type {
  RunCumulativeAnalysisInput,
  RunCumulativeAnalysisOutput,
} from '@/types/mcp-tools';
import { McpValidationError } from '../../errors';
import { runCumulativeAnalysis as runCumulativeAnalysisWorker } from '../../../workers/algorithm/cumulative-analysis.js';

export async function runCumulativeAnalysis(
  input: RunCumulativeAnalysisInput,
): Promise<RunCumulativeAnalysisOutput> {
  if (!input.content_id || input.content_id.trim().length === 0) {
    throw new McpValidationError('content_id is required');
  }

  const result = await runCumulativeAnalysisWorker(input.content_id);

  return {
    structured: result.structured,
    ai_interpretation: result.ai_interpretation,
    recommendations: result.recommendations,
  };
}
