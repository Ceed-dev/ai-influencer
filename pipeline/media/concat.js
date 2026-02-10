'use strict';

const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Concatenate multiple video buffers into one using ffmpeg concat demuxer.
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

    // Create concat list file
    const listPath = path.join(tmpDir, 'list.txt');
    const listContent = filePaths.map((p) => `file '${p}'`).join('\n');
    fs.writeFileSync(listPath, listContent);

    // Output path
    const outputPath = path.join(tmpDir, 'final.mp4');

    // Run ffmpeg
    await new Promise((resolve, reject) => {
      execFile(
        'ffmpeg',
        ['-f', 'concat', '-safe', '0', '-i', listPath, '-c', 'copy', outputPath],
        { timeout: 60000 },
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
    // Clean up temp files
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

module.exports = { concatVideos };
