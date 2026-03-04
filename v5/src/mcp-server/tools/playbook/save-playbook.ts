/**
 * FEAT-CPB-001: save_playbook
 * Spec: content_playbooks — Playbook保存（embedding自動生成）
 * markdown_content → embedding生成 → DB insert
 */
import type {
  SavePlaybookInput,
  SavePlaybookOutput,
} from '@/types/mcp-tools';
import { getPool } from '../../db.js';
import { McpValidationError } from '../../errors.js';
import { generateEmbedding } from '../../../workers/algorithm/embedding-batch.js';

export async function savePlaybook(
  input: SavePlaybookInput,
): Promise<SavePlaybookOutput> {
  if (!input.playbook_name || input.playbook_name.trim().length === 0) {
    throw new McpValidationError('playbook_name is required and must not be empty');
  }
  if (!input.content_type || input.content_type.trim().length === 0) {
    throw new McpValidationError('content_type is required and must not be empty');
  }
  const validFormats = ['short_video', 'text_post', 'image_post'] as const;
  if (!validFormats.includes(input.content_format as typeof validFormats[number])) {
    throw new McpValidationError(
      `content_format must be one of: ${validFormats.join(', ')}`,
    );
  }
  if (!input.markdown_content || input.markdown_content.trim().length === 0) {
    throw new McpValidationError('markdown_content is required and must not be empty');
  }

  const createdBy = input.created_by ?? 'human';

  // Generate embedding from markdown content
  const embedding = await generateEmbedding(input.markdown_content);
  const embeddingStr = `[${embedding.join(',')}]`;

  const pool = getPool();
  const res = await pool.query(
    `INSERT INTO content_playbooks
       (playbook_name, content_type, content_format, niche, platform, markdown_content, embedding, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7::vector, $8)
     RETURNING id, playbook_name, created_at`,
    [
      input.playbook_name.trim(),
      input.content_type.trim(),
      input.content_format,
      input.niche ?? null,
      input.platform ?? null,
      input.markdown_content,
      embeddingStr,
      createdBy,
    ],
  );

  const row = res.rows[0] as Record<string, unknown>;
  return {
    id: row['id'] as number,
    playbook_name: row['playbook_name'] as string,
    created_at: String(row['created_at']),
  };
}
