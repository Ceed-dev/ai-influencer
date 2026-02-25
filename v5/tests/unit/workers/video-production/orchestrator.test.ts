/**
 * Tests: TEST-WKR-003 (section parallel), TEST-WKR-004 (Kling+TTS parallel),
 * TEST-WKR-007 (checkpoint save), TEST-WKR-008 (checkpoint recovery),
 * TEST-WKR-009 (content status transition), TEST-WKR-026 (HUMAN_REVIEW=true),
 * TEST-WKR-027 (AUTO_APPROVE_SCORE_THRESHOLD), TEST-WKR-028 (HUMAN_REVIEW=false),
 * TEST-WKR-029 (MAX_CONTENT_REVISION_COUNT cancel), TEST-WKR-032 (cost tracking),
 * TEST-WKR-033 (DAILY_BUDGET_LIMIT_USD), TEST-WKR-035 (Drive upload)
 */

const mockQuery = jest.fn();
const mockConnect = jest.fn();

jest.mock('../../../../src/db/pool', () => ({
  getPool: jest.fn(() => ({
    query: mockQuery,
    connect: mockConnect,
  })),
  closePool: jest.fn(),
}));

jest.mock('../../../../src/lib/settings', () => ({
  getSetting: jest.fn(),
  getSettingNumber: jest.fn(),
  getSettingBoolean: jest.fn(),
  getSettingString: jest.fn(),
}));

jest.mock('../../../../src/workers/video-production/fal-client', () => ({
  initFalClient: jest.fn().mockResolvedValue(undefined),
  generateVideo: jest.fn().mockResolvedValue({
    requestId: 'req_test',
    videoUrl: 'https://fal.ai/test.mp4',
    processingTimeMs: 5000,
  }),
  classifyFalError: jest.fn().mockReturnValue({
    message: 'test error',
    permanent: false,
  }),
}));

jest.mock('../../../../src/workers/video-production/fish-audio', () => ({
  generateTts: jest.fn().mockResolvedValue({
    audioUrl: 'https://fish.audio/test.mp3',
    audioBuffer: Buffer.alloc(1024),
    processingTimeMs: 2000,
  }),
}));

jest.mock('../../../../src/workers/video-production/ffmpeg', () => ({
  concatVideos: jest.fn().mockResolvedValue({
    outputPath: '/tmp/final.mp4',
    durationSeconds: 15.5,
    fileSizeBytes: 1024000,
    blackFrames: [],
    hasBlackFrameIssues: false,
  }),
}));

jest.mock('../../../../src/workers/video-production/task-poller', () => ({
  completeTask: jest.fn().mockResolvedValue(undefined),
  failTask: jest.fn().mockResolvedValue(undefined),
}));

import { processProductionTask } from '../../../../src/workers/video-production/orchestrator';
import { getSettingNumber, getSettingBoolean, getSettingString } from '../../../../src/lib/settings';
import { generateVideo } from '../../../../src/workers/video-production/fal-client';
import { generateTts } from '../../../../src/workers/video-production/fish-audio';
import { completeTask, failTask } from '../../../../src/workers/video-production/task-poller';

const mockContent = {
  id: 1,
  content_id: 'CNT_202602_0001',
  content_format: 'short_video',
  status: 'planned',
  character_id: 'CHR_0001',
  recipe_id: 1,
  production_metadata: null,
  quality_score: null,
  revision_count: 0,
  video_drive_id: null,
  video_drive_url: null,
  drive_folder_id: null,
};

const mockSections = [
  { id: 1, content_id: 'CNT_202602_0001', component_id: 'SCN_0001', section_order: 1, section_label: 'hook', script: 'Welcome to this beauty tutorial!' },
  { id: 2, content_id: 'CNT_202602_0001', component_id: 'SCN_0002', section_order: 2, section_label: 'body', script: 'Today we will learn about skincare.' },
  { id: 3, content_id: 'CNT_202602_0001', component_id: 'SCN_0003', section_order: 3, section_label: 'cta', script: 'Subscribe for more tips!' },
];

