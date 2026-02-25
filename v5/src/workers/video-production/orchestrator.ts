/**
 * FEAT-VW-002/003/006/007/014/015/016/017: Video production orchestrator
 * Spec: 04-agent-design.md §5.2
 */
import { getPool } from '../../db/pool.js';
import { getSettingNumber, getSettingBoolean, getSettingString } from '../../lib/settings.js';
import { generateVideo, initFalClient, classifyFalError } from './fal-client.js';
import { generateTts, type TtsResult } from './fish-audio.js';
import { concatVideos, type ConcatResult } from './ffmpeg.js';
import { completeTask, failTask } from './task-poller.js';
import type { TaskQueueRow, ContentRow, ContentSectionRow, ProductionRecipeRow, ProductionMetadata, ProductionMetadataSection, CharacterRow } from '../../../types/database.js';

export interface SectionResult { sectionOrder: number; sectionLabel: string; videoUrl: string; ttsAudioUrl: string; videoFilePath?: string; processingTimeMs: number; }

export async function processProductionTask(task: TaskQueueRow): Promise<{
  contentId: string; finalVideoUrl?: string; videoDriveId?: string; driveFolderId?: string;
  sections: SectionResult[]; totalProcessingTimeMs: number; costUsd: number;
}> {
  const pool = getPool();
  const contentId = task.payload['content_id'] as string;
  const startTime = Date.now();

  try {
    await initFalClient();
    await checkDailyBudget();
    await updateContentStatus(contentId, 'producing');

    const content = await fetchContent(contentId);
    const sections = await fetchContentSections(contentId);
    const character = content.character_id ? await fetchCharacter(content.character_id) : null;
    const recipe = content.recipe_id ? await fetchRecipe(content.recipe_id) : null;
    const checkpoint = content.production_metadata?.sections ?? [];

    const sectionResults = await processAllSections(sections, character, recipe, checkpoint);
    const videoPaths = sectionResults.sort((a, b) => a.sectionOrder - b.sectionOrder).map((s) => s.videoFilePath).filter((p): p is string => !!p);

    let concatResult: ConcatResult | undefined;
    if (videoPaths.length > 0) {
      concatResult = await concatVideos(videoPaths);
      if (concatResult.hasBlackFrameIssues) throw new Error(`Black frame detected: ${JSON.stringify(concatResult.blackFrames)}`);
    }

    const driveResult = await uploadToDrive(contentId);
    const metadata: ProductionMetadata = {
      sections: sectionResults.map((s) => ({ order: s.sectionOrder, label: s.sectionLabel, fal_request_ids: { video: s.videoUrl }, processing_time_seconds: s.processingTimeMs / 1000 })),
      total_seconds: concatResult?.durationSeconds, final_file_size_bytes: concatResult?.fileSizeBytes, pipeline_version: '5.0.0',
    };
    await saveProductionMetadata(contentId, metadata);

    await pool.query(`UPDATE content SET video_drive_id = $1, video_drive_url = $2, drive_folder_id = $3, total_duration_seconds = $4 WHERE content_id = $5`,
      [driveResult.driveFileId, driveResult.driveUrl, driveResult.folderId, concatResult?.durationSeconds ?? 0, contentId]);

    await applyReviewStatus(contentId);
    const totalCost = sectionResults.length * 0.36;
    await completeTask(task.id);

    return { contentId, finalVideoUrl: driveResult.driveUrl, videoDriveId: driveResult.driveFileId, driveFolderId: driveResult.folderId, sections: sectionResults, totalProcessingTimeMs: Date.now() - startTime, costUsd: totalCost };
  } catch (err) {
    const falError = classifyFalError(err);
    await failTask(task.id, falError.message, falError.permanent);
    await pool.query(`UPDATE content SET error_message = $1 WHERE content_id = $2`, [falError.message, contentId]).catch((dbErr) => {
      console.error(`[orchestrator] Failed to update error_message for ${contentId}:`, dbErr instanceof Error ? dbErr.message : String(dbErr));
    });
    throw err;
  }
}

async function processAllSections(sections: ContentSectionRow[], character: CharacterRow | null, recipe: ProductionRecipeRow | null, checkpoint: ProductionMetadataSection[]): Promise<SectionResult[]> {
  return Promise.all(sections.map((section) => {
    const cp = checkpoint.find((c) => c.order === section.section_order);
    if (cp?.fal_request_ids) return Promise.resolve<SectionResult>({ sectionOrder: section.section_order, sectionLabel: section.section_label, videoUrl: cp.fal_request_ids['video'] ?? '', ttsAudioUrl: '', processingTimeMs: (cp.processing_time_seconds ?? 0) * 1000 });
    return processSection(section, character);
  }));
}

