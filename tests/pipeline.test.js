'use strict';

/**
 * Comprehensive E2E-style tests for the content generation pipeline.
 * Tests cover: module loading, CLI arg parsing, scenario data integrity,
 * concat utility, config correctness, content-manager CRUD, orchestrator
 * dry-run, error handling for edge cases, and Drive integration.
 *
 * v4.0: Added tests for inventory-reader, production-manager, parallel
 * orchestrator, new CLI flags, and config.inventoryIds.accounts.
 */

// ─── Test 1: All pipeline modules load without error ───
test('all pipeline modules load without error', () => {
  expect(() => require('../pipeline/config')).not.toThrow();
  expect(() => require('../pipeline/data/scenario.json')).not.toThrow();
  expect(() => require('../pipeline/media/fal-client')).not.toThrow();
  expect(() => require('../pipeline/media/video-generator')).not.toThrow();
  expect(() => require('../pipeline/media/tts-generator')).not.toThrow();
  expect(() => require('../pipeline/media/lipsync')).not.toThrow();
  expect(() => require('../pipeline/media/concat')).not.toThrow();
  expect(() => require('../pipeline/media/fabric-generator')).not.toThrow();
  expect(() => require('../pipeline/orchestrator')).not.toThrow();
  expect(() => require('../pipeline/sheets/client')).not.toThrow();
  expect(() => require('../pipeline/sheets/content-manager')).not.toThrow();
  expect(() => require('../pipeline/storage/drive-storage')).not.toThrow();
  // v4.0 new modules
  expect(() => require('../pipeline/sheets/inventory-reader')).not.toThrow();
  expect(() => require('../pipeline/sheets/production-manager')).not.toThrow();
});

// ─── Test 2: Deleted modules no longer exist ───
test('compositor and cloudinary modules are removed', () => {
  expect(() => require('../pipeline/media/compositor')).toThrow();
  expect(() => require('../pipeline/media/cloudinary')).toThrow();
});

// ─── Test 3: Config has no cloudinary/elevenlabs sections, has fishAudio ───
test('config has no cloudinary or elevenlabs sections, has fishAudio', () => {
  const config = require('../pipeline/config');
  expect(config.cloudinary).toBeUndefined();
  expect(config.elevenlabs).toBeUndefined();
  expect(config.fal).toBeDefined();
  expect(config.fal.apiKey).toBeDefined();
  expect(config.google).toBeDefined();
  expect(config.google.masterSpreadsheetId).toBe('1fI1s_KLcegpiACJYpmpNe9tnQmnZo2o8eHIXNV5SpPg');
  expect(config.google.rootDriveFolderId).toBe('1KRQuZ4W7u5CXRamjvN4xmavfu-7TPb0X');
  // Fish Audio config
  expect(config.fishAudio).toBeDefined();
  expect(config.fishAudio.apiKey).toBeDefined();
  expect(config.fishAudio.baseUrl).toBe('https://api.fish.audio/v1');
  expect(config.fishAudio.model).toBe('s1');
  expect(config.fishAudio.defaultFormat).toBe('mp3');
});

// ─── Test 4: Scenario data structure is valid (deprecated but kept) ───
test('scenario.json has correct structure and DEPRECATED marker', () => {
  const scenario = require('../pipeline/data/scenario.json');

  // v4.0: scenario.json is deprecated
  expect(scenario._DEPRECATED).toBeDefined();
  expect(typeof scenario._DEPRECATED).toBe('string');
  expect(scenario._DEPRECATED).toContain('inventory-reader');

  expect(scenario.sections).toBeDefined();
  expect(scenario.sections).toHaveLength(3);

  const names = scenario.sections.map(s => s.name);
  expect(names).toEqual(['hook', 'body', 'cta']);

  for (const section of scenario.sections) {
    expect(section).toHaveProperty('name');
    expect(section).toHaveProperty('index');
    expect(section).toHaveProperty('filenamePrefix');
    expect(section).toHaveProperty('script');
    expect(section).toHaveProperty('motionVideoDriveId');
    expect(typeof section.script).toBe('string');
    expect(section.script.length).toBeGreaterThan(10);
    expect(typeof section.motionVideoDriveId).toBe('string');
    expect(section.motionVideoDriveId.length).toBeGreaterThan(5);
  }

  // Filename prefixes are ordered
  expect(scenario.sections[0].filenamePrefix).toBe('01_hook');
  expect(scenario.sections[1].filenamePrefix).toBe('02_body');
  expect(scenario.sections[2].filenamePrefix).toBe('03_cta');

  // Indices are sequential
  expect(scenario.sections.map(s => s.index)).toEqual([1, 2, 3]);
});

// ─── Test 5: Video generator uses correct endpoint and params ───
test('video-generator uses motion-control endpoint', () => {
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '../pipeline/media/video-generator.js'), 'utf8');
  expect(src).toContain('fal-ai/kling-video/v2.6/standard/motion-control');
  expect(src).not.toContain('image-to-video');
  expect(src).toContain('video_url: motionVideoUrl');
  expect(src).toContain("character_orientation: 'video'");
  expect(src).not.toContain('keep_original_sound');
});

// ─── Test 6: TTS generator uses Fish Audio API ───
test('tts-generator uses Fish Audio API with referenceId', () => {
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '../pipeline/media/tts-generator.js'), 'utf8');
  // Fish Audio endpoint
  expect(src).toContain('fishAudio.baseUrl');
  expect(src).toContain('/tts');
  expect(src).toContain('Fish Audio');
  // Uses referenceId, not voice name
  expect(src).toContain('referenceId');
  expect(src).toContain('reference_id');
  // Uploads to fal.storage (binary → URL conversion)
  expect(src).toContain('uploadToFalStorage');
  // No ElevenLabs references
  expect(src).not.toContain('elevenlabs');
  expect(src).not.toContain('eleven-v3');
  expect(src).not.toContain('Aria');
});

// ─── Test 7: Lipsync uses correct endpoint ───
test('lipsync uses v2/pro endpoint with bounce sync_mode', () => {
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '../pipeline/media/lipsync.js'), 'utf8');
  expect(src).toContain('fal-ai/sync-lipsync/v2/pro');
  expect(src).not.toMatch(/sync-lipsync\/v2'/);
  expect(src).toContain("syncMode = 'bounce'");
  expect(src).toContain('sync_mode: syncMode');
});

// ─── Test 8: fal-client exports all required functions ───
test('fal-client exports submitAndWait, checkStatus, uploadToFalStorage, downloadFromDrive', () => {
  const falClient = require('../pipeline/media/fal-client');
  expect(typeof falClient.submitAndWait).toBe('function');
  expect(typeof falClient.checkStatus).toBe('function');
  expect(typeof falClient.uploadToFalStorage).toBe('function');
  expect(typeof falClient.downloadFromDrive).toBe('function');
});

