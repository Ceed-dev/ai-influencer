/**
 * FEAT-MCC-019: update_content_status
 * Spec: 04-agent-design.md SS4.6 #10
 * Updates the status (and optional metadata) of a content record.
 */
import type {
  UpdateContentStatusInput,
  UpdateContentStatusOutput,
} from '@/types/mcp-tools';
import type { ContentStatus } from '@/types/database';
import { getPool } from '../../db';
import { McpValidationError, McpNotFoundError } from '../../errors';

const VALID_STATUSES: ContentStatus[] = [
  'planned',
  'producing',
  'ready',
  'pending_review',
  'pending_approval',
  'approved',
  'rejected',
  'revision_needed',
  'posted',
  'measured',
  'cancelled',
  'analyzed',
];

export async function updateContentStatus(
  input: UpdateContentStatusInput,
): Promise<UpdateContentStatusOutput> {
  if (!VALID_STATUSES.includes(input.status)) {
    throw new McpValidationError(
      `Invalid status: "${input.status}". Must be one of: ${VALID_STATUSES.join(', ')}`,
    );
  }

  const pool = getPool();

  const res = await pool.query(
    `UPDATE content
     SET status = $2,
         production_metadata = COALESCE($3::jsonb, production_metadata),
         updated_at = NOW()
     WHERE content_id = $1`,
    [
      input.content_id,
      input.status,
      input.metadata ? JSON.stringify(input.metadata) : null,
    ],
  );

  if (res.rowCount === 0) {
    throw new McpNotFoundError(`Content not found: ${input.content_id}`);
  }

  return { success: true };
}
