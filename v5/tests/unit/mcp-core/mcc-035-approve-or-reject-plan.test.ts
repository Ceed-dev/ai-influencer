/**
 * TEST-MCP-035: approve_or_reject_plan — approve + reject + validation
 * FEAT-MCC-035
 */
import { approveOrRejectPlan } from '@/src/mcp-server/tools/dashboard/approve-or-reject-plan';
import { withClient } from '../../helpers/db';
import { McpValidationError, McpNotFoundError } from '@/src/mcp-server/errors';

const PREFIX = 'MCP_TEST_';

describe('FEAT-MCC-035: approve_or_reject_plan', () => {
  beforeAll(async () => {
    await withClient(async (client) => {
      // Ensure characters exist
      await client.query(`
        INSERT INTO characters (character_id, name, voice_id, status)
        VALUES ('${PREFIX}CHR_035', 'Test Char 035', 'abc123def456abc123def456abc12345', 'active')
        ON CONFLICT (character_id) DO NOTHING
      `);
      // Insert test content in pending_approval status
      await client.query(`
        INSERT INTO content (content_id, character_id, content_format, status)
        VALUES
          ('${PREFIX}CNT_035A', '${PREFIX}CHR_035', 'short_video', 'pending_approval'),
          ('${PREFIX}CNT_035B', '${PREFIX}CHR_035', 'short_video', 'pending_approval')
        ON CONFLICT (content_id) DO NOTHING
      `);
    });
  });

  afterAll(async () => {
    await withClient(async (client) => {
      await client.query(`DELETE FROM content WHERE content_id LIKE '${PREFIX}CNT_035%'`);
      await client.query(`DELETE FROM characters WHERE character_id = '${PREFIX}CHR_035'`);
    });
  });

  test('TEST-MCP-035a: approves content plan', async () => {
    const result = await approveOrRejectPlan({
      content_id: `${PREFIX}CNT_035A`,
      decision: 'approve',
      feedback: 'Looks good',
    });

    expect(result).toEqual({ success: true });

    const res = await withClient(async (client) => {
      return client.query(
        `SELECT status, approved_by FROM content WHERE content_id = $1`,
        [`${PREFIX}CNT_035A`],
      );
    });
    expect(res.rows[0]?.status).toBe('approved');
    expect(res.rows[0]?.approved_by).toBe('human');
  });

  test('TEST-MCP-035b: rejects content plan', async () => {
    const result = await approveOrRejectPlan({
      content_id: `${PREFIX}CNT_035B`,
      decision: 'reject',
      feedback: 'Needs more data',
      rejection_category: 'data_insufficient',
    });

    expect(result).toEqual({ success: true });

    const res = await withClient(async (client) => {
      return client.query(
        `SELECT status, rejection_category FROM content WHERE content_id = $1`,
        [`${PREFIX}CNT_035B`],
      );
    });
    expect(res.rows[0]?.status).toBe('rejected');
    expect(res.rows[0]?.rejection_category).toBe('data_insufficient');
  });

  test('TEST-MCP-035c: throws McpNotFoundError for non-existent content', async () => {
    await expect(
      approveOrRejectPlan({ content_id: 'NONEXISTENT', decision: 'approve' }),
    ).rejects.toThrow(McpNotFoundError);
  });

  test('TEST-MCP-035d: throws McpValidationError for invalid decision', async () => {
    await expect(
      approveOrRejectPlan({ content_id: `${PREFIX}CNT_035A`, decision: 'maybe' as 'approve' }),
    ).rejects.toThrow(McpValidationError);
  });
});
