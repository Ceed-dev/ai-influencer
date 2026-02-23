/**
 * FEAT-MCC-020: run_quality_check
 * Spec: 04-agent-design.md SS4.6 #11
 * Runs placeholder quality checks on produced content.
 */
import type {
  RunQualityCheckInput,
  RunQualityCheckOutput,
} from '@/types/mcp-tools';
import { getPool } from '../../db';
import { McpNotFoundError } from '../../errors';

export async function runQualityCheck(
  input: RunQualityCheckInput,
): Promise<RunQualityCheckOutput> {
  const pool = getPool();

  // Verify content exists
  const contentRes = await pool.query(
    `SELECT content_id FROM content WHERE content_id = $1`,
    [input.content_id],
  );

  if (contentRes.rowCount === 0) {
    throw new McpNotFoundError(`Content not found: ${input.content_id}`);
  }

  // Placeholder quality checks
  const checks: Array<{ name: string; passed: boolean; details?: string }> = [];

  // Check 1: video_exists — verify video_url is non-empty
  const videoExists = !!input.video_url && input.video_url.trim() !== '';
  checks.push({
    name: 'video_exists',
    passed: videoExists,
    details: videoExists ? 'Video URL is present' : 'Video URL is empty or missing',
  });

  // Check 2: content_exists — verify content record exists in DB (already confirmed above)
  checks.push({
    name: 'content_exists',
    passed: true,
    details: 'Content record found in database',
  });

  // Check 3: sections_complete — check that content has at least one section
  const sectionsRes = await pool.query(
    `SELECT COUNT(*)::int AS section_count
     FROM content_sections
     WHERE content_id = $1`,
    [input.content_id],
  );

  const sectionCount = (sectionsRes.rows[0] as { section_count: number } | undefined)?.section_count ?? 0;
  const sectionsComplete = sectionCount > 0;
  checks.push({
    name: 'sections_complete',
    passed: sectionsComplete,
    details: sectionsComplete
      ? `${sectionCount} section(s) found`
      : 'No sections found for this content',
  });

  const passed = checks.every((c) => c.passed);

  return { passed, checks };
}
