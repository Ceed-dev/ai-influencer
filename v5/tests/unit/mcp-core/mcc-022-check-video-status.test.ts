/**
 * TEST-MCP-022: check_video_status — normal + validation
 * FEAT-MCC-022
 */
import { checkVideoStatus } from '@/src/mcp-server/tools/production/check-video-status';
import { McpValidationError } from '@/src/mcp-server/errors';

describe('FEAT-MCC-022: check_video_status', () => {
  test('TEST-MCP-022a: returns completed status with video_url', async () => {
    const result = await checkVideoStatus({ request_id: 'req_abc123' });

    expect(result.status).toBe('completed');
    expect(result.video_url).toBe('https://fal.ai/result/req_abc123');
  });

  test('TEST-MCP-022b: output has correct type shape', async () => {
    const result = await checkVideoStatus({ request_id: 'req_xyz' });

    expect(['pending', 'processing', 'completed', 'failed']).toContain(result.status);
    expect(typeof result.video_url).toBe('string');
  });

  test('TEST-MCP-022c: throws McpValidationError for empty request_id', async () => {
    await expect(
      checkVideoStatus({ request_id: '' }),
    ).rejects.toThrow(McpValidationError);
  });
});
