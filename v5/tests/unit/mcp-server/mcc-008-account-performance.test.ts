/**
 * Tests for get_account_performance
 */
import { getAccountPerformance } from '@/src/mcp-server/tools/planner/get-account-performance';
import { McpValidationError, McpNotFoundError } from '@/src/mcp-server/errors';
import { withClient } from '../../helpers/db';

const PREFIX = 'TACP_';

describe('get_account_performance', () => {
  beforeAll(async () => {
    await withClient(async (client) => {
      // Cleanup in correct FK order
      await client.query(`DELETE FROM account_baselines WHERE account_id LIKE '${PREFIX}%'`);
      await client.query(`DELETE FROM metrics WHERE publication_id IN (SELECT id FROM publications WHERE content_id LIKE '${PREFIX}%')`);
      await client.query(`DELETE FROM content_sections WHERE content_id LIKE '${PREFIX}%'`);
      await client.query(`DELETE FROM publications WHERE content_id LIKE '${PREFIX}%'`);
      await client.query(`DELETE FROM content WHERE content_id LIKE '${PREFIX}%'`);
      await client.query(`DELETE FROM accounts WHERE account_id LIKE '${PREFIX}%'`);
      await client.query(`DELETE FROM characters WHERE character_id LIKE '${PREFIX}%'`);

      // Seed test data
      await client.query(`
        INSERT INTO characters (character_id, name, voice_id, status)
        VALUES ('${PREFIX}CHR_001', 'Test Perf Char', 'abc123def456abc123def456abc12345', 'active')
        ON CONFLICT (character_id) DO NOTHING
      `);
      await client.query(`
        INSERT INTO accounts (account_id, platform, status, follower_count, character_id, niche, cluster)
        VALUES ('${PREFIX}ACC_001', 'youtube', 'active', 1000, '${PREFIX}CHR_001', 'beauty', 'cluster_a')
        ON CONFLICT (account_id) DO NOTHING
      `);
      await client.query(`
        INSERT INTO content (content_id, character_id, content_format, status)
        VALUES ('${PREFIX}CNT_001', '${PREFIX}CHR_001', 'short_video', 'posted')
        ON CONFLICT (content_id) DO NOTHING
      `);
      await client.query(`
        INSERT INTO publications (content_id, account_id, platform, status, posted_at)
        VALUES ('${PREFIX}CNT_001', '${PREFIX}ACC_001', 'youtube', 'measured', NOW() - INTERVAL '2 days')
        ON CONFLICT DO NOTHING
      `);

      // Insert metrics
      const pubRes = await client.query(
        `SELECT id FROM publications WHERE content_id = '${PREFIX}CNT_001' LIMIT 1`
      );
      if (pubRes.rows.length > 0) {
        await client.query(`
          INSERT INTO metrics (publication_id, views, likes, comments, shares, engagement_rate, follower_delta, measurement_point)
          VALUES ($1, 5000, 250, 50, 30, 0.0660, 15, '48h')
          ON CONFLICT (publication_id, measurement_point) DO NOTHING
        `, [pubRes.rows[0].id]);
      }
    });
  });

  afterAll(async () => {
    await withClient(async (client) => {
      await client.query(`DELETE FROM account_baselines WHERE account_id LIKE '${PREFIX}%'`);
      await client.query(`DELETE FROM metrics WHERE publication_id IN (SELECT id FROM publications WHERE content_id LIKE '${PREFIX}%')`);
      await client.query(`DELETE FROM content_sections WHERE content_id LIKE '${PREFIX}%'`);
      await client.query(`DELETE FROM publications WHERE content_id LIKE '${PREFIX}%'`);
      await client.query(`DELETE FROM content WHERE content_id LIKE '${PREFIX}%'`);
      await client.query(`DELETE FROM accounts WHERE account_id LIKE '${PREFIX}%'`);
      await client.query(`DELETE FROM characters WHERE character_id LIKE '${PREFIX}%'`);
    });
  });

  test('returns performance for valid account and period', async () => {
    const result = await getAccountPerformance({
      account_id: `${PREFIX}ACC_001`,
      period: '7d',
    });
    expect(result).toHaveProperty('avg_views');
    expect(result).toHaveProperty('avg_engagement');
    expect(result).toHaveProperty('top_content');
    expect(result).toHaveProperty('trend');
    expect(typeof result.avg_views).toBe('number');
    expect(typeof result.avg_engagement).toBe('number');
    expect(['improving', 'stable', 'declining']).toContain(result.trend);
  });

  test('rejects invalid period', async () => {
    await expect(
      getAccountPerformance({ account_id: `${PREFIX}ACC_001`, period: '1y' as any }),
    ).rejects.toThrow(McpValidationError);
  });

  test('rejects empty account_id', async () => {
    await expect(
      getAccountPerformance({ account_id: '', period: '7d' }),
    ).rejects.toThrow(McpValidationError);
  });

  test('throws NotFoundError for nonexistent account', async () => {
    await expect(
      getAccountPerformance({ account_id: 'NONEXISTENT_999', period: '7d' }),
    ).rejects.toThrow(McpNotFoundError);
  });
});
