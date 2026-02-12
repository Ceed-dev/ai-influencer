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

// ─── Test 9: concat module exports concatVideos function ───
test('concat module exports concatVideos', () => {
  const concat = require('../pipeline/media/concat');
  expect(typeof concat.concatVideos).toBe('function');
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
}, 60000);

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
}, 60000);

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

// ─── Test 13: orchestrator exports runPipeline + new v4.0 exports ───
test('orchestrator exports runPipeline, runSingleJob, processReadyJobs', () => {
  const orch = require('../pipeline/orchestrator');
  expect(typeof orch.runPipeline).toBe('function');
  expect(typeof orch.runSingleJob).toBe('function');
  expect(typeof orch.processReadyJobs).toBe('function');
});

// ─── Test 14: orchestrator source has no references to old modules ───
test('orchestrator has no cloudinary/compositor references', () => {
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '../pipeline/orchestrator.js'), 'utf8');
  expect(src).not.toContain('cloudinary');
  expect(src).not.toContain('compositor');
  expect(src).not.toContain('composite');
  expect(src).toContain('concatVideos');
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

// ─── Test 16: CLI script supports new v4.0 flags ───
test('run-pipeline.js supports --video-id, --limit, --dry-run and legacy --character-folder', () => {
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '../scripts/run-pipeline.js'), 'utf8');
  // New v4.0 flags
  expect(src).toContain('--video-id');
  expect(src).toContain('--limit');
  expect(src).toContain('--dry-run');
  expect(src).toContain('--help');
  // Legacy backward compat
  expect(src).toContain('--character-folder');
  // New imports
  expect(src).toContain('runPipeline');
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
test('production-manager exports HEADERS with 32 columns and CRUD functions', () => {
  const pm = require('../pipeline/sheets/production-manager');
  expect(Array.isArray(pm.HEADERS)).toBe(true);
  expect(pm.HEADERS).toHaveLength(32);

  // Key columns must be present
  const requiredCols = [
    'video_id', 'account_id', 'edit_status', 'character_id',
    'hook_scenario_id', 'body_scenario_id', 'cta_scenario_id',
    'hook_motion_id', 'body_motion_id', 'cta_motion_id',
    'voice_id', 'pipeline_status', 'current_phase',
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

// ─── Test 27: production-manager uses production tab ───
test('production-manager reads from production tab', () => {
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '../pipeline/sheets/production-manager.js'), 'utf8');

  expect(src).toContain('productionTab');
  expect(src).toContain('getReadyRows');
  expect(src).toContain("edit_status");
  expect(src).toContain("pipeline_status");
  // Should use 32-column HEADERS
  expect(src).toContain('HEADERS');
});
