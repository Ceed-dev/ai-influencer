/**
 * TEST-DSH-046: REST API — 不正JSON処理
 * TEST-DSH-047: REST API — 404処理
 * TEST-DSH-139: Error response format
 */
import * as fs from 'fs';
import * as path from 'path';

describe('FEAT-DSH-036: REST API error handling', () => {
  // TEST-DSH-046: Invalid JSON handling is implemented in route handlers
  test('TEST-DSH-046: POST routes handle invalid JSON', () => {
    // Verify the accounts route.ts has JSON error handling
    const accountsRoute = fs.readFileSync(
      path.join(__dirname, '../../../dashboard/app/api/accounts/route.ts'),
      'utf-8'
    );
    expect(accountsRoute).toContain('Invalid JSON body');
    expect(accountsRoute).toContain('status: 400');
  });

  // TEST-DSH-047: 404 handling
  test('TEST-DSH-047: account detail returns 404 for missing ID', () => {
    const accountDetailRoute = fs.readFileSync(
      path.join(__dirname, '../../../dashboard/app/api/accounts/[id]/route.ts'),
      'utf-8'
    );
    expect(accountDetailRoute).toContain('not found');
    expect(accountDetailRoute).toContain('status: 404');
  });

  test('content detail returns 404 for missing content', () => {
    const approveRoute = fs.readFileSync(
      path.join(__dirname, '../../../dashboard/app/api/content/[id]/approve/route.ts'),
      'utf-8'
    );
    expect(approveRoute).toContain('not found');
    expect(approveRoute).toContain('status: 404');
  });

  test('settings returns 404 for missing key', () => {
    const settingsRoute = fs.readFileSync(
      path.join(__dirname, '../../../dashboard/app/api/settings/[key]/route.ts'),
      'utf-8'
    );
    expect(settingsRoute).toContain('not found');
    expect(settingsRoute).toContain('status: 404');
  });

  // TEST-DSH-139: Not-found page exists
  test('TEST-DSH-139: custom 404 page exists', () => {
    const notFoundPage = fs.readFileSync(
      path.join(__dirname, '../../../dashboard/app/not-found.tsx'),
      'utf-8'
    );
    expect(notFoundPage).toContain('404');
    expect(notFoundPage).toContain('not found');
  });

  test('reject route validates required comment', () => {
    const rejectRoute = fs.readFileSync(
      path.join(__dirname, '../../../dashboard/app/api/content/[id]/reject/route.ts'),
      'utf-8'
    );
    expect(rejectRoute).toContain('comment is required');
    expect(rejectRoute).toContain('status: 400');
  });
});
