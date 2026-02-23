/**
 * TEST-MCP-036: get_pending_approvals — returns pending content plans
 * FEAT-MCC-036
 */
import { getPendingApprovals } from '@/src/mcp-server/tools/dashboard/get-pending-approvals';
import { withClient } from '../../helpers/db';

const PREFIX = 'MCP_TEST_';

describe('FEAT-MCC-036: get_pending_approvals', () => {
  beforeAll(async () => {
    await withClient(async (client) => {
      await client.query(`
        INSERT INTO characters (character_id, name, voice_id, status)
        VALUES ('${PREFIX}CHR_036', 'Test Char 036', 'abc123def456abc123def456abc12345', 'active')
        ON CONFLICT (character_id) DO NOTHING
      `);
      await client.query(`
        INSERT INTO content (content_id, character_id, content_format, status)
        VALUES ('${PREFIX}CNT_036', '${PREFIX}CHR_036', 'short_video', 'pending_approval')
        ON CONFLICT (content_id) DO NOTHING
      `);
    });
  });

  afterAll(async () => {
    await withClient(async (client) => {
      await client.query(`DELETE FROM content WHERE content_id LIKE '${PREFIX}CNT_036%'`);
      await client.query(`DELETE FROM characters WHERE character_id = '${PREFIX}CHR_036'`);
    });
  });

  test('TEST-MCP-036a: returns pending approvals with correct structure', async () => {
    const result = await getPendingApprovals({});

    expect(Array.isArray(result.approvals)).toBe(true);
    expect(result.approvals.length).toBeGreaterThanOrEqual(1);

    const item = result.approvals.find((a) => a.content_id === `${PREFIX}CNT_036`);
    expect(item).toBeDefined();
    expect(item).toHaveProperty('content_id');
    expect(item).toHaveProperty('hypothesis');
    expect(item).toHaveProperty('plan_summary');
    expect(item).toHaveProperty('cost_estimate');
    expect(item).toHaveProperty('created_at');
  });

  test('TEST-MCP-036b: output types are correct', async () => {
    const result = await getPendingApprovals({});

    for (const item of result.approvals) {
      expect(typeof item.content_id).toBe('string');
      expect(typeof item.hypothesis).toBe('string');
      expect(typeof item.plan_summary).toBe('string');
      expect(typeof item.cost_estimate).toBe('number');
      expect(typeof item.created_at).toBe('string');
    }
  });
});
