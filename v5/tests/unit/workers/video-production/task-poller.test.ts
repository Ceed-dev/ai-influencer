/**
 * Tests: TEST-WKR-001, TEST-WKR-002, TEST-WKR-019, TEST-WKR-020, TEST-WKR-023, TEST-WKR-040
 */
const mockQuery = jest.fn();
const mockConnect = jest.fn();
const mockRelease = jest.fn();
jest.mock('../../../../src/db/pool', () => ({ getPool: () => ({ query: mockQuery, connect: mockConnect }), closePool: jest.fn() }));
jest.mock('../../../../src/lib/settings', () => ({ getSetting: jest.fn(), getSettingNumber: jest.fn(), getSettingBoolean: jest.fn(), getSettingString: jest.fn() }));

import { acquireNextTask, getActiveTaskCount, loadPollerSettings, pollOnce, completeTask, failTask } from '../../../../src/workers/video-production/task-poller';
import { getSettingNumber } from '../../../../src/lib/settings';
const mockClient = { query: jest.fn(), release: mockRelease };

beforeEach(() => { jest.clearAllMocks(); mockConnect.mockResolvedValue(mockClient);
  (getSettingNumber as jest.Mock).mockImplementation((k: string) => {
    if (k === 'PRODUCTION_POLL_INTERVAL_SEC') return Promise.resolve(30);
    if (k === 'MAX_CONCURRENT_PRODUCTIONS') return Promise.resolve(5);
    return Promise.reject(new Error('unknown'));
  });
});

describe('Task Queue Polling', () => {
  describe('TEST-WKR-001: empty queue', () => {
    it('returns null when no pending tasks', async () => {
      mockClient.query.mockResolvedValueOnce(undefined).mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce(undefined);
      expect(await acquireNextTask('w1')).toBeNull();
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('TEST-WKR-002: task acquisition', () => {
    it('acquires pending task and sets processing', async () => {
      const task = { id: 1, task_type: 'produce', payload: { content_id: 'CNT_202602_0001' }, status: 'pending', priority: 0, assigned_worker: null, retry_count: 0, max_retries: 3, error_message: null, last_error_at: null, created_at: '2026-02-23T00:00:00Z', started_at: null, completed_at: null };
      mockClient.query.mockResolvedValueOnce(undefined).mockResolvedValueOnce({ rows: [task] }).mockResolvedValueOnce(undefined).mockResolvedValueOnce(undefined);
      const r = await acquireNextTask('w1');
      expect(r).not.toBeNull();
      expect(r!.status).toBe('processing');
      expect(r!.assigned_worker).toBe('w1');
      expect(mockClient.query).toHaveBeenCalledWith(expect.stringContaining("status = 'processing'"), ['w1', 1]);
    });

    it('uses FOR UPDATE SKIP LOCKED', async () => {
      mockClient.query.mockResolvedValueOnce(undefined).mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce(undefined);
      await acquireNextTask('w1');
      expect(mockClient.query.mock.calls[1][0]).toContain('FOR UPDATE SKIP LOCKED');
    });
  });

  describe('TEST-WKR-020: failed_permanent skip', () => {
    it('only selects pending status', async () => {
      mockClient.query.mockResolvedValueOnce(undefined).mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce(undefined);
      await acquireNextTask('w1');
      expect(mockClient.query.mock.calls[1][0]).toContain("status = 'pending'");
    });
  });

  describe('TEST-WKR-023: priority sort', () => {
    it('orders by priority DESC, created_at ASC', async () => {
      mockClient.query.mockResolvedValueOnce(undefined).mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce(undefined);
      await acquireNextTask('w1');
      expect(mockClient.query.mock.calls[1][0]).toContain('ORDER BY priority DESC, created_at ASC');
    });
  });

  describe('TEST-WKR-019: concurrency limit', () => {
    it('returns at_capacity when at limit', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '5' }] });
      expect((await pollOnce('w1')).type).toBe('at_capacity');
    });

    it('allows acquisition under capacity', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '3' }] });
      mockClient.query.mockResolvedValueOnce(undefined).mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce(undefined);
      expect((await pollOnce('w1')).type).toBe('no_task');
    });
  });

  describe('TEST-WKR-040: dynamic settings reload', () => {
    it('reloads settings on each poll', async () => {
      (getSettingNumber as jest.Mock).mockImplementation((k: string) => {
        if (k === 'PRODUCTION_POLL_INTERVAL_SEC') return Promise.resolve(60);
        if (k === 'MAX_CONCURRENT_PRODUCTIONS') return Promise.resolve(10);
        return Promise.reject(new Error('x'));
      });
      const s = await loadPollerSettings();
      expect(s.pollIntervalMs).toBe(60000);
      expect(s.maxConcurrent).toBe(10);
    });

    it('uses defaults when settings missing', async () => {
      (getSettingNumber as jest.Mock).mockRejectedValue(new Error('missing'));
      const s = await loadPollerSettings();
      expect(s.pollIntervalMs).toBe(30000);
      expect(s.maxConcurrent).toBe(5);
    });
  });

  describe('task completion/failure', () => {
    it('completeTask sets completed', async () => {
      mockQuery.mockResolvedValueOnce(undefined);
      await completeTask(1);
      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("status = 'completed'"), [1]);
    });

    it('failTask permanent sets failed_permanent', async () => {
      mockQuery.mockResolvedValueOnce(undefined);
      await failTask(1, 'balance', true);
      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("status = 'failed_permanent'"), [1, 'balance']);
    });

    it('failTask increments retry_count', async () => {
      mockQuery.mockResolvedValueOnce(undefined);
      await failTask(1, 'temp error');
      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('retry_count = retry_count + 1'), [1, 'temp error']);
    });
  });
});
