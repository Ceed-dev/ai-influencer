/**
 * TEST-MCP-023: generate_script — normal + language variants + validation
 * FEAT-MCC-023
 */
import { generateScript } from '@/src/mcp-server/tools/production/generate-script';
import { McpValidationError } from '@/src/mcp-server/errors';

describe('FEAT-MCC-023: generate_script', () => {
  test('TEST-MCP-023a: returns English scripts', async () => {
    const result = await generateScript({
      content_id: 'CNT_TEST_001',
      scenario_data: { topic: 'skincare', emotion: 'excited' },
      script_language: 'en',
    });

    expect(result).toHaveProperty('hook_script');
    expect(result).toHaveProperty('body_script');
    expect(result).toHaveProperty('cta_script');
    expect(typeof result.hook_script).toBe('string');
    expect(typeof result.body_script).toBe('string');
    expect(typeof result.cta_script).toBe('string');
    expect(result.hook_script).toContain('skincare');
  });

  test('TEST-MCP-023b: returns Japanese scripts', async () => {
    const result = await generateScript({
      content_id: 'CNT_TEST_002',
      scenario_data: { topic: 'beauty', emotion: 'calm' },
      script_language: 'jp',
    });

    expect(result.hook_script).toContain('beauty');
    expect(result.cta_script).toContain('チャンネル登録');
  });

  test('TEST-MCP-023c: handles missing scenario_data fields gracefully', async () => {
    const result = await generateScript({
      content_id: 'CNT_TEST_003',
      scenario_data: {},
      script_language: 'en',
    });

    expect(result.hook_script).toContain('general');
    expect(result.body_script).toContain('general');
  });

  test('TEST-MCP-023d: throws McpValidationError for empty content_id', async () => {
    await expect(
      generateScript({
        content_id: '',
        scenario_data: {},
        script_language: 'en',
      }),
    ).rejects.toThrow(McpValidationError);
  });

  test('TEST-MCP-023e: throws McpValidationError for invalid language', async () => {
    await expect(
      generateScript({
        content_id: 'CNT_TEST_004',
        scenario_data: {},
        script_language: 'fr' as 'en' | 'jp',
      }),
    ).rejects.toThrow(McpValidationError);
  });
});