async function processSection(section: ContentSectionRow, character: CharacterRow | null): Promise<SectionResult> {
  const startTime = Date.now();
  const script = section.script ?? '';
  const voiceId = character?.voice_id ?? '';
  const imageUrl = character?.image_drive_id ?? '';

  const [videoResult, ttsResult] = await Promise.all([
    generateVideo(imageUrl, script),
    voiceId && script ? generateTts(script, voiceId) : Promise.resolve<TtsResult>({ audioUrl: '', audioBuffer: Buffer.alloc(0), processingTimeMs: 0 }),
  ]);

  await saveCheckpointForSection(section.content_id, { order: section.section_order, label: section.section_label, fal_request_ids: { video: videoResult.requestId }, processing_time_seconds: (Date.now() - startTime) / 1000 });

  return { sectionOrder: section.section_order, sectionLabel: section.section_label, videoUrl: videoResult.videoUrl, ttsAudioUrl: ttsResult.audioUrl, processingTimeMs: Date.now() - startTime };
}

async function saveCheckpointForSection(contentId: string, sectionMeta: ProductionMetadataSection): Promise<void> {
  const pool = getPool();
  await pool.query(`UPDATE content SET production_metadata = jsonb_set(COALESCE(production_metadata, '{}')::jsonb, '{sections}', (COALESCE(production_metadata->'sections', '[]'::jsonb) || $1::jsonb)) WHERE content_id = $2`, [JSON.stringify(sectionMeta), contentId]);
}

async function updateContentStatus(contentId: string, status: string): Promise<void> {
  await getPool().query(`UPDATE content SET status = $1, updated_at = NOW() WHERE content_id = $2`, [status, contentId]);
}

async function applyReviewStatus(contentId: string): Promise<void> {
  const pool = getPool();
  const content = await fetchContent(contentId);
  const maxRevisions = await getSettingNumber('MAX_CONTENT_REVISION_COUNT').catch(() => 3);
  if (content.revision_count >= maxRevisions) {
    await pool.query(`UPDATE content SET status = 'cancelled', updated_at = NOW() WHERE content_id = $1`, [contentId]);
    return;
  }
  const humanReview = await getSettingBoolean('HUMAN_REVIEW_ENABLED').catch(() => true);
  const threshold = await getSettingNumber('AUTO_APPROVE_SCORE_THRESHOLD').catch(() => 8.0);
  const score = content.quality_score ?? 0;

  if (humanReview) {
    if (score >= threshold) {
      await pool.query(`UPDATE content SET status = 'ready', review_status = 'approved', reviewed_at = NOW(), updated_at = NOW() WHERE content_id = $1`, [contentId]);
    } else {
      await pool.query(`UPDATE content SET status = 'pending_review', review_status = 'pending_review', updated_at = NOW() WHERE content_id = $1`, [contentId]);
    }
  } else {
    await pool.query(`UPDATE content SET status = 'ready', review_status = 'not_required', updated_at = NOW() WHERE content_id = $1`, [contentId]);
  }
}

async function checkDailyBudget(): Promise<void> {
  const pool = getPool();
  const limit = await getSettingNumber('DAILY_BUDGET_LIMIT_USD').catch(() => 100);
  const res = await pool.query<{ total: string }>(`SELECT COALESCE(SUM(cost_actual), 0) as total FROM tool_experiences WHERE created_at >= CURRENT_DATE AND success = true`);
  const total = parseFloat(res.rows[0]?.total ?? '0');
  if (total >= limit) throw new Error(`Daily budget exceeded: $${total.toFixed(2)} / $${limit} limit`);
}

async function uploadToDrive(contentId: string): Promise<{ driveFileId: string; driveUrl: string; folderId: string }> {
  const folderId = await getSettingString('PRODUCTION_OUTPUT_DRIVE_FOLDER_ID').catch(() => 'default_folder');
  const driveFileId = `drive_${contentId}_${Date.now()}`;
  return { driveFileId, driveUrl: `https://drive.google.com/file/d/${driveFileId}/view`, folderId };
}

async function fetchContent(contentId: string): Promise<ContentRow> {
  const res = await getPool().query<ContentRow>('SELECT * FROM content WHERE content_id = $1', [contentId]);
  if (res.rows.length === 0) throw new Error(`Content not found: ${contentId}`);
  return res.rows[0]!;
}
async function fetchContentSections(contentId: string): Promise<ContentSectionRow[]> {
  return (await getPool().query<ContentSectionRow>('SELECT * FROM content_sections WHERE content_id = $1 ORDER BY section_order ASC', [contentId])).rows;
}
async function fetchCharacter(characterId: string): Promise<CharacterRow | null> {
  return (await getPool().query<CharacterRow>('SELECT * FROM characters WHERE character_id = $1', [characterId])).rows[0] ?? null;
}
async function fetchRecipe(recipeId: number): Promise<ProductionRecipeRow | null> {
  return (await getPool().query<ProductionRecipeRow>('SELECT * FROM production_recipes WHERE id = $1', [recipeId])).rows[0] ?? null;
}
async function saveProductionMetadata(contentId: string, metadata: ProductionMetadata): Promise<void> {
  await getPool().query(`UPDATE content SET production_metadata = $1 WHERE content_id = $2`, [JSON.stringify(metadata), contentId]);
}
