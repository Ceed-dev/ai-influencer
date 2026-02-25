/**
 * MCI-017: create_component
 * Tests: INSERT into components with type validation
 */
import { createComponent } from '../../../src/mcp-server/tools/curation/create-component';
import { McpValidationError } from '../../../src/mcp-server/errors';
import { withClient } from '../../helpers/db';

async function cleanup() {
  await withClient(async (client) => {
    await client.query(`DELETE FROM components WHERE name LIKE 'test_mci_017%'`);
  });
}

describe('MCI-017: create_component', () => {
  beforeAll(cleanup);
  afterAll(cleanup);

  test('rejects invalid type', async () => {
    await expect(
      createComponent({
        type: 'invalid' as any,
        subtype: 'hook',
        name: 'test',
        data: {},
        tags: [],
      }),
    ).rejects.toThrow(McpValidationError);
  });

  test('rejects empty name', async () => {
    await expect(
      createComponent({
        type: 'scenario',
        subtype: 'hook',
        name: '',
        data: {},
        tags: [],
      }),
    ).rejects.toThrow(McpValidationError);
  });

  test('creates component and returns component_id', async () => {
    const result = await createComponent({
      type: 'scenario',
      subtype: 'hook',
      name: 'test_mci_017 hook scenario',
      data: { script_en: 'test script' },
      tags: ['test'],
    });
    expect(result).toHaveProperty('component_id');
    expect(result.component_id).toMatch(/^SCN_/);
  });
});
