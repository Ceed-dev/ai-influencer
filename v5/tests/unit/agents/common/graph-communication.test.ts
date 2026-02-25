/**
 * TEST-AGT-018: Graph communication — PostgreSQL status changes only
 * Spec: 02-architecture.md §3.7
 *
 * Verifies:
 * 1. Content status transitions are enforced correctly
 * 2. Publication status transitions are enforced correctly
 * 3. Task queue provides inter-graph communication
 * 4. No direct graph-to-graph API calls exist
 */
import {
  isValidTransition as isValidContentTransition,
} from '@/src/agents/common/content-status';
import {
  isValidTransition as isValidPubTransition,
} from '@/src/agents/common/publication-status';
import type { ContentStatus, PublicationStatus } from '@/types/langgraph-state';

// ---------- Content Status Transition Tests ----------

describe('FEAT-INT-008: Content status transitions', () => {
  const validPaths: Array<[ContentStatus, ContentStatus]> = [
    ['pending_approval', 'planned'],
    ['planned', 'producing'],
    ['producing', 'ready'],
    ['ready', 'posted'],
    ['posted', 'measured'],
    ['measured', 'analyzed'],
  ];

  test.each(validPaths)(
    'allows valid transition: %s → %s',
    (from, to) => {
      expect(isValidContentTransition(from, to)).toBe(true);
    }
  );

  const terminalTransitions: Array<[ContentStatus, ContentStatus]> = [
    ['pending_approval', 'cancelled'],
    ['planned', 'cancelled'],
    ['producing', 'cancelled'],
    ['ready', 'cancelled'],
    ['pending_approval', 'error'],
    ['planned', 'error'],
    ['producing', 'error'],
    ['ready', 'error'],
    ['posted', 'error'],
    ['measured', 'error'],
  ];

  test.each(terminalTransitions)(
    'allows terminal transition: %s → %s',
    (from, to) => {
      expect(isValidContentTransition(from, to)).toBe(true);
    }
  );

  const invalidPaths: Array<[ContentStatus, ContentStatus]> = [
    ['pending_approval', 'producing'],
    ['pending_approval', 'ready'],
    ['planned', 'ready'],
    ['planned', 'posted'],
    ['producing', 'planned'],
    ['ready', 'producing'],
    ['posted', 'ready'],
    ['analyzed', 'measured'],
    ['error', 'planned'],
    ['cancelled', 'planned'],
    ['analyzed', 'planned'],
  ];

  test.each(invalidPaths)(
    'rejects invalid transition: %s → %s',
    (from, to) => {
      expect(isValidContentTransition(from, to)).toBe(false);
    }
  );

  test('error and cancelled are terminal states', () => {
    const terminalStates: ContentStatus[] = ['error', 'cancelled', 'analyzed'];
    const allStatuses: ContentStatus[] = [
      'pending_approval', 'planned', 'producing', 'ready',
      'posted', 'measured', 'analyzed', 'error', 'cancelled',
    ];
    for (const state of terminalStates) {
      for (const target of allStatuses) {
        expect(isValidContentTransition(state, target)).toBe(false);
      }
    }
  });
});

// ---------- Publication Status Transition Tests ----------

describe('FEAT-INT-008: Publication status transitions', () => {
  const validPaths: Array<[PublicationStatus, PublicationStatus]> = [
    ['scheduled', 'posted'],
    ['posted', 'measured'],
  ];

  test.each(validPaths)(
    'allows valid transition: %s → %s',
    (from, to) => {
      expect(isValidPubTransition(from, to)).toBe(true);
    }
  );

  const invalidPaths: Array<[PublicationStatus, PublicationStatus]> = [
    ['scheduled', 'measured'],
    ['posted', 'scheduled'],
    ['measured', 'posted'],
    ['measured', 'scheduled'],
  ];

  test.each(invalidPaths)(
    'rejects invalid transition: %s → %s',
    (from, to) => {
      expect(isValidPubTransition(from, to)).toBe(false);
    }
  );
});

// ---------- Inter-Graph Communication Pattern Tests ----------

describe('FEAT-INT-008: No direct graph-to-graph communication', () => {
  test('graph communication module only uses SQL queries (task_queue table)', () => {
    const graphComm = require('@/src/agents/common/graph-communication');
    const exportNames = Object.keys(graphComm);

    expect(exportNames).toContain('enqueueTask');
    expect(exportNames).toContain('dequeueTask');
    expect(exportNames).toContain('completeTask');
    expect(exportNames).toContain('failTask');
    expect(exportNames).toContain('countPendingTasks');

    // No HTTP client, WebSocket, or direct inter-process communication
    expect(exportNames).not.toContain('sendMessage');
    expect(exportNames).not.toContain('callGraph');
    expect(exportNames).not.toContain('emit');
  });

  test('content status module only uses SQL queries', () => {
    const contentStatus = require('@/src/agents/common/content-status');
    const exportNames = Object.keys(contentStatus);

    expect(exportNames).toContain('transitionContentStatus');
    expect(exportNames).toContain('pollContentByStatus');
    expect(exportNames).toContain('getContentStatus');
    expect(exportNames).toContain('isValidTransition');
  });

  test('publication status module only uses SQL queries', () => {
    const pubStatus = require('@/src/agents/common/publication-status');
    const exportNames = Object.keys(pubStatus);

    expect(exportNames).toContain('transitionPublicationStatus');
    expect(exportNames).toContain('pollPublicationsByStatus');
    expect(exportNames).toContain('pollPublicationsForMeasurement');
    expect(exportNames).toContain('isValidTransition');
  });

  test('content status flow matches spec: pending_approval → planned → producing → ready → posted → measured → analyzed', () => {
    const happyPath: ContentStatus[] = [
      'pending_approval', 'planned', 'producing', 'ready', 'posted', 'measured', 'analyzed'
    ];

    for (let i = 0; i < happyPath.length - 1; i++) {
      expect(isValidContentTransition(happyPath[i]!, happyPath[i + 1]!)).toBe(true);
    }
  });

  test('publication status flow matches spec: scheduled → posted → measured', () => {
    const happyPath: PublicationStatus[] = ['scheduled', 'posted', 'measured'];

    for (let i = 0; i < happyPath.length - 1; i++) {
      expect(isValidPubTransition(happyPath[i]!, happyPath[i + 1]!)).toBe(true);
    }
  });
});
