'use strict';

const config = require('./config');
const { readSheet, writeSheet } = require('./sheets/client');
const { uploadImage } = require('./media/cloudinary');
const { generateVideo } = require('./media/video-generator');
const { generateSpeech } = require('./media/tts-generator');
const { syncLips } = require('./media/lipsync');
const { composite } = require('./media/compositor');
const { storeVideo } = require('./storage/drive-storage');

const SPREADSHEET_ID = config.google.masterSpreadsheetId;
const PIPELINE_TAB = 'content_pipeline';

/**
 * Read a content row from the content_pipeline sheet by content ID.
 * Returns { row, rowIndex, headers }.
 */
async function readContentRow(contentId) {
  const data = await readSheet(SPREADSHEET_ID, PIPELINE_TAB);
  if (!data.length) throw new Error('content_pipeline sheet is empty');
  const headers = data[0];
  const idCol = headers.indexOf('content_id');
  if (idCol === -1) throw new Error('content_id column not found in content_pipeline');

  for (let i = 1; i < data.length; i++) {
    if (data[i][idCol] === contentId) {
      return { row: data[i], rowIndex: i + 1, headers }; // rowIndex is 1-based for Sheets
    }
  }
  throw new Error(`Content ID "${contentId}" not found in content_pipeline`);
}

/**
 * Update the status cell for a content row.
 */
async function updateStatus(rowIndex, headers, status) {
  const statusCol = headers.indexOf('status');
  if (statusCol === -1) return;
  const colLetter = String.fromCharCode(65 + statusCol);
  await writeSheet(SPREADSHEET_ID, `${PIPELINE_TAB}!${colLetter}${rowIndex}`, [[status]]);
}

/**
 * Update a specific column value for a content row.
 */
async function updateCell(rowIndex, headers, columnName, value) {
  const col = headers.indexOf(columnName);
  if (col === -1) return;
  const colLetter = String.fromCharCode(65 + col);
  await writeSheet(SPREADSHEET_ID, `${PIPELINE_TAB}!${colLetter}${rowIndex}`, [[value]]);
}

/**
 * Get a column value from a row by header name.
 */
function getField(row, headers, name) {
  const idx = headers.indexOf(name);
  return idx >= 0 ? row[idx] || '' : '';
}

/**
 * Run the full video production pipeline.
 *
 * Steps:
 *   1. Read scenario from content_pipeline sheet
 *   2. Upload character image to Cloudinary
 *   3. Generate video with Kling (image-to-video)
 *   4. Generate speech audio with ElevenLabs
 *   5. Lip-sync video to audio
 *   6. Composite final video with Creatify Aurora
 *   7. Upload final video to Google Drive
 *
 * @param {object} params
 * @param {string} params.contentId - Content ID from content_pipeline sheet
 * @param {string} [params.folderId] - Drive folder for output (defaults to config root folder)
 * @param {boolean} [params.dryRun=false] - Log steps without calling APIs
 * @returns {Promise<object>} Pipeline result with URLs at each step
 */
