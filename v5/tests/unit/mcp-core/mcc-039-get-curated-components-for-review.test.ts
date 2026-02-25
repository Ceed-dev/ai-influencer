/**
 * TEST-MCP-039: get_curated_components_for_review — returns pending review components
 * FEAT-MCC-039
 */
import { getCuratedComponentsForReview } from '@/src/mcp-server/tools/agent-mgmt/get-curated-components-for-review';
import { withClient } from '../../helpers/db';

const PREFIX = 'MCP_TEST_';

describe('FEAT-MCC-039: get_curated_components_for_review', () => {
  beforeAll(async () => {
    await withClient(async (client) => {
      await client.query(`
        INSERT INTO components (component_id, type, subtype, name, data, review_status, curation_confidence, curated_by)
        VALUES
          ('${PREFIX}CMP_039A', 'scenario', 'hook', 'Test Hook 039', '{"test": true}', 'pending_review', 0.85, 'auto'),
          ('${PREFIX}CMP_039B', 'motion', 'body', 'Test Motion 039', '{"movement": "slow"}', 'pending_review', 0.72, 'auto')
        ON CONFLICT (component_id) DO NOTHING
      `);
    });
  });

  afterAll(async () => {
    await withClient(async (client) => {
      await client.query(`DELETE FROM components WHERE component_id LIKE '${PREFIX}CMP_039%'`);
    });
  });

  test('TEST-MCP-039a: returns pending review components', async () => {
    const result = await getCuratedComponentsForReview({});

    expect(Array.isArray(result.components)).toBe(true);
    expect(result.components.length).toBeGreaterThanOrEqual(2);

    const found = result.components.find((c) => c.component_id === `${PREFIX}CMP_039A`);
    expect(found).toBeDefined();
    expect(found?.type).toBe('scenario');
    expect(found?.curator_confidence).toBe(0.85);
  });

  test('TEST-MCP-039b: output has correct structure', async () => {
    const result = await getCuratedComponentsForReview({});

    for (const comp of result.components) {
      expect(typeof comp.component_id).toBe('string');
      expect(typeof comp.type).toBe('string');
      expect(typeof comp.data).toBe('object');
      expect(typeof comp.curator_confidence).toBe('number');
    }
  });
});