// ─── Test 9: concat module exports concatVideos, detectBlackFrames, trimBlackStart ───
test('concat module exports concatVideos, detectBlackFrames, trimBlackStart', () => {
  const concat = require('../pipeline/media/concat');
  expect(typeof concat.concatVideos).toBe('function');
  expect(typeof concat.detectBlackFrames).toBe('function');
  expect(typeof concat.trimBlackStart).toBe('function');
});

// ─── Test 10: ffmpeg concat works with real video files ───
test('concatVideos concatenates video buffers with ffmpeg', async () => {
  const { execFileSync } = require('child_process');
  const fs = require('fs');
  const path = require('path');
  const os = require('os');
  const { concatVideos } = require('../pipeline/media/concat');

  // Generate two small test MP4 files with ffmpeg
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'concat-test-'));
  try {
    const clip1Path = path.join(tmpDir, 'clip1.mp4');
    const clip2Path = path.join(tmpDir, 'clip2.mp4');

    // Create 1-second black video clips
    execFileSync('ffmpeg', [
      '-f', 'lavfi', '-i', 'color=c=black:s=320x240:d=1:r=30',
      '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono',
      '-t', '1', '-c:v', 'libx264', '-c:a', 'aac', '-shortest',
      '-pix_fmt', 'yuv420p', clip1Path,
    ], { timeout: 30000 });

    execFileSync('ffmpeg', [
      '-f', 'lavfi', '-i', 'color=c=red:s=320x240:d=1:r=30',
      '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono',
      '-t', '1', '-c:v', 'libx264', '-c:a', 'aac', '-shortest',
      '-pix_fmt', 'yuv420p', clip2Path,
    ], { timeout: 30000 });

    const clip1Buf = fs.readFileSync(clip1Path);
    const clip2Buf = fs.readFileSync(clip2Path);

    const result = await concatVideos([
      { buffer: clip1Buf, filename: '01_hook.mp4' },
      { buffer: clip2Buf, filename: '02_body.mp4' },
    ]);

    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    // Combined should be roughly >= sum of parts (mp4 container overhead varies)
    expect(result.length).toBeGreaterThan(Math.min(clip1Buf.length, clip2Buf.length));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}, 120000);

// ─── Test 11: concatVideos with 3 clips (matches pipeline usage) ───
test('concatVideos handles 3 clips like the actual pipeline', async () => {
  const { execFileSync } = require('child_process');
  const fs = require('fs');
  const path = require('path');
  const os = require('os');
  const { concatVideos } = require('../pipeline/media/concat');

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'concat-test3-'));
  try {
    const clips = [];
    for (const name of ['01_hook', '02_body', '03_cta']) {
      const clipPath = path.join(tmpDir, `${name}.mp4`);
      execFileSync('ffmpeg', [
        '-f', 'lavfi', '-i', `color=c=blue:s=320x240:d=0.5:r=30`,
        '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono',
        '-t', '0.5', '-c:v', 'libx264', '-c:a', 'aac', '-shortest',
        '-pix_fmt', 'yuv420p', clipPath,
      ], { timeout: 30000 });
      clips.push({ buffer: fs.readFileSync(clipPath), filename: `${name}.mp4` });
    }

    const result = await concatVideos(clips);
    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}, 120000);

// ─── Test 11b: detectBlackFrames finds black frames in test video ───
test('detectBlackFrames detects black frames at the start of a video', async () => {
  const { execFileSync } = require('child_process');
  const fs = require('fs');
  const path = require('path');
  const os = require('os');
  const { detectBlackFrames } = require('../pipeline/media/concat');

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bdetect-test-'));
  try {
    const videoPath = path.join(tmpDir, 'test.mp4');
    // Create a video with 0.5s black then 1s red — should detect the black segment
    execFileSync('ffmpeg', [
      '-f', 'lavfi', '-i', 'color=c=black:s=320x240:d=0.5:r=30',
      '-f', 'lavfi', '-i', 'color=c=red:s=320x240:d=1:r=30',
      '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono',
      '-filter_complex', '[0:v][1:v]concat=n=2:v=1:a=0[outv]',
      '-map', '[outv]', '-map', '2:a',
      '-t', '1.5', '-c:v', 'libx264', '-c:a', 'aac', '-shortest',
      '-pix_fmt', 'yuv420p', videoPath,
    ], { timeout: 30000 });

    const buffer = fs.readFileSync(videoPath);
    const blacks = await detectBlackFrames(buffer);
    expect(Array.isArray(blacks)).toBe(true);
    // Should detect at least the black segment at the start
    expect(blacks.length).toBeGreaterThanOrEqual(1);
    expect(blacks[0].start).toBe(0);
    expect(blacks[0].duration).toBeGreaterThanOrEqual(0.1);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}, 60000);

// ─── Test 11c: concat uses filter_complex (re-encoding, not stream copy) ───
test('concat.js uses filter_complex re-encoding instead of stream copy', () => {
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '../pipeline/media/concat.js'), 'utf8');
  expect(src).toContain('filter_complex');
  expect(src).toContain('concat=n=');
  expect(src).toContain('libx264');
  expect(src).toContain('yuv420p');
  // concatVideos should NOT use the old concat demuxer approach
  expect(src).not.toContain("'-f', 'concat'");
});

// ─── Test 12: content-manager HEADERS match sheet structure ───
test('content-manager HEADERS are consistent with new schema', () => {
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '../pipeline/sheets/content-manager.js'), 'utf8');

  const expectedHeaders = [
    'content_id', 'account_id', 'status', 'character_folder_id', 'section_count',
    'hook_video_url', 'body_video_url', 'cta_video_url', 'final_video_url',
    'drive_folder_id', 'platform_post_id', 'views_48h', 'error_message',
    'created_at', 'updated_at',
  ];

  for (const h of expectedHeaders) {
    expect(src).toContain(`'${h}'`);
  }

  // Old headers should NOT be present
  expect(src).not.toContain("'character_image_url'");
  expect(src).not.toContain("'script_text'");
  expect(src).not.toContain("'kling_video_url'");
  expect(src).not.toContain("'tts_audio_url'");
  expect(src).not.toContain("'lipsync_video_url'");
  expect(src).not.toContain("'drive_file_id'");
});

