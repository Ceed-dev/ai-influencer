/**
 * TEST-MCP-040: approve_curated_component — approve + with modifications + not found
 * FEAT-MCC-040
 */
import { approveCuratedComponent } from '@/src/mcp-server/tools/agent-mgmt/approve-curated-component';
import { withClient } from '../../helpers/db';
import { McpNotFoundError, McpValidationError } from '@/src/mcp-server/errors';

const PREFIX = 'MCP_TEST_';

describe('FEAT-MCC-040: approve_curated_component', () => {
  beforeAll(async () => {
    await withClient(async (client) => {
      await client.query(`
        INSERT INTO components (component_id, type, subtype, name, data, review_status, curated_by)
        VALUES
          ('${PREFIX}CMP_040A', 'scenario', 'hook', 'Test Hook 040A', '{"original": true}', 'pending_review', 'auto'),
          ('${PREFIX}CMP_040B', 'audio', 'bgm', 'Test BGM 040B', '{"genre": "lofi"}', 'pending_review', 'auto')
        ON CONFLICT (component_id) DO NOTHING
      `);
    });
  });

  afterAll(async () => {
    await withClient(async (client) => {
      await client.query(`DELETE FROM components WHERE component_id LIKE '${PREFIX}CMP_040%'`);
    });
  });

  test('TEST-MCP-040a: approves component without modifications', async () => {
    const result = await approveCuratedComponent({
      component_id: `${PREFIX}CMP_040A`,
    });

    expect(result).toEqual({ success: true });

    const res = await withClient(async (client) => {
      return client.query(
        `SELECT review_status FROM components WHERE component_id = $1`,
        [`${PREFIX}CMP_040A`],
      );
    });
    expect(res.rows[0]?.review_status).toBe('human_approved');
  });

  test('TEST-MCP-040b: approves component with modifications', async () => {
    const result = await approveCuratedComponent({
      component_id: `${PREFIX}CMP_040B`,
      modifications: { genre: 'ambient', bpm: 90 },
    });

    expect(result).toEqual({ success: true });

    const res = await withClient(async (client) => {
      return client.query(
        `SELECT review_status, data FROM components WHERE component_id = $1`,
        [`${PREFIX}CMP_040B`],
      );
    });
    expect(res.rows[0]?.review_status).toBe('human_approved');
    const data = res.rows[0]?.data as Record<string, unknown>;
    expect(data['genre']).toBe('ambient');
    expect(data['bpm']).toBe(90);
  });

  test('TEST-MCP-040c: throws McpNotFoundError for non-existent component', async () => {
    await expect(
      approveCuratedComponent({ component_id: 'NONEXISTENT_CMP' }),
    ).rejects.toThrow(McpNotFoundError);
  });

  test('TEST-MCP-040d: throws McpValidationError for empty component_id', async () => {
    await expect(
      approveCuratedComponent({ component_id: '' }),
    ).rejects.toThrow(McpValidationError);
  });
});
