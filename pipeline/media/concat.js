'use strict';

const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Concatenate multiple video buffers into one using ffmpeg filter_complex concat filter.
 * Re-encodes with H.264 to eliminate black frames at segment boundaries.
 * @param {Array<{buffer: Buffer, filename: string}>} clips - Ordered video clips
 * @returns {Promise<Buffer>} Concatenated video buffer
 */
async function concatVideos(clips) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-inf-concat-'));

  try {
    // Write clip files to temp dir
    const filePaths = clips.map(({ buffer, filename }) => {
      const filePath = path.join(tmpDir, filename);
      fs.writeFileSync(filePath, buffer);
      return filePath;
    });

    const outputPath = path.join(tmpDir, 'final.mp4');

    // Build ffmpeg args with filter_complex concat filter
    const inputArgs = filePaths.flatMap((p) => ['-i', p]);

    // Build filter_complex string dynamically: [0:v][0:a][1:v][1:a]...concat=n=N:v=1:a=1[outv][outa]
    const n = filePaths.length;
    const streamRefs = Array.from({ length: n }, (_, i) => `[${i}:v][${i}:a]`).join('');
    const filterComplex = `${streamRefs}concat=n=${n}:v=1:a=1[outv][outa]`;

    const args = [
      ...inputArgs,
      '-filter_complex', filterComplex,
      '-map', '[outv]',
      '-map', '[outa]',
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '18',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-movflags', '+faststart',
      outputPath,
    ];

    await new Promise((resolve, reject) => {
      execFile(
        'ffmpeg',
        args,
        { timeout: 600000 },
        (err, stdout, stderr) => {
          if (err) {
            reject(new Error(`ffmpeg concat failed: ${err.message}\n${stderr}`));
          } else {
            resolve();
          }
        }
      );
    });

    return fs.readFileSync(outputPath);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

/**
 * Detect black frames in a video using ffmpeg blackdetect filter.
 * @param {Buffer} videoBuffer - Video file buffer
 * @returns {Promise<Array<{start: number, end: number, duration: number}>>} Detected black frame regions
 */
async function detectBlackFrames(videoBuffer) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-inf-bdetect-'));

  try {
    const inputPath = path.join(tmpDir, 'input.mp4');
    fs.writeFileSync(inputPath, videoBuffer);

    const stderr = await new Promise((resolve, reject) => {
      execFile(
        'ffmpeg',
        [
          '-i', inputPath,
          '-vf', 'blackdetect=d=0.03:pix_th=0.10',
          '-an',
          '-f', 'null',
          '-',
        ],
        { timeout: 120000 },
        (err, stdout, stderrOut) => {
          // ffmpeg writes detection info to stderr even on success;
          // exit code may be non-zero in some builds, so we always parse stderr
          if (err && !stderrOut) {
            reject(new Error(`ffmpeg blackdetect failed: ${err.message}`));
          } else {
            resolve(stderrOut || '');
          }
        }
      );
    });

    // Parse lines like: [blackdetect @ 0x...] black_start:4.96 black_end:5.0 black_duration:0.04
    const results = [];
    const regex = /black_start:\s*([\d.]+)\s*black_end:\s*([\d.]+)\s*black_duration:\s*([\d.]+)/g;
    let match;
    while ((match = regex.exec(stderr)) !== null) {
      results.push({
        start: parseFloat(match[1]),
        end: parseFloat(match[2]),
        duration: parseFloat(match[3]),
      });
    }

    return results;
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

/**
 * Trim black frames from the start of a video.
 * @param {Buffer} videoBuffer - Video file buffer
 * @param {number} trimDuration - Seconds to trim from the start
 * @returns {Promise<Buffer>} Trimmed video buffer
 */
async function trimBlackStart(videoBuffer, trimDuration) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-inf-trim-'));

  try {
    const inputPath = path.join(tmpDir, 'input.mp4');
    const outputPath = path.join(tmpDir, 'trimmed.mp4');
    fs.writeFileSync(inputPath, videoBuffer);

    await new Promise((resolve, reject) => {
      execFile(
        'ffmpeg',
        [
          '-ss', String(trimDuration),
          '-i', inputPath,
          '-c', 'copy',
          '-movflags', '+faststart',
          outputPath,
        ],
        { timeout: 60000 },
        (err, stdout, stderr) => {
          if (err) {
            reject(new Error(`ffmpeg trim failed: ${err.message}\n${stderr}`));
          } else {
            resolve();
          }
        }
      );
    });

    return fs.readFileSync(outputPath);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

module.exports = { concatVideos, detectBlackFrames, trimBlackStart };