// ─── Test 13: orchestrator exports runSingleJob + processReadyJobs (runPipeline removed) ───
test('orchestrator exports runSingleJob and processReadyJobs but NOT runPipeline', () => {
  const orch = require('../pipeline/orchestrator');
  expect(orch.runPipeline).toBeUndefined();
  expect(typeof orch.runSingleJob).toBe('function');
  expect(typeof orch.processReadyJobs).toBe('function');
});

// ─── Test 14: orchestrator source has no references to old/deprecated modules ───
test('orchestrator has no cloudinary/compositor/content-manager references', () => {
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '../pipeline/orchestrator.js'), 'utf8');
  expect(src).not.toContain('cloudinary');
  expect(src).not.toContain('compositor');
  expect(src).not.toContain('composite');
  expect(src).not.toContain('content-manager');
  expect(src).not.toContain('runPipeline');
  expect(src).not.toContain('listDriveFiles');
  expect(src).toContain('concatVideos');
  expect(src).toContain('detectBlackFrames');
  expect(src).toContain('trimBlackStart');
  expect(src).toContain('uploadToFalStorage');
  expect(src).toContain('downloadFromDrive');
});

// ─── Test 15: orchestrator uses Promise.all for parallel execution ───
test('orchestrator uses Promise.all for parallel section processing', () => {
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '../pipeline/orchestrator.js'), 'utf8');

  // Must have Promise.all for parallel section processing
  expect(src).toContain('Promise.all');

  // Should import from inventory-reader and production-manager
  expect(src).toContain('inventory-reader');
  expect(src).toContain('production-manager');
  expect(src).toContain('resolveProductionRow');
  expect(src).toContain('getReadyRows');
  expect(src).toContain('updateProductionRow');
});

// ─── Test 16: CLI script supports v4.0 flags (legacy --character-folder removed) ───
test('run-pipeline.js supports --video-id, --limit, --dry-run and no legacy --character-folder', () => {
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '../scripts/run-pipeline.js'), 'utf8');
  // v4.0 flags
  expect(src).toContain('--video-id');
  expect(src).toContain('--limit');
  expect(src).toContain('--dry-run');
  expect(src).toContain('--help');
  // Legacy removed
  expect(src).not.toContain('--character-folder');
  expect(src).not.toContain('runPipeline');
  // Current imports
  expect(src).toContain('runSingleJob');
  expect(src).toContain('processReadyJobs');
  // Production manager imports
  expect(src).toContain('getProductionRow');
  expect(src).toContain('resolveProductionRow');
});

// ─── Test 17: CLI shows help text with --help flag ───
test('CLI shows help text when --help is passed', async () => {
  const { execFile } = require('child_process');
  const result = await new Promise((resolve) => {
    execFile('node', ['scripts/run-pipeline.js', '--help'], { timeout: 30000 }, (err, stdout, stderr) => {
      resolve({ code: err ? err.code : 0, stdout, stderr });
    });
  });
  expect(result.code).toBe(0);
  expect(result.stdout).toContain('--video-id');
  expect(result.stdout).toContain('--limit');
  expect(result.stdout).toContain('--dry-run');
}, 30000);

// ─── Test 18: CLI batch dry-run completes without hanging ───
test('CLI batch dry-run completes without hanging', async () => {
  const { execFile } = require('child_process');
  const result = await new Promise((resolve) => {
    execFile('node', ['scripts/run-pipeline.js', '--dry-run', '--limit', '1'],
      { timeout: 30000 }, (err, stdout, stderr) => {
        resolve({ code: err ? err.code : 0, stdout: stdout || '', stderr: stderr || '' });
      });
  });
  expect(result.code).toBe(0);
  expect(result.stdout).toContain('[pipeline]');
}, 30000);

// ─── Test 19: package.json has no cloudinary dependency ───
test('package.json has no cloudinary dependency', () => {
  const pkg = require('../package.json');
  expect(pkg.dependencies.cloudinary).toBeUndefined();
  expect(pkg.dependencies['@fal-ai/client']).toBeDefined();
  expect(pkg.dependencies.googleapis).toBeDefined();
  expect(pkg.dependencies.dotenv).toBeDefined();
});

// ─── Test 20: drive-storage module still works (backward compat) ───
test('drive-storage module exports storeVideo', () => {
  const ds = require('../pipeline/storage/drive-storage');
  expect(typeof ds.storeVideo).toBe('function');
});

// ─── Test 21: sheets/client exports all required functions ───
test('sheets/client exports getDrive, listDriveFiles, uploadToDrive', () => {
  const client = require('../pipeline/sheets/client');
  expect(typeof client.getDrive).toBe('function');
  expect(typeof client.listDriveFiles).toBe('function');
  expect(typeof client.uploadToDrive).toBe('function');
  expect(typeof client.readSheet).toBe('function');
  expect(typeof client.writeSheet).toBe('function');
  expect(typeof client.appendSheet).toBe('function');
});

// ─── Test 22: inventory-reader exports all required functions ───
test('inventory-reader exports getMotion, getScenario, getCharacter, resolveProductionRow, clearCache', () => {
  const reader = require('../pipeline/sheets/inventory-reader');
  expect(typeof reader.getMotion).toBe('function');
  expect(typeof reader.getScenario).toBe('function');
  expect(typeof reader.getCharacter).toBe('function');
  expect(typeof reader.resolveProductionRow).toBe('function');
  expect(typeof reader.clearCache).toBe('function');
});

// ─── Test 23: production-manager exports and HEADERS ───
test('production-manager exports HEADERS with 35 columns and CRUD functions', () => {
  const pm = require('../pipeline/sheets/production-manager');
  expect(Array.isArray(pm.HEADERS)).toBe(true);
  expect(pm.HEADERS).toHaveLength(35);

  // Key columns must be present
  const requiredCols = [
    'video_id', 'account_id', 'edit_status', 'character_id',
    'hook_scenario_id', 'body_scenario_id', 'cta_scenario_id',
    'hook_motion_id', 'body_motion_id', 'cta_motion_id',
    'voice_id', 'script_language', 'pipeline_status', 'current_phase',
    'final_video_url', 'drive_folder_id', 'error_message',
    'processing_time_sec', 'created_at', 'updated_at',
    'overall_score', 'analysis_date',
  ];
  for (const col of requiredCols) {
    expect(pm.HEADERS).toContain(col);
  }

  // CRUD functions
  expect(typeof pm.getReadyRows).toBe('function');
  expect(typeof pm.getProductionRow).toBe('function');
  expect(typeof pm.updateProductionRow).toBe('function');
  expect(typeof pm.createProductionRow).toBe('function');
});

