#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const config = require('../digest/config');
const { fetchDayConversation } = require('../digest/slack-client');
const { formatForSummarizer, composeMarkdown, composeNoActivity, formatConversationLog } = require('../digest/formatter');
const { summarize } = require('../digest/summarizer');

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

// ── Date helpers ──

/**
 * Get yesterday's date string in JST (YYYY-MM-DD).
 */
function getYesterdayJST() {
  const now = new Date(Date.now() + JST_OFFSET_MS);
  const yesterday = new Date(now);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  return yesterday.toISOString().slice(0, 10);
}

/**
 * Get JST day boundaries as Unix timestamps (seconds).
 * @param {string} dateStr - YYYY-MM-DD (JST date)
 * @returns {{ oldest: string, latest: string }}
 */
function getJSTDayBounds(dateStr) {
  // dateStr is JST date — midnight JST = 15:00 UTC previous day
  const [y, m, d] = dateStr.split('-').map(Number);
  const midnightJST = Date.UTC(y, m - 1, d, 0, 0, 0) - JST_OFFSET_MS;
  const nextMidnightJST = midnightJST + 24 * 60 * 60 * 1000;
  return {
    oldest: String(midnightJST / 1000),
    latest: String(nextMidnightJST / 1000),
  };
}

/**
 * Generate date strings from startDate to endDate inclusive.
 */
function generateDateRange(startDate, endDate) {
  const dates = [];
  const [sy, sm, sd] = startDate.split('-').map(Number);
  const [ey, em, ed] = endDate.split('-').map(Number);
  const start = new Date(Date.UTC(sy, sm - 1, sd));
  const end = new Date(Date.UTC(ey, em - 1, ed));

  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

// ── CLI ──

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    date: null,
    from: null,
    to: null,
    dryRun: false,
    force: false,
  };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--date' && args[i + 1]) opts.date = args[++i];
    if (args[i] === '--from' && args[i + 1]) opts.from = args[++i];
    if (args[i] === '--to' && args[i + 1]) opts.to = args[++i];
    if (args[i] === '--dry-run') opts.dryRun = true;
    if (args[i] === '--force') opts.force = true;
    if (args[i] === '--help' || args[i] === '-h') {
      showUsage();
      process.exit(0);
    }
  }
  return opts;
}

function showUsage() {
  console.log(`Usage:
  node scripts/generate-digest.js                       前日 (JST) の要約を生成
  node scripts/generate-digest.js --date 2026-02-16     指定日の要約を生成
  node scripts/generate-digest.js --from 2026-02-01     指定日から昨日までバックフィル
  node scripts/generate-digest.js --from 2026-02-01 --to 2026-02-15   範囲指定バックフィル
  node scripts/generate-digest.js --dry-run             stdout に出力 (ファイル書込みなし)
  node scripts/generate-digest.js --force               既存ファイルを上書き

Options:
  --date <YYYY-MM-DD>    Target date (JST)
  --from <YYYY-MM-DD>    Backfill start date
  --to   <YYYY-MM-DD>    Backfill end date (default: yesterday JST)
  --dry-run              Print to stdout, don't write files
  --force                Overwrite existing digest files
  --help, -h             Show this help message
`);
}

/**
 * Get the output file path for a given date.
 */
function getOutputPath(dateStr) {
  const [year, month] = dateStr.split('-');
  return path.join(config.output.baseDir, year, month, `${dateStr}.md`);
}

/**
 * Generate digest for a single day.
 * @returns {Promise<{dateStr, status, filePath?}>}
 */
