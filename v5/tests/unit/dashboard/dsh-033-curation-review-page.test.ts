/**
 * TEST-DSH-043: Curation Review — コンポーネント一覧
 * TEST-DSH-090: 削除確認ダイアログ
 * TEST-DSH-126: tool_catalog一覧
 * TEST-DSH-127: キュレーションレビューパネル
 */
import * as fs from 'fs';
import * as path from 'path';
import { query, withClient } from '../../helpers/db';

describe('FEAT-DSH-033: Curation Review page', () => {
  const pagePath = path.join(__dirname, '../../../dashboard/app/curation/page.tsx');
  let content: string;
  const apiPath = path.join(__dirname, '../../../dashboard/app/api/components/route.ts');
  let apiContent: string;

  beforeAll(async () => {
    content = fs.readFileSync(pagePath, 'utf-8');
    apiContent = fs.readFileSync(apiPath, 'utf-8');

    await withClient(async (client) => {
      await client.query(`DELETE FROM components WHERE name LIKE 'TEST_CUR_%'`);
      await client.query(`
        INSERT INTO components (component_id, type, name, curated_by, curation_confidence, review_status)
        VALUES
          ('CMP_T001', 'scenario', 'TEST_CUR_1 Morning scenario', 'auto', 0.85, 'pending_review'),
          ('CMP_T002', 'motion', 'TEST_CUR_2 Dance motion', 'auto', 0.70, 'pending_review'),
          ('CMP_T003', 'audio', 'TEST_CUR_3 BGM track', 'human', 0.95, 'human_approved')
      `);
    });
  });

  afterAll(async () => {
    await withClient(async (client) => {
      await client.query(`DELETE FROM components WHERE name LIKE 'TEST_CUR_%'`);
    });
  });

  // TEST-DSH-043: shows pending_review components
  test('TEST-DSH-043: page fetches pending_review components', () => {
    expect(content).toContain('pending_review');
    expect(content).toContain('/api/components');
  });

  // TEST-DSH-090: approve/reject buttons
  test('TEST-DSH-090: has approve and reject buttons', () => {
    expect(content).toContain('承認');
    expect(content).toContain('差し戻し');
  });

  // TEST-DSH-126: component details shown
  test('TEST-DSH-126: shows component type and confidence', () => {
    expect(content).toContain('自信度');
    expect(content).toContain('スコア');
    expect(content).toContain('type');
  });

  // TEST-DSH-127: curation panel with filter
  test('TEST-DSH-127: has type filter for components', () => {
    expect(content).toContain('コンポーネントタイプ');
    expect(content).toContain('scenario');
    expect(content).toContain('motion');
    expect(content).toContain('audio');
    expect(content).toContain('image');
  });

  test('API: supports review_status filter', () => {
    expect(apiContent).toContain('review_status');
    expect(apiContent).toContain('searchParams.get');
  });

  test('DB: query pending_review components', async () => {
    const result = await query(
      `SELECT * FROM components WHERE name LIKE 'TEST_CUR_%' AND review_status = 'pending_review'`
    );
    expect(result.rows.length).toBe(2);
    result.rows.forEach((row: Record<string, unknown>) => {
      expect(row.review_status).toBe('pending_review');
    });
  });

  test('DB: approved components excluded from pending', async () => {
    const result = await query(
      `SELECT * FROM components WHERE name LIKE 'TEST_CUR_%' AND review_status = 'human_approved'`
    );
    expect(result.rows.length).toBe(1);
    expect((result.rows[0] as Record<string, unknown>).component_id).toBe('CMP_T003');
  });
});
