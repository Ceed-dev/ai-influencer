/**
 * save_audience_signal
 * Tests: TEST-MCP-108
 */
import { saveAudienceSignal } from '../../../src/mcp-server/tools/intelligence/save-audience-signal';
import { McpValidationError } from '../../../src/mcp-server/errors';
import { withClient } from '../../helpers/db';

async function cleanup() {
  await withClient(async (client) => {
    await client.query(`DELETE FROM market_intel WHERE data->>'topic' LIKE '%test_mci_037%'`);
  });
}

describe('save_audience_signal', () => {
  beforeAll(cleanup);
  afterAll(cleanup);

  test('TEST-MCP-108: saves audience signal and returns id', async () => {
    const result = await saveAudienceSignal({
      signal_type: 'engagement_spike',
      topic: 'test_mci_037_morning_routine',
      sentiment: 'positive',
      sample_data: { comments: ['love this!', 'more please'] },
    });

    expect(result).toHaveProperty('id');
    expect(typeof result.id).toBe('number');
    expect(result.id).toBeGreaterThan(0);

    const dbCheck = await withClient(async (client) => {
      const res = await client.query(
        `SELECT intel_type, data FROM market_intel WHERE id = $1`,
        [result.id],
      );
      return res.rows[0];
    });

    expect(dbCheck).toBeDefined();
    expect(dbCheck.intel_type).toBe('audience_signal');
    expect(dbCheck.data.signal_type).toBe('engagement_spike');
    expect(dbCheck.data.topic).toBe('test_mci_037_morning_routine');
    expect(dbCheck.data.sentiment).toBe('positive');
    expect(dbCheck.data.sample_data).toEqual({ comments: ['love this!', 'more please'] });
  });

  test('rejects empty signal_type', async () => {
    await expect(
      saveAudienceSignal({
        signal_type: '',
        topic: 'test_mci_037_topic',
        sentiment: 'positive',
        sample_data: {},
      }),
    ).rejects.toThrow(McpValidationError);
  });

  test('rejects empty topic', async () => {
    await expect(
      saveAudienceSignal({
        signal_type: 'test',
        topic: '',
        sentiment: 'positive',
        sample_data: {},
      }),
    ).rejects.toThrow(McpValidationError);
  });

  test('rejects empty sentiment', async () => {
    await expect(
      saveAudienceSignal({
        signal_type: 'test',
        topic: 'test_mci_037_topic',
        sentiment: '',
        sample_data: {},
      }),
    ).rejects.toThrow(McpValidationError);
  });
});