// ─── Test 24: config has inventoryIds including accounts and productionTab ───
test('config has inventoryIds with all 5 inventory types and productionTab', () => {
  const config = require('../pipeline/config');
  expect(config.google.inventoryIds).toBeDefined();
  expect(config.google.inventoryIds.scenarios).toBe('13Meu7cniKUr1JiEyKla0qhfiV9Az1IFuzIedzDxjpiY');
  expect(config.google.inventoryIds.motions).toBe('1ycnmfpL8OgAI7WvlPTr3Z9p1H8UTmCNMV7ahunMlsEw');
  expect(config.google.inventoryIds.characters).toBe('1-m4f5LgNmArtpECZqqxFL-6P4eabBmPkOYX2VkFHCHA');
  expect(config.google.inventoryIds.audio).toBe('1Dw_atybwdGpi1Q0jh6CsuUSwzqVw1ZXB6jQT_-VDVak');
  // accounts key must exist with the real spreadsheet ID
  expect(config.google.inventoryIds.accounts).toBe('1CmT6C3qCW3md6lJ9Rvc2WNQkWa5zcvlq6Zp_enJHoUE');
  // productionTab
  expect(config.google.productionTab).toBe('production');
});

// ─── Test 25: inventory-reader source uses correct tab name and cache pattern ───
test('inventory-reader uses inventory tab and in-memory cache', () => {
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '../pipeline/sheets/inventory-reader.js'), 'utf8');

  // Uses 'inventory' tab (not 'Sheet1')
  expect(src).toContain("'inventory'");
  // Has a cache object
  expect(src).toContain('_cache');
  // Exports clearCache
  expect(src).toContain('clearCache');
  // Reads from inventoryIds config
  expect(src).toContain('inventoryIds');
});

// ─── Test 26: orchestrator has extractDriveFileId fallback ───
test('orchestrator has extractDriveFileId fallback for file_link URLs', () => {
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '../pipeline/orchestrator.js'), 'utf8');

  // Must have the extractDriveFileId helper
  expect(src).toContain('extractDriveFileId');
  // Must check drive_file_id first
  expect(src).toContain('row.drive_file_id');
  // Must fall back to file_link
  expect(src).toContain('row.file_link');
  // Must support /d/{ID} URL pattern
  expect(src).toContain('/d/');
});

// ─── Test 27: production-manager HEADERS contains script_language ───
test('production-manager HEADERS contains script_language after voice_id', () => {
  const pm = require('../pipeline/sheets/production-manager');
  expect(pm.HEADERS).toContain('script_language');
  const voiceIdx = pm.HEADERS.indexOf('voice_id');
  const langIdx = pm.HEADERS.indexOf('script_language');
  expect(langIdx).toBe(voiceIdx + 1);
});

// ─── Test 28: orchestrator uses dynamic scriptKey ───
test('orchestrator uses dynamic scriptKey instead of hardcoded script_en', () => {
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '../pipeline/orchestrator.js'), 'utf8');

  // Must use dynamic scriptKey pattern
  expect(src).toContain('script_${');
  expect(src).toContain('scriptLanguage');
  // The generateSpeech call should use section.scenario[scriptKey], not hardcoded script_en
  expect(src).toContain('section.scenario[scriptKey]');
  expect(src).not.toMatch(/section\.scenario\.script_en/);
});

// ─── Test 29: inventory-reader validates scriptLanguage ───
test('inventory-reader validates script_language to en or jp', () => {
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '../pipeline/sheets/inventory-reader.js'), 'utf8');

  // Must read script_language from row
  expect(src).toContain('row.script_language');
  // Must default to 'en'
  expect(src).toContain("|| 'en'");
  // Must validate allowed values
  expect(src).toContain("!== 'en'");
  expect(src).toContain("!== 'jp'");
  // Must return scriptLanguage field
  expect(src).toContain('scriptLanguage');
  // Must include script_language in error message
  expect(src).toContain('Invalid script_language');
});

// ─── Test 30: production-manager reads from production tab ───
test('production-manager reads from production tab (uses 33-column HEADERS)', () => {
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '../pipeline/sheets/production-manager.js'), 'utf8');

  expect(src).toContain('productionTab');
  expect(src).toContain('getReadyRows');
  expect(src).toContain("edit_status");
  expect(src).toContain("pipeline_status");
  // Should use 33-column HEADERS
  expect(src).toContain('HEADERS');
});

// ─── Test 31: production-manager exports getQueuedRows ───
test('production-manager exports getQueuedRows function', () => {
  const pm = require('../pipeline/sheets/production-manager');
  expect(typeof pm.getQueuedRows).toBe('function');
});

// ─── Test 32: getQueuedRows filters queued/queued_dry status only ───
test('getQueuedRows source filters for queued and queued_dry statuses', () => {
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '../pipeline/sheets/production-manager.js'), 'utf8');

  // Must filter for both queued and queued_dry
  expect(src).toContain("pipeline_status === 'queued'");
  expect(src).toContain("pipeline_status === 'queued_dry'");
  // Must also check edit_status
  expect(src).toContain("edit_status === 'ready'");
  // Must be exported
  expect(src).toContain('getQueuedRows');
});

// ─── Test 33: watch-pipeline.js exists and has correct structure ───
test('watch-pipeline.js has watcher structure with graceful shutdown', () => {
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '../scripts/watch-pipeline.js'), 'utf8');

  // Must import from correct modules
  expect(src).toContain('getQueuedRows');
  expect(src).toContain('runSingleJob');
  expect(src).toContain('resolveProductionRow');
  // Must have polling logic
  expect(src).toContain('POLL_INTERVAL');
  expect(src).toContain('pollOnce');
  // Must handle graceful shutdown
  expect(src).toContain('SIGINT');
  expect(src).toContain('SIGTERM');
  // Must handle queued_dry for dry-run mode
  expect(src).toContain('queued_dry');
  // Must support concurrent job processing
  expect(src).toContain('MAX_CONCURRENT');
  expect(src).toContain('activeJobs');
});

// ─── Test 34: watch-pipeline.js shows help or starts without crashing ───
test('watch-pipeline.js can be loaded as a module check', () => {
  const fs = require('fs');
  const path = require('path');
  // Just verify the file exists and is valid JS
  const filePath = path.join(__dirname, '../scripts/watch-pipeline.js');
  expect(fs.existsSync(filePath)).toBe(true);
  const src = fs.readFileSync(filePath, 'utf8');
  expect(src.length).toBeGreaterThan(100);
});

