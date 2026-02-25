/**
 * FEAT-VW-008: ffmpeg concat (H.264 CRF18 + blackdetect)
 * Spec: 04-agent-design.md §5.2
 */
import { execFile } from 'node:child_process';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface ConcatResult { outputPath: string; durationSeconds: number; fileSizeBytes: number; blackFrames: BlackFrame[]; hasBlackFrameIssues: boolean; }
export interface BlackFrame { startTime: number; endTime: number; duration: number; }

export async function concatVideos(inputPaths: string[], options: { crf?: number; outputPath?: string } = {}): Promise<ConcatResult> {
  const { crf = 18 } = options;
  const tempDir = await mkdtemp(join(tmpdir(), 'ffmpeg-concat-'));
  const outputPath = options.outputPath ?? join(tempDir, 'final.mp4');

  try {
    const inputArgs: string[] = [];
    const filterParts: string[] = [];
    for (let i = 0; i < inputPaths.length; i++) {
      inputArgs.push('-i', inputPaths[i]!);
      filterParts.push(`[${i}:v:0][${i}:a:0]`);
    }
    const filterComplex = `${filterParts.join('')}concat=n=${inputPaths.length}:v=1:a=1[outv][outa]`;
    await execFileAsync('ffmpeg', [
      ...inputArgs, '-filter_complex', filterComplex, '-map', '[outv]', '-map', '[outa]',
      '-c:v', 'libx264', '-crf', String(crf), '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', '-y', outputPath,
    ], { timeout: 300000 });

    const probe = await probeVideo(outputPath);
    const fileSize = (await stat(outputPath)).size;
    const blackFrames = await detectBlackFrames(outputPath);
    return { outputPath, durationSeconds: probe.duration, fileSizeBytes: fileSize, blackFrames, hasBlackFrameIssues: blackFrames.some((bf) => bf.duration > 0.1) };
  } catch (err) {
    await rm(tempDir, { recursive: true, force: true }).catch((err) => {
      console.warn(`[ffmpeg] Failed to clean temp dir ${tempDir}: ${err instanceof Error ? err.message : String(err)}`);
    });
    throw err;
  }
}

export async function detectBlackFrames(videoPath: string, minDuration: number = 0.05): Promise<BlackFrame[]> {
  try {
    const { stderr } = await execFileAsync('ffmpeg', ['-i', videoPath, '-vf', `blackdetect=d=${minDuration}:pix_th=0.10`, '-an', '-f', 'null', '-'], { timeout: 60000 });
    const frames: BlackFrame[] = [];
    const regex = /black_start:(\d+\.?\d*)\s+black_end:(\d+\.?\d*)\s+black_duration:(\d+\.?\d*)/g;
    let match;
    while ((match = regex.exec(stderr)) !== null) {
      frames.push({ startTime: parseFloat(match[1]!), endTime: parseFloat(match[2]!), duration: parseFloat(match[3]!) });
    }
    return frames;
  } catch { return []; }
}

export async function probeVideo(videoPath: string): Promise<{ duration: number; width: number; height: number }> {
  const { stdout } = await execFileAsync('ffprobe', ['-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams', videoPath]);
  const data = JSON.parse(stdout) as { format?: { duration?: string }; streams?: Array<{ width?: number; height?: number; codec_type?: string }> };
  const vs = data.streams?.find((s) => s.codec_type === 'video');
  return { duration: parseFloat(data.format?.duration ?? '0'), width: vs?.width ?? 0, height: vs?.height ?? 0 };
}
