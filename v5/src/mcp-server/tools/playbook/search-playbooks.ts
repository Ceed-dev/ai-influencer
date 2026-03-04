/**
 * FEAT-CPB-002: search_playbooks
 * Spec: content_playbooks — ベクトル検索でPlaybookを検索
 * query_text → embedding → pgvector cosine検索
 */
import type {
  SearchPlaybooksInput,
  SearchPlaybooksOutput,
} from '@/types/mcp-tools';
import { getPool } from '../../db.js';
import { McpValidationError } from '../../errors.js';
import { generateEmbedding } from '../../../workers/algorithm/embedding-batch.js';

export async function searchPlaybooks(
  input: SearchPlaybooksInput,
): Promise<SearchPlaybooksOutput> {
  if (!input.query_text || input.query_text.trim().length === 0) {
    throw new McpValidationError('query_text is required and must not be empty');
  }

  const limit = input.limit ?? 10;
  if (limit < 1 || limit > 100) {
    throw new McpValidationError('limit must be between 1 and 100');
  }

  const pool = getPool();
  const embedding = await generateEmbedding(input.query_text);
  const embeddingStr = `[${embedding.join(',')}]`;

  // Build dynamic WHERE clauses
  const conditions: string[] = [
    'embedding IS NOT NULL',
    'is_active = true',
  ];
  const params: unknown[] = [embeddingStr, limit];
  let paramIdx = 3;

  if (input.content_format) {
    conditions.push(`content_format = $${paramIdx}`);
    params.push(input.content_format);
    paramIdx++;
  }
  if (input.niche) {
    conditions.push(`niche = $${paramIdx}`);
    params.push(input.niche);
    paramIdx++;
  }
  if (input.platform) {
    conditions.push(`platform = $${paramIdx}`);
    params.push(input.platform);
    paramIdx++;
  }

  const whereClause = conditions.join(' AND ');

  const res = await pool.query(
    `SELECT id, playbook_name, content_type, content_format, niche, platform,
            markdown_content, avg_effectiveness_score,
            1 - (embedding <=> $1::vector) AS similarity
     FROM content_playbooks
     WHERE ${whereClause}
       AND 1 - (embedding <=> $1::vector) > 0.0
     ORDER BY embedding <=> $1::vector
     LIMIT $2`,
    params,
  );

  return {
    results: res.rows.map((r: Record<string, unknown>) => ({
      id: r['id'] as number,
      playbook_name: r['playbook_name'] as string,
      content_type: r['content_type'] as string,
      content_format: r['content_format'] as string,
      niche: (r['niche'] as string | null) ?? null,
      platform: (r['platform'] as string | null) ?? null,
      markdown_content: r['markdown_content'] as string,
      similarity: Number(r['similarity']),
      avg_effectiveness_score: r['avg_effectiveness_score'] != null
        ? Number(r['avg_effectiveness_score'])
        : null,
    })),
  };
}