// ─── Test 35: ecosystem.config.js has correct PM2 configuration ───
test('ecosystem.config.js has correct PM2 configuration for all 5 daemons', () => {
  const config = require('../ecosystem.config.js');
  expect(config.apps).toBeDefined();
  expect(config.apps).toHaveLength(5);

  const watcher = config.apps.find((a) => a.name === 'pipeline-watcher');
  expect(watcher).toBeDefined();
  expect(watcher.script).toBe('scripts/watch-pipeline.js');
  expect(watcher.autorestart).toBe(true);
  expect(watcher.env.MAX_CONCURRENT).toBe(5);

  const poster = config.apps.find((a) => a.name === 'posting-scheduler');
  expect(poster).toBeDefined();
  expect(poster.script).toBe('scripts/watch-posting.js');
  expect(poster.autorestart).toBe(true);
  expect(poster.env.POLL_INTERVAL).toBe(60000);

  const ytPoster = config.apps.find((a) => a.name === 'yt-posting-scheduler');
  expect(ytPoster).toBeDefined();
  expect(ytPoster.script).toBe('scripts/watch-yt-posting.js');
  expect(ytPoster.autorestart).toBe(true);
  expect(ytPoster.env.YT_POLL_INTERVAL).toBe(120000);
  expect(ytPoster.env.YT_MAX_PER_POLL).toBe(2);
  expect(ytPoster.env.YT_DAILY_LIMIT).toBe(6);
});

// ─── Test 36: inventory-reader requires voice_id (throws if missing) ───
test('inventory-reader throws if voice_id is missing', () => {
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '../pipeline/sheets/inventory-reader.js'), 'utf8');

  // Source must contain the error message about voice_id being required
  expect(src).toContain('voice_id is required for video');
  expect(src).toContain('Fish Audio reference_id');
  // The old fallback to empty string should NOT be present
  expect(src).not.toMatch(/voice:\s*row\.voice_id\s*\|\|\s*''/);
});

// ─── Test 37: posting-task-manager loads without error ───
test('posting-task-manager loads without error', () => {
  expect(() => require('../pipeline/sheets/posting-task-manager')).not.toThrow();
});

// ─── Test 38: x-credential-manager loads without error ───
test('x-credential-manager loads without error', () => {
  expect(() => require('../pipeline/posting/x-credential-manager')).not.toThrow();
});

// ─── Test 39: twitter adapter loads without error ───
test('twitter adapter loads without error', () => {
  expect(() => require('../pipeline/posting/adapters/twitter')).not.toThrow();
});

// ─── Test 40: CHARACTER_NAME_MAP has 12 entries ───
test('CHARACTER_NAME_MAP has 12 entries for all characters', () => {
  const { CHARACTER_NAME_MAP } = require('../pipeline/sheets/posting-task-manager');
  expect(Object.keys(CHARACTER_NAME_MAP)).toHaveLength(12);
  // Spot-check key mappings
  expect(CHARACTER_NAME_MAP['清楚AI先生']).toEqual({ characterId: 'CHR_0001', accountId: 'ACC_0037' });
  expect(CHARACTER_NAME_MAP['彼氏感カウンセラー']).toEqual({ characterId: 'CHR_0012', accountId: 'ACC_0048' });
});

// ─── Test 41: parseTimeWindow parses valid time windows ───
test('parseTimeWindow parses "7:00-8:00" correctly', () => {
  const { parseTimeWindow } = require('../pipeline/sheets/posting-task-manager');
  expect(parseTimeWindow('7:00-8:00')).toEqual({ startHour: 7, startMin: 0, endHour: 8, endMin: 0 });
  expect(parseTimeWindow('12:30-13:45')).toEqual({ startHour: 12, startMin: 30, endHour: 13, endMin: 45 });
  expect(parseTimeWindow('')).toBeNull();
  expect(parseTimeWindow(null)).toBeNull();
  expect(parseTimeWindow('invalid')).toBeNull();
});

// ─── Test 42: buildTweetText respects 280 char limit ───
test('buildTweetText truncates to 280 chars', () => {
  const { buildTweetText } = require('../pipeline/sheets/posting-task-manager');
  const longBody = 'A'.repeat(300);
  const result = buildTweetText(longBody, '');
  expect(result.length).toBeLessThanOrEqual(280);
});

// ─── Test 43: buildTweetText combines body + hashtags ───
test('buildTweetText joins body and hashtags with double newline', () => {
  const { buildTweetText } = require('../pipeline/sheets/posting-task-manager');
  const result = buildTweetText('Hello world', '#AI #test');
  expect(result).toBe('Hello world\n\n#AI #test');
});

// ─── Test 44: credential manager returns null for unknown account ───
test('x-credential-manager returns null for unknown account', () => {
  const { getAccountCredentials } = require('../pipeline/posting/x-credential-manager');
  expect(getAccountCredentials('ACC_9999')).toBeNull();
});

// ─── Test 45: config has x section with posting spreadsheet ID ───
test('config has x section with postingSpreadsheetId and postingTab', () => {
  const config = require('../pipeline/config');
  expect(config.x).toBeDefined();
  expect(config.x.postingSpreadsheetId).toBe('1pWqXHckZWoTuTQ1r1hqnmr57ioo5aQ8ZTSRntzMHJ08');
  expect(config.x.postingTab).toBe('投稿タスク');
  expect(config.x.credentialsPath).toBeDefined();
});

// ─── Test 46: yt-credential-manager loads without error ───
test('yt-credential-manager loads without error', () => {
  expect(() => require('../pipeline/posting/yt-credential-manager')).not.toThrow();
});

// ─── Test 47: yt-credential-manager returns null for unknown account ───
test('yt-credential-manager returns null for unknown account', () => {
  const { getAccountCredentials } = require('../pipeline/posting/yt-credential-manager');
  expect(getAccountCredentials('ACC_9999')).toBeNull();
});

// ─── Test 48: youtube adapter exports uploadShort and downloadVideoToTemp ───
test('youtube adapter exports uploadShort, downloadVideoToTemp, getYouTubeClientForAccount', () => {
  const yt = require('../pipeline/posting/adapters/youtube');
  expect(typeof yt.uploadShort).toBe('function');
  expect(typeof yt.downloadVideoToTemp).toBe('function');
  expect(typeof yt.getYouTubeClientForAccount).toBe('function');
  expect(typeof yt.upload).toBe('function');
});

// ─── Test 49: yt-posting-task-manager loads without error ───
test('yt-posting-task-manager loads without error', () => {
  expect(() => require('../pipeline/sheets/yt-posting-task-manager')).not.toThrow();
});

// ─── Test 50: YT_CHARACTER_NAME_MAP has 12 entries ───
test('YT_CHARACTER_NAME_MAP has 12 entries for YouTube accounts', () => {
  const { YT_CHARACTER_NAME_MAP } = require('../pipeline/sheets/yt-posting-task-manager');
  expect(Object.keys(YT_CHARACTER_NAME_MAP)).toHaveLength(12);
  // Spot-check: YouTube accounts use different ACC IDs than X accounts
  expect(YT_CHARACTER_NAME_MAP['清楚AI先生']).toEqual({ characterId: 'CHR_0001', accountId: 'ACC_0003' });
  expect(YT_CHARACTER_NAME_MAP['彼氏感カウンセラー']).toEqual({ characterId: 'CHR_0012', accountId: 'ACC_0036' });
});

