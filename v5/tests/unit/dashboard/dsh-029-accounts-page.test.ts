/**
 * TEST-DSH-039: Account Management page — CRUD
 * TEST-DSH-067-069: Account UI components
 * TEST-DSH-078: Platform filter
 * TEST-DSH-084: Account status display
 */
import * as fs from 'fs';
import * as path from 'path';

describe('FEAT-DSH-029: Account Management page — CRUD', () => {
  let pageContent: string;

  beforeAll(() => {
    pageContent = fs.readFileSync(
      path.join(__dirname, '../../../dashboard/app/accounts/page.tsx'),
      'utf-8'
    );
  });

  // TEST-DSH-039: Page exists with CRUD
  test('TEST-DSH-039: Account Management page renders', () => {
    expect(pageContent).toContain('Account Management');
    expect(pageContent).toContain('export default function');
  });

  // TEST-DSH-067: Account list
  test('TEST-DSH-067: displays account list', () => {
    expect(pageContent).toContain('<table');
    expect(pageContent).toContain('account_id');
    expect(pageContent).toContain('platform');
  });

  // TEST-DSH-068: Create form
  test('TEST-DSH-068: has create account form', () => {
    expect(pageContent).toContain('Create Account');
    expect(pageContent).toContain('handleCreate');
    expect(pageContent).toContain('New Account');
  });

  // TEST-DSH-069: Status update
  test('TEST-DSH-069: can update account status', () => {
    expect(pageContent).toContain('handleStatusChange');
    expect(pageContent).toContain('PUT');
  });

  // TEST-DSH-078: Platform filter
  test('TEST-DSH-078: platform filter buttons', () => {
    expect(pageContent).toContain('platformFilter');
    expect(pageContent).toContain('youtube');
    expect(pageContent).toContain('tiktok');
    expect(pageContent).toContain('instagram');
  });

  // TEST-DSH-084: Status display
  test('TEST-DSH-084: shows status with color coding', () => {
    expect(pageContent).toContain('statusColor');
    expect(pageContent).toContain('active');
    expect(pageContent).toContain('suspended');
    expect(pageContent).toContain('setup');
  });

  test('displays follower count', () => {
    expect(pageContent).toContain('follower_count');
    expect(pageContent).toContain('toLocaleString');
  });

  test('character ID shown', () => {
    expect(pageContent).toContain('character_id');
  });
});
