/**
 * MCI-038: update_component_score
 * Tests: component score update
 */
import { updateComponentScore } from '../../../src/mcp-server/tools/intelligence/update-component-score';
import { McpValidationError, McpNotFoundError } from '../../../src/mcp-server/errors';
import { withClient } from '../../helpers/db';

describe('MCI-038: update_component_score', () => {
  test('rejects empty component_id', async () => {
    await expect(
      updateComponentScore({ component_id: '', new_score: 50 }),
    ).rejects.toThrow(McpValidationError);
  });

  test('rejects score below 0', async () => {
    await expect(
      updateComponentScore({ component_id: 'COMP_001', new_score: -1 }),
    ).rejects.toThrow(McpValidationError);
  });

  test('rejects score above 100', async () => {
    await expect(
      updateComponentScore({ component_id: 'COMP_001', new_score: 101 }),
    ).rejects.toThrow(McpValidationError);
  });

  test('throws not found for non-existent component', async () => {
    await expect(
      updateComponentScore({ component_id: 'NONEXISTENT_999', new_score: 50 }),
    ).rejects.toThrow(McpNotFoundError);
  });

  test('successfully updates score for existing component', async () => {
    let componentId: string;
    try {
      componentId = await withClient(async (client) => {
        const res = await client.query(
          `INSERT INTO components (component_id, type, subtype, name, score)
           VALUES ('TEST_COMP_038', 'scenario', 'hook', 'Test Component', 50.00)
           RETURNING component_id`,
        );
        return res.rows[0].component_id;
      });

      const result = await updateComponentScore({ component_id: componentId, new_score: 75 });
      expect(result.success).toBe(true);

      // Verify the update
      const verifyRes = await withClient(async (client) => {
        const res = await client.query(
          `SELECT score FROM components WHERE component_id = $1`,
          [componentId],
        );
        return res.rows[0];
      });
      expect(Number(verifyRes.score)).toBe(75);
    } finally {
      await withClient(async (client) => {
        await client.query(`DELETE FROM components WHERE component_id = 'TEST_COMP_038'`);
      });
    }
  });
});
