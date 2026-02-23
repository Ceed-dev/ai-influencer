/**
 * TEST-DSH-026: ダッシュボード自動リフレッシュ
 * TEST-DSH-131: ローディングインジケーター
 */
import * as fs from 'fs';
import * as path from 'path';

describe('FEAT-DSH-018: Auto Refresh configuration', () => {
  test('TEST-DSH-026: SWR config has refreshInterval', () => {
    const configPath = path.join(__dirname, '../../../dashboard/lib/swr-config.ts');
    const content = fs.readFileSync(configPath, 'utf-8');

    expect(content).toContain('refreshInterval');
    expect(content).toContain('DASHBOARD_AUTO_REFRESH_SEC');
    expect(content).toContain('revalidateOnFocus');
  });

  test('TEST-DSH-131: pages have loading state', () => {
    const pagesDir = path.join(__dirname, '../../../dashboard/app');
    const pageFiles = [
      'kpi/page.tsx',
      'errors/page.tsx',
      'accounts/page.tsx',
      'performance/page.tsx',
    ];

    for (const pageFile of pageFiles) {
      const fullPath = path.join(pagesDir, pageFile);
      const content = fs.readFileSync(fullPath, 'utf-8');
      expect(content).toMatch(/Loading|progressbar|loading/);
    }
  });

  test('default refresh interval is 30 seconds', () => {
    const configPath = path.join(__dirname, '../../../dashboard/lib/swr-config.ts');
    const content = fs.readFileSync(configPath, 'utf-8');
    expect(content).toContain('DEFAULT_REFRESH_INTERVAL_SEC = 30');
  });
});
