/**
 * FEAT-MCC-005: allocate_resources
 * Spec: 04-agent-design.md §4.1 #9
 * Stores resource allocations by merging into cycles.summary JSONB.
 */
import type {
  AllocateResourcesInput,
  AllocateResourcesOutput,
} from '@/types/mcp-tools';
import { getPool } from '../../db';
import { McpNotFoundError, McpValidationError } from '../../errors';

export async function allocateResources(
  input: AllocateResourcesInput,
): Promise<AllocateResourcesOutput> {
  if (input.cycle_id == null || typeof input.cycle_id !== 'number') {
    throw new McpValidationError(
      `Invalid cycle_id: "${String(input.cycle_id)}". Must be a number.`,
    );
  }

  if (!Array.isArray(input.allocations) || input.allocations.length === 0) {
    throw new McpValidationError(
      'Invalid allocations: must be a non-empty array.',
    );
  }

  for (const alloc of input.allocations) {
    if (!alloc.cluster || typeof alloc.cluster !== 'string') {
      throw new McpValidationError('Each allocation must have a non-empty cluster string.');
    }
    if (typeof alloc.content_count !== 'number' || alloc.content_count < 0) {
      throw new McpValidationError(`Invalid content_count for cluster "${alloc.cluster}".`);
    }
    if (typeof alloc.budget !== 'number' || alloc.budget < 0) {
      throw new McpValidationError(`Invalid budget for cluster "${alloc.cluster}".`);
    }
  }

  const pool = getPool();

  // First verify the cycle exists
  const cycleRes = await pool.query(
    `SELECT id, summary FROM cycles WHERE id = $1`,
    [input.cycle_id],
  );

  if (cycleRes.rowCount === 0) {
    throw new McpNotFoundError(
      `Cycle with id ${input.cycle_id} not found.`,
    );
  }

  const existingRow = cycleRes.rows[0] as Record<string, unknown> | undefined;
  const existingSummary = (existingRow?.['summary'] as Record<string, unknown> | null) ?? {};

  // Merge allocations into existing summary
  const mergedSummary = {
    ...existingSummary,
    allocations: input.allocations,
  };

  await pool.query(
    `UPDATE cycles SET summary = $2 WHERE id = $1`,
    [input.cycle_id, JSON.stringify(mergedSummary)],
  );

  return { success: true };
}
