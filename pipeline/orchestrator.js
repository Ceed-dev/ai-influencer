'use strict';

const config = require('./config');
const scenario = require('./data/scenario.json');
const { uploadToFalStorage, downloadFromDrive } = require('./media/fal-client');
const { generateVideo } = require('./media/video-generator');
const { generateSpeech } = require('./media/tts-generator');
const { syncLips } = require('./media/lipsync');
const { concatVideos } = require('./media/concat');
const { listDriveFiles, getDrive, uploadToDrive } = require('./sheets/client');
const { createContent, updateContentStatus } = require('./sheets/content-manager');

const ROOT_FOLDER_ID = config.google.rootDriveFolderId;

/**
 * Create a subfolder in Google Drive. Returns existing folder if name matches.
 */
async function getOrCreateFolder(parentId, folderName) {
  const drive = getDrive();
  // Check if folder already exists
  const existing = await drive.files.list({
    q: `'${parentId}' in parents and name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id, name)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  if (existing.data.files && existing.data.files.length > 0) {
    return existing.data.files[0].id;
  }
  // Create new folder
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
 * Run the full video production pipeline.
 *
 * Flow:
 *   1. Get character image from Drive folder → upload to fal.storage
 *   2. For each scenario section (hook, body, cta):
 *      a. Kling motion-control (image + motion ref → video)
 *      b. ElevenLabs TTS (script → audio)
 *      c. Sync Lipsync (video + audio → lip-synced video)
 *   3. ffmpeg concat: 3 section videos → final.mp4
 *   4. Upload all 4 files to Drive Productions/YYYY-MM-DD/CNT_XXXX/
 *   5. Record URLs and status in content_pipeline sheet
 *
 * @param {object} params
 * @param {string} params.characterFolderId - Drive folder ID containing character image(s)
 * @param {boolean} [params.dryRun=false] - Log steps without calling APIs
 * @returns {Promise<object>} Pipeline result with all URLs
 */
async function runPipeline({ characterFolderId, dryRun = false }) {
  const log = (step, msg) => console.log(`[pipeline:${step}] ${msg}`);
  const sections = scenario.sections;
  const result = { sections: {}, dryRun };

  // Create content entry in sheet
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
    // Step 1: Get character image from Drive folder
    log('image', `Listing files in character folder ${characterFolderId}...`);
    const files = await listDriveFiles(characterFolderId);
    const imageFile = files.find((f) => f.mimeType && f.mimeType.startsWith('image/'));
    if (!imageFile) {
      throw new Error(`No image file found in character folder ${characterFolderId}`);
    }
    log('image', `Found character image: ${imageFile.name} (${imageFile.id})`);

    // Download from Drive and upload to fal.storage for a temp public URL
    log('image', 'Downloading from Drive...');
    const { buffer: imageBuffer, mimeType: imageMimeType } = await downloadFromDrive(imageFile.id);
    log('image', `Downloaded ${imageBuffer.length} bytes, uploading to fal.storage...`);
    await updateContentStatus(contentId, 'uploading_image');
    const falImageUrl = await uploadToFalStorage(imageBuffer, imageMimeType);
    log('image', `fal.storage URL: ${falImageUrl}`);
    result.falImageUrl = falImageUrl;

    // Step 2: Process each section
    const sectionClips = [];
    for (const section of sections) {
      log(section.name, `--- Processing section ${section.index}: ${section.name} ---`);
      const sectionResult = {};

      // 2a: Upload motion reference video to fal.storage
      log(section.name, 'Downloading motion video from Drive...');
      const { buffer: motionBuffer, mimeType: motionMime } = await downloadFromDrive(section.motionVideoDriveId);
      log(section.name, `Motion video: ${motionBuffer.length} bytes, uploading to fal.storage...`);
      const falMotionUrl = await uploadToFalStorage(motionBuffer, motionMime);
      log(section.name, `Motion fal.storage URL: ${falMotionUrl}`);

      // 2b: Kling motion-control
      log(section.name, 'Generating video with Kling motion-control...');
      await updateContentStatus(contentId, `generating_video_${section.name}`);
      const rawVideoUrl = await generateVideo({
        imageUrl: falImageUrl,
        motionVideoUrl: falMotionUrl,
      });
      sectionResult.rawVideoUrl = rawVideoUrl;
      log(section.name, `Kling done: ${rawVideoUrl}`);

      // 2c: ElevenLabs TTS
      log(section.name, 'Generating speech with ElevenLabs...');
      await updateContentStatus(contentId, `generating_audio_${section.name}`);
      const audioUrl = await generateSpeech({ text: section.script });
      sectionResult.audioUrl = audioUrl;
      log(section.name, `TTS done: ${audioUrl}`);

      // 2d: Sync Lipsync
      log(section.name, 'Syncing lips...');
      await updateContentStatus(contentId, `lip_syncing_${section.name}`);
      const lipsyncVideoUrl = await syncLips({
        videoUrl: rawVideoUrl,
        audioUrl,
      });
      sectionResult.lipsyncVideoUrl = lipsyncVideoUrl;
      log(section.name, `Lipsync done: ${lipsyncVideoUrl}`);

      // Download lipsync result to buffer for concat
      log(section.name, 'Downloading lip-synced video...');
      const videoBuffer = await downloadToBuffer(lipsyncVideoUrl);
      sectionClips.push({
        buffer: videoBuffer,
        filename: `${section.filenamePrefix}.mp4`,
      });
      sectionResult.buffer = videoBuffer;
      result.sections[section.name] = sectionResult;
      log(section.name, `Section ${section.name} complete (${videoBuffer.length} bytes)`);
    }

    // Step 3: Concat all sections
    log('concat', 'Concatenating 3 sections with ffmpeg...');
    await updateContentStatus(contentId, 'concatenating');
    const finalBuffer = await concatVideos(sectionClips);
    result.finalBufferSize = finalBuffer.length;
    log('concat', `Final video: ${finalBuffer.length} bytes`);

    // Step 4: Upload to Drive
    log('drive', 'Creating output folder structure...');
    await updateContentStatus(contentId, 'uploading_to_drive');
    const productionsFolderId = await getOrCreateFolder(ROOT_FOLDER_ID, 'Productions');
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const dateFolderId = await getOrCreateFolder(productionsFolderId, today);
    const contentFolderId = await getOrCreateFolder(dateFolderId, contentId);

    // Upload individual section videos + final
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

    // Step 5: Update sheet with all URLs
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

module.exports = { runPipeline };
