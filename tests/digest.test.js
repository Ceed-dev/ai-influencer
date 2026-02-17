'use strict';

// ── Config tests ──

describe('digest/config', () => {
  test('exports required sections', () => {
    const config = require('../digest/config');
    expect(config).toHaveProperty('slack');
    expect(config).toHaveProperty('openai');
    expect(config).toHaveProperty('output');
    expect(config.slack).toHaveProperty('botToken');
    expect(config.slack).toHaveProperty('channelName');
    expect(config.slack).toHaveProperty('workspaceDomain');
    expect(config.openai).toHaveProperty('apiKey');
    expect(config.openai).toHaveProperty('model');
    expect(config.openai).toHaveProperty('maxTokens');
    expect(config.output).toHaveProperty('baseDir');
  });

  test('defaults are correct', () => {
    const config = require('../digest/config');
    expect(config.slack.channelName).toBe('ceed-aiインフルエンサー');
    expect(config.openai.model).toBe('gpt-4o');
    expect(config.openai.maxTokens).toBe(4096);
  });
});

// ── Date helper tests ──

describe('generate-digest date helpers', () => {
  const { getYesterdayJST, getJSTDayBounds, generateDateRange } = require('../scripts/generate-digest');

  test('getYesterdayJST returns YYYY-MM-DD format', () => {
    const result = getYesterdayJST();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('getJSTDayBounds returns correct boundaries', () => {
    // 2026-02-16 JST → midnight JST = 2026-02-15 15:00:00 UTC
    const { oldest, latest } = getJSTDayBounds('2026-02-16');
    const oldestDate = new Date(parseFloat(oldest) * 1000);
    const latestDate = new Date(parseFloat(latest) * 1000);

    // oldest should be 2026-02-15 15:00:00 UTC
    expect(oldestDate.getUTCFullYear()).toBe(2026);
    expect(oldestDate.getUTCMonth()).toBe(1); // Feb = 1
    expect(oldestDate.getUTCDate()).toBe(15);
    expect(oldestDate.getUTCHours()).toBe(15);
    expect(oldestDate.getUTCMinutes()).toBe(0);

    // latest should be 2026-02-16 15:00:00 UTC (24h later)
    expect(latestDate.getUTCDate()).toBe(16);
    expect(latestDate.getUTCHours()).toBe(15);

    // Difference should be exactly 24h
    expect(parseFloat(latest) - parseFloat(oldest)).toBe(86400);
  });

  test('getJSTDayBounds handles month boundaries', () => {
    const { oldest } = getJSTDayBounds('2026-03-01');
    const d = new Date(parseFloat(oldest) * 1000);
    expect(d.getUTCMonth()).toBe(1); // Feb
    expect(d.getUTCDate()).toBe(28);
    expect(d.getUTCHours()).toBe(15);
  });

  test('generateDateRange generates inclusive range', () => {
    const dates = generateDateRange('2026-02-01', '2026-02-05');
    expect(dates).toEqual([
      '2026-02-01',
      '2026-02-02',
      '2026-02-03',
      '2026-02-04',
      '2026-02-05',
    ]);
  });

  test('generateDateRange single day', () => {
    const dates = generateDateRange('2026-02-10', '2026-02-10');
    expect(dates).toEqual(['2026-02-10']);
  });

  test('generateDateRange crosses month boundary', () => {
    const dates = generateDateRange('2026-01-30', '2026-02-02');
    expect(dates).toEqual([
      '2026-01-30',
      '2026-01-31',
      '2026-02-01',
      '2026-02-02',
    ]);
  });
});

// ── Permalink tests ──

describe('slack-client buildPermalink', () => {
  const { buildPermalink } = require('../digest/slack-client');

  beforeEach(() => {
    // Set workspace domain for testing
    const config = require('../digest/config');
    config.slack.workspaceDomain = 'testworkspace';
  });

  test('builds correct permalink from ts', () => {
    const link = buildPermalink('C12345678', '1708012345.123456');
    expect(link).toBe('https://testworkspace.slack.com/archives/C12345678/p1708012345123456');
  });

  test('returns null when workspaceDomain is empty', () => {
    const config = require('../digest/config');
    config.slack.workspaceDomain = '';
    const link = buildPermalink('C12345678', '1708012345.123456');
    expect(link).toBeNull();
  });
});

// ── Formatter tests ──

describe('digest/formatter', () => {
  const { tsToJST, formatTimeJST, formatForSummarizer, composeNoActivity, composeMarkdown } = require('../digest/formatter');

  test('tsToJST converts Unix timestamp to JST', () => {
    // 2026-02-16 00:00:00 UTC = 2026-02-16 09:00:00 JST
    const jst = tsToJST('1771113600');
    expect(jst.getUTCHours()).toBe(9);
  });

  test('formatTimeJST returns HH:MM', () => {
    // 2026-02-16 00:30:00 UTC = 2026-02-16 09:30:00 JST
    const time = formatTimeJST('1771115400');
    expect(time).toBe('09:30');
  });

  test('formatForSummarizer handles empty messages', () => {
    const result = formatForSummarizer([], new Map(), new Map());
    expect(result).toBe('');
  });

  test('formatForSummarizer formats messages with timestamps', () => {
    const messages = [
      { ts: '1771113600', user: 'U001', text: 'Hello' },
      { ts: '1771115400', user: 'U002', text: 'World' },
    ];
    const users = new Map([['U001', 'pochi'], ['U002', 'shungo']]);
    const result = formatForSummarizer(messages, new Map(), users);
    expect(result).toContain('[09:00] pochi: Hello');
    expect(result).toContain('[09:30] shungo: World');
  });

  test('formatForSummarizer includes thread replies', () => {
    const messages = [
      { ts: '1771113600', user: 'U001', text: 'Question?', reply_count: 1 },
    ];
    const threadReplies = new Map([
      ['1771113600', [{ ts: '1771114200', user: 'U002', text: 'Answer!' }]],
    ]);
    const users = new Map([['U001', 'pochi'], ['U002', 'shungo']]);
    const result = formatForSummarizer(messages, threadReplies, users);
    expect(result).toContain('スレッド (1件)');
    expect(result).toContain('shungo: Answer!');
  });

  test('formatForSummarizer includes continued threads from previous days', () => {
    const messages = [
      { ts: '1771113600', user: 'U001', text: 'Today message' },
    ];
    const continuedThreads = new Map([
      ['1770500000', {
        parent: { ts: '1770500000', user: 'U001', text: 'Old thread from days ago' },
        replies: [{ ts: '1771114200', user: 'U002', text: 'New reply today' }],
      }],
    ]);
    const users = new Map([['U001', 'pochi'], ['U002', 'shungo']]);
    const result = formatForSummarizer(messages, new Map(), users, continuedThreads);
    expect(result).toContain('前日以前のスレッドの続き');
    expect(result).toContain('Old thread from days ago');
    expect(result).toContain('本日の返信 (1件)');
    expect(result).toContain('New reply today');
  });

  test('composeNoActivity generates minimal markdown', () => {
    const md = composeNoActivity('2026-02-16', 'test-channel');
    expect(md).toContain('date: 2026-02-16');
    expect(md).toContain('messages: 0');
    expect(md).toContain('活動なし');
    expect(md).toContain('2026年2月16日');
  });

  test('composeMarkdown generates full markdown with frontmatter', () => {
    const stats = { messageCount: 10, threadCount: 3, participantCount: 2 };
    const md = composeMarkdown('2026-02-16', '### テスト要約', 'raw log here', stats, 'test-channel');
    expect(md).toContain('date: 2026-02-16');
    expect(md).toContain('messages: 10');
    expect(md).toContain('threads: 3');
    expect(md).toContain('participants: 2');
    expect(md).toContain('# Slack日報: 2026年2月16日 (test-channel)');
    expect(md).toContain('## サマリー');
    expect(md).toContain('### テスト要約');
    expect(md).toContain('<details>');
    expect(md).toContain('raw log here');
  });
});

// ── Summarizer tests ──

describe('digest/summarizer', () => {
  const { SYSTEM_PROMPT, splitIntoChunks, CHUNK_CHAR_LIMIT } = require('../digest/summarizer');

  test('SYSTEM_PROMPT is a non-empty string', () => {
    expect(typeof SYSTEM_PROMPT).toBe('string');
    expect(SYSTEM_PROMPT.length).toBeGreaterThan(100);
    expect(SYSTEM_PROMPT).toContain('AI KOL');
  });

  test('splitIntoChunks returns single chunk for small text', () => {
    const chunks = splitIntoChunks('short text', CHUNK_CHAR_LIMIT);
    expect(chunks).toEqual(['short text']);
  });

  test('splitIntoChunks splits at line boundaries', () => {
    const line = 'a'.repeat(100) + '\n';
    const text = line.repeat(2000); // 202,000 chars
    const chunks = splitIntoChunks(text, CHUNK_CHAR_LIMIT);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(CHUNK_CHAR_LIMIT + 101); // Allow last line
    }
  });
});

// ── CLI args tests ──

describe('generate-digest parseArgs', () => {
  const originalArgv = process.argv;

  afterEach(() => {
    process.argv = originalArgv;
  });

  test('default options', () => {
    process.argv = ['node', 'generate-digest.js'];
    const { parseArgs } = require('../scripts/generate-digest');
    const opts = parseArgs();
    expect(opts.date).toBeNull();
    expect(opts.from).toBeNull();
    expect(opts.to).toBeNull();
    expect(opts.dryRun).toBe(false);
    expect(opts.force).toBe(false);
  });

  test('parses --date', () => {
    process.argv = ['node', 'generate-digest.js', '--date', '2026-02-16'];
    const { parseArgs } = require('../scripts/generate-digest');
    const opts = parseArgs();
    expect(opts.date).toBe('2026-02-16');
  });

  test('parses --from --to', () => {
    process.argv = ['node', 'generate-digest.js', '--from', '2026-02-01', '--to', '2026-02-15'];
    const { parseArgs } = require('../scripts/generate-digest');
    const opts = parseArgs();
    expect(opts.from).toBe('2026-02-01');
    expect(opts.to).toBe('2026-02-15');
  });

  test('parses --dry-run and --force', () => {
    process.argv = ['node', 'generate-digest.js', '--dry-run', '--force'];
    const { parseArgs } = require('../scripts/generate-digest');
    const opts = parseArgs();
    expect(opts.dryRun).toBe(true);
    expect(opts.force).toBe(true);
  });
});

// ── Output path tests ──

describe('generate-digest getOutputPath', () => {
  const { getOutputPath } = require('../scripts/generate-digest');

  test('constructs correct path', () => {
    const p = getOutputPath('2026-02-16');
    expect(p).toContain('digests');
    expect(p).toContain('2026');
    expect(p).toContain('02');
    expect(p).toMatch(/2026-02-16\.md$/);
  });
});
