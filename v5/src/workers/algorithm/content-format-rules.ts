/**
 * FEAT-ALG-015: content_format factor applicability rules
 * Spec: 08-algorithm-analysis.md §26
 *
 * Data-driven approach: NULL values in DB naturally produce adj=0.
 * This module defines the applicability matrix for documentation and
 * validation purposes. No explicit branching needed in the prediction
 * pipeline — the SQL WHERE clauses with NULL checks handle it.
 *
 * Matrix:
 * | Factor                      | short_video | text_post       | image_post       |
 * |-----------------------------|-------------|-----------------|------------------|
 * | hook_type                   | YES         | YES (text hook)  | YES (caption)    |
 * | content_length              | YES (secs)  | YES (char count) | NO (NULL->adj=0) |
 * | post_hour                   | YES         | YES              | YES              |
 * | post_weekday                | YES         | YES              | YES              |
 * | niche                       | YES         | YES              | YES              |
 * | narrative_structure         | YES         | YES (text struct) | NO (NULL->adj=0) |
 * | sound_bgm                   | YES         | NO (NULL->adj=0) | NO (NULL->adj=0) |
 * | hashtag_keyword             | YES         | YES              | YES              |
 * | cross_account_performance   | YES         | YES              | YES              |
 */
import type { ContentFormat } from '@/types/database';

/** All 9 prediction factors */
export const FACTORS = [
  'hook_type',
  'content_length',
  'post_hour',
  'post_weekday',
  'niche',
  'narrative_structure',
  'sound_bgm',
  'hashtag_keyword',
  'cross_account_performance',
] as const;

export type Factor = (typeof FACTORS)[number];

/**
 * Applicability matrix: which factors apply to which content_format.
 * TRUE = factor can have a non-null value in DB.
 * FALSE = factor will always be NULL in DB → adj=0 naturally.
 */
export const FORMAT_FACTOR_MATRIX: Record<ContentFormat, Record<Factor, boolean>> = {
  short_video: {
    hook_type: true,
    content_length: true,
    post_hour: true,
    post_weekday: true,
    niche: true,
    narrative_structure: true,
    sound_bgm: true,
    hashtag_keyword: true,
    cross_account_performance: true,
  },
  text_post: {
    hook_type: true,
    content_length: true, // char_count-based bucketing
    post_hour: true,
    post_weekday: true,
    niche: true,
    narrative_structure: true, // text structure
    sound_bgm: false,         // NULL → adj=0
    hashtag_keyword: true,
    cross_account_performance: true,
  },
  image_post: {
    hook_type: true,  // caption hook
    content_length: false,        // NULL → adj=0
    post_hour: true,
    post_weekday: true,
    niche: true,
    narrative_structure: false,   // NULL → adj=0
    sound_bgm: false,             // NULL → adj=0
    hashtag_keyword: true,
    cross_account_performance: true,
  },
};

/**
 * Get applicable factors for a given content_format.
 * Returns only factors where the value can be non-null.
 */
export function getApplicableFactors(contentFormat: ContentFormat): Factor[] {
  const matrix = FORMAT_FACTOR_MATRIX[contentFormat];
  return FACTORS.filter(f => matrix[f]);
}

/**
 * Get inapplicable (always-null/skipped) factors for a given content_format.
 */
export function getSkippedFactors(contentFormat: ContentFormat): Factor[] {
  const matrix = FORMAT_FACTOR_MATRIX[contentFormat];
  return FACTORS.filter(f => !matrix[f]);
}

/**
 * Check if a specific factor applies to a content_format.
 */
export function isFactorApplicable(factor: Factor, contentFormat: ContentFormat): boolean {
  return FORMAT_FACTOR_MATRIX[contentFormat][factor];
}

/**
 * Count applicable factors for a content_format.
 */
export function countApplicableFactors(contentFormat: ContentFormat): number {
  return getApplicableFactors(contentFormat).length;
}

/** Content length buckets for text_post (char count) */
export const TEXT_POST_LENGTH_BUCKETS = [
  { label: '0-140c', min: 0, max: 140 },
  { label: '141-280c', min: 141, max: 280 },
  { label: '281-500c', min: 281, max: 500 },
  { label: '500c+', min: 501, max: Infinity },
] as const;

/**
 * Get text post length bucket label from character count.
 */
export function getTextPostLengthBucket(charCount: number): string {
  for (const bucket of TEXT_POST_LENGTH_BUCKETS) {
    if (charCount >= bucket.min && charCount <= bucket.max) {
      return bucket.label;
    }
  }
  return '500c+';
}
