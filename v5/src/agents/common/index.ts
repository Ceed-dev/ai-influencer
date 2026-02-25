/**
 * Common agent utilities — graph communication via PostgreSQL only.
 * Spec: 02-architecture.md §3.7
 */
export {
  isValidTransition as isValidContentTransition,
  transitionContentStatus,
  pollContentByStatus,
  getContentStatus,
} from './content-status';

export {
  isValidTransition as isValidPublicationTransition,
  transitionPublicationStatus,
  pollPublicationsByStatus,
  pollPublicationsForMeasurement,
} from './publication-status';

export {
  enqueueTask,
  dequeueTask,
  completeTask,
  failTask,
  countPendingTasks,
  type TaskQueueEntry,
} from './graph-communication';

export {
  getMcpTools,
  callMcpTool,
  closeMcpClient,
  getMcpClient,
} from './mcp-client';