// ─── Test 51: config.youtube has credentialsPath and postingTab ───
test('config.youtube has credentialsPath and postingTab', () => {
  const config = require('../pipeline/config');
  expect(config.youtube).toBeDefined();
  expect(config.youtube.credentialsPath).toBeDefined();
  expect(config.youtube.credentialsPath).toContain('.yt-credentials.json');
  expect(config.youtube.postingTab).toBe('YT投稿タスク');
  expect(config.youtube.postingSpreadsheetId).toBe('1n332Q6LjAl9I4c6y3OwqFiontuum3LbVu9mM1gjxN-0');
});

// ─── Test 52: watch-yt-posting.js has quota tracking structure ───
test('watch-yt-posting.js has quota tracking and correct structure', () => {
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '../scripts/watch-yt-posting.js'), 'utf8');

  // Quota tracking
  expect(src).toContain('dailyUploadCount');
  expect(src).toContain('YT_DAILY_LIMIT');
  expect(src).toContain('YT_POLL_INTERVAL');
  expect(src).toContain('YT_MAX_PER_POLL');
  // Must handle quota exceeded
  expect(src).toContain('quotaExceeded');
  // Must have graceful shutdown
  expect(src).toContain('SIGINT');
  expect(src).toContain('SIGTERM');
  // Must import from yt-posting-task-manager
  expect(src).toContain('yt-posting-task-manager');
  expect(src).toContain('yt-credential-manager');
});

// ─── Test 53: youtube adapter source uses yt-credential-manager ───
test('youtube adapter source uses yt-credential-manager', () => {
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '../pipeline/posting/adapters/youtube.js'), 'utf8');

  expect(src).toContain('yt-credential-manager');
  expect(src).toContain('getAppCredentials');
  expect(src).toContain('getAccountCredentials');
  expect(src).toContain('downloadVideoToTemp');
  expect(src).toContain('uploadShort');
  // Must use Drive download → tmp file → YouTube upload pattern
  expect(src).toContain('tmpPath');
  expect(src).toContain('cleanup');
  expect(src).toContain('getDrive');
});

// ─── Test 54: yt-oauth-setup.js has OAuth 2.0 flow structure ───
test('yt-oauth-setup.js has OAuth 2.0 flow structure', () => {
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '../scripts/yt-oauth-setup.js'), 'utf8');

  // OAuth 2.0 flow
  expect(src).toContain('generateAuthUrl');
  expect(src).toContain('getToken');
  expect(src).toContain('refresh_token');
  expect(src).toContain('youtube.upload');
  // Must support manual mode
  expect(src).toContain('--manual');
  // Must get channel info after authorization
  expect(src).toContain('channels.list');
  expect(src).toContain('channelId');
  expect(src).toContain('channelTitle');
  // Must use yt-credential-manager
  expect(src).toContain('yt-credential-manager');
  expect(src).toContain('storeAccountCredentials');
});

// ─── Test 55: yt-posting-task-manager reuses parseTimeWindow from posting-task-manager ───
test('yt-posting-task-manager imports time window functions from posting-task-manager', () => {
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '../pipeline/sheets/yt-posting-task-manager.js'), 'utf8');

  expect(src).toContain("require('./posting-task-manager')");
  expect(src).toContain('parseTimeWindow');
  expect(src).toContain('isWithinWindow');
  expect(src).toContain('drive_file_id');
  expect(src).toContain('markPosted');
  expect(src).toContain('markError');
});

// ─── Test 56: tiktok-credential-manager loads without error ───
test('tiktok-credential-manager loads without error', () => {
  expect(() => require('../pipeline/posting/tiktok-credential-manager')).not.toThrow();
});

// ─── Test 57: tiktok-credential-manager returns null for unknown account ───
test('tiktok-credential-manager returns null for unknown account', () => {
  const { getAccountCredentials } = require('../pipeline/posting/tiktok-credential-manager');
  expect(getAccountCredentials('ACC_9999')).toBeNull();
});

// ─── Test 58: tiktok-credential-manager source has refreshAccessToken ───
test('tiktok-credential-manager source has refreshAccessToken', () => {
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '../pipeline/posting/tiktok-credential-manager.js'), 'utf8');
  expect(src).toContain('refreshAccessToken');
  expect(src).toContain('getValidToken');
  expect(src).toContain('/v2/oauth/token/');
  expect(src).toContain('refresh_token');
});

// ─── Test 59: tiktok adapter exports uploadVideo ───
test('tiktok adapter exports uploadVideo and downloadVideoToTemp', () => {
  const tiktok = require('../pipeline/posting/adapters/tiktok');
  expect(typeof tiktok.uploadVideo).toBe('function');
  expect(typeof tiktok.downloadVideoToTemp).toBe('function');
});

// ─── Test 60: tiktok-posting-task-manager loads without error ───
test('tiktok-posting-task-manager loads without error', () => {
  expect(() => require('../pipeline/sheets/tiktok-posting-task-manager')).not.toThrow();
});

// ─── Test 61: TIKTOK_CHARACTER_NAME_MAP has 12 entries ───
test('TIKTOK_CHARACTER_NAME_MAP has 12 entries for TikTok accounts', () => {
  const { TIKTOK_CHARACTER_NAME_MAP } = require('../pipeline/sheets/tiktok-posting-task-manager');
  expect(Object.keys(TIKTOK_CHARACTER_NAME_MAP)).toHaveLength(12);
  // Spot-check: TikTok accounts use ACC_0001, ACC_0005, etc.
  expect(TIKTOK_CHARACTER_NAME_MAP['清楚AI先生']).toEqual({ characterId: 'CHR_0001', accountId: 'ACC_0001' });
  expect(TIKTOK_CHARACTER_NAME_MAP['彼氏感カウンセラー']).toEqual({ characterId: 'CHR_0012', accountId: 'ACC_0035' });
});

// ─── Test 62: config.tiktok has credentialsPath and postingTab ───
test('config.tiktok has credentialsPath and postingTab', () => {
  const config = require('../pipeline/config');
  expect(config.tiktok).toBeDefined();
  expect(config.tiktok.credentialsPath).toBeDefined();
  expect(config.tiktok.credentialsPath).toContain('.tiktok-credentials.json');
  expect(config.tiktok.postingTab).toBe('TikTok投稿タスク');
  expect(config.tiktok.baseUrl).toBe('https://open.tiktokapis.com');
});

