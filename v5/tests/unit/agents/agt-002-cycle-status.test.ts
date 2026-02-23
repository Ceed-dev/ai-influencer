/**
 * TEST-AGT-002: 戦略サイクルグラフ — cycles テーブル更新
 * Spec: 12-test-specifications.md TEST-AGT-002
 *
 * Verifies: After a full graph run, cycles.status = 'completed'
 * Pass: Latest cycle status = 'completed'
 * Fail: Status remains 'planning' or 'executing'
 */
import {
  createCycle,
  updateCycleStatus,
  getCycleStatus,
  updateCycleSummary,
  type CycleStatus,
} from '../../../src/agents/nodes/cycle-status';

// Mock the pool module
jest.mock('../../../src/db/pool', () => {
  // In-memory cycles table
  let cycles: Array<{
    id: number;
    cycle_number: number;
    started_at: string;
    ended_at: string | null;
    status: string;
    summary: Record<string, unknown> | null;
  }> = [];
  let nextId = 1;

  const mockQuery = jest.fn(async (sql: string, params?: unknown[]) => {
    // CREATE cycle
    if (sql.includes('INSERT INTO cycles')) {
      const maxNum = cycles.length > 0 ? Math.max(...cycles.map(c => c.cycle_number)) : 0;
      const newCycle = {
        id: nextId++,
        cycle_number: maxNum + 1,
        started_at: new Date().toISOString(),
        ended_at: null,
        status: 'planning',
        summary: null,
      };
      cycles.push(newCycle);
      return { rows: [{ id: newCycle.id, cycle_number: newCycle.cycle_number }] };
    }

    // UPDATE status
    if (sql.includes('UPDATE cycles SET') && sql.includes('status')) {
      const cycleId = params?.[0] as number;
      const cycle = cycles.find(c => c.id === cycleId);
      if (cycle) {
        // Extract status from SQL
        const statusMatch = sql.match(/status = '(\w+)'/);
        if (statusMatch?.[1]) {
          cycle.status = statusMatch[1];
        }
        if (sql.includes('ended_at = NOW()')) {
          cycle.ended_at = new Date().toISOString();
        }
      }
      return { rows: [] };
    }

    // UPDATE summary
    if (sql.includes('UPDATE cycles SET summary')) {
      const summaryStr = params?.[0] as string;
      const cycleId = params?.[1] as number;
      const cycle = cycles.find(c => c.id === cycleId);
      if (cycle) {
        cycle.summary = JSON.parse(summaryStr);
      }
      return { rows: [] };
    }

    // SELECT status
    if (sql.includes('SELECT status FROM cycles')) {
      const cycleId = params?.[0] as number;
      const cycle = cycles.find(c => c.id === cycleId);
      return { rows: cycle ? [{ status: cycle.status }] : [] };
    }

    return { rows: [] };
  });

  return {
    getPool: () => ({ query: mockQuery }),
    createPool: jest.fn(),
    closePool: jest.fn(),
    // Expose for test cleanup
    __reset: () => { cycles = []; nextId = 1; },
    __getCycles: () => cycles,
  };
});

const poolModule = require('../../../src/db/pool');

describe('TEST-AGT-002: Strategy Cycle Graph — cycles table update', () => {
  beforeEach(() => {
    poolModule.__reset();
  });

  it('should create a new cycle with status=planning', async () => {
    const { id, cycle_number } = await createCycle();
    expect(id).toBe(1);
    expect(cycle_number).toBe(1);

    const status = await getCycleStatus(id);
    expect(status).toBe('planning');
  });

  it('should transition to completed after full cycle', async () => {
    const { id } = await createCycle();

    // Simulate full cycle status transitions
    await updateCycleStatus(id, 'executing');
    expect(await getCycleStatus(id)).toBe('executing');

    await updateCycleStatus(id, 'measuring');
    expect(await getCycleStatus(id)).toBe('measuring');

    await updateCycleStatus(id, 'analyzing');
    expect(await getCycleStatus(id)).toBe('analyzing');

    await updateCycleStatus(id, 'completed');
    const finalStatus = await getCycleStatus(id);
    expect(finalStatus).toBe('completed');
  });

  it('should set ended_at when transitioning to completed', async () => {
    const { id } = await createCycle();
    await updateCycleStatus(id, 'completed');

    const cycles = poolModule.__getCycles();
    const cycle = cycles.find((c: { id: number }) => c.id === id);
    expect(cycle.ended_at).toBeTruthy();
  });

  it('should increment cycle_number for successive cycles', async () => {
    const first = await createCycle();
    const second = await createCycle();
    expect(second.cycle_number).toBe(first.cycle_number + 1);
  });

  it('should update cycle summary', async () => {
    const { id } = await createCycle();
    const summary = {
      contents_planned: 15,
      hypotheses_generated: 3,
      key_decisions: ['Test decision'],
    };
    await updateCycleSummary(id, summary);

    const cycles = poolModule.__getCycles();
    const cycle = cycles.find((c: { id: number }) => c.id === id);
    expect(cycle.summary).toEqual(summary);
  });

  it('should return null for non-existent cycle', async () => {
    const status = await getCycleStatus(999);
    expect(status).toBeNull();
  });
});
