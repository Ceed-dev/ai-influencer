/**
 * FEAT-CPB-003: get_playbook
 * Spec: content_playbooks — id or playbook_nameでPlaybook取得
 */
import type {
  GetPlaybookInput,
  GetPlaybookOutput,
} from '@/types/mcp-tools';
import type { ContentPlaybookRow } from '@/types/database';
import { getPool } from '../../db.js';
import { McpValidationError } from '../../errors.js';

export async function getPlaybook(
  input: GetPlaybookInput,
): Promise<GetPlaybookOutput> {
  if (input.id == null && !input.playbook_name) {
    throw new McpValidationError('Either id or playbook_name must be provided');
  }

  const pool = getPool();

  let query: string;
  let params: unknown[];

  if (input.id != null) {
    query = 'SELECT * FROM content_playbooks WHERE id = $1';
    params = [input.id];
  } else {
    query = 'SELECT * FROM content_playbooks WHERE playbook_name = $1';
    params = [input.playbook_name];
  }

  const res = await pool.query(query, params);
  const row = res.rows[0] as Record<string, unknown> | undefined;

  if (!row) {
    return { playbook: null };
  }

  return {
    playbook: {
      id: row['id'] as number,
      playbook_name: row['playbook_name'] as string,
      content_type: row['content_type'] as string,
      content_format: row['content_format'] as ContentPlaybookRow['content_format'],
      niche: (row['niche'] as string | null) ?? null,
      platform: (row['platform'] as string | null) ?? null,
      markdown_content: row['markdown_content'] as string,
      embedding: row['embedding'] as number[] | null,
      avg_effectiveness_score: row['avg_effectiveness_score'] != null
        ? Number(row['avg_effectiveness_score'])
        : null,
      times_used: row['times_used'] as number,
      is_active: row['is_active'] as boolean,
      created_by: row['created_by'] as ContentPlaybookRow['created_by'],
      created_at: String(row['created_at']),
      updated_at: String(row['updated_at']),
    },
  };
}
