/**
 * Tests: TEST-WKR-010 (ffmpeg concat H.264 CRF18 + blackdetect)
 */
import { execFile } from 'node:child_process';

jest.mock('node:child_process', () => ({ execFile: jest.fn() }));
jest.mock('node:fs/promises', () => ({
  mkdtemp: jest.fn().mockResolvedValue('/tmp/ffmpeg-test'),
  rm: jest.fn().mockResolvedValue(undefined),
  stat: jest.fn().mockResolvedValue({ size: 1024000 }),
}));

const mockExecFile = execFile as unknown as jest.Mock;

import { concatVideos, detectBlackFrames, probeVideo } from '../../../../src/workers/video-production/ffmpeg';

describe('ffmpeg Operations', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  describe('TEST-WKR-010: ffmpeg concat', () => {
    it('concatenates with correct args', async () => {
      mockExecFile.mockImplementation((cmd: string, args: string[], opts: unknown, cb?: Function) => {
        if (!cb && typeof opts === 'function') cb = opts as Function;
        if (cmd === 'ffmpeg') cb!(null, { stdout: '', stderr: '' });
        else if (cmd === 'ffprobe') cb!(null, { stdout: JSON.stringify({ format: { duration: '15.5' }, streams: [{ codec_type: 'video', width: 1080, height: 1920 }] }), stderr: '' });
        return {} as any;
      });

      const r = await concatVideos(['/tmp/s1.mp4', '/tmp/s2.mp4', '/tmp/s3.mp4']);
      const ffCall = mockExecFile.mock.calls.find((c: any[]) => c[0] === 'ffmpeg');
      expect(ffCall).toBeDefined();
      const a = ffCall![1] as string[];
      expect(a).toContain('-crf'); expect(a).toContain('18');
      expect(a).toContain('-c:v'); expect(a).toContain('libx264');
      expect(a).toContain('-pix_fmt'); expect(a).toContain('yuv420p');
      expect(a[a.indexOf('-filter_complex') + 1]).toContain('concat=n=3');
      expect(r.durationSeconds).toBe(15.5);
      expect(r.fileSizeBytes).toBe(1024000);
    });

    it('detects black frames', async () => {
      mockExecFile.mockImplementation((_: string, __: string[], opts: unknown, cb?: Function) => {
        if (!cb && typeof opts === 'function') cb = opts as Function;
        cb!(null, { stdout: '', stderr: 'black_start:5.0 black_end:5.3 black_duration:0.3' });
        return {} as any;
      });
      const f = await detectBlackFrames('/tmp/f.mp4');
      expect(f.length).toBe(1);
      expect(f[0]!.duration).toBe(0.3);
    });

    it('empty when no black frames', async () => {
      mockExecFile.mockImplementation((_: string, __: string[], opts: unknown, cb?: Function) => {
        if (!cb && typeof opts === 'function') cb = opts as Function;
        cb!(null, { stdout: '', stderr: '' });
        return {} as any;
      });
      expect(await detectBlackFrames('/tmp/f.mp4')).toHaveLength(0);
    });

    it('flags black frames > 0.1s', async () => {
      mockExecFile.mockImplementation((cmd: string, args: string[], opts: unknown, cb?: Function) => {
        if (!cb && typeof opts === 'function') cb = opts as Function;
        if (cmd === 'ffmpeg' && (args as string[]).includes('-filter_complex')) cb!(null, { stdout: '', stderr: '' });
        else if (cmd === 'ffmpeg') cb!(null, { stdout: '', stderr: 'black_start:4.9 black_end:5.2 black_duration:0.3' });
        else cb!(null, { stdout: JSON.stringify({ format: { duration: '15' }, streams: [{ codec_type: 'video', width: 1080, height: 1920 }] }), stderr: '' });
        return {} as any;
      });
      const r = await concatVideos(['/tmp/s1.mp4', '/tmp/s2.mp4']);
      expect(r.hasBlackFrameIssues).toBe(true);
    });
  });

  describe('probeVideo', () => {
    it('parses ffprobe output', async () => {
      mockExecFile.mockImplementation((_: string, __: string[], opts: unknown, cb?: Function) => {
        if (!cb && typeof opts === 'function') cb = opts as Function;
        cb!(null, { stdout: JSON.stringify({ format: { duration: '45.67' }, streams: [{ codec_type: 'video', width: 1920, height: 1080 }] }), stderr: '' });
        return {} as any;
      });
      const r = await probeVideo('/tmp/t.mp4');
      expect(r.duration).toBe(45.67);
      expect(r.width).toBe(1920);
    });
  });
});
