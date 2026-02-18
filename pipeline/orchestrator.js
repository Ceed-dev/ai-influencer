'use strict';

const config = require('./config');
const { uploadToFalStorage, downloadFromDrive } = require('./media/fal-client');
const { generateVideo } = require('./media/video-generator');
const { generateSpeech } = require('./media/tts-generator');
const { syncLips } = require('./media/lipsync');
const { generateFabricVideo } = require('./media/fabric-generator');
const { concatVideos, detectBlackFrames, trimBlackStart } = require('./media/concat');
const { getDrive, uploadToDrive } = require('./sheets/client');
const { resolveProductionRow, clearCache: clearInventoryCache } = require('./sheets/inventory-reader');
const { getReadyRows, getProductionRow, updateProductionRow } = require('./sheets/production-manager');

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
 * Resize an image buffer if it exceeds max dimensions using ffmpeg.
 * Kling motion-control requires images <= 3850x3850.
 * @param {Buffer} buffer - Image data
 * @param {string} mimeType - MIME type
 * @returns {Promise<{buffer: Buffer, mimeType: string}>} Possibly resized image
 */
async function resizeImageIfNeeded(buffer, mimeType) {
  const { execFile: execFileCb } = require('child_process');
  const fs = require('fs');
  const path = require('path');
  const os = require('os');

  const MAX_DIM = 3850;
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-inf-resize-'));

  try {
    const ext = mimeType.includes('png') ? 'png' : 'jpg';
    const inputPath = path.join(tmpDir, `input.${ext}`);
    const outputPath = path.join(tmpDir, `output.${ext}`);
    fs.writeFileSync(inputPath, buffer);

    // Check dimensions
    const dims = await new Promise((resolve, reject) => {
      execFileCb('ffprobe', [
        '-v', 'quiet', '-show_entries', 'stream=width,height',
        '-of', 'csv=p=0', inputPath,
      ], { timeout: 10000 }, (err, stdout) => {
        if (err) return reject(err);
        const [w, h] = stdout.trim().split(',').map(Number);
        resolve({ width: w, height: h });
      });
    });

    if (dims.width <= MAX_DIM && dims.height <= MAX_DIM) {
      return { buffer, mimeType };
    }

    console.log(`[pipeline:image] Resizing ${dims.width}x${dims.height} → max ${MAX_DIM}px`);

    // Resize preserving aspect ratio
    await new Promise((resolve, reject) => {
      execFileCb('ffmpeg', [
        '-i', inputPath,
        '-vf', `scale='min(${MAX_DIM},iw)':'min(${MAX_DIM},ih)':force_original_aspect_ratio=decrease`,
        '-q:v', '2',
        outputPath,
        '-y',
      ], { timeout: 30000 }, (err, stdout, stderr) => {
        if (err) reject(new Error(`Image resize failed: ${err.message}\n${stderr}`));
        else resolve();
      });
    });

    const resized = fs.readFileSync(outputPath);
    console.log(`[pipeline:image] Resized to ${resized.length} bytes`);
    return { buffer: resized, mimeType };
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

/**
 * Upload a character image from Drive to fal.storage.
 * Auto-resizes if image exceeds Kling's 3850x3850 limit.
 * @param {object} character - Character inventory row with drive_file_id or file_link
 * @returns {Promise<string>} fal.storage URL
 */
async function uploadCharacterImage(character) {
  const fileId = extractDriveFileId(character, 'Character');
  const downloaded = await downloadFromDrive(fileId);
  const { buffer, mimeType } = await resizeImageIfNeeded(downloaded.buffer, downloaded.mimeType);
  return uploadToFalStorage(buffer, mimeType);
}

/**
 * Trim a video buffer to maxDuration seconds if it exceeds the limit.
 * Kling motion-control requires reference videos 3-30s.
 * Auto-loops short videos and trims long ones.
 * @param {Buffer} buffer - Video data
 * @param {number} maxDuration - Max duration in seconds
 * @param {number} [minDuration=3] - Min duration in seconds
 * @returns {Promise<Buffer>} Adjusted video buffer
 */
async function trimVideoIfNeeded(buffer, maxDuration, minDuration = 3) {
  const { execFile: execFileCb } = require('child_process');
  const fs = require('fs');
  const path = require('path');
  const os = require('os');

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-inf-trimvid-'));
  try {
    const inputPath = path.join(tmpDir, 'input.mp4');
    fs.writeFileSync(inputPath, buffer);

    // Check duration
    const duration = await new Promise((resolve, reject) => {
      execFileCb('ffprobe', [
        '-v', 'quiet', '-show_entries', 'format=duration',
        '-of', 'csv=p=0', inputPath,
      ], { timeout: 10000 }, (err, stdout) => {
        if (err) return reject(err);
        resolve(parseFloat(stdout.trim()));
      });
    });

    if (duration >= minDuration && duration <= maxDuration) return buffer;

    const outputPath = path.join(tmpDir, 'adjusted.mp4');

    if (duration < minDuration) {
      // Loop the video to reach minimum duration
      const loops = Math.ceil(minDuration / duration);
      console.log(`[pipeline:motion] Looping motion video from ${duration.toFixed(1)}s to ${(duration * loops).toFixed(1)}s (${loops}x, min: ${minDuration}s)`);
      await new Promise((resolve, reject) => {
        execFileCb('ffmpeg', [
          '-stream_loop', String(loops - 1),
          '-i', inputPath,
          '-t', String(minDuration),
          '-c:v', 'libx264', '-preset', 'fast', '-crf', '18',
          '-c:a', 'aac', '-b:a', '192k',
          '-movflags', '+faststart',
          outputPath,
          '-y',
        ], { timeout: 60000 }, (err, stdout, stderr) => {
          if (err) reject(new Error(`Motion loop failed: ${err.message}\n${stderr}`));
          else resolve();
        });
      });
    } else {
      // Trim to max duration
      console.log(`[pipeline:motion] Trimming motion video from ${duration.toFixed(1)}s to ${maxDuration}s`);
      await new Promise((resolve, reject) => {
        execFileCb('ffmpeg', [
          '-i', inputPath,
          '-t', String(maxDuration),
          '-c', 'copy',
          '-movflags', '+faststart',
          outputPath,
          '-y',
        ], { timeout: 60000 }, (err, stdout, stderr) => {
          if (err) reject(new Error(`Motion trim failed: ${err.message}\n${stderr}`));
          else resolve();
        });
      });
    }

    return fs.readFileSync(outputPath);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

/**
 * Upload a motion video from Drive to fal.storage.
 * Auto-adjusts duration: loops if <3s, trims if >30s (Kling requires 3-30s).
 * @param {object} motion - Motion inventory row with drive_file_id or file_link
 * @returns {Promise<string>} fal.storage URL
 */
async function uploadMotionVideo(motion) {
  const fileId = extractDriveFileId(motion, 'Motion');
  const { buffer, mimeType } = await downloadFromDrive(fileId);
  const trimmed = await trimVideoIfNeeded(buffer, 30);
  return uploadToFalStorage(trimmed, mimeType);
}

/**
 * Run a single video production job.
 *
 * Flow:
 *   1. Upload character image to fal.storage (shared across all sections)
 *   2. Process 3 sections IN PARALLEL:
 *      - Upload motion video to fal.storage
 *      - Kling motion-control + Fish Audio TTS (parallel)
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

  const scriptKey = `script_${resolved.scriptLanguage}`;
  log('init', `Video: ${videoId}, character: ${resolved.character.component_id}, voice: ${resolved.voice}, lang: ${resolved.scriptLanguage}`);

  if (dryRun) {
    log('dry-run', 'Step 1: Upload character image to fal.storage');
    for (const sec of resolved.sections) {
      if (sec.name === 'body') {
        log('dry-run', `Step 2: [${sec.name}] TTS → Fabric 1.0 (image + audio → lip-synced video)`);
      } else {
        log('dry-run', `Step 2: [${sec.name}] Motion upload → Kling + TTS (parallel) → Lipsync`);
      }
    }
    log('dry-run', 'Step 3: ffmpeg concat 3 sections → final.mp4 + black frame validation');
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

        const scriptText = section.scenario[scriptKey];
        if (!scriptText) {
          throw new Error(`Section ${sName}: ${scriptKey} is empty for scenario ${section.scenario.component_id}. Fill in the ${resolved.scriptLanguage === 'en' ? 'script_en (K column)' : 'script_jp (L column)'} in the Scenarios Inventory.`);
        }

        let finalVideoUrl;

        if (sName === 'body') {
          // ★ Body: Fabric 1.0 path — image + audio → lip-synced video directly
          log(sName, 'Starting TTS for Fabric 1.0 path...');
          const audioUrl = await generateSpeech({ text: scriptText, referenceId: resolved.voice });
          log(sName, `TTS done: ${audioUrl}`);

          log(sName, 'Generating lip-synced video with Fabric 1.0 (image + audio)...');
          finalVideoUrl = await generateFabricVideo({ imageUrl: falImageUrl, audioUrl });
          log(sName, `Fabric 1.0 done: ${finalVideoUrl}`);
        } else {
          // Hook / CTA: existing Kling + Lipsync path
          log(sName, `Uploading motion ${section.motion.component_id} to fal.storage...`);
          const falMotionUrl = await uploadMotionVideo(section.motion);
          log(sName, `Motion fal.storage URL: ${falMotionUrl}`);

          log(sName, 'Starting Kling + TTS in parallel...');
          const [rawVideoUrl, audioUrl] = await Promise.all([
            generateVideo({ imageUrl: falImageUrl, motionVideoUrl: falMotionUrl }),
            generateSpeech({ text: scriptText, referenceId: resolved.voice }),
          ]);
          log(sName, `Kling done: ${rawVideoUrl}`);
          log(sName, `TTS done: ${audioUrl}`);

          log(sName, 'Syncing lips...');
          finalVideoUrl = await syncLips({ videoUrl: rawVideoUrl, audioUrl });
          log(sName, `Lipsync done: ${finalVideoUrl}`);
        }

        // Download result
        log(sName, 'Downloading video...');
        const buffer = await downloadToBuffer(finalVideoUrl);
        log(sName, `Section ${sName} complete (${buffer.length} bytes)`);

        return { buffer, filename: `${section.prefix}.mp4`, name: sName };
      })
    );

    // Step 3: ffmpeg concat + black frame validation
    log('concat', 'Concatenating 3 sections with ffmpeg (re-encoding)...');
    await updateProductionRow(videoId, { current_phase: 'concatenating' });
    let finalBuffer = await concatVideos(sectionResults);
    log('concat', `Concatenated video: ${finalBuffer.length} bytes`);

    // Step 3b: Validate — detect and trim black frames
    await updateProductionRow(videoId, { current_phase: 'validating_video' });
    log('validate', 'Scanning for black frames...');
    const blackFrames = await detectBlackFrames(finalBuffer);
    if (blackFrames.length > 0) {
      log('validate', `Detected ${blackFrames.length} black region(s): ${JSON.stringify(blackFrames)}`);
      // Trim black frames at the start (start === 0)
      const startBlack = blackFrames.find((bf) => bf.start === 0);
      if (startBlack) {
        log('validate', `Trimming ${startBlack.duration}s black start...`);
        finalBuffer = await trimBlackStart(finalBuffer, startBlack.duration);
        // Re-validate after trim
        const recheck = await detectBlackFrames(finalBuffer);
        const recheckStart = recheck.find((bf) => bf.start === 0);
        if (recheckStart) {
          log('validate', `WARNING: Black start still present after trim (${recheckStart.duration}s)`);
        } else {
          log('validate', 'Black start successfully removed');
        }
      }
      // Log any mid-video black frames as warnings (don't fail)
      const midBlack = blackFrames.filter((bf) => bf.start > 0);
      if (midBlack.length > 0) {
        log('validate', `WARNING: ${midBlack.length} mid-video black region(s) found: ${JSON.stringify(midBlack)}`);
      }
    } else {
      log('validate', 'No black frames detected — video is clean');
    }
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

module.exports = { runSingleJob, processReadyJobs };
