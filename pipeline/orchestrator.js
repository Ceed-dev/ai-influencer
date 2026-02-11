'use strict';

const config = require('./config');
const { uploadToFalStorage, downloadFromDrive } = require('./media/fal-client');
const { generateVideo } = require('./media/video-generator');
const { generateSpeech } = require('./media/tts-generator');
const { syncLips } = require('./media/lipsync');
const { concatVideos } = require('./media/concat');
const { listDriveFiles, getDrive, uploadToDrive } = require('./sheets/client');
const { resolveProductionRow, clearCache: clearInventoryCache } = require('./sheets/inventory-reader');
const { getReadyRows, getProductionRow, updateProductionRow } = require('./sheets/production-manager');

// Legacy import — only used by deprecated runPipeline()
const { createContent, updateContentStatus } = require('./sheets/content-manager');

const ROOT_FOLDER_ID = config.google.rootDriveFolderId;

/**
 * Create a subfolder in Google Drive. Returns existing folder if name matches.
 */
async function getOrCreateFolder(parentId, folderName) {
  const drive = getDrive();
  const existing = await drive.files.list({
    q: `'${parentId}' in parents and name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id, name)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  if (existing.data.files && existing.data.files.length > 0) {
    return existing.data.files[0].id;
  }
  const res = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    },
    fields: 'id',
    supportsAllDrives: true,
  });
  return res.data.id;
}

/**
 * Download a video URL to a Buffer (used for fal.ai output URLs).
 */
function downloadToBuffer(url) {
  const https = require('https');
  const http = require('http');
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadToBuffer(res.headers.location).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`Download failed: HTTP ${res.statusCode}`));
      }
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

/**
 * Extract a Google Drive file ID from a drive_file_id field or a file_link URL.
 * Supports: raw ID, https://drive.google.com/file/d/{ID}/view, /open?id={ID}
 */
function extractDriveFileId(row, label) {
  if (row.drive_file_id) return row.drive_file_id;
  if (row.file_link) {
    const match = row.file_link.match(/\/d\/([a-zA-Z0-9_-]+)/) ||
                  row.file_link.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (match) return match[1];
  }
  throw new Error(`${label} ${row.component_id} has no drive_file_id or valid file_link`);
}

/**
 * Upload a character image from Drive to fal.storage.
 * @param {object} character - Character inventory row with drive_file_id or file_link
 * @returns {Promise<string>} fal.storage URL
 */
async function uploadCharacterImage(character) {
  const fileId = extractDriveFileId(character, 'Character');
  const { buffer, mimeType } = await downloadFromDrive(fileId);
  return uploadToFalStorage(buffer, mimeType);
}

/**
 * Upload a motion video from Drive to fal.storage.
 * @param {object} motion - Motion inventory row with drive_file_id or file_link
 * @returns {Promise<string>} fal.storage URL
 */
async function uploadMotionVideo(motion) {
  const fileId = extractDriveFileId(motion, 'Motion');
  const { buffer, mimeType } = await downloadFromDrive(fileId);
  return uploadToFalStorage(buffer, mimeType);
}

/**
 * Run a single video production job.
 *
 * Flow:
 *   1. Upload character image to fal.storage (shared across all sections)
 *   2. Process 3 sections IN PARALLEL:
 *      - Upload motion video to fal.storage
 *      - Kling motion-control + ElevenLabs TTS (parallel)
 *      - Sync Lipsync (needs both Kling + TTS)
 *      - Download lipsync result
 *   3. ffmpeg concat → final.mp4
 *   4. Upload 4 files to Drive
 *   5. Update production sheet
 *
 * @param {string} videoId - VID_YYYYMM_XXXX
 * @param {object} resolved - Output from resolveProductionRow()
 * @param {boolean} [dryRun=false]
 * @returns {Promise<object>} Result with driveUrls, processingTime, etc.
 */
async function runSingleJob(videoId, resolved, dryRun = false) {
  const log = (step, msg) => console.log(`[pipeline:${step}] ${msg}`);
  const startTime = Date.now();
  const result = { videoId, sections: {}, dryRun };

  log('init', `Video: ${videoId}, character: ${resolved.character.component_id}, voice: ${resolved.voice}`);

  if (dryRun) {
    log('dry-run', 'Step 1: Upload character image to fal.storage');
    for (const sec of resolved.sections) {
      log('dry-run', `Step 2: [${sec.name}] Motion upload → Kling + TTS (parallel) → Lipsync`);
    }
    log('dry-run', 'Step 3: ffmpeg concat 3 sections → final.mp4');
    log('dry-run', 'Step 4: Upload 4 files to Drive');
    log('dry-run', 'Step 5: Update production sheet');
    await updateProductionRow(videoId, {
      pipeline_status: 'dry_run_complete',
      processing_time_sec: String(Math.round((Date.now() - startTime) / 1000)),
    });
    return result;
  }

  try {
    await updateProductionRow(videoId, { pipeline_status: 'processing', current_phase: 'uploading_character' });

    // Step 1: Upload character image → fal.storage (shared across all sections)
    log('image', `Uploading character ${resolved.character.component_id} to fal.storage...`);
    const falImageUrl = await uploadCharacterImage(resolved.character);
    log('image', `fal.storage URL: ${falImageUrl}`);
    result.falImageUrl = falImageUrl;

    // Step 2: Process 3 sections IN PARALLEL ★★★
    await updateProductionRow(videoId, { current_phase: 'processing_sections' });
    log('parallel', `Processing ${resolved.sections.length} sections in parallel...`);

    const sectionResults = await Promise.all(
      resolved.sections.map(async (section) => {
        const sName = section.name;
        log(sName, `--- Processing section: ${sName} ---`);

        // 2a: Upload motion video to fal.storage
        log(sName, `Uploading motion ${section.motion.component_id} to fal.storage...`);
        const falMotionUrl = await uploadMotionVideo(section.motion);
        log(sName, `Motion fal.storage URL: ${falMotionUrl}`);

        // 2b: Kling + TTS in PARALLEL ★★
        log(sName, 'Starting Kling + TTS in parallel...');
        const [rawVideoUrl, audioUrl] = await Promise.all([
          generateVideo({ imageUrl: falImageUrl, motionVideoUrl: falMotionUrl }),
          generateSpeech({ text: section.scenario.script_en, voice: resolved.voice }),
        ]);
        log(sName, `Kling done: ${rawVideoUrl}`);
        log(sName, `TTS done: ${audioUrl}`);

        // 2c: Lipsync (needs both Kling + TTS)
        log(sName, 'Syncing lips...');
        const lipsyncVideoUrl = await syncLips({ videoUrl: rawVideoUrl, audioUrl });
        log(sName, `Lipsync done: ${lipsyncVideoUrl}`);

        // 2d: Download lipsync result
        log(sName, 'Downloading lip-synced video...');
        const buffer = await downloadToBuffer(lipsyncVideoUrl);
        log(sName, `Section ${sName} complete (${buffer.length} bytes)`);

        return { buffer, filename: `${section.prefix}.mp4`, name: sName };
      })
    );

    // Step 3: ffmpeg concat
    log('concat', 'Concatenating 3 sections with ffmpeg...');
    await updateProductionRow(videoId, { current_phase: 'concatenating' });
    const finalBuffer = await concatVideos(sectionResults);
    result.finalBufferSize = finalBuffer.length;
    log('concat', `Final video: ${finalBuffer.length} bytes`);

    // Step 4: Upload to Drive
    log('drive', 'Creating output folder structure...');
    await updateProductionRow(videoId, { current_phase: 'uploading_to_drive' });
    const productionsFolderId = await getOrCreateFolder(ROOT_FOLDER_ID, 'Productions');
    const today = new Date().toISOString().slice(0, 10);
    const dateFolderId = await getOrCreateFolder(productionsFolderId, today);
    const contentFolderId = await getOrCreateFolder(dateFolderId, videoId);

    const driveUrls = {};
    for (const clip of sectionResults) {
      log('drive', `Uploading ${clip.filename}...`);
      const uploaded = await uploadToDrive(contentFolderId, clip.filename, 'video/mp4', clip.buffer);
      driveUrls[clip.filename] = uploaded.webViewLink;
    }
    log('drive', 'Uploading final.mp4...');
    const finalUploaded = await uploadToDrive(contentFolderId, 'final.mp4', 'video/mp4', finalBuffer);
    driveUrls['final.mp4'] = finalUploaded.webViewLink;
    result.driveUrls = driveUrls;
    result.driveFolderId = contentFolderId;
    log('drive', `All files uploaded to Drive folder: ${contentFolderId}`);

    // Step 5: Update production sheet
    const processingTime = Math.round((Date.now() - startTime) / 1000);
    result.processingTime = processingTime;
    log('sheet', 'Updating production sheet...');
    await updateProductionRow(videoId, {
      pipeline_status: 'completed',
      current_phase: '',
      hook_video_url: driveUrls['01_hook.mp4'] || '',
      body_video_url: driveUrls['02_body.mp4'] || '',
      cta_video_url: driveUrls['03_cta.mp4'] || '',
      final_video_url: driveUrls['final.mp4'] || '',
      drive_folder_id: contentFolderId,
      processing_time_sec: String(processingTime),
    });
    log('done', `Pipeline complete! Video: ${videoId}, time: ${processingTime}s`);

    return result;
  } catch (err) {
    const processingTime = Math.round((Date.now() - startTime) / 1000);
    log('error', `Pipeline failed: ${err.message}`);
    try {
      await updateProductionRow(videoId, {
        pipeline_status: 'error',
        current_phase: '',
        error_message: err.message,
        processing_time_sec: String(processingTime),
      });
    } catch (_) {
      // ignore sheet update error during error handling
    }
    throw err;
  }
}

/**
 * Process all ready rows from the production sheet.
 *
 * @param {object} [opts]
 * @param {boolean} [opts.dryRun=false]
 * @param {number} [opts.limit=10]
 * @returns {Promise<object>} Summary: { succeeded, failed, total, results }
 */
async function processReadyJobs({ dryRun = false, limit = 10 } = {}) {
  const rows = await getReadyRows(limit);
  console.log(`[pipeline] Found ${rows.length} ready row(s) (limit: ${limit})`);

  if (rows.length === 0) {
    console.log('[pipeline] No rows to process.');
    return { succeeded: 0, failed: 0, total: 0, results: [] };
  }

  const results = { succeeded: 0, failed: 0, total: rows.length, results: [] };

  for (const row of rows) {
    try {
      console.log(`\n[pipeline] === Processing ${row.video_id} ===`);
      const resolved = await resolveProductionRow(row);
      const result = await runSingleJob(row.video_id, resolved, dryRun);
      results.succeeded++;
      results.results.push({ videoId: row.video_id, status: 'completed', result });
    } catch (err) {
      results.failed++;
      results.results.push({ videoId: row.video_id, status: 'error', error: err.message });
      console.error(`[pipeline] Failed ${row.video_id}: ${err.message}`);
    }
  }

  return results;
}

// ──────────────────────────────────────────────────────────────
// Legacy function — kept for backward compatibility with old CLI
// ──────────────────────────────────────────────────────────────

/**
 * @deprecated Use runSingleJob() with production tab instead.
 * Run the legacy pipeline using scenario.json + character folder ID.
 */
async function runPipeline({ characterFolderId, dryRun = false }) {
  const log = (step, msg) => console.log(`[pipeline:${step}] ${msg}`);
  const scenario = require('./data/scenario.json');
  const sections = scenario.sections;
  const result = { sections: {}, dryRun };

  const contentId = await createContent({
    character_folder_id: characterFolderId,
    section_count: String(sections.length),
    status: 'processing',
  });
  result.contentId = contentId;
  log('init', `Content ID: ${contentId}, sections: ${sections.length}`);

  if (dryRun) {
    log('dry-run', 'Step 1: Download character image from Drive → fal.storage upload');
    for (const section of sections) {
      log('dry-run', `Step 2.${section.index}: [${section.name}] Kling motion-control → TTS → Lipsync`);
    }
    log('dry-run', 'Step 3: ffmpeg concat 3 sections → final.mp4');
    log('dry-run', 'Step 4: Upload 4 files to Drive Productions/');
    log('dry-run', 'Step 5: Update content_pipeline sheet');
    await updateContentStatus(contentId, 'dry_run_complete');
    return result;
  }

  try {
    log('image', `Listing files in character folder ${characterFolderId}...`);
    const files = await listDriveFiles(characterFolderId);
    const imageFile = files.find((f) => f.mimeType && f.mimeType.startsWith('image/'));
    if (!imageFile) throw new Error(`No image file found in character folder ${characterFolderId}`);
    log('image', `Found character image: ${imageFile.name} (${imageFile.id})`);

    log('image', 'Downloading from Drive...');
    const { buffer: imageBuffer, mimeType: imageMimeType } = await downloadFromDrive(imageFile.id);
    log('image', `Downloaded ${imageBuffer.length} bytes, uploading to fal.storage...`);
    await updateContentStatus(contentId, 'uploading_image');
    const falImageUrl = await uploadToFalStorage(imageBuffer, imageMimeType);
    log('image', `fal.storage URL: ${falImageUrl}`);
    result.falImageUrl = falImageUrl;

    const sectionClips = [];
    for (const section of sections) {
      log(section.name, `--- Processing section ${section.index}: ${section.name} ---`);
      const sectionResult = {};

      log(section.name, 'Downloading motion video from Drive...');
      const { buffer: motionBuffer, mimeType: motionMime } = await downloadFromDrive(section.motionVideoDriveId);
      log(section.name, `Motion video: ${motionBuffer.length} bytes, uploading to fal.storage...`);
      const falMotionUrl = await uploadToFalStorage(motionBuffer, motionMime);
      log(section.name, `Motion fal.storage URL: ${falMotionUrl}`);

      log(section.name, 'Generating video with Kling motion-control...');
      await updateContentStatus(contentId, `generating_video_${section.name}`);
      const rawVideoUrl = await generateVideo({ imageUrl: falImageUrl, motionVideoUrl: falMotionUrl });
      sectionResult.rawVideoUrl = rawVideoUrl;
      log(section.name, `Kling done: ${rawVideoUrl}`);

      log(section.name, 'Generating speech with ElevenLabs...');
      await updateContentStatus(contentId, `generating_audio_${section.name}`);
      const audioUrl = await generateSpeech({ text: section.script });
      sectionResult.audioUrl = audioUrl;
      log(section.name, `TTS done: ${audioUrl}`);

      log(section.name, 'Syncing lips...');
      await updateContentStatus(contentId, `lip_syncing_${section.name}`);
      const lipsyncVideoUrl = await syncLips({ videoUrl: rawVideoUrl, audioUrl });
      sectionResult.lipsyncVideoUrl = lipsyncVideoUrl;
      log(section.name, `Lipsync done: ${lipsyncVideoUrl}`);

      log(section.name, 'Downloading lip-synced video...');
      const videoBuffer = await downloadToBuffer(lipsyncVideoUrl);
      sectionClips.push({ buffer: videoBuffer, filename: `${section.filenamePrefix}.mp4` });
      sectionResult.buffer = videoBuffer;
      result.sections[section.name] = sectionResult;
      log(section.name, `Section ${section.name} complete (${videoBuffer.length} bytes)`);
    }

    log('concat', 'Concatenating 3 sections with ffmpeg...');
    await updateContentStatus(contentId, 'concatenating');
    const finalBuffer = await concatVideos(sectionClips);
    result.finalBufferSize = finalBuffer.length;
    log('concat', `Final video: ${finalBuffer.length} bytes`);

    log('drive', 'Creating output folder structure...');
    await updateContentStatus(contentId, 'uploading_to_drive');
    const productionsFolderId = await getOrCreateFolder(ROOT_FOLDER_ID, 'Productions');
    const today = new Date().toISOString().slice(0, 10);
    const dateFolderId = await getOrCreateFolder(productionsFolderId, today);
    const contentFolderId = await getOrCreateFolder(dateFolderId, contentId);

    const driveUrls = {};
    for (const clip of sectionClips) {
      log('drive', `Uploading ${clip.filename}...`);
      const uploaded = await uploadToDrive(contentFolderId, clip.filename, 'video/mp4', clip.buffer);
      driveUrls[clip.filename] = uploaded.webViewLink;
    }
    log('drive', 'Uploading final.mp4...');
    const finalUploaded = await uploadToDrive(contentFolderId, 'final.mp4', 'video/mp4', finalBuffer);
    driveUrls['final.mp4'] = finalUploaded.webViewLink;
    result.driveUrls = driveUrls;
    result.driveFolderId = contentFolderId;
    log('drive', `All files uploaded to Drive folder: ${contentFolderId}`);

    log('sheet', 'Updating content_pipeline sheet...');
    await updateContentStatus(contentId, 'completed', {
      hook_video_url: driveUrls['01_hook.mp4'] || '',
      body_video_url: driveUrls['02_body.mp4'] || '',
      cta_video_url: driveUrls['03_cta.mp4'] || '',
      final_video_url: driveUrls['final.mp4'] || '',
      drive_folder_id: contentFolderId,
    });
    log('done', `Pipeline complete! Content ID: ${contentId}`);

    return result;
  } catch (err) {
    log('error', `Pipeline failed: ${err.message}`);
    try {
      await updateContentStatus(contentId, 'error', { error_message: err.message });
    } catch (_) {
      // ignore sheet update error during error handling
    }
    throw err;
  }
}

module.exports = { runPipeline, runSingleJob, processReadyJobs };
