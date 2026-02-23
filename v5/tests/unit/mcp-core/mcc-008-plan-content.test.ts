/**
 * TEST-MCP-028: plan_content — creates content and sections
 * TEST-MCP-029: plan_content — content_format validation
 */
import { planContent } from '@/src/mcp-server/tools/planner/plan-content';
import { seedBaseData, cleanupBaseData, PREFIX } from '../../helpers/mcp-seed';
import { McpValidationError } from '@/src/mcp-server/errors';
import { withClient } from '../../helpers/db';

describe('FEAT-MCC-008: plan_content', () => {
  beforeAll(async () => {
    await cleanupBaseData();
    await seedBaseData();
  });

  afterAll(async () => {
    // Clean up any content created by this test
    await withClient(async (client) => {
      await client.query(`DELETE FROM content_sections WHERE content_id LIKE 'CNT_%'`);
      await client.query(`DELETE FROM content WHERE content_id LIKE 'CNT_%' AND content_id NOT LIKE '${PREFIX}%'`);
    });
    await cleanupBaseData();
  });

  // TEST-MCP-028: creates content with sections
  test('TEST-MCP-028: creates content record and content_sections', async () => {
    // First, create a hypothesis to reference
    let hypothesisId: number;
    await withClient(async (client) => {
      const res = await client.query(
        `INSERT INTO hypotheses (category, statement, rationale, verdict)
         VALUES ('content_format', 'Test hypothesis', 'Test rationale', 'pending')
         RETURNING id`,
      );
      hypothesisId = (res.rows[0] as Record<string, unknown>)['id'] as number;
    });

    const result = await planContent({
      hypothesis_id: hypothesisId!,
      character_id: `${PREFIX}CHR_001`,
      script_language: 'en',
      content_format: 'short_video',
      sections: [
        { component_id: 'SCN_0001', section_label: 'hook' },
        { component_id: 'SCN_0002', section_label: 'body' },
        { component_id: 'SCN_0003', section_label: 'cta' },
      ],
    });

    expect(result).toHaveProperty('content_id');
    expect(typeof result.content_id).toBe('string');
    expect(result.content_id).toMatch(/^CNT_\d{6}_\d{4}$/);

    // Verify content row was created
    await withClient(async (client) => {
      const contentRes = await client.query(
        `SELECT * FROM content WHERE content_id = $1`,
        [result.content_id],
      );
      expect(contentRes.rowCount).toBe(1);
      const row = contentRes.rows[0] as Record<string, unknown>;
      expect(row['status']).toBe('planned');
      expect(row['content_format']).toBe('short_video');
      expect(row['script_language']).toBe('en');
      expect(row['character_id']).toBe(`${PREFIX}CHR_001`);

      // Verify sections were created
      const sectionRes = await client.query(
        `SELECT * FROM content_sections WHERE content_id = $1 ORDER BY section_order`,
        [result.content_id],
      );
      expect(sectionRes.rowCount).toBe(3);

      const sections = sectionRes.rows as Array<Record<string, unknown>>;
      expect(sections[0]?.['section_label']).toBe('hook');
      expect(sections[0]?.['component_id']).toBe('SCN_0001');
      expect(sections[0]?.['section_order']).toBe(1);

      expect(sections[1]?.['section_label']).toBe('body');
      expect(sections[2]?.['section_label']).toBe('cta');
    });
  });

  // TEST-MCP-029: rejects invalid content_format
  test('TEST-MCP-029: rejects invalid content_format', async () => {
    await expect(
      planContent({
        hypothesis_id: 1,
        character_id: `${PREFIX}CHR_001`,
        script_language: 'en',
        content_format: 'podcast' as any,
        sections: [{ component_id: 'SCN_0001', section_label: 'hook' }],
      }),
    ).rejects.toThrow(McpValidationError);
  });

  // Accepts all valid content_formats
  test('accepts text_post format', async () => {
    let hypothesisId: number;
    await withClient(async (client) => {
      const res = await client.query(
        `INSERT INTO hypotheses (category, statement, rationale, verdict)
         VALUES ('content_format', 'Text post test', 'Rationale', 'pending')
         RETURNING id`,
      );
      hypothesisId = (res.rows[0] as Record<string, unknown>)['id'] as number;
    });

    const result = await planContent({
      hypothesis_id: hypothesisId!,
      character_id: `${PREFIX}CHR_001`,
      script_language: 'jp',
      content_format: 'text_post',
      sections: [{ component_id: 'SCN_0001', section_label: 'body' }],
    });

    expect(result).toHaveProperty('content_id');
    expect(result.content_id).toMatch(/^CNT_\d{6}_\d{4}$/);
  });
});
