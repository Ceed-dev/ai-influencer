/**
 * FEAT-MCC-010: request_production
 * Spec: 04-agent-design.md S4.4 #9
 * Inserts a production task into task_queue.
 */
import type {
  RequestProductionInput,
  RequestProductionOutput,
} from '@/types/mcp-tools';
import { getPool } from '../../db';
import { McpDbError } from '../../errors';

export async function requestProduction(
  input: RequestProductionInput,
): Promise<RequestProductionOutput> {
  const pool = getPool();

  try {
    const res = await pool.query(
      `
      INSERT INTO task_queue (task_type, payload, status, priority)
      VALUES ('produce', $1::jsonb, 'pending', $2)
      RETURNING id
      `,
      [JSON.stringify({ content_id: input.content_id }), input.priority],
    );

    const row = res.rows[0] as Record<string, unknown> | undefined;
    if (!row) {
      throw new McpDbError('Failed to insert production task: no row returned');
    }

    return { task_id: Number(row['id']) };
  } catch (err) {
    if (err instanceof McpDbError) throw err;
    throw new McpDbError('Failed to request production', err);
  }
}
