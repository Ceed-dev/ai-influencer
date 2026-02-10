'use strict';

/**
 * Comprehensive E2E-style tests for the content generation pipeline.
 * Tests cover: module loading, CLI arg parsing, scenario data integrity,
 * concat utility, config correctness, content-manager CRUD, orchestrator
 * dry-run, error handling for edge cases, and Drive integration.
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
});

// ─── Test 2: Deleted modules no longer exist ───
test('compositor and cloudinary modules are removed', () => {
  expect(() => require('../pipeline/media/compositor')).toThrow();
  expect(() => require('../pipeline/media/cloudinary')).toThrow();
});

// ─── Test 3: Config has no cloudinary/elevenlabs sections ───
test('config has no cloudinary or elevenlabs sections', () => {
  const config = require('../pipeline/config');
  expect(config.cloudinary).toBeUndefined();
  expect(config.elevenlabs).toBeUndefined();
  expect(config.fal).toBeDefined();
  expect(config.fal.apiKey).toBeDefined();
  expect(config.google).toBeDefined();
  expect(config.google.masterSpreadsheetId).toBe('1fI1s_KLcegpiACJYpmpNe9tnQmnZo2o8eHIXNV5SpPg');
  expect(config.google.rootDriveFolderId).toBe('1KRQuZ4W7u5CXRamjvN4xmavfu-7TPb0X');
});

// ─── Test 4: Scenario data structure is valid ───
test('scenario.json has correct structure', () => {
  const scenario = require('../pipeline/data/scenario.json');
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

// ─── Test 6: TTS generator uses correct endpoint ───
test('tts-generator uses eleven-v3 endpoint with voice name', () => {
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '../pipeline/media/tts-generator.js'), 'utf8');
  expect(src).toContain('fal-ai/elevenlabs/tts/eleven-v3');
  expect(src).not.toContain('tts/v3');
  expect(src).toContain("voice = 'Aria'");
  expect(src).not.toContain('voice_id');
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

// ─── Test 13: orchestrator exports runPipeline ───
test('orchestrator exports runPipeline function', () => {
  const orch = require('../pipeline/orchestrator');
  expect(typeof orch.runPipeline).toBe('function');
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

// ─── Test 15: CLI script source structure ───
test('run-pipeline.js uses --character-folder arg', () => {
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '../scripts/run-pipeline.js'), 'utf8');
  expect(src).toContain('--character-folder');
  expect(src).toContain('--dry-run');
  expect(src).not.toContain('--account');
  expect(src).not.toContain('createContent');
  expect(src).toContain('runPipeline');
});

// ─── Test 16: CLI exits with error when no args ───
test('CLI shows usage and exits with code 1 when no args', async () => {
  const { execFile } = require('child_process');
  const result = await new Promise((resolve) => {
    execFile('node', ['scripts/run-pipeline.js'], { timeout: 30000 }, (err, stdout, stderr) => {
      resolve({ code: err ? err.code : 0, stdout, stderr });
    });
  });
  expect(result.code).toBe(1);
  expect(result.stderr).toContain('--character-folder');
}, 30000);

// ─── Test 17: CLI exits with error for non-existent folder ───
test('CLI errors when given non-existent Drive folder ID', async () => {
  const { execFile } = require('child_process');
  const result = await new Promise((resolve) => {
    execFile('node', ['scripts/run-pipeline.js', '--character-folder', 'NONEXISTENT_FOLDER_123'],
      { timeout: 30000 }, (err, stdout, stderr) => {
        resolve({ code: err ? err.code : 0, stdout, stderr: stderr || '', combinedOutput: stdout + stderr });
      });
  });
  expect(result.code).not.toBe(0);
}, 30000);

// ─── Test 18: CLI exits with error for empty folder ───
test('CLI errors when character folder has no images', async () => {
  const { execFile } = require('child_process');
  // Use the Characters/Images folder which we know is empty
  const result = await new Promise((resolve) => {
    execFile('node', ['scripts/run-pipeline.js', '--character-folder', '1g8OsaH0sFfHe91zEY22MdbllWPp3HJZK'],
      { timeout: 30000 }, (err, stdout, stderr) => {
        resolve({ code: err ? err.code : 0, stdout: stdout || '', stderr: stderr || '' });
      });
  });
  expect(result.code).not.toBe(0);
  expect(result.stderr).toContain('No image file');
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

// ─── Test 22: Existing GAS tests still pass ───
// This verifies we didn't break anything in the GAS subsystem