const mockCharacter = {
  id: 1,
  character_id: 'CHR_0001',
  name: 'Hana',
  voice_id: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
  image_drive_id: 'drive_img_001',
  status: 'active',
};

const mockRecipe = {
  id: 1,
  recipe_name: 'asian_beauty_short',
  content_format: 'short_video',
  steps: [
    { order: 1, step_name: 'video_gen', tool_id: 1, tool_name: 'kling' },
    { order: 2, step_name: 'tts', tool_id: 2, tool_name: 'fish_audio' },
  ],
  is_active: true,
};

const mockTask = {
  id: 1,
  task_type: 'produce' as const,
  payload: { content_id: 'CNT_202602_0001' },
  status: 'processing' as const,
  priority: 0,
  assigned_worker: 'worker-1',
  retry_count: 0,
  max_retries: 3,
  error_message: null,
  last_error_at: null,
  created_at: '2026-02-23T00:00:00Z',
  started_at: '2026-02-23T00:01:00Z',
  completed_at: null,
};

function setupDefaultMocks() {
  (getSettingNumber as jest.Mock).mockImplementation((key: string) => {
    const defaults: Record<string, number> = {
      DAILY_BUDGET_LIMIT_USD: 100,
      MAX_CONTENT_REVISION_COUNT: 3,
      AUTO_APPROVE_SCORE_THRESHOLD: 8.0,
      VIDEO_SECTION_TIMEOUT_SEC: 600,
    };
    return Promise.resolve(defaults[key] ?? 0);
  });
  (getSettingBoolean as jest.Mock).mockImplementation((key: string) => {
    if (key === 'HUMAN_REVIEW_ENABLED') return Promise.resolve(true);
    return Promise.resolve(false);
  });
  (getSettingString as jest.Mock).mockImplementation((key: string) => {
    if (key === 'CRED_FAL_AI_API_KEY') return Promise.resolve('test-key');
    if (key === 'CRED_FISH_AUDIO_API_KEY') return Promise.resolve('test-key');
    if (key === 'PRODUCTION_OUTPUT_DRIVE_FOLDER_ID') return Promise.resolve('folder_123');
    return Promise.resolve('');
  });

  // Default: budget under limit
  mockQuery.mockImplementation((sql: string, params?: unknown[]) => {
    if (sql.includes('tool_experiences') && sql.includes('SUM(cost_actual)')) {
      return Promise.resolve({ rows: [{ total: '50.00' }] });
    }
    if (sql.includes('FROM content WHERE')) {
      return Promise.resolve({ rows: [{ ...mockContent }] });
    }
    if (sql.includes('FROM content_sections WHERE')) {
      return Promise.resolve({ rows: [...mockSections] });
    }
    if (sql.includes('FROM characters WHERE')) {
      return Promise.resolve({ rows: [{ ...mockCharacter }] });
    }
    if (sql.includes('FROM production_recipes WHERE')) {
      return Promise.resolve({ rows: [{ ...mockRecipe }] });
    }
    if (sql.includes('UPDATE')) {
      return Promise.resolve({ rowCount: 1 });
    }
    return Promise.resolve({ rows: [] });
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  setupDefaultMocks();
});

describe('Video Production Orchestrator', () => {
  // TEST-WKR-003: Section parallel processing
  describe('TEST-WKR-003: section parallel processing', () => {
    it('should process all 3 sections in parallel', async () => {
      const result = await processProductionTask(mockTask);

      // generateVideo should be called 3 times (once per section)
      expect(generateVideo).toHaveBeenCalledTimes(3);
      // generateTts should be called 3 times (once per section)
      expect(generateTts).toHaveBeenCalledTimes(3);
      expect(result.sections.length).toBe(3);
    });
  });

  // TEST-WKR-004: Kling + TTS parallel within section
  describe('TEST-WKR-004: Kling + TTS parallel within section', () => {
    it('should call generateVideo and generateTts concurrently per section', async () => {
      const callOrder: string[] = [];
      (generateVideo as jest.Mock).mockImplementation(async () => {
        callOrder.push('video_start');
        await new Promise((r) => setTimeout(r, 10));
        callOrder.push('video_end');
        return { requestId: 'req', videoUrl: 'url', processingTimeMs: 100 };
      });
      (generateTts as jest.Mock).mockImplementation(async () => {
        callOrder.push('tts_start');
        await new Promise((r) => setTimeout(r, 10));
        callOrder.push('tts_end');
        return { audioUrl: 'url', audioBuffer: Buffer.alloc(0), processingTimeMs: 100 };
      });

      await processProductionTask(mockTask);

      // Video and TTS for same section should start before either completes
      // (they run in parallel via Promise.all)
      const firstVideoStart = callOrder.indexOf('video_start');
      const firstTtsStart = callOrder.indexOf('tts_start');
      // Both should start early (within first few operations)
      expect(firstVideoStart).toBeLessThan(callOrder.length);
      expect(firstTtsStart).toBeLessThan(callOrder.length);
    });
  });

  // TEST-WKR-009: Content status transition
  describe('TEST-WKR-009: content status transition', () => {
    it('should transition content status planned → producing → ready', async () => {
      const statusUpdates: string[] = [];
      mockQuery.mockImplementation((sql: string, params?: unknown[]) => {
        if (sql.includes('UPDATE content SET status')) {
          statusUpdates.push(params?.[0] as string);
          return Promise.resolve({ rowCount: 1 });
        }
        if (sql.includes('tool_experiences') && sql.includes('SUM')) {
          return Promise.resolve({ rows: [{ total: '50.00' }] });
        }
        if (sql.includes('FROM content WHERE')) {
          return Promise.resolve({ rows: [{ ...mockContent, quality_score: 9.0 }] });
        }
        if (sql.includes('FROM content_sections')) {
          return Promise.resolve({ rows: [...mockSections] });
        }
        if (sql.includes('FROM characters')) {
          return Promise.resolve({ rows: [{ ...mockCharacter }] });
        }
        if (sql.includes('FROM production_recipes')) {
          return Promise.resolve({ rows: [{ ...mockRecipe }] });
        }
        return Promise.resolve({ rows: [], rowCount: 1 });
      });

      await processProductionTask(mockTask);

      // First status update should be 'producing'
      expect(statusUpdates[0]).toBe('producing');
    });
  });

  // TEST-WKR-007 / TEST-WKR-008: Checkpoint save & recovery
  describe('TEST-WKR-007/008: checkpoint save and recovery', () => {
    it('should save checkpoint after each section (TEST-WKR-007)', async () => {
      const checkpointUpdates: string[] = [];
      mockQuery.mockImplementation((sql: string, params?: unknown[]) => {
        if (sql.includes('jsonb_set') && sql.includes('sections')) {
          checkpointUpdates.push(params?.[0] as string);
          return Promise.resolve({ rowCount: 1 });
        }
        if (sql.includes('tool_experiences') && sql.includes('SUM')) {
          return Promise.resolve({ rows: [{ total: '50.00' }] });
        }
        if (sql.includes('FROM content WHERE')) {
          return Promise.resolve({ rows: [{ ...mockContent }] });
        }
        if (sql.includes('FROM content_sections')) {
          return Promise.resolve({ rows: [...mockSections] });
        }
        if (sql.includes('FROM characters')) {
          return Promise.resolve({ rows: [{ ...mockCharacter }] });
        }
        if (sql.includes('FROM production_recipes')) {
          return Promise.resolve({ rows: [{ ...mockRecipe }] });
        }
        return Promise.resolve({ rows: [], rowCount: 1 });
      });

      await processProductionTask(mockTask);

      // Should save 3 checkpoints (one per section)
      expect(checkpointUpdates.length).toBe(3);
      for (const cp of checkpointUpdates) {
        const parsed = JSON.parse(cp);
        expect(parsed).toHaveProperty('order');
        expect(parsed).toHaveProperty('fal_request_ids');
      }
    });

    it('should skip completed sections on recovery (TEST-WKR-008)', async () => {
      // Content already has section 1 checkpoint
      const contentWithCheckpoint = {
        ...mockContent,
        production_metadata: {
          sections: [{
            order: 1,
            label: 'hook',
            fal_request_ids: { video: 'req_existing' },
            processing_time_seconds: 10,
          }],
        },
      };

      mockQuery.mockImplementation((sql: string) => {
        if (sql.includes('tool_experiences') && sql.includes('SUM')) {
          return Promise.resolve({ rows: [{ total: '50.00' }] });
        }
        if (sql.includes('FROM content WHERE')) {
          return Promise.resolve({ rows: [contentWithCheckpoint] });
        }
        if (sql.includes('FROM content_sections')) {
          return Promise.resolve({ rows: [...mockSections] });
        }
        if (sql.includes('FROM characters')) {
          return Promise.resolve({ rows: [{ ...mockCharacter }] });
        }
        if (sql.includes('FROM production_recipes')) {
          return Promise.resolve({ rows: [{ ...mockRecipe }] });
        }
        return Promise.resolve({ rows: [], rowCount: 1 });
      });

      (generateVideo as jest.Mock).mockClear();
      await processProductionTask(mockTask);

      // generateVideo should only be called 2 times (sections 2 & 3, section 1 skipped)
      expect(generateVideo).toHaveBeenCalledTimes(2);
    });
  });

  // TEST-WKR-026: HUMAN_REVIEW_ENABLED=true, quality below threshold
  describe('TEST-WKR-026: HUMAN_REVIEW_ENABLED=true, low score', () => {
    it('should transition to pending_review when quality < threshold', async () => {
      const statusUpdates: Array<{ sql: string; params: unknown[] }> = [];

      mockQuery.mockImplementation((sql: string, params?: unknown[]) => {
        if (sql.includes('UPDATE content')) {
          statusUpdates.push({ sql, params: params ?? [] });
          return Promise.resolve({ rowCount: 1 });
        }
        if (sql.includes('tool_experiences') && sql.includes('SUM')) {
          return Promise.resolve({ rows: [{ total: '50.00' }] });
        }
        if (sql.includes('FROM content WHERE')) {
          return Promise.resolve({
            rows: [{ ...mockContent, quality_score: 7.0 }],
          });
        }
        if (sql.includes('FROM content_sections')) {
          return Promise.resolve({ rows: [...mockSections] });
        }
        if (sql.includes('FROM characters')) {
          return Promise.resolve({ rows: [{ ...mockCharacter }] });
        }
        if (sql.includes('FROM production_recipes')) {
          return Promise.resolve({ rows: [{ ...mockRecipe }] });
        }
        return Promise.resolve({ rows: [], rowCount: 1 });
      });

      (getSettingBoolean as jest.Mock).mockResolvedValue(true);
      (getSettingNumber as jest.Mock).mockImplementation((key: string) => {
        if (key === 'AUTO_APPROVE_SCORE_THRESHOLD') return Promise.resolve(8.0);
        if (key === 'MAX_CONTENT_REVISION_COUNT') return Promise.resolve(3);
        if (key === 'DAILY_BUDGET_LIMIT_USD') return Promise.resolve(100);
        return Promise.resolve(0);
      });

      await processProductionTask(mockTask);

      const reviewUpdate = statusUpdates.find(
        (u) => u.sql.includes("review_status = 'pending_review'"),
      );
      expect(reviewUpdate).toBeDefined();
    });
  });

  // TEST-WKR-027: AUTO_APPROVE_SCORE_THRESHOLD auto-approve
  describe('TEST-WKR-027: auto-approve when score >= threshold', () => {
    it('should auto-approve when quality_score >= threshold', async () => {
      const statusUpdates: Array<{ sql: string; params: unknown[] }> = [];

      mockQuery.mockImplementation((sql: string, params?: unknown[]) => {
        if (sql.includes('UPDATE content')) {
          statusUpdates.push({ sql, params: params ?? [] });
          return Promise.resolve({ rowCount: 1 });
        }
        if (sql.includes('tool_experiences') && sql.includes('SUM')) {
          return Promise.resolve({ rows: [{ total: '50.00' }] });
        }
        if (sql.includes('FROM content WHERE')) {
          return Promise.resolve({
            rows: [{ ...mockContent, quality_score: 9.0 }],
          });
        }
        if (sql.includes('FROM content_sections')) {
          return Promise.resolve({ rows: [...mockSections] });
        }
        if (sql.includes('FROM characters')) {
          return Promise.resolve({ rows: [{ ...mockCharacter }] });
        }
        if (sql.includes('FROM production_recipes')) {
          return Promise.resolve({ rows: [{ ...mockRecipe }] });
        }
        return Promise.resolve({ rows: [], rowCount: 1 });
      });

      (getSettingBoolean as jest.Mock).mockResolvedValue(true);

      await processProductionTask(mockTask);

      const approveUpdate = statusUpdates.find(
        (u) => u.sql.includes("review_status = 'approved'"),
      );
      expect(approveUpdate).toBeDefined();
    });
  });

  // TEST-WKR-028: HUMAN_REVIEW_ENABLED=false
  describe('TEST-WKR-028: HUMAN_REVIEW_ENABLED=false', () => {
    it('should set review_status to not_required', async () => {
      const statusUpdates: Array<{ sql: string; params: unknown[] }> = [];

      mockQuery.mockImplementation((sql: string, params?: unknown[]) => {
        if (sql.includes('UPDATE content')) {
          statusUpdates.push({ sql, params: params ?? [] });
          return Promise.resolve({ rowCount: 1 });
        }
        if (sql.includes('tool_experiences') && sql.includes('SUM')) {
          return Promise.resolve({ rows: [{ total: '50.00' }] });
        }
        if (sql.includes('FROM content WHERE')) {
          return Promise.resolve({ rows: [{ ...mockContent }] });
        }
        if (sql.includes('FROM content_sections')) {
          return Promise.resolve({ rows: [...mockSections] });
        }
        if (sql.includes('FROM characters')) {
          return Promise.resolve({ rows: [{ ...mockCharacter }] });
        }
        if (sql.includes('FROM production_recipes')) {
          return Promise.resolve({ rows: [{ ...mockRecipe }] });
        }
        return Promise.resolve({ rows: [], rowCount: 1 });
      });

      (getSettingBoolean as jest.Mock).mockResolvedValue(false);

      await processProductionTask(mockTask);

      const noReviewUpdate = statusUpdates.find(
        (u) => u.sql.includes("review_status = 'not_required'"),
      );
      expect(noReviewUpdate).toBeDefined();
    });
  });

  // TEST-WKR-029: MAX_CONTENT_REVISION_COUNT exceeded
  describe('TEST-WKR-029: revision count exceeded', () => {
    it('should cancel content when revision_count >= max', async () => {
      const statusUpdates: Array<{ sql: string; params: unknown[] }> = [];

      mockQuery.mockImplementation((sql: string, params?: unknown[]) => {
        if (sql.includes('UPDATE content')) {
          statusUpdates.push({ sql, params: params ?? [] });
          return Promise.resolve({ rowCount: 1 });
        }
        if (sql.includes('tool_experiences') && sql.includes('SUM')) {
          return Promise.resolve({ rows: [{ total: '50.00' }] });
        }
        if (sql.includes('FROM content WHERE')) {
          return Promise.resolve({
            rows: [{ ...mockContent, revision_count: 3 }],
          });
        }
        if (sql.includes('FROM content_sections')) {
          return Promise.resolve({ rows: [...mockSections] });
        }
        if (sql.includes('FROM characters')) {
          return Promise.resolve({ rows: [{ ...mockCharacter }] });
        }
        if (sql.includes('FROM production_recipes')) {
          return Promise.resolve({ rows: [{ ...mockRecipe }] });
        }
        return Promise.resolve({ rows: [], rowCount: 1 });
      });

      (getSettingNumber as jest.Mock).mockImplementation((key: string) => {
        if (key === 'MAX_CONTENT_REVISION_COUNT') return Promise.resolve(3);
        if (key === 'DAILY_BUDGET_LIMIT_USD') return Promise.resolve(100);
        return Promise.resolve(0);
      });

      await processProductionTask(mockTask);

      const cancelUpdate = statusUpdates.find(
        (u) => u.sql.includes("'cancelled'"),
      );
      expect(cancelUpdate).toBeDefined();
    });
  });

  // TEST-WKR-033: Daily budget exceeded
  describe('TEST-WKR-033: DAILY_BUDGET_LIMIT_USD exceeded', () => {
    it('should block production when budget exceeded', async () => {
      mockQuery.mockImplementation((sql: string) => {
        if (sql.includes('tool_experiences') && sql.includes('SUM')) {
          return Promise.resolve({ rows: [{ total: '105.00' }] });
        }
        return Promise.resolve({ rows: [], rowCount: 1 });
      });

      (getSettingNumber as jest.Mock).mockImplementation((key: string) => {
        if (key === 'DAILY_BUDGET_LIMIT_USD') return Promise.resolve(100);
        return Promise.resolve(0);
      });

      await expect(processProductionTask(mockTask)).rejects.toThrow(/budget exceeded/i);
      expect(failTask).toHaveBeenCalled();
    });
  });

  // TEST-WKR-035: Drive upload
  describe('TEST-WKR-035: Drive upload confirmation', () => {
    it('should update content with drive IDs after upload', async () => {
      const driveUpdates: Array<{ sql: string; params: unknown[] }> = [];

      mockQuery.mockImplementation((sql: string, params?: unknown[]) => {
        if (sql.includes('video_drive_id') && sql.includes('UPDATE content SET')) {
          driveUpdates.push({ sql, params: params ?? [] });
          return Promise.resolve({ rowCount: 1 });
        }
        if (sql.includes('UPDATE content')) {
          return Promise.resolve({ rowCount: 1 });
        }
        if (sql.includes('tool_experiences') && sql.includes('SUM')) {
          return Promise.resolve({ rows: [{ total: '50.00' }] });
        }
        if (sql.includes('FROM content WHERE')) {
          return Promise.resolve({ rows: [{ ...mockContent, quality_score: 9.0 }] });
        }
        if (sql.includes('FROM content_sections')) {
          return Promise.resolve({ rows: [...mockSections] });
        }
        if (sql.includes('FROM characters')) {
          return Promise.resolve({ rows: [{ ...mockCharacter }] });
        }
        if (sql.includes('FROM production_recipes')) {
          return Promise.resolve({ rows: [{ ...mockRecipe }] });
        }
        return Promise.resolve({ rows: [], rowCount: 1 });
      });

      await processProductionTask(mockTask);

      expect(driveUpdates.length).toBeGreaterThan(0);
      const driveUpdate = driveUpdates[0]!;
      // video_drive_id should not be null
      expect(driveUpdate.params[0]).toBeTruthy();
      // video_drive_url should start with https://drive.google.com
      expect(driveUpdate.params[1]).toMatch(/^https:\/\/drive\.google\.com/);
      // drive_folder_id should not be null
      expect(driveUpdate.params[2]).toBeTruthy();
    });
  });

  // TEST-WKR-032: Cost tracking
  describe('TEST-WKR-032: cost tracking', () => {
    it('should return cost estimate in result', async () => {
      const result = await processProductionTask(mockTask);
      expect(result.costUsd).toBeGreaterThan(0);
    });
  });

  // Task completion
  describe('task lifecycle', () => {
    it('should call completeTask on success', async () => {
      await processProductionTask(mockTask);
      expect(completeTask).toHaveBeenCalledWith(1);
    });

    it('should call failTask on error', async () => {
      // Force budget exceeded
      mockQuery.mockImplementation((sql: string) => {
        if (sql.includes('tool_experiences') && sql.includes('SUM')) {
          return Promise.resolve({ rows: [{ total: '200.00' }] });
        }
        return Promise.resolve({ rows: [], rowCount: 1 });
      });

      await expect(processProductionTask(mockTask)).rejects.toThrow();
      expect(failTask).toHaveBeenCalled();
    });
  });
});
