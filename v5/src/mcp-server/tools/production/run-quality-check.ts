/**
 * FEAT-MCC-020: run_quality_check
 * Spec: 04-agent-design.md SS4.6 #11
 * Runs quality checks on produced content.
 * Uses ffprobe for media validation when video_url points to a local file.
 * Falls back to basic checks when ffprobe is unavailable.
 */
import type {
  RunQualityCheckInput,
  RunQualityCheckOutput,
} from '@/types/mcp-tools';
import { getPool } from '../../db';
import { McpNotFoundError } from '../../errors';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';

const execFileAsync = promisify(execFile);

interface FfprobeStream {
  codec_type?: string;
  codec_name?: string;
  width?: number;
  height?: number;
  duration?: string;
  bit_rate?: string;
}

interface FfprobeData {
  streams?: FfprobeStream[];
  format?: {
    duration?: string;
    bit_rate?: string;
  };
}

/**
 * Run ffprobe on a local file to get media info.
 * Returns null if ffprobe is unavailable or file doesn't exist.
 */
async function probeMedia(filePath: string): Promise<FfprobeData | null> {
  if (!existsSync(filePath)) return null;
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_streams',
      '-show_format',
      filePath,
    ], { timeout: 30000 });
    return JSON.parse(stdout) as FfprobeData;
  } catch {
    return null;
  }
}

/**
 * Detect black frames using ffmpeg blackdetect filter.
 * Returns the total duration of black frames in seconds.
 */
async function detectBlackFrames(filePath: string): Promise<{ blackDurationSec: number; detected: boolean } | null> {
  if (!existsSync(filePath)) return null;
  try {
    const { stderr } = await execFileAsync('ffmpeg', [
      '-i', filePath,
      '-vf', 'blackdetect=d=0.5:pix_th=0.10',
      '-an', '-f', 'null', '-',
    ], { timeout: 120000 });
    // Parse blackdetect output from stderr
    const matches = stderr.matchAll(/black_duration:(\d+\.?\d*)/g);
    let totalBlack = 0;
    for (const m of matches) {
      totalBlack += parseFloat(m[1]!);
    }
    return { blackDurationSec: totalBlack, detected: totalBlack > 0 };
  } catch {
    return null;
  }
}

export async function runQualityCheck(
  input: RunQualityCheckInput,
): Promise<RunQualityCheckOutput> {
  const pool = getPool();

  // Verify content exists
  const contentRes = await pool.query(
    `SELECT content_id FROM content WHERE content_id = $1`,
    [input.content_id],
  );

  if (contentRes.rowCount === 0) {
    throw new McpNotFoundError(`Content not found: ${input.content_id}`);
  }

  const checks: Array<{ name: string; passed: boolean; details?: string }> = [];

  // Check 1: video_exists — verify video_url is non-empty
  const videoExists = !!input.video_url && input.video_url.trim() !== '';
  checks.push({
    name: 'video_exists',
    passed: videoExists,
    details: videoExists ? 'Video URL is present' : 'Video URL is empty or missing',
  });

  // Check 2: content_exists — verify content record exists in DB (already confirmed above)
  checks.push({
    name: 'content_exists',
    passed: true,
    details: 'Content record found in database',
  });

  // Check 3: sections_complete — check that content has at least one section
  const sectionsRes = await pool.query(
    `SELECT COUNT(*)::int AS section_count
     FROM content_sections
     WHERE content_id = $1`,
    [input.content_id],
  );

  const sectionCount = (sectionsRes.rows[0] as { section_count: number } | undefined)?.section_count ?? 0;
  const sectionsComplete = sectionCount > 0;
  checks.push({
    name: 'sections_complete',
    passed: sectionsComplete,
    details: sectionsComplete
      ? `${sectionCount} section(s) found`
      : 'No sections found for this content',
  });

  // If video_url is a local file path, run ffprobe-based checks
  if (videoExists && !input.video_url.startsWith('http')) {
    const probeData = await probeMedia(input.video_url);
    if (probeData) {
      const videoStream = probeData.streams?.find((s) => s.codec_type === 'video');
      const audioStream = probeData.streams?.find((s) => s.codec_type === 'audio');

      // Check 4: video_codec
      if (videoStream) {
        const validCodecs = ['h264', 'h265', 'hevc', 'vp9', 'av1'];
        const codecOk = validCodecs.includes(videoStream.codec_name ?? '');
        checks.push({
          name: 'video_codec',
          passed: codecOk,
          details: codecOk
            ? `Codec: ${videoStream.codec_name}`
            : `Unsupported codec: ${videoStream.codec_name ?? 'unknown'}. Expected: ${validCodecs.join(', ')}`,
        });

        // Check 5: resolution (min 720p)
        const height = videoStream.height ?? 0;
        const width = videoStream.width ?? 0;
        const resOk = height >= 720 || width >= 720;
        checks.push({
          name: 'resolution',
          passed: resOk,
          details: resOk
            ? `Resolution: ${width}x${height}`
            : `Resolution too low: ${width}x${height}. Minimum 720p required`,
        });
      }

      // Check 6: duration
      const durationStr = probeData.format?.duration ?? videoStream?.duration ?? '0';
      const durationSec = parseFloat(durationStr);
      if (durationSec > 0) {
        const durationOk = durationSec >= 1 && durationSec <= 600;
        checks.push({
          name: 'duration',
          passed: durationOk,
          details: durationOk
            ? `Duration: ${durationSec.toFixed(1)}s`
            : `Duration out of range: ${durationSec.toFixed(1)}s. Expected 1-600s`,
        });
      }

      // Check 7: bitrate
      const bitrateStr = probeData.format?.bit_rate ?? '0';
      const bitrate = parseInt(bitrateStr, 10);
      if (bitrate > 0) {
        const bitrateOk = bitrate >= 500000 && bitrate <= 50000000;
        checks.push({
          name: 'bitrate',
          passed: bitrateOk,
          details: bitrateOk
            ? `Bitrate: ${(bitrate / 1000000).toFixed(2)} Mbps`
            : `Bitrate outside range: ${(bitrate / 1000000).toFixed(2)} Mbps. Expected 0.5-50 Mbps`,
        });
      }

      // Check 8: audio_stream
      checks.push({
        name: 'audio_stream',
        passed: !!audioStream,
        details: audioStream
          ? `Audio codec: ${audioStream.codec_name}`
          : 'No audio stream found in video',
      });

      // Check 9: black_frames
      const blackResult = await detectBlackFrames(input.video_url);
      if (blackResult !== null) {
        const totalDuration = durationSec > 0 ? durationSec : 1;
        const blackRatio = blackResult.blackDurationSec / totalDuration;
        const blackOk = blackRatio < 0.3;
        checks.push({
          name: 'black_frames',
          passed: blackOk,
          details: blackOk
            ? `Black frame duration: ${blackResult.blackDurationSec.toFixed(1)}s (${(blackRatio * 100).toFixed(1)}%)`
            : `Excessive black frames: ${blackResult.blackDurationSec.toFixed(1)}s (${(blackRatio * 100).toFixed(1)}% of video)`,
        });
      }
    }
  }

  const passed = checks.every((c) => c.passed);

  return { passed, checks };
}