async function generateSingleDay(dateStr, opts) {
  const channelName = config.slack.channelName;
  const outputPath = getOutputPath(dateStr);

  // Check existing file
  if (!opts.force && !opts.dryRun && fs.existsSync(outputPath)) {
    console.log(`[digest] ${dateStr}: skipped (file exists, use --force to overwrite)`);
    return { dateStr, status: 'skipped' };
  }

  console.log(`[digest] ${dateStr}: fetching messages from #${channelName}...`);

  const { oldest, latest } = getJSTDayBounds(dateStr);
  const { messages, threadReplies, continuedThreads, users, stats, channelId } = await fetchDayConversation(
    channelName,
    oldest,
    latest
  );

  // No messages and no continued threads → minimal file
  if (messages.length === 0 && continuedThreads.size === 0) {
    const md = composeNoActivity(dateStr, channelName);
    if (opts.dryRun) {
      console.log(md);
    } else {
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, md, 'utf8');
      console.log(`[digest] ${dateStr}: 活動なし → ${outputPath}`);
    }
    return { dateStr, status: 'no_activity', filePath: outputPath };
  }

  const contInfo = stats.continuedThreadCount > 0 ? `, continued threads: ${stats.continuedThreadCount} (${stats.continuedReplyCount} replies)` : '';
  console.log(`[digest] ${dateStr}: ${stats.messageCount} messages, ${stats.threadCount} threads, ${stats.participantCount} participants${contInfo}`);

  // Format for summarizer
  const formattedText = formatForSummarizer(messages, threadReplies, users, continuedThreads);

  // AI summarize
  console.log(`[digest] ${dateStr}: generating AI summary...`);
  const summary = await summarize(formattedText, dateStr);

  // Format conversation log for raw section
  const conversationLog = formatConversationLog(messages, threadReplies, users, channelId, continuedThreads);

  // Compose final markdown
  const md = composeMarkdown(dateStr, summary, conversationLog, stats, channelName);

  if (opts.dryRun) {
    console.log(md);
  } else {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, md, 'utf8');
    console.log(`[digest] ${dateStr}: done → ${outputPath}`);
  }

  return { dateStr, status: 'generated', filePath: outputPath };
}

// ── Main ──

async function main() {
  const opts = parseArgs();

  // Determine dates to process
  let dates;
  if (opts.from) {
    const endDate = opts.to || getYesterdayJST();
    dates = generateDateRange(opts.from, endDate);
    console.log(`[digest] Backfill mode: ${opts.from} → ${endDate} (${dates.length} days)`);
  } else {
    const targetDate = opts.date || getYesterdayJST();
    dates = [targetDate];
  }

  const results = [];
  const failures = [];

  for (let i = 0; i < dates.length; i++) {
    const dateStr = dates[i];
    if (dates.length > 1) {
      console.log(`\n[digest] ${i + 1}/${dates.length}: ${dateStr} ...`);
    }

    try {
      const result = await generateSingleDay(dateStr, opts);
      results.push(result);
    } catch (err) {
      console.error(`[digest] ${dateStr}: ERROR — ${err.message}`);
      failures.push({ dateStr, error: err.message });
      // Continue to next day in backfill mode
      if (dates.length === 1) throw err;
    }

    // Rate limit pause between days (skip for last day)
    if (dates.length > 1 && i < dates.length - 1) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  // Summary
  if (dates.length > 1) {
    const generated = results.filter((r) => r.status === 'generated').length;
    const noActivity = results.filter((r) => r.status === 'no_activity').length;
    const skipped = results.filter((r) => r.status === 'skipped').length;
    console.log(`\n[digest] === Backfill Summary ===`);
    console.log(`[digest] Generated: ${generated}, No activity: ${noActivity}, Skipped: ${skipped}, Failed: ${failures.length}`);
    if (failures.length > 0) {
      console.log('[digest] Failed dates:');
      for (const f of failures) {
        console.log(`  ${f.dateStr}: ${f.error}`);
      }
    }
  }

  if (failures.length > 0 && dates.length > 1) {
    process.exit(1);
  }
}

// Only run main when executed directly (not when required by tests)
if (require.main === module) {
  main().catch((err) => {
    console.error('[digest] Fatal error:', err.message);
    process.exit(1);
  });
}

module.exports = { getYesterdayJST, getJSTDayBounds, generateDateRange, getOutputPath, parseArgs };
