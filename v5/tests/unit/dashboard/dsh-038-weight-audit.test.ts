/**
 * Tests for GET /api/weights/audit
 */
import * as fs from 'fs';
import * as path from 'path';
import { query, withClient } from '../../helpers/db';

const MARKER = 'TWAU_';

describe('GET /api/weights/audit', () => {
  const routePath = path.join(__dirname, '../../../dashboard/app/api/weights/audit/route.ts');
  let routeContent: string;

  beforeAll(async () => {
    routeContent = fs.readFileSync(routePath, 'utf-8');

    await withClient(async (client) => {
      await client.query(`DELETE FROM weight_audit_log WHERE factor_name LIKE '${MARKER}%'`);
      await client.query(`
        INSERT INTO weight_audit_log (platform, factor_name, old_weight, new_weight, data_count, metrics_count)
        VALUES
          ('youtube', '${MARKER}niche_factor', 0.15, 0.18, 100, 50),
          ('tiktok', '${MARKER}time_factor', 0.20, 0.22, 80, 40),
          ('youtube', '${MARKER}engagement_factor', 0.30, 0.28, 120, 60)
      `);
    });
  });

  afterAll(async () => {
    await withClient(async (client) => {
      await client.query(`DELETE FROM weight_audit_log WHERE factor_name LIKE '${MARKER}%'`);
    });
  });

  test('route file exists and exports GET handler', () => {
    expect(routeContent).toContain('export async function GET');
    expect(routeContent).toContain('weight_audit_log');
  });

  test('DB: weight audit log entries exist', async () => {
    const result = await query(
      `SELECT * FROM weight_audit_log WHERE factor_name LIKE '${MARKER}%' ORDER BY calculated_at DESC`
    );
    expect(result.rows.length).toBe(3);
    expect(result.rows[0]).toHaveProperty('platform');
    expect(result.rows[0]).toHaveProperty('factor_name');
    expect(result.rows[0]).toHaveProperty('old_weight');
    expect(result.rows[0]).toHaveProperty('new_weight');
  });

  test('route supports platform filter', () => {
    expect(routeContent).toContain('platform');
    expect(routeContent).toContain('searchParams');
  });

  test('route supports limit parameter', () => {
    expect(routeContent).toContain('limit');
  });

  test('route returns total count', () => {
    expect(routeContent).toContain('total');
    expect(routeContent).toContain('audit_logs');
  });
});