async function runPipeline({ contentId, folderId, dryRun = false }) {
  const log = (step, msg) => console.log(`[pipeline:${step}] ${msg}`);
  const result = {};

  // Step 1: Read scenario
  log('read', `Loading content ${contentId}...`);
  const { row, rowIndex, headers } = await readContentRow(contentId);
  const characterImageUrl = getField(row, headers, 'character_image_url');
  const motionPrompt = getField(row, headers, 'motion_prompt');
  const scriptText = getField(row, headers, 'script_text');
  const voiceId = getField(row, headers, 'voice_id') || config.elevenlabs.defaultVoiceId;
  const targetFolder = folderId || getField(row, headers, 'drive_folder_id') || config.google.rootDriveFolderId;

  log('read', `Character: ${characterImageUrl}`);
  log('read', `Prompt: ${motionPrompt}`);
  log('read', `Script: ${scriptText.substring(0, 60)}...`);

  if (dryRun) {
    log('dry-run', 'Step 2: uploadImage(characterImageUrl) → cloudinaryUrl');
    log('dry-run', 'Step 3: generateVideo({ imageUrl, prompt }) → rawVideoUrl');
    log('dry-run', 'Step 4: generateSpeech({ text, voiceId }) → audioUrl');
    log('dry-run', 'Step 5: syncLips({ videoUrl, audioUrl }) → lipsyncVideoUrl');
    log('dry-run', 'Step 6: composite({ videoUrl, audioUrl }) → finalVideoUrl');
    log('dry-run', 'Step 7: storeVideo({ videoUrl, fileName, folderId }) → driveLink');
    return { dryRun: true, contentId, steps: ['read', 'cloudinary', 'kling', 'tts', 'lipsync', 'composite', 'drive'] };
  }

  // Step 2: Upload character image to Cloudinary
  log('cloudinary', 'Uploading character image...');
  await updateStatus(rowIndex, headers, 'uploading_image');
  const { url: cloudinaryUrl } = await uploadImage(characterImageUrl, {
    folder: 'ai-influencer/characters',
  });
  result.cloudinaryUrl = cloudinaryUrl;
  log('cloudinary', `Done: ${cloudinaryUrl}`);

  // Step 3: Generate video with Kling
  log('kling', 'Generating video...');
  await updateStatus(rowIndex, headers, 'generating_video');
  const rawVideoUrl = await generateVideo({
    imageUrl: cloudinaryUrl,
    prompt: motionPrompt,
  });
  result.rawVideoUrl = rawVideoUrl;
  await updateCell(rowIndex, headers, 'raw_video_url', rawVideoUrl);
  log('kling', `Done: ${rawVideoUrl}`);

  // Step 4: Generate speech
  log('tts', 'Generating speech...');
  await updateStatus(rowIndex, headers, 'generating_audio');
  const audioUrl = await generateSpeech({ text: scriptText, voiceId });
  result.audioUrl = audioUrl;
  await updateCell(rowIndex, headers, 'audio_url', audioUrl);
  log('tts', `Done: ${audioUrl}`);

  // Step 5: Lip-sync
  log('lipsync', 'Syncing lips...');
  await updateStatus(rowIndex, headers, 'lip_syncing');
  const lipsyncVideoUrl = await syncLips({ videoUrl: rawVideoUrl, audioUrl });
  result.lipsyncVideoUrl = lipsyncVideoUrl;
  await updateCell(rowIndex, headers, 'lipsync_video_url', lipsyncVideoUrl);
  log('lipsync', `Done: ${lipsyncVideoUrl}`);

  // Step 6: Composite final
  log('composite', 'Compositing final video...');
  await updateStatus(rowIndex, headers, 'compositing');
  const finalVideoUrl = await composite({ videoUrl: lipsyncVideoUrl, audioUrl });
  result.finalVideoUrl = finalVideoUrl;
  await updateCell(rowIndex, headers, 'final_video_url', finalVideoUrl);
  log('composite', `Done: ${finalVideoUrl}`);

  // Step 7: Upload to Drive
  log('drive', 'Uploading to Drive...');
  await updateStatus(rowIndex, headers, 'uploading_to_drive');
  const fileName = `${contentId}_final.mp4`;
  const driveResult = await storeVideo({ videoUrl: finalVideoUrl, fileName, folderId: targetFolder });
  result.driveFileId = driveResult.fileId;
  result.driveLink = driveResult.webViewLink;
  await updateCell(rowIndex, headers, 'drive_file_id', driveResult.fileId);
  await updateCell(rowIndex, headers, 'drive_link', driveResult.webViewLink);
  log('drive', `Done: ${driveResult.webViewLink}`);

  // Final status
  await updateStatus(rowIndex, headers, 'completed');
  log('done', `Pipeline complete for ${contentId}`);

  return result;
}

module.exports = { runPipeline };
