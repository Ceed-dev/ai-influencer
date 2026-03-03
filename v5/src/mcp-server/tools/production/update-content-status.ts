/**
 * FEAT-MCC-019: update_content_status
 * Spec: 04-agent-design.md SS4.6 #10
 * Updates the status (and optional metadata) of a content record.
 *
 * Side-effect: when status transitions to 'ready' or 'approved',
 * automatically creates a publications record (status='scheduled') and a
 * task_queue 'publish' entry for the account configured via
 * PUBLISH_DEFAULT_ACCOUNT_ID system_setting.
 */
import type {
  UpdateContentStatusInput,
  UpdateContentStatusOutput,
} from '@/types/mcp-tools';
import type { ContentStatus } from '@/types/database';
import { getPool } from '../../db';
import { McpValidationError, McpNotFoundError } from '../../errors';
import { getSettingString } from '../../../lib/settings.js';

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

/**
 * Create a publications record (status='scheduled') and a task_queue 'publish'
 * entry for the content, using PUBLISH_DEFAULT_ACCOUNT_ID from system_settings.
 * Non-fatal: errors are logged but do not fail the status update.
 */
async function scheduleForPublishing(contentId: string): Promise<void> {
  const pool = getPool();

  let accountId: string;
  try {
    accountId = await getSettingString('PUBLISH_DEFAULT_ACCOUNT_ID');
  } catch {
    console.warn(
      '[update-content-status] PUBLISH_DEFAULT_ACCOUNT_ID not set — skipping publish scheduling',
    );
    return;
  }

  if (!accountId || accountId.trim() === '') {
    console.warn(
      '[update-content-status] PUBLISH_DEFAULT_ACCOUNT_ID is empty — skipping publish scheduling',
    );
    return;
  }

  const accountRes = await pool.query<{ platform: string }>(
    `SELECT platform FROM accounts WHERE account_id = $1 AND status = 'active'`,
    [accountId],
  );

  if (accountRes.rows.length === 0) {
    console.warn(
      `[update-content-status] Account ${accountId} not found or not active — skipping publish scheduling`,
    );
    return;
  }

  const platform = accountRes.rows[0]!.platform;

  // Idempotency: skip if a publications record already exists for this content+account
  const existingPub = await pool.query<{ id: number }>(
    `SELECT id FROM publications WHERE content_id = $1 AND account_id = $2`,
    [contentId, accountId],
  );

  if (existingPub.rows.length > 0) {
    console.warn(
      `[update-content-status] Publications record already exists for content=${contentId}, account=${accountId} — skipping`,
    );
    return;
  }

  // Create publications record with status='scheduled'
  await pool.query(
    `INSERT INTO publications (content_id, account_id, platform, status)
     VALUES ($1, $2, $3, 'scheduled')`,
    [contentId, accountId, platform],
  );

  // Create task_queue 'publish' entry
  await pool.query(
    `INSERT INTO task_queue (task_type, payload, status, priority)
     VALUES ('publish', $1::jsonb, 'pending', 0)`,
    [JSON.stringify({ content_id: contentId, account_id: accountId })],
  );

  console.warn(
    `[update-content-status] Scheduled content=${contentId} for publishing via account=${accountId} (${platform})`,
  );
}

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

  // When content becomes ready/approved, schedule it for publishing
  if (input.status === 'ready' || input.status === 'approved') {
    await scheduleForPublishing(input.content_id).catch((err) => {
      console.error(
        '[update-content-status] scheduleForPublishing failed (non-fatal):',
        err instanceof Error ? err.message : String(err),
      );
    });
  }

  return { success: true };
}
