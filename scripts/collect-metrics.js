#!/usr/bin/env node
'use strict';

// TODO: Phase 3 - Collect platform metrics for posted content
// - Read content_pipeline rows with status=posted
// - For each platform, call the appropriate API to get view counts
// - Update views_48h column and transition status to collected

async function main() {
  console.log('[metrics] Metrics collection not yet implemented (Phase 3)');
  console.log('[metrics] Will collect: YouTube Analytics, TikTok metrics, Instagram Insights');
}

main().catch((err) => {
  console.error('[metrics] Fatal error:', err.message);
  process.exit(1);
});
