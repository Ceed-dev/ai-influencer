/**
 * TEST-MCP-041: submit_reference_content — normal + validation
 * FEAT-MCC-041
 */
import { submitReferenceContent } from '@/src/mcp-server/tools/agent-mgmt/submit-reference-content';
import { withClient } from '../../helpers/db';
import { McpValidationError } from '@/src/mcp-server/errors';

describe('FEAT-MCC-041: submit_reference_content', () => {
  const insertedIds: number[] = [];

  afterAll(async () => {
    if (insertedIds.length > 0) {
      await withClient(async (client) => {
        await client.query(
          `DELETE FROM task_queue WHERE id = ANY($1)`,
          [insertedIds],
        );
      });
    }
  });

  test('TEST-MCP-041a: inserts reference content with url and returns queue_id', async () => {
    const result = await submitReferenceContent({
      url: 'https://example.com/reference-video',
      description: 'Good example of beauty content',
      target_type: 'scenario',
    });

    expect(typeof result.queue_id).toBe('number');
    expect(result.queue_id).toBeGreaterThan(0);
    insertedIds.push(result.queue_id);

    // Verify task_queue entry
    const res = await withClient(async (client) => {
      return client.query(
        `SELECT task_type, status, payload FROM task_queue WHERE id = $1`,
        [result.queue_id],
      );
    });
    expect(res.rows[0]?.task_type).toBe('curate');
    expect(res.rows[0]?.status).toBe('pending');
    const payload = res.rows[0]?.payload as Record<string, unknown>;
    expect(payload['url']).toBe('https://example.com/reference-video');
  });

  test('TEST-MCP-041b: inserts reference content with file_id', async () => {
    const result = await submitReferenceContent({
      file_id: 'drive_file_123',
      description: 'Reference motion template',
      target_type: 'motion',
    });

    expect(typeof result.queue_id).toBe('number');
    insertedIds.push(result.queue_id);
  });

  test('TEST-MCP-041c: throws McpValidationError for empty description', async () => {
    await expect(
      submitReferenceContent({
        url: 'https://example.com',
        description: '',
        target_type: 'scenario',
      }),
    ).rejects.toThrow(McpValidationError);
  });

  test('TEST-MCP-041d: throws McpValidationError when neither url nor file_id provided', async () => {
    await expect(
      submitReferenceContent({
        description: 'test',
        target_type: 'scenario',
      }),
    ).rejects.toThrow(McpValidationError);
  });

  test('TEST-MCP-041e: throws McpValidationError for empty target_type', async () => {
    await expect(
      submitReferenceContent({
        url: 'https://example.com',
        description: 'test',
        target_type: '',
      }),
    ).rejects.toThrow(McpValidationError);
  });
});
