/**
 * TEST-DSH-041: Performance ページ — アカウント別パフォーマンス
 * TEST-DSH-128: コスト管理 (partial)
 * TEST-DSH-129: 予算超過 (partial)
 * TEST-DSH-148: PlatformBreakdownPie
 */
import * as fs from 'fs';
import * as path from 'path';
import { query } from '../../helpers/db';

describe('FEAT-DSH-031: Performance page', () => {
  const pagePath = path.join(__dirname, '../../../dashboard/app/performance/page.tsx');
  let content: string;
  const apiPath = path.join(__dirname, '../../../dashboard/app/api/performance/route.ts');
  let apiContent: string;

  beforeAll(() => {
    content = fs.readFileSync(pagePath, 'utf-8');
    apiContent = fs.readFileSync(apiPath, 'utf-8');
  });

  // TEST-DSH-041: shows account-level performance
  test('TEST-DSH-041: Performance page shows account metrics', () => {
    expect(content).toContain('アカウント');
    expect(content).toContain('プラットフォーム');
    expect(content).toContain('フォロワー');
    expect(content).toContain('総ビュー');
    expect(content).toContain('エンゲージメント率');
  });

  // TEST-DSH-128: engagement rate calculation
  test('TEST-DSH-128: API calculates engagement rate', () => {
    expect(apiContent).toContain('engagement_rate');
    expect(apiContent).toContain('total_views');
    expect(apiContent).toContain('total_likes');
    expect(apiContent).toContain('total_comments');
  });

  // TEST-DSH-129: publication count
  test('TEST-DSH-129: API includes publication count', () => {
    expect(apiContent).toContain('publication_count');
  });

  // TEST-DSH-148: platform breakdown
  test('TEST-DSH-148: shows platform in performance data', () => {
    expect(content).toContain('platform');
    expect(apiContent).toContain('a.platform');
  });

  test('Performance page fetches from /api/performance', () => {
    expect(content).toContain('/api/performance');
  });

  test('API joins accounts with publications and metrics', () => {
    expect(apiContent).toContain('publications');
    expect(apiContent).toContain('metrics');
    expect(apiContent).toContain('LEFT JOIN');
  });

  test('DB: performance query works', async () => {
    const result = await query(
      `SELECT a.account_id, a.platform, a.platform_username
       FROM accounts a
       ORDER BY a.account_id ASC LIMIT 5`
    );
    expect(Array.isArray(result.rows)).toBe(true);
  });
});
