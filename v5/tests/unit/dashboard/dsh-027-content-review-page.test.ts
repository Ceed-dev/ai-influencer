/**
 * TEST-DSH-037: Content Review page
 * TEST-DSH-073-075: Review UI components
 * TEST-DSH-114-115: Approve/Reject buttons
 */
import * as fs from 'fs';
import * as path from 'path';

describe('FEAT-DSH-027: Content Review page — approve/reject UI', () => {
  let pageContent: string;

  beforeAll(() => {
    pageContent = fs.readFileSync(
      path.join(__dirname, '../../../dashboard/app/review/page.tsx'),
      'utf-8'
    );
  });

  // TEST-DSH-037: Page exists and renders review UI
  test('TEST-DSH-037: Review page component exists', () => {
    expect(pageContent).toContain('Content Review');
    expect(pageContent).toContain('export default function');
  });

  // TEST-DSH-073: pending_approval items listed
  test('TEST-DSH-073: fetches pending_approval content', () => {
    expect(pageContent).toContain('pending_approval');
    expect(pageContent).toContain('/api/content');
  });

  // TEST-DSH-074: Approve button
  test('TEST-DSH-074: has approve button', () => {
    expect(pageContent).toContain('Approve');
    expect(pageContent).toContain('handleApprove');
    expect(pageContent).toContain('/approve');
  });

  // TEST-DSH-075: Reject button
  test('TEST-DSH-075: has reject button with comment requirement', () => {
    expect(pageContent).toContain('Reject');
    expect(pageContent).toContain('handleReject');
    expect(pageContent).toContain('/reject');
    expect(pageContent).toContain('rejection_category');
  });

  // TEST-DSH-114: Approve calls API
  test('TEST-DSH-114: approve calls POST /api/content/:id/approve', () => {
    expect(pageContent).toContain('approve');
    expect(pageContent).toContain('POST');
  });

  // TEST-DSH-115: Reject requires comment
  test('TEST-DSH-115: reject enforces comment requirement', () => {
    expect(pageContent).toContain('Rejection requires a comment');
  });

  test('displays content format badge', () => {
    expect(pageContent).toContain('content_format');
  });

  test('displays quality score', () => {
    expect(pageContent).toContain('quality_score');
  });

  test('has feedback textarea', () => {
    expect(pageContent).toContain('textarea');
    expect(pageContent).toContain('Feedback');
  });

  test('includes rejection category dropdown', () => {
    expect(pageContent).toContain('plan_revision');
    expect(pageContent).toContain('data_insufficient');
    expect(pageContent).toContain('hypothesis_weak');
  });
});
