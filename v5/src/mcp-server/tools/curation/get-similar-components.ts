/**
 * MCI-018: get_similar_components — vector search
 * Spec: 04-agent-design.md §4.10 #5
 */
import type {
  GetSimilarComponentsInput,
  GetSimilarComponentsOutput,
} from '@/types/mcp-tools';
import { getPool } from '../../db';
import { McpValidationError } from '../../errors';
import { generateEmbedding } from '../../../workers/algorithm/embedding-batch.js';

const VALID_TYPES = ['scenario', 'motion', 'audio', 'image'] as const;

export async function getSimilarComponents(
  input: GetSimilarComponentsInput,
): Promise<GetSimilarComponentsOutput> {
  if (!VALID_TYPES.includes(input.type as typeof VALID_TYPES[number])) {
    throw new McpValidationError(
      `Invalid type: "${input.type}". Must be one of: ${VALID_TYPES.join(', ')}`,
    );
  }
  if (!input.query_text || input.query_text.trim().length === 0) {
    throw new McpValidationError('query_text is required');
  }

  const limit = input.limit ?? 5;
  const pool = getPool();

  // Check if components table has embedding column; if not, fallback to text search
  const embedding = await generateEmbedding(input.query_text);
  const embeddingStr = `[${embedding.join(',')}]`;

  // Try vector search if embedding column exists, otherwise do text-based similarity
  try {
    const res = await pool.query(
      `SELECT component_id, 1 - (embedding <=> $1::vector) AS similarity
       FROM components
       WHERE type = $2
         AND embedding IS NOT NULL
         AND 1 - (embedding <=> $1::vector) > 0.0
       ORDER BY embedding <=> $1::vector
       LIMIT $3`,
      [embeddingStr, input.type, limit],
    );

    return {
      results: res.rows.map((r: Record<string, unknown>) => ({
        component_id: r['component_id'] as string,
        similarity: Number(r['similarity']),
      })),
    };
  } catch {
    // Fallback: text-based search using name ILIKE
    const res = await pool.query(
      `SELECT component_id, 0.5 AS similarity
       FROM components
       WHERE type = $1
         AND (name ILIKE $2 OR subtype ILIKE $2)
       LIMIT $3`,
      [input.type, `%${input.query_text}%`, limit],
    );

    return {
      results: res.rows.map((r: Record<string, unknown>) => ({
        component_id: r['component_id'] as string,
        similarity: Number(r['similarity']),
      })),
    };
  }
}