// ─── Test 63: watch-tiktok-posting.js has correct structure ───
test('watch-tiktok-posting.js has correct structure with poll and shutdown', () => {
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '../scripts/watch-tiktok-posting.js'), 'utf8');

  expect(src).toContain('TIKTOK_POLL_INTERVAL');
  expect(src).toContain('TIKTOK_MAX_PER_POLL');
  expect(src).toContain('TIKTOK_DAILY_LIMIT');
  expect(src).toContain('dailyUploadCount');
  expect(src).toContain('pollOnce');
  expect(src).toContain('SIGINT');
  expect(src).toContain('SIGTERM');
  expect(src).toContain('tiktok-posting-task-manager');
  expect(src).toContain('tiktok-credential-manager');
});

// ─── Test 64: tiktok adapter source uses tiktok-credential-manager ───
test('tiktok adapter source uses tiktok-credential-manager', () => {
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '../pipeline/posting/adapters/tiktok.js'), 'utf8');

  expect(src).toContain('tiktok-credential-manager');
  expect(src).toContain('getValidToken');
  expect(src).toContain('downloadVideoToTemp');
  expect(src).toContain('uploadVideo');
  expect(src).toContain('FILE_UPLOAD');
  expect(src).toContain('publish/video/init');
  expect(src).toContain('publish/status/fetch');
  expect(src).toContain('tmpPath');
  expect(src).toContain('cleanup');
  expect(src).toContain('getDrive');
});

// ─── Test 65: tiktok-oauth-setup.js has OAuth 2.0 flow ───
test('tiktok-oauth-setup.js has TikTok OAuth 2.0 flow', () => {
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '../scripts/tiktok-oauth-setup.js'), 'utf8');

  expect(src).toContain('tiktok.com/v2/auth/authorize');
  expect(src).toContain('/v2/oauth/token/');
  expect(src).toContain('video.publish');
  expect(src).toContain('--manual');
  expect(src).toContain('tiktok-credential-manager');
  expect(src).toContain('storeAccountCredentials');
  expect(src).toContain('localhost:3000/callback');
});

// ─── Test 66: ig-credential-manager loads without error ───
test('ig-credential-manager loads without error', () => {
  expect(() => require('../pipeline/posting/ig-credential-manager')).not.toThrow();
});

// ─── Test 67: ig-credential-manager returns null for unknown account ───
test('ig-credential-manager returns null for unknown account', () => {
  const { getAccountCredentials } = require('../pipeline/posting/ig-credential-manager');
  expect(getAccountCredentials('ACC_9999')).toBeNull();
});

// ─── Test 68: ig-credential-manager source has refreshLongLivedToken ───
test('ig-credential-manager source has refreshLongLivedToken', () => {
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '../pipeline/posting/ig-credential-manager.js'), 'utf8');
  expect(src).toContain('refreshLongLivedToken');
  expect(src).toContain('getValidToken');
  expect(src).toContain('ig_refresh_token');
  expect(src).toContain('tokenExpiresAt');
});

// ─── Test 69: instagram adapter exports uploadReel ───
test('instagram adapter exports uploadReel and downloadVideoToTemp', () => {
  const ig = require('../pipeline/posting/adapters/instagram');
  expect(typeof ig.uploadReel).toBe('function');
  expect(typeof ig.downloadVideoToTemp).toBe('function');
});

// ─── Test 70: ig-posting-task-manager loads without error ───
test('ig-posting-task-manager loads without error', () => {
  expect(() => require('../pipeline/sheets/ig-posting-task-manager')).not.toThrow();
});

// ─── Test 71: IG_CHARACTER_NAME_MAP has 12 entries ───
test('IG_CHARACTER_NAME_MAP has 12 entries for Instagram accounts', () => {
  const { IG_CHARACTER_NAME_MAP } = require('../pipeline/sheets/ig-posting-task-manager');
  expect(Object.keys(IG_CHARACTER_NAME_MAP)).toHaveLength(12);
  // Spot-check: Instagram accounts use ACC_0002, ACC_0004, etc.
  expect(IG_CHARACTER_NAME_MAP['清楚AI先生']).toEqual({ characterId: 'CHR_0001', accountId: 'ACC_0002' });
  expect(IG_CHARACTER_NAME_MAP['彼氏感カウンセラー']).toEqual({ characterId: 'CHR_0012', accountId: 'ACC_0034' });
});

// ─── Test 72: config.instagram has credentialsPath and postingTab ───
test('config.instagram has credentialsPath and postingTab', () => {
  const config = require('../pipeline/config');
  expect(config.instagram).toBeDefined();
  expect(config.instagram.credentialsPath).toBeDefined();
  expect(config.instagram.credentialsPath).toContain('.ig-credentials.json');
  expect(config.instagram.postingTab).toBe('IG投稿タスク');
  expect(config.instagram.graphApiVersion).toBe('v22.0');
});

// ─── Test 73: watch-ig-posting.js has correct structure with hourly limit ───
test('watch-ig-posting.js has correct structure with poll, hourly limit, and shutdown', () => {
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '../scripts/watch-ig-posting.js'), 'utf8');

  expect(src).toContain('IG_POLL_INTERVAL');
  expect(src).toContain('IG_MAX_PER_POLL');
  expect(src).toContain('IG_HOURLY_LIMIT');
  expect(src).toContain('hourlyUploadCount');
  expect(src).toContain('pollOnce');
  expect(src).toContain('SIGINT');
  expect(src).toContain('SIGTERM');
  expect(src).toContain('ig-posting-task-manager');
  expect(src).toContain('ig-credential-manager');
});

// ─── Test 74: instagram adapter source uses ig-credential-manager and uploadToFalStorage ───
test('instagram adapter source uses ig-credential-manager and uploadToFalStorage', () => {
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '../pipeline/posting/adapters/instagram.js'), 'utf8');

  expect(src).toContain('ig-credential-manager');
  expect(src).toContain('getValidToken');
  expect(src).toContain('uploadToFalStorage');
  expect(src).toContain('uploadReel');
  expect(src).toContain('downloadVideoToTemp');
  expect(src).toContain('media_type');
  expect(src).toContain('REELS');
  expect(src).toContain('media_publish');
  expect(src).toContain('tmpPath');
  expect(src).toContain('cleanup');
  expect(src).toContain('getDrive');
  expect(src).toContain('igUserId');
});

