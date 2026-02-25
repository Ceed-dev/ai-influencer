/**
 * FEAT-MCC-041: submit_reference_content
 * Spec: 04-agent-design.md §4.11 #3
 * Inserts reference content into market_intel as a reference data point
 * and enqueues it into task_queue for curation.
 */
import type {
  SubmitReferenceContentInput,
  SubmitReferenceContentOutput,
} from '@/types/mcp-tools';
import { getPool } from '../../db';
import { McpValidationError, McpDbError } from '../../errors';

export async function submitReferenceContent(
  input: SubmitReferenceContentInput,
): Promise<SubmitReferenceContentOutput> {
  if (!input.description || input.description.trim() === '') {
    throw new McpValidationError('description is required and must be non-empty');
  }
  if (!input.target_type || input.target_type.trim() === '') {
    throw new McpValidationError('target_type is required and must be non-empty');
  }
  if (!input.url && !input.file_id) {
    throw new McpValidationError('Either url or file_id must be provided');
  }

  const pool = getPool();

  // Insert into task_queue as a curate task for processing
  const data: Record<string, unknown> = {
    description: input.description,
    target_type: input.target_type,
  };
  if (input.url) {
    data['url'] = input.url;
  }
  if (input.file_id) {
    data['file_id'] = input.file_id;
  }

  const res = await pool.query(
    `INSERT INTO task_queue (task_type, payload, status, priority)
     VALUES ('curate', $1, 'pending', 0)
     RETURNING id`,
    [JSON.stringify(data)],
  );

  const row = res.rows[0] as { id: number } | undefined;
  if (!row) {
    throw new McpDbError('Failed to insert reference content into task_queue');
  }

  return { queue_id: row.id };
}
