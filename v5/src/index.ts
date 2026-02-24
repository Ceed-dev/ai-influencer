/**
 * v5.0 AI-Influencer — Main Entry Point
 * Spec: 02-architecture.md §3.4, 04-agent-design.md §5.5
 *
 * Each LangGraph graph runs as an independent process.
 * This entry point starts the specified service(s).
 *
 * Usage:
 *   tsx src/index.ts [service]
 *
 * Services:
 *   mcp         — Start MCP Server (stdio transport)
 *   strategy    — Start Strategy Cycle Graph (daily cron)
 *   production  — Start Production Pipeline Graph (continuous)
 *   publishing  — Start Publishing Scheduler Graph (continuous)
 *   measurement — Start Measurement Job Graph (continuous)
 *   batch       — Start Batch Job Orchestrator (algorithm schedules)
 *   health      — Run health check and exit
 *   all         — Start all continuous services (default)
 */
import { healthCheck, closePool, getPool } from './db/pool.js';
import { closeSettingsPool } from './lib/settings.js';
import { closeMcpClient } from './agents/common/mcp-client.js';

const SERVICE = process.argv[2] || 'health';

// Global error handlers — catch unhandled rejections and uncaught exceptions
process.on('unhandledRejection', (reason, promise) => {
  console.error('[process] Unhandled Promise Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[process] Uncaught Exception:', error);
  process.exit(1);
});

async function startMcp(): Promise<void> {
  const { startMcpServer } = await import('./mcp-server/index.js');
  await startMcpServer();
}

async function startStrategy(): Promise<void> {
  const { compileStrategyCycleGraph } = await import('./agents/graphs/strategy-cycle.js');
  const graph = compileStrategyCycleGraph();
  console.log('[strategy] Strategy Cycle Graph compiled. Awaiting cron trigger...');
  // In production, this would be triggered by a cron job.
  // For now, we keep the process alive.
  await new Promise(() => {}); // Keep alive
  void graph; // Reference to prevent unused warning
}

async function startProduction(): Promise<void> {
  const { createProductionPipelineGraph } = await import('./agents/graphs/production-pipeline.js');
  const graph = createProductionPipelineGraph();
  console.log('[production] Production Pipeline Graph started. Polling for tasks...');
  // The graph's poll_tasks node will continuously poll task_queue
  try {
    await graph.invoke(
      {},
      { configurable: { thread_id: 'production-main' } },
    );
  } catch (err) {
    console.error('[production] Graph exited:', err);
  }
}

async function startPublishing(): Promise<void> {
  const { createPublishingSchedulerGraph } = await import('./agents/graphs/publishing-scheduler.js');
  const graph = createPublishingSchedulerGraph();
  console.log('[publishing] Publishing Scheduler Graph started. Polling for tasks...');
  try {
    await graph.invoke(
      {},
      { configurable: { thread_id: 'publishing-main' } },
    );
  } catch (err) {
    console.error('[publishing] Graph exited:', err);
  }
}

async function startMeasurement(): Promise<void> {
  const { createMeasurementJobGraph } = await import('./agents/graphs/measurement-job.js');
  const graph = createMeasurementJobGraph();
  console.log('[measurement] Measurement Job Graph started. Polling for targets...');
  try {
    await graph.invoke(
      {},
      { configurable: { thread_id: 'measurement-main' } },
    );
  } catch (err) {
    console.error('[measurement] Graph exited:', err);
  }
}

async function startBatch(): Promise<void> {
  const { startBatchOrchestrator } = await import('./workers/batch-orchestrator.js');
  startBatchOrchestrator();
  console.log('[batch] Batch Job Orchestrator running. Checking schedules every minute.');
  await new Promise(() => {}); // Keep alive
}

async function runHealthCheck(): Promise<void> {
  console.log('=== v5.0 AI-Influencer Health Check ===\n');

  // DB health
  const dbResult = await healthCheck();
  if (dbResult.healthy) {
    console.log(`[OK] Database: healthy (${dbResult.latencyMs}ms)`);
  } else {
    console.error(`[FAIL] Database: ${dbResult.error}`);
    process.exitCode = 1;
  }

  // Table count
  const pool = getPool();
  const tableRes = await pool.query(
    "SELECT COUNT(*) as cnt FROM information_schema.tables WHERE table_schema = 'public'",
  );
  const tableCount = Number(tableRes.rows[0]?.['cnt'] ?? 0);
  console.log(`[INFO] Tables: ${tableCount} (expected: 33)`);

  // Settings count
  const settingsRes = await pool.query('SELECT COUNT(*) as cnt FROM system_settings');
  const settingsCount = Number(settingsRes.rows[0]?.['cnt'] ?? 0);
  console.log(`[INFO] System settings: ${settingsCount} (expected: 124)`);

  // pgvector
  const vecRes = await pool.query(
    "SELECT 1 FROM pg_extension WHERE extname = 'vector'",
  );
  if (vecRes.rows.length > 0) {
    console.log('[OK] pgvector: enabled');
  } else {
    console.error('[WARN] pgvector: not enabled');
  }

  console.log('\n=== Health Check Complete ===');
}

async function startAll(): Promise<void> {
  console.log('=== v5.0 AI-Influencer — Starting All Services ===\n');

  // Run health check first
  await runHealthCheck();
  console.log('');

  // Start batch orchestrator with error handling
  try {
    const { startBatchOrchestrator } = await import('./workers/batch-orchestrator.js');
    startBatchOrchestrator();
    console.log('[main] Batch orchestrator started successfully.');
  } catch (err) {
    console.error('[main] Failed to start batch orchestrator:', err);
  }

  // Start continuous services in parallel
  const services = [
    startProduction().catch((err) => console.error('[production] Fatal:', err)),
    startPublishing().catch((err) => console.error('[publishing] Fatal:', err)),
    startMeasurement().catch((err) => console.error('[measurement] Fatal:', err)),
  ];

  console.log('[main] All continuous services started (including batch orchestrator).');
  console.log('[main] Strategy Cycle runs via daily cron (not started in "all" mode).');
  console.log('[main] MCP Server runs via stdio (not started in "all" mode).\n');

  await Promise.all(services);
}

// Graceful shutdown
async function shutdown(signal: string): Promise<void> {
  console.log(`\n[shutdown] Received ${signal}. Shutting down gracefully...`);
  try {
    const { stopBatchOrchestrator } = await import('./workers/batch-orchestrator.js');
    stopBatchOrchestrator();
  } catch {
    // Batch orchestrator may not be loaded
  }
  await closeMcpClient();
  await closePool();
  await closeSettingsPool();
  console.log('[shutdown] Pools and MCP client closed. Exiting.');
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

// Main
(async () => {
  try {
    switch (SERVICE) {
      case 'mcp':
        await startMcp();
        break;
      case 'strategy':
        await startStrategy();
        break;
      case 'production':
        await startProduction();
        break;
      case 'publishing':
        await startPublishing();
        break;
      case 'measurement':
        await startMeasurement();
        break;
      case 'batch':
        await startBatch();
        break;
      case 'health':
        await runHealthCheck();
        await closePool();
        await closeSettingsPool();
        break;
      case 'all':
        await startAll();
        break;
      default:
        console.error(`Unknown service: ${SERVICE}`);
        console.error('Usage: tsx src/index.ts [mcp|strategy|production|publishing|measurement|batch|health|all]');
        process.exitCode = 1;
    }
  } catch (err) {
    console.error('[fatal]', err);
    process.exitCode = 1;
  }
})();
