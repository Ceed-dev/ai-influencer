/**
 * FEAT-STR-010: Parallel planning configuration
 * Spec: 04-agent-design.md §5.1, 02-architecture.md §3.3
 *
 * Configures parallel planner instances that work on different clusters simultaneously.
 * Each planner handles a subset of accounts grouped by cluster.
 * PARALLEL_PLANNER_COUNT from system_settings determines the number of instances.
 * All config from DB system_settings — no hardcoding.
 */
import type { PoolClient } from 'pg';
import { getSettingNumber } from '../../lib/settings.js';

/** Planner instance configuration */
export interface PlannerInstance {
  instanceId: number;
  cluster: string;
  accountIds: string[];
  accountCount: number;
}

/** Parallel planning configuration */
export interface ParallelPlanningConfig {
  plannerCount: number;
  instances: PlannerInstance[];
  totalAccounts: number;
}

/**
 * Distribute accounts across planner instances by cluster.
 * Each cluster gets its own planner instance.
 */
export function distributeAccountsToPlanners(
  accounts: Array<{ accountId: string; cluster: string }>,
  maxPlanners: number,
): PlannerInstance[] {
  // Group by cluster
  const clusters: Record<string, string[]> = {};
  for (const account of accounts) {
    const cluster = account.cluster || 'default';
    if (!clusters[cluster]) {
      clusters[cluster] = [];
    }
    clusters[cluster]!.push(account.accountId);
  }

  const clusterNames = Object.keys(clusters);

  // If we have fewer clusters than max planners, one planner per cluster
  if (clusterNames.length <= maxPlanners) {
    return clusterNames.map((cluster, idx) => ({
      instanceId: idx + 1,
      cluster,
      accountIds: clusters[cluster]!,
      accountCount: clusters[cluster]!.length,
    }));
  }

  // More clusters than planners: merge smaller clusters together
  const sorted = clusterNames
    .map((c) => ({ cluster: c, count: clusters[c]!.length }))
    .sort((a, b) => b.count - a.count);

  const instances: PlannerInstance[] = [];
  for (let i = 0; i < maxPlanners; i++) {
    instances.push({
      instanceId: i + 1,
      cluster: '',
      accountIds: [],
      accountCount: 0,
    });
  }

  // Round-robin assignment of clusters to planners
  for (let i = 0; i < sorted.length; i++) {
    const target = instances[i % maxPlanners]!;
    const clusterAccounts = clusters[sorted[i]!.cluster]!;
    target.accountIds.push(...clusterAccounts);
    target.accountCount = target.accountIds.length;
    target.cluster = target.cluster
      ? `${target.cluster},${sorted[i]!.cluster}`
      : sorted[i]!.cluster;
  }

  return instances.filter((i) => i.accountCount > 0);
}

/**
 * Get parallel planning configuration from DB.
 *
 * @param client - Database client
 * @returns Planning config with planner instances
 */
export async function getParallelPlanningConfig(
  client: PoolClient,
): Promise<ParallelPlanningConfig> {
  const maxPlanners = await getSettingNumber('PARALLEL_PLANNER_COUNT', client);

  // Get active accounts grouped by cluster
  const res = await client.query(
    `SELECT account_id, COALESCE(cluster, 'default') AS cluster
     FROM accounts
     WHERE status = 'active'
     ORDER BY cluster, account_id`,
  );

  const accounts = res.rows.map((r) => {
    const row = r as Record<string, unknown>;
    return {
      accountId: row['account_id'] as string,
      cluster: row['cluster'] as string,
    };
  });

  const instances = distributeAccountsToPlanners(accounts, maxPlanners);

  return {
    plannerCount: instances.length,
    instances,
    totalAccounts: accounts.length,
  };
}
