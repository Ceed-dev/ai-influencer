/**
 * FEAT-MCC-003: create_cycle
 * Spec: 04-agent-design.md §4.1 #7
 * Creates a new cycle with status 'planning'.
 */
import type {
  CreateCycleInput,
  CreateCycleOutput,
} from '@/types/mcp-tools';
import { getPool } from '../../db';
import { McpDbError, McpValidationError } from '../../errors';

export async function createCycle(
  input: CreateCycleInput,
): Promise<CreateCycleOutput> {
  if (
    input.cycle_number == null ||
    typeof input.cycle_number !== 'number' ||
    !Number.isInteger(input.cycle_number) ||
    input.cycle_number < 1
  ) {
    throw new McpValidationError(
      `Invalid cycle_number: "${String(input.cycle_number)}". Must be a positive integer.`,
    );
  }

  const pool = getPool();

  try {
    const res = await pool.query(
      `INSERT INTO cycles (cycle_number, status)
       VALUES ($1, 'planning')
       RETURNING id, cycle_number, status`,
      [input.cycle_number],
    );

    const row = res.rows[0] as Record<string, unknown> | undefined;
    if (!row) {
      throw new McpDbError('Failed to create cycle: no row returned');
    }

    return {
      id: Number(row['id']),
      cycle_number: Number(row['cycle_number']),
      status: String(row['status']),
    };
  } catch (err: unknown) {
    if (err instanceof McpDbError || err instanceof McpValidationError) {
      throw err;
    }
    // Handle unique constraint violation on cycle_number
    const pgErr = err as { code?: string; message?: string };
    if (pgErr.code === '23505') {
      throw new McpValidationError(
        `Cycle number ${input.cycle_number} already exists.`,
      );
    }
    throw new McpDbError('Failed to create cycle', err);
  }
}
