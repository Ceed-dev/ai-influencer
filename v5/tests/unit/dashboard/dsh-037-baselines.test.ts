/**
 * Tests for GET /api/baselines/:account_id
 */
import * as fs from 'fs';
import * as path from 'path';
import { query, withClient } from '../../helpers/db';

const PREFIX = 'TBSL_';

describe('GET /api/baselines/:account_id', () => {
  const routePath = path.join(__dirname, '../../../dashboard/app/api/baselines/[account_id]/route.ts');
  let routeContent: string;

  beforeAll(async () => {
    routeContent = fs.readFileSync(routePath, 'utf-8');

    await withClient(async (client) => {
      await client.query(`DELETE FROM account_baselines WHERE account_id LIKE '${PREFIX}%'`);
      await client.query(`DELETE FROM accounts WHERE account_id LIKE '${PREFIX}%'`);
      await client.query(`DELETE FROM characters WHERE character_id = '${PREFIX}CHR_001'`);

      await client.query(`
        INSERT INTO characters (character_id, name, voice_id, status)
        VALUES ('${PREFIX}CHR_001', 'Baseline Test Char', 'abc123def456abc123def456abc12345', 'active')
        ON CONFLICT (character_id) DO NOTHING
      `);
      await client.query(`
        INSERT INTO accounts (account_id, platform, status, character_id)
        VALUES ('${PREFIX}ACC_001', 'youtube', 'active', '${PREFIX}CHR_001')
        ON CONFLICT (account_id) DO NOTHING
      `);
      await client.query(`
        INSERT INTO account_baselines (account_id, baseline_impressions, source, sample_count, window_start, window_end)
        VALUES ('${PREFIX}ACC_001', 5000.0, 'own_history', 30, '2026-01-01', '2026-01-31')
        ON CONFLICT (account_id) DO UPDATE SET baseline_impressions = 5000.0
      `);
    });
  });

  afterAll(async () => {
    await withClient(async (client) => {
      await client.query(`DELETE FROM account_baselines WHERE account_id LIKE '${PREFIX}%'`);
      await client.query(`DELETE FROM accounts WHERE account_id LIKE '${PREFIX}%'`);
      await client.query(`DELETE FROM characters WHERE character_id = '${PREFIX}CHR_001'`);
    });
  });

  test('route file exists and exports GET handler', () => {
    expect(routeContent).toContain('export async function GET');
    expect(routeContent).toContain('account_baselines');
  });

  test('DB: baseline data exists for test account', async () => {
    const result = await query(
      `SELECT * FROM account_baselines WHERE account_id = $1`,
      [`${PREFIX}ACC_001`]
    );
    expect(result.rows.length).toBe(1);
    expect(Number(result.rows[0].baseline_impressions)).toBe(5000);
    expect(result.rows[0].source).toBe('own_history');
  });

  test('route handles baseline_impressions, source, sample_count fields', () => {
    expect(routeContent).toContain('baseline_impressions');
    expect(routeContent).toContain('source');
    expect(routeContent).toContain('sample_count');
    expect(routeContent).toContain('window_start');
    expect(routeContent).toContain('window_end');
  });
});
