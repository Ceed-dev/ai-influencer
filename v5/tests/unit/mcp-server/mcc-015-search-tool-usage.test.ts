/**
 * Tests for search_similar_tool_usage
 */
import { searchSimilarToolUsage } from '@/src/mcp-server/tools/tool-knowledge/search-similar-tool-usage';
import { McpValidationError } from '@/src/mcp-server/errors';
import { withClient } from '../../helpers/db';

const MARKER = 'TSTU_';

describe('search_similar_tool_usage', () => {
  let toolId: number;

  beforeAll(async () => {
    await withClient(async (client) => {
      // Ensure a tool exists
      const toolRes = await client.query(
        `INSERT INTO tool_catalog (tool_name, tool_type, is_active)
         VALUES ('${MARKER}test_tool', 'video_generation', true)
         ON CONFLICT DO NOTHING
         RETURNING id`
      );
      if (toolRes.rows.length > 0) {
        toolId = toolRes.rows[0].id;
      } else {
        const existing = await client.query(
          `SELECT id FROM tool_catalog WHERE tool_name = '${MARKER}test_tool'`
        );
        toolId = existing.rows[0].id;
      }

      // Insert test experiences
      await client.query(`DELETE FROM tool_experiences WHERE quality_notes LIKE '${MARKER}%'`);
      await client.query(`
        INSERT INTO tool_experiences (tool_id, agent_id, recipe_used, quality_score, quality_notes, success, content_type)
        VALUES
          ($1, 'tool_specialist', '{"tools": ["tool_a", "tool_b"]}', 0.85, '${MARKER}note1', true, 'short_video'),
          ($1, 'tool_specialist', '{"tools": ["tool_a", "tool_b"]}', 0.90, '${MARKER}note2', true, 'short_video'),
          ($1, 'tool_specialist', '{"tools": ["tool_c"]}', 0.70, '${MARKER}note3', true, 'short_video')
      `, [toolId]);
    });
  });

  afterAll(async () => {
    await withClient(async (client) => {
      await client.query(`DELETE FROM tool_experiences WHERE quality_notes LIKE '${MARKER}%'`);
      await client.query(`DELETE FROM tool_catalog WHERE tool_name = '${MARKER}test_tool'`);
    });
  });

  test('returns grouped tool usage results', async () => {
    const result = await searchSimilarToolUsage({
      requirements: { content_type: 'short_video' },
      limit: 5,
    });
    expect(result).toHaveProperty('results');
    expect(Array.isArray(result.results)).toBe(true);
  });

  test('results have correct structure', async () => {
    const result = await searchSimilarToolUsage({
      requirements: { content_type: 'short_video' },
      limit: 10,
    });
    if (result.results.length > 0) {
      const r = result.results[0]!;
      expect(r).toHaveProperty('tool_combination');
      expect(r).toHaveProperty('avg_quality_score');
      expect(r).toHaveProperty('usage_count');
      expect(r).toHaveProperty('notes');
      expect(Array.isArray(r.tool_combination)).toBe(true);
    }
  });

  test('rejects invalid limit', async () => {
    await expect(
      searchSimilarToolUsage({ requirements: {}, limit: 0 }),
    ).rejects.toThrow(McpValidationError);
  });
});
