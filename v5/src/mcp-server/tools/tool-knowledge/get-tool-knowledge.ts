/**
 * MCI-013: get_tool_knowledge — query tool_catalog
 * Spec: 04-agent-design.md §4.5 #1
 */
import type {
  GetToolKnowledgeInput,
  GetToolKnowledgeOutput,
} from '@/types/mcp-tools';
import { getPool } from '../../db';
import { McpValidationError } from '../../errors';

const VALID_CATEGORIES = ['video_gen', 'tts', 'lipsync', 'image_gen'] as const;

// Map user-facing category to tool_catalog.tool_type
const CATEGORY_TO_TOOL_TYPE: Record<string, string> = {
  video_gen: 'video_generation',
  tts: 'tts',
  lipsync: 'lipsync',
  image_gen: 'image_generation',
};

export async function getToolKnowledge(
  input: GetToolKnowledgeInput,
): Promise<GetToolKnowledgeOutput> {
  if (input.category && !VALID_CATEGORIES.includes(input.category as typeof VALID_CATEGORIES[number])) {
    throw new McpValidationError(
      `Invalid category: "${input.category}". Must be one of: ${VALID_CATEGORIES.join(', ')}`,
    );
  }

  const pool = getPool();
  const conditions: string[] = ['is_active = true'];
  const params: unknown[] = [];
  let paramIdx = 1;

  if (input.tool_name) {
    conditions.push(`tool_name ILIKE $${paramIdx++}`);
    params.push(`%${input.tool_name}%`);
  }
  if (input.category) {
    const toolType = CATEGORY_TO_TOOL_TYPE[input.category];
    conditions.push(`tool_type = $${paramIdx++}`);
    params.push(toolType);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const res = await pool.query(
    `SELECT tool_name, strengths, weaknesses, quirks, supported_formats, updated_at
     FROM tool_catalog
     ${where}
     ORDER BY tool_name`,
    params,
  );

  return {
    tools: res.rows.map((r: Record<string, unknown>) => {
      const strengths = r['strengths'] as string[] | null;
      const weaknesses = r['weaknesses'] as string[] | null;
      const quirks = r['quirks'] as Record<string, unknown> | null;
      const formats = r['supported_formats'] as Record<string, unknown> | null;

      return {
        tool_name: r['tool_name'] as string,
        capabilities: strengths ?? [],
        limitations: weaknesses ?? [],
        best_for: strengths?.slice(0, 3) ?? [],
        parameters: { quirks: quirks ?? {}, formats: formats ?? {} },
        updated_at: (r['updated_at'] as Date).toISOString(),
      };
    }),
  };
}
