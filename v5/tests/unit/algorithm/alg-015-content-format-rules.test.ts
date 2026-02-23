/**
 * FEAT-ALG-015: content_format factor applicability rules
 * Tests: TEST-ALG-022
 *
 * Pure-function tests — no DB required.
 */
import {
  FACTORS,
  FORMAT_FACTOR_MATRIX,
  getApplicableFactors,
  getSkippedFactors,
  isFactorApplicable,
  countApplicableFactors,
  getTextPostLengthBucket,
} from '../../../src/workers/algorithm/content-format-rules';

describe('FEAT-ALG-015: content_format factor rules', () => {
  // TEST-ALG-022: factor applicability matrix
  test('TEST-ALG-022: short_video uses all 9 factors', () => {
    const applicable = getApplicableFactors('short_video');
    expect(applicable).toHaveLength(9);
    expect(countApplicableFactors('short_video')).toBe(9);
  });

  test('text_post skips sound_bgm (NULL→adj=0)', () => {
    expect(isFactorApplicable('sound_bgm', 'text_post')).toBe(false);
    const skipped = getSkippedFactors('text_post');
    expect(skipped).toContain('sound_bgm');
  });

  test('text_post uses 8 factors', () => {
    expect(countApplicableFactors('text_post')).toBe(8);
  });

  test('text_post applicable factors include content_length and narrative_structure', () => {
    expect(isFactorApplicable('content_length', 'text_post')).toBe(true);
    expect(isFactorApplicable('narrative_structure', 'text_post')).toBe(true);
  });

  test('image_post skips content_length, narrative_structure, sound_bgm', () => {
    const skipped = getSkippedFactors('image_post');
    expect(skipped).toContain('content_length');
    expect(skipped).toContain('narrative_structure');
    expect(skipped).toContain('sound_bgm');
    expect(skipped).toHaveLength(3);
  });

  test('image_post uses 6 factors', () => {
    expect(countApplicableFactors('image_post')).toBe(6);
  });

  test('image_post keeps hook_type (caption hook)', () => {
    expect(isFactorApplicable('hook_type', 'image_post')).toBe(true);
  });

  test('all formats share common factors: post_hour, post_weekday, niche, hashtag_keyword, cross_account', () => {
    const commonFactors = ['post_hour', 'post_weekday', 'niche', 'hashtag_keyword', 'cross_account_performance'] as const;
    for (const factor of commonFactors) {
      expect(isFactorApplicable(factor, 'short_video')).toBe(true);
      expect(isFactorApplicable(factor, 'text_post')).toBe(true);
      expect(isFactorApplicable(factor, 'image_post')).toBe(true);
    }
  });

  test('FACTORS array contains exactly 9 elements', () => {
    expect(FACTORS).toHaveLength(9);
  });

  test('FORMAT_FACTOR_MATRIX covers all 3 content formats', () => {
    expect(Object.keys(FORMAT_FACTOR_MATRIX)).toEqual(
      expect.arrayContaining(['short_video', 'text_post', 'image_post']),
    );
    expect(Object.keys(FORMAT_FACTOR_MATRIX)).toHaveLength(3);
  });

  // Text post length bucketing
  test('text post length bucket — 0-140c', () => {
    expect(getTextPostLengthBucket(0)).toBe('0-140c');
    expect(getTextPostLengthBucket(100)).toBe('0-140c');
    expect(getTextPostLengthBucket(140)).toBe('0-140c');
  });

  test('text post length bucket — 141-280c', () => {
    expect(getTextPostLengthBucket(141)).toBe('141-280c');
    expect(getTextPostLengthBucket(200)).toBe('141-280c');
    expect(getTextPostLengthBucket(280)).toBe('141-280c');
  });

  test('text post length bucket — 281-500c', () => {
    expect(getTextPostLengthBucket(281)).toBe('281-500c');
    expect(getTextPostLengthBucket(500)).toBe('281-500c');
  });

  test('text post length bucket — 500c+', () => {
    expect(getTextPostLengthBucket(501)).toBe('500c+');
    expect(getTextPostLengthBucket(10000)).toBe('500c+');
  });
});
