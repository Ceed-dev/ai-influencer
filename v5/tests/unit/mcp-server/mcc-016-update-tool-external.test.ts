/**
 * Tests for update_tool_knowledge_from_external
 */
import { updateToolKnowledgeFromExternal } from '@/src/mcp-server/tools/tool-knowledge/update-tool-knowledge-from-external';
import { McpValidationError, McpNotFoundError } from '@/src/mcp-server/errors';
import { withClient } from '../../helpers/db';

const MARKER = 'TUKFE_';

describe('update_tool_knowledge_from_external', () => {
  let toolName: string;

  beforeAll(async () => {
    toolName = `${MARKER}test_tool`;
    await withClient(async (client) => {
      await client.query(`DELETE FROM tool_external_sources WHERE content_summary LIKE '${MARKER}%'`);
      await client.query(
        `INSERT INTO tool_catalog (tool_name, tool_type, is_active)
         VALUES ($1, 'video_generation', true)
         ON CONFLICT DO NOTHING`,
        [toolName]
      );
    });
  });

  afterAll(async () => {
    await withClient(async (client) => {
      await client.query(`DELETE FROM tool_external_sources WHERE content_summary LIKE '${MARKER}%'`);
      await client.query(`DELETE FROM tool_catalog WHERE tool_name = $1`, [toolName]);
    });
  });

  test('inserts external knowledge source successfully', async () => {
    const result = await updateToolKnowledgeFromExternal({
      tool_name: toolName,
      update_type: 'capability',
      description: `${MARKER}New video generation capability added`,
      source_url: 'https://example.com/changelog',
    });
    expect(result).toHaveProperty('id');
    expect(typeof result.id).toBe('number');
  });

  test('works without source_url', async () => {
    const result = await updateToolKnowledgeFromExternal({
      tool_name: toolName,
      update_type: 'bug',
      description: `${MARKER}Known bug in API v2`,
    });
    expect(result).toHaveProperty('id');
  });

  test('rejects invalid update_type', async () => {
    await expect(
      updateToolKnowledgeFromExternal({
        tool_name: toolName,
        update_type: 'invalid' as any,
        description: 'test',
      }),
    ).rejects.toThrow(McpValidationError);
  });

  test('rejects empty tool_name', async () => {
    await expect(
      updateToolKnowledgeFromExternal({
        tool_name: '',
        update_type: 'capability',
        description: 'test',
      }),
    ).rejects.toThrow(McpValidationError);
  });

  test('throws NotFoundError for unknown tool', async () => {
    await expect(
      updateToolKnowledgeFromExternal({
        tool_name: 'NONEXISTENT_TOOL_XYZ',
        update_type: 'capability',
        description: 'test',
      }),
    ).rejects.toThrow(McpNotFoundError);
  });
});