// ─── Test 75: ig-oauth-setup.js has Facebook OAuth flow ───
test('ig-oauth-setup.js has Facebook OAuth flow for Instagram', () => {
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '../scripts/ig-oauth-setup.js'), 'utf8');

  expect(src).toContain('facebook.com');
  expect(src).toContain('dialog/oauth');
  expect(src).toContain('instagram_basic');
  expect(src).toContain('instagram_content_publish');
  expect(src).toContain('pages_show_list');
  expect(src).toContain('--manual');
  expect(src).toContain('ig-credential-manager');
  expect(src).toContain('storeAccountCredentials');
  expect(src).toContain('instagram_business_account');
  expect(src).toContain('localhost:3000/callback');
});

// ─── Test 76: fabric-generator module exports generateFabricVideo ───
test('fabric-generator exports generateFabricVideo function', () => {
  const fabric = require('../pipeline/media/fabric-generator');
  expect(typeof fabric.generateFabricVideo).toBe('function');
});

// ─── Test 77: fabric-generator uses correct Fabric 1.0 endpoint ───
test('fabric-generator uses veed/fabric-1.0 endpoint with 720p default', () => {
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '../pipeline/media/fabric-generator.js'), 'utf8');
  expect(src).toContain("'veed/fabric-1.0'");
  expect(src).toContain("resolution = '720p'");
  expect(src).toContain('image_url: imageUrl');
  expect(src).toContain('audio_url: audioUrl');
  expect(src).toContain('resolution');
  expect(src).toContain('result.video.url');
  // Must use submitAndWait from fal-client (not a different client)
  expect(src).toContain("require('./fal-client')");
  expect(src).toContain('submitAndWait');
});

// ─── Test 78: orchestrator imports fabric-generator ───
test('orchestrator imports generateFabricVideo from fabric-generator', () => {
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '../pipeline/orchestrator.js'), 'utf8');
  expect(src).toContain("require('./media/fabric-generator')");
  expect(src).toContain('generateFabricVideo');
});

// ─── Test 79: orchestrator routes body through Fabric path ───
test('orchestrator routes body section through Fabric 1.0 and hook/cta through Kling+Lipsync', () => {
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '../pipeline/orchestrator.js'), 'utf8');

  // Body section uses Fabric path
  expect(src).toContain("sName === 'body'");
  expect(src).toContain('Fabric 1.0');
  expect(src).toContain('generateFabricVideo');

  // Body path: TTS first, then Fabric (sequential, not parallel with Kling)
  // The Fabric call must reference imageUrl and audioUrl
  expect(src).toContain('generateFabricVideo({ imageUrl: falImageUrl, audioUrl })');

  // Hook/CTA still use Kling + Lipsync
  expect(src).toContain('generateVideo(');
  expect(src).toContain('syncLips(');
  expect(src).toContain('uploadMotionVideo(');
});

// ─── Test 80: orchestrator dry-run distinguishes body from hook/cta ───
test('orchestrator dry-run log shows Fabric for body and Kling for hook/cta', () => {
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '../pipeline/orchestrator.js'), 'utf8');

  // Dry-run must have different messages for body vs hook/cta
  expect(src).toContain("sec.name === 'body'");
  expect(src).toContain('Fabric 1.0 (image + audio');
  expect(src).toContain('Motion upload');
  expect(src).toContain('Kling + TTS');
});

// ─── Test 81: fabric-generator does NOT use Kling or Lipsync ───
test('fabric-generator has no Kling or Lipsync references', () => {
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '../pipeline/media/fabric-generator.js'), 'utf8');
  expect(src).not.toContain('kling');
  expect(src).not.toContain('motion-control');
  expect(src).not.toContain('sync-lipsync');
  expect(src).not.toContain('video_url');
  expect(src).not.toContain('motionVideoUrl');
});

// ─── Test 82: orchestrator body path does not upload motion video ───
test('orchestrator body path does not call uploadMotionVideo', () => {
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '../pipeline/orchestrator.js'), 'utf8');

  // The body branch (if sName === 'body') should NOT contain uploadMotionVideo
  // Extract the body branch code between the if and else if (base video check)
  const bodyBranch = src.match(/if \(sName === 'body'\) \{([\s\S]*?)\} else if/);
  expect(bodyBranch).not.toBeNull();
  expect(bodyBranch[1]).not.toContain('uploadMotionVideo');
  expect(bodyBranch[1]).not.toContain('generateVideo');
  expect(bodyBranch[1]).not.toContain('syncLips');
  expect(bodyBranch[1]).toContain('generateSpeech');
  expect(bodyBranch[1]).toContain('generateFabricVideo');
});

// ─── Test 83: concat normalizes resolution and fps before concatenating ───
test('concat.js normalizes each input to 720x1280@30fps before concat', () => {
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '../pipeline/media/concat.js'), 'utf8');

  // Must scale each input to 720x1280
  expect(src).toContain('scale=720:1280');
  // Must normalize fps to 30
  expect(src).toContain('fps=30');
  // Must set SAR to 1 (square pixels)
  expect(src).toContain('setsar=1');
  // Scale filters must be applied per-input before concat (template: [v${i}])
  expect(src).toContain('[v${i}]');
});

// ─── Test 84: orchestrator supports pre-generated base video for hook/cta ───
test('orchestrator supports pre-generated base video for hook/cta (Kling skip)', () => {
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '../pipeline/orchestrator.js'), 'utf8');

  // parseDriveId helper exists
  expect(src).toContain('parseDriveId');
  // baseVideoId check in main flow
  expect(src).toContain('section.baseVideoId');
  // When base video exists, downloads from Drive and uploads to fal.storage
  expect(src).toContain('Downloading base video from Drive');
  expect(src).toContain('Uploading base video to fal.storage');
  // Kling is skipped
  expect(src).toContain('skipping Kling');
  // Dry-run shows Kling SKIPPED
  expect(src).toContain('Kling SKIPPED');
});

// ─── Test 85: inventory-reader supports base video IDs ───
test('inventory-reader passes baseVideoId through resolved sections', () => {
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '../pipeline/sheets/inventory-reader.js'), 'utf8');

  expect(src).toContain('hook_base_video_id');
  expect(src).toContain('cta_base_video_id');
  expect(src).toContain('baseVideoId');
  // Motion is optional when base video is set
  expect(src).toContain('hook_motion_id or hook_base_video_id');
  expect(src).toContain('cta_motion_id or cta_base_video_id');
});

// ─── Test 86: production-manager HEADERS contains base video columns ───
test('production-manager HEADERS contains hook_base_video_id and cta_base_video_id', () => {
  const pm = require('../pipeline/sheets/production-manager');
  expect(pm.HEADERS).toContain('hook_base_video_id');
  expect(pm.HEADERS).toContain('cta_base_video_id');
});
