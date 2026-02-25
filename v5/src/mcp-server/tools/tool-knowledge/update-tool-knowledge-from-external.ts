/**
 * MCI-016b: update_tool_knowledge_from_external
 * Spec: 04-agent-design.md S4.5 #5
 * Inserts external information source into tool_external_sources.
 */
import type {
  UpdateToolKnowledgeFromExternalInput,
  UpdateToolKnowledgeFromExternalOutput,
} from '@/types/mcp-tools';
import { getPool } from '../../db';
import { McpValidationError, McpNotFoundError } from '../../errors';

const VALID_UPDATE_TYPES = ['capability', 'pricing', 'api_change', 'bug'] as const;

const UPDATE_TYPE_TO_SOURCE_TYPE: Record<string, string> = {
  capability: 'changelog',
  pricing: 'official_doc',
  api_change: 'changelog',
  bug: 'forum',
};

export async function updateToolKnowledgeFromExternal(
  input: UpdateToolKnowledgeFromExternalInput,
): Promise<UpdateToolKnowledgeFromExternalOutput> {
  if (!input.tool_name || input.tool_name.trim().length === 0) {
    throw new McpValidationError('tool_name is required');
  }
  if (!VALID_UPDATE_TYPES.includes(input.update_type as typeof VALID_UPDATE_TYPES[number])) {
    throw new McpValidationError(
      `Invalid update_type: "${input.update_type}". Must be one of: ${VALID_UPDATE_TYPES.join(', ')}`,
    );
  }
  if (!input.description || input.description.trim().length === 0) {
    throw new McpValidationError('description is required');
  }

  const pool = getPool();

  // Find the tool in tool_catalog
  const toolRes = await pool.query(
    `SELECT id FROM tool_catalog WHERE tool_name ILIKE $1 LIMIT 1`,
    [input.tool_name],
  );

  if (toolRes.rowCount === 0) {
    throw new McpNotFoundError(`Tool "${input.tool_name}" not found in tool_catalog`);
  }

  const toolId = (toolRes.rows[0] as Record<string, unknown>)['id'] as number;
  const sourceType = UPDATE_TYPE_TO_SOURCE_TYPE[input.update_type] ?? 'other';
  const sourceUrl = input.source_url ?? `manual://${input.update_type}`;

  const res = await pool.query(
    `INSERT INTO tool_external_sources
       (source_type, source_url, tool_id, content_summary, key_insights, fetched_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     RETURNING id`,
    [
      sourceType,
      sourceUrl,
      toolId,
      input.description,
      JSON.stringify({ update_type: input.update_type }),
    ],
  );

  return { id: res.rows[0]['id'] as number };
}
