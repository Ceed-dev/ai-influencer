/**
 * FEAT-MS-004: Component creation + dedup detection
 * Spec: 04-agent-design.md §4.10 (#2, #5), 02-architecture.md §8
 *
 * Creates structured components from raw data and checks for duplicates.
 * Dedup uses name/tag matching (pgvector dedup is in learning-dedup.ts).
 * All config from DB system_settings — no hardcoding.
 */
import type { PoolClient } from 'pg';
import type { ComponentType, CuratedBy, ComponentReviewStatus } from '@/types/database';

/** Input for creating a component */
export interface ComponentCreateParams {
  type: ComponentType;
  subtype?: string | null;
  name: string;
  description?: string | null;
  data?: Record<string, unknown> | null;
  driveFileId?: string | null;
  niche?: string | null;
  tags?: string[] | null;
  curatedBy: CuratedBy;
  curationConfidence?: number | null;
}

/** Result of component creation */
export interface ComponentCreateResult {
  componentId: string;
  isDuplicate: boolean;
  existingComponentId?: string;
  reviewStatus: ComponentReviewStatus;
}

/** Duplicate check result */
export interface DuplicateCheckResult {
  isDuplicate: boolean;
  existingId: string | null;
  similarity: string; // 'exact_name' | 'tag_overlap' | 'none'
}

/**
 * Generate a component ID in the appropriate format.
 * SCN_NNNN for scenario, MOT_NNNN for motion, AUD_NNNN for audio, IMG_NNNN for image.
 */
export async function generateComponentId(
  client: PoolClient,
  type: ComponentType,
): Promise<string> {
  const prefixes: Record<ComponentType, string> = {
    scenario: 'SCN',
    motion: 'MOT',
    audio: 'AUD',
    image: 'IMG',
  };

  const prefix = prefixes[type];
  const res = await client.query(
    `SELECT COALESCE(MAX(
       CASE WHEN component_id LIKE $1 || '_%'
       THEN CAST(SUBSTRING(component_id FROM $2) AS INTEGER)
       ELSE 0 END
     ), 0) + 1 AS next_num
     FROM components`,
    [`${prefix}`, `${prefix}_(.+)`],
  );

  const nextNum = (res.rows[0] as Record<string, unknown>)['next_num'] as number;
  return `${prefix}_${String(nextNum).padStart(4, '0')}`;
}

/**
 * Check for duplicate components based on name and tag overlap.
 */
export async function checkDuplicate(
  client: PoolClient,
  type: ComponentType,
  name: string,
  tags: string[] | null,
): Promise<DuplicateCheckResult> {
  // Check exact name match
  const nameRes = await client.query(
    `SELECT component_id FROM components
     WHERE type = $1 AND LOWER(name) = LOWER($2)
     LIMIT 1`,
    [type, name],
  );

  if (nameRes.rows.length > 0) {
    return {
      isDuplicate: true,
      existingId: (nameRes.rows[0] as Record<string, unknown>)['component_id'] as string,
      similarity: 'exact_name',
    };
  }

  // Check high tag overlap (>= 80% shared tags)
  if (tags && tags.length > 0) {
    const tagRes = await client.query(
      `SELECT component_id, tags
       FROM components
       WHERE type = $1 AND tags IS NOT NULL AND array_length(tags, 1) > 0
       LIMIT 100`,
      [type],
    );

    for (const row of tagRes.rows) {
      const r = row as Record<string, unknown>;
      const existingTags = (r['tags'] ?? []) as string[];
      const overlap = tags.filter((t) => existingTags.includes(t)).length;
      const overlapRatio = overlap / Math.max(tags.length, existingTags.length);

      if (overlapRatio >= 0.8) {
        return {
          isDuplicate: true,
          existingId: r['component_id'] as string,
          similarity: 'tag_overlap',
        };
      }
    }
  }

  return { isDuplicate: false, existingId: null, similarity: 'none' };
}

/**
 * Create a component with duplicate detection.
 * If a duplicate is found, returns the existing component ID instead.
 */
export async function createComponentWithDedup(
  client: PoolClient,
  params: ComponentCreateParams,
): Promise<ComponentCreateResult> {
  // Check for duplicates first
  const dupCheck = await checkDuplicate(client, params.type, params.name, params.tags ?? null);

  if (dupCheck.isDuplicate && dupCheck.existingId) {
    return {
      componentId: dupCheck.existingId,
      isDuplicate: true,
      existingComponentId: dupCheck.existingId,
      reviewStatus: 'auto_approved',
    };
  }

  // Generate component ID
  const componentId = await generateComponentId(client, params.type);

  // Determine review status based on confidence
  const reviewStatus: ComponentReviewStatus =
    params.curatedBy === 'auto' && (params.curationConfidence ?? 0) < 0.8
      ? 'pending_review'
      : 'auto_approved';

  // INSERT component
  await client.query(
    `INSERT INTO components
       (component_id, type, subtype, name, description, data,
        drive_file_id, niche, tags, curated_by, curation_confidence, review_status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [
      componentId,
      params.type,
      params.subtype ?? null,
      params.name,
      params.description ?? null,
      params.data ? JSON.stringify(params.data) : null,
      params.driveFileId ?? null,
      params.niche ?? null,
      params.tags ?? null,
      params.curatedBy,
      params.curationConfidence ?? null,
      reviewStatus,
    ],
  );

  return {
    componentId,
    isDuplicate: false,
    reviewStatus,
  };
}
