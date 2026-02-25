/**
 * FEAT-ALG-013: Data decay — 90-day hard cutoff
 * Tests: TEST-ALG-020 (complementary — verifies cutoff constant and utility)
 *
 * Pure-function tests — no DB required.
 */
import {
  DATA_DECAY_CUTOFF_DAYS,
  DATA_DECAY_SQL_CREATED_AT,
  DATA_DECAY_SQL_MEASURED_AT,
  buildDecayCutoffSql,
  isWithinDecayWindow,
  getDecayCutoffDate,
} from '../../../src/workers/algorithm/data-decay';

describe('FEAT-ALG-013: Data decay 90-day hard cutoff', () => {
  test('cutoff constant is 90 days', () => {
    expect(DATA_DECAY_CUTOFF_DAYS).toBe(90);
  });

  test('SQL fragment for created_at contains 90 days', () => {
    expect(DATA_DECAY_SQL_CREATED_AT).toContain("90 days");
    expect(DATA_DECAY_SQL_CREATED_AT).toContain('created_at');
  });

  test('SQL fragment for measured_at contains 90 days', () => {
    expect(DATA_DECAY_SQL_MEASURED_AT).toContain("90 days");
    expect(DATA_DECAY_SQL_MEASURED_AT).toContain('measured_at');
  });

  test('buildDecayCutoffSql produces correct SQL fragment', () => {
    const sql = buildDecayCutoffSql('ps.created_at');
    expect(sql).toBe("AND ps.created_at > NOW() - INTERVAL '90 days'");
  });

  test('buildDecayCutoffSql with different column name', () => {
    const sql = buildDecayCutoffSql('m.measured_at');
    expect(sql).toBe("AND m.measured_at > NOW() - INTERVAL '90 days'");
  });

  test('isWithinDecayWindow — 30 days ago is within window', () => {
    const ref = new Date('2026-06-01T00:00:00Z');
    const date = new Date('2026-05-01T00:00:00Z'); // 31 days ago
    expect(isWithinDecayWindow(date, ref)).toBe(true);
  });

  test('isWithinDecayWindow — 89 days ago is within window', () => {
    const ref = new Date('2026-06-01T00:00:00Z');
    const date = new Date('2026-03-04T00:00:01Z'); // ~89 days ago
    expect(isWithinDecayWindow(date, ref)).toBe(true);
  });

  test('isWithinDecayWindow — 91 days ago is OUTSIDE window', () => {
    const ref = new Date('2026-06-01T00:00:00Z');
    const date = new Date('2026-03-01T00:00:00Z'); // ~92 days ago
    expect(isWithinDecayWindow(date, ref)).toBe(false);
  });

  test('isWithinDecayWindow — exactly 90 days ago is OUTSIDE window (strict >)', () => {
    const ref = new Date('2026-06-01T00:00:00Z');
    const cutoff = new Date(ref.getTime() - 90 * 24 * 60 * 60 * 1000);
    // Exactly at cutoff should be false (strict >)
    expect(isWithinDecayWindow(cutoff, ref)).toBe(false);
  });

  test('getDecayCutoffDate returns date 90 days before reference', () => {
    const ref = new Date('2026-06-01T00:00:00Z');
    const cutoff = getDecayCutoffDate(ref);
    const diffDays = (ref.getTime() - cutoff.getTime()) / (24 * 60 * 60 * 1000);
    expect(diffDays).toBe(90);
  });

  test('getDecayCutoffDate uses current time when no ref provided', () => {
    const before = Date.now();
    const cutoff = getDecayCutoffDate();
    const after = Date.now();
    // Cutoff should be ~90 days before now
    const expectedMs = 90 * 24 * 60 * 60 * 1000;
    expect(before - cutoff.getTime()).toBeGreaterThanOrEqual(expectedMs - 1000);
    expect(after - cutoff.getTime()).toBeLessThanOrEqual(expectedMs + 1000);
  });
});
