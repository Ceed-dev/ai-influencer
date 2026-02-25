/**
 * Tests: TEST-WKR-004, TEST-WKR-011, TEST-WKR-024, TEST-WKR-025
 */
jest.mock('@fal-ai/client', () => ({ fal: { config: jest.fn(), subscribe: jest.fn(), storage: { upload: jest.fn() } } }));
jest.mock('../../../../src/lib/settings', () => ({ getSettingString: jest.fn().mockResolvedValue('test-key'), getSettingNumber: jest.fn().mockResolvedValue(600) }));
jest.mock('../../../../src/lib/retry', () => {
  const actual = jest.requireActual('../../../../src/lib/retry');
  return { ...actual, retryWithBackoff: jest.fn().mockImplementation(async (fn: Function) => fn(new AbortController().signal)) };
});

import { resizeImageIfNeeded, isFalRetryable, classifyFalError, initFalClient, generateVideo } from '../../../../src/workers/video-production/fal-client';
import { fal } from '@fal-ai/client';

describe('fal.ai Client', () => {
  describe('TEST-WKR-011: image resize', () => {
    it('no resize within limit', () => { const r = resizeImageIfNeeded(1920, 1080); expect(r.resized).toBe(false); });
    it('resizes 4000x4000', () => { const r = resizeImageIfNeeded(4000, 4000); expect(r.resized).toBe(true); expect(r.width).toBeLessThanOrEqual(3850); expect(r.height).toBeLessThanOrEqual(3850); });
    it('maintains aspect ratio', () => { const r = resizeImageIfNeeded(4000, 2000); expect(r.width).toBe(3850); expect(r.height).toBe(1925); });
    it('exact 3850 not resized', () => { expect(resizeImageIfNeeded(3850, 3850).resized).toBe(false); });
    it('one dim over limit', () => { const r = resizeImageIfNeeded(3000, 5000); expect(r.resized).toBe(true); expect(r.height).toBe(3850); expect(r.width).toBe(2310); });
  });

  describe('TEST-WKR-024: fal.ai 403', () => {
    it('not retryable', () => { const e = Object.assign(new Error('Forbidden'), { status: 403 }); expect(isFalRetryable(e)).toBe(false); });
    it('classifies as balance exhausted', () => { const e = Object.assign(new Error('Forbidden'), { status: 403 }); const c = classifyFalError(e); expect(c.message).toContain('403'); expect(c.permanent).toBe(true); });
  });

  describe('TEST-WKR-025: fal.ai 422', () => {
    it('not retryable', () => { const e = Object.assign(new Error('Unprocessable'), { status: 422 }); expect(isFalRetryable(e)).toBe(false); });
    it('classifies as permanent', () => { const e = Object.assign(new Error('Unprocessable'), { status: 422 }); const c = classifyFalError(e); expect(c.message).toContain('422'); expect(c.permanent).toBe(true); });
  });

  describe('retryable errors', () => {
    it('429 retryable', () => { expect(isFalRetryable(Object.assign(new Error(), { status: 429 }))).toBe(true); });
    it('500 retryable', () => { expect(isFalRetryable(Object.assign(new Error(), { status: 500 }))).toBe(true); });
  });

  describe('initFalClient', () => {
    it('configures fal', async () => { await initFalClient(); expect(fal.config).toHaveBeenCalledWith({ credentials: 'test-key' }); });
  });

  describe('generateVideo', () => {
    it('calls fal.subscribe correctly', async () => {
      (fal.subscribe as jest.Mock).mockResolvedValue({ request_id: 'r1', video: { url: 'https://fal.ai/v.mp4' } });
      const r = await generateVideo('https://img.com/c.png', 'prompt');
      expect(fal.subscribe).toHaveBeenCalledWith('fal-ai/kling-video/v2.6/standard/image-to-video', expect.objectContaining({ input: expect.objectContaining({ prompt: 'prompt', image_url: 'https://img.com/c.png' }) }));
      expect(r.requestId).toBe('r1');
      expect(r.videoUrl).toBe('https://fal.ai/v.mp4');
    });
  });
});
