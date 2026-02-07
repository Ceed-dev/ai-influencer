/**
 * E2E Tests - End-to-End Integration Tests
 *
 * Tests the complete flow: CSV Import → Analysis → Report Output
 * Run with: npm test -- gas/tests/E2E.test.js
 */

// ============================================================
// Mock Setup
// ============================================================

// Mock GAS Utilities
const mockParseCsv = jest.fn();
const mockBase64Decode = jest.fn((str) => str);
const mockNewBlob = jest.fn((data) => ({
  getDataAsString: jest.fn(() => data)
}));
const mockFormatDate = jest.fn((date, tz, format) => {
  const d = new Date(date);
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}_${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}${String(d.getSeconds()).padStart(2, '0')}`;
});
const mockSleep = jest.fn();

global.Utilities = {
  parseCsv: mockParseCsv,
  base64Decode: mockBase64Decode,
  newBlob: mockNewBlob,
  formatDate: mockFormatDate,
  sleep: mockSleep
};

// Mock Logger
global.Logger = {
  log: jest.fn()
};

// Mock ContentService
global.ContentService = {
  createTextOutput: jest.fn((content) => ({
    setMimeType: jest.fn(() => content)
  })),
  MimeType: { JSON: 'application/json' }
};

// Mock UrlFetchApp for LLM calls
const mockFetch = jest.fn();
global.UrlFetchApp = { fetch: mockFetch };

// Mock SpreadsheetApp
const mockSheets = {};
let mockSpreadsheet;

global.SpreadsheetApp = {
  openById: jest.fn(() => mockSpreadsheet)
};

// Mock CONFIG
const CONFIG = {
  SPREADSHEET_ID: 'test-spreadsheet-id',
  OPENAI_API_KEY: 'test-api-key',
  OPENAI_MODEL: 'gpt-4o',
  SHEETS: {
    VIDEOS_MASTER: 'videos_master',
    METRICS_YOUTUBE: 'metrics_youtube',
    METRICS_TIKTOK: 'metrics_tiktok',
    METRICS_INSTAGRAM: 'metrics_instagram',
    KPI_TARGETS: 'kpi_targets',
    SCENARIO_CUTS: 'scenario_cuts',
    ANALYSIS_REPORTS: 'analysis_reports',
    RECOMMENDATIONS: 'recommendations',
    UNLINKED_IMPORTS: 'unlinked_imports'
  },
  KPI_DEFAULTS: {
    youtube: { completion_rate: 0.50, ctr: 0.05, engagement_rate: 0.03 },
    tiktok: { completion_rate: 0.40, engagement_rate: 0.08, avg_watch_time: 10 },
    instagram: { reach_rate: 0.30, avg_watch_time: 15, engagement_rate: 0.05 }
  },
  COLUMN_ALIASES: {
    youtube: {
      video_id: ['Video ID', 'Content', 'コンテンツ'],
      title: ['Video title', 'Title', '動画タイトル'],
      views: ['Views', 'View count', '視聴回数'],
      watch_time_hours: ['Watch time (hours)', '総再生時間（時間）'],
      avg_view_duration: ['Average view duration', '平均視聴時間'],
      ctr: ['Impressions click-through rate (%)', 'CTR'],
      likes: ['Likes', 'Like count', '高評価'],
      comments: ['Comments', 'Comment count'],
      shares: ['Shares', 'Share count'],
      subscribers_gained: ['Subscribers', 'Subscribers gained']
    },
    tiktok: {
      video_id: ['Video ID', 'video_id', 'ID'],
      title: ['Title', 'Video Title', 'Description'],
      views: ['Video views', 'Views', 'Total views'],
      avg_watch_time: ['Average watch time', 'Avg. watch time'],
      completion_rate: ['Watched full video (%)', 'Completion rate'],
      likes: ['Likes', 'Like count'],
      comments: ['Comments', 'Comment count'],
      shares: ['Shares', 'Share count'],
      saves: ['Saves', 'Save count'],
      engagement_rate: ['Engagement rate']
    },
    instagram: {
      reel_id: ['Reel ID', 'Media ID', 'ID'],
      title: ['Caption', 'Title', 'Description'],
      views: ['Plays', 'Views', 'Video Views'],
      reach: ['Reach', 'Accounts reached'],
      avg_watch_time: ['Average watch time', 'Avg. watch time'],
      likes: ['Likes', 'Like count'],
      comments: ['Comments', 'Comment count'],
      shares: ['Shares', 'Share count'],
      saves: ['Saves', 'Save count']
    }
  },
  RETRY: { MAX_ATTEMPTS: 3, BASE_DELAY_MS: 100, MAX_DELAY_MS: 500 }
};

global.CONFIG = CONFIG;

// Sheet mock factory with enhanced functionality
function createMockSheet(name, initialData = []) {
  let sheetData = initialData.map(row => [...row]);

  return {
    getName: jest.fn(() => name),
    getDataRange: jest.fn(() => ({
      getValues: jest.fn(() => sheetData)
    })),
    getLastRow: jest.fn(() => sheetData.length),
    getMaxColumns: jest.fn(() => sheetData[0]?.length || 10),
    getRange: jest.fn((row, col, numRows, numCols) => ({
      getValues: jest.fn(() => {
        const result = [];
        for (let i = 0; i < (numRows || 1); i++) {
          const rowData = [];
          for (let j = 0; j < (numCols || 1); j++) {
            rowData.push(sheetData[row - 1 + i]?.[col - 1 + j] ?? '');
          }
          result.push(rowData);
        }
        return result;
      }),
      setValues: jest.fn((values) => {
        for (let i = 0; i < values.length; i++) {
          if (!sheetData[row - 1 + i]) sheetData[row - 1 + i] = [];
          for (let j = 0; j < values[i].length; j++) {
            sheetData[row - 1 + i][col - 1 + j] = values[i][j];
          }
        }
      }),
      setValue: jest.fn((value) => {
        if (!sheetData[row - 1]) sheetData[row - 1] = [];
        sheetData[row - 1][col - 1] = value;
      })
    })),
    appendRow: jest.fn((row) => { sheetData.push([...row]); }),
    deleteRows: jest.fn((startRow, numRows) => { sheetData.splice(startRow - 1, numRows); }),
    deleteRow: jest.fn((rowIndex) => { sheetData.splice(rowIndex - 1, 1); }),
    setFrozenRows: jest.fn(),
    _getData: () => sheetData,
    _setData: (data) => { sheetData = data.map(row => [...row]); }
  };
}

// Initialize mock spreadsheet with all required sheets
function initializeMockSpreadsheet() {
  mockSheets.videos_master = createMockSheet('videos_master', [
    ['video_uid', 'title', 'created_date', 'youtube_id', 'tiktok_id', 'instagram_id', 'scenario_id'],
    ['VID_202602_0001', 'Test Video 1', '2026-02-01', 'yt_abc123', 'tt_001', 'ig_001', 'SC_001'],
    ['VID_202602_0002', 'Test Video 2', '2026-02-02', 'yt_def456', '', '', 'SC_002']
  ]);
  mockSheets.metrics_youtube = createMockSheet('metrics_youtube', [
    ['video_uid', 'import_date', 'views', 'likes', 'comments', 'shares', 'engagement_rate', 'watch_time_hours', 'avg_watch_time_sec', 'completion_rate', 'ctr', 'subscribers_gained']
  ]);
  mockSheets.metrics_tiktok = createMockSheet('metrics_tiktok', [
    ['video_uid', 'import_date', 'views', 'likes', 'comments', 'shares', 'engagement_rate', 'saves', 'avg_watch_time_sec', 'completion_rate']
  ]);
  mockSheets.metrics_instagram = createMockSheet('metrics_instagram', [
    ['video_uid', 'import_date', 'views', 'likes', 'comments', 'shares', 'engagement_rate', 'saves', 'avg_watch_time_sec', 'reach']
  ]);
  mockSheets.kpi_targets = createMockSheet('kpi_targets', [
    ['platform', 'metric', 'target_value', 'description'],
    ['youtube', 'completion_rate', 0.50, 'Target 50% completion'],
    ['youtube', 'ctr', 0.05, 'Target 5% CTR'],
    ['tiktok', 'completion_rate', 0.40, 'Target 40% completion'],
    ['instagram', 'engagement_rate', 0.05, 'Target 5% engagement']
  ]);
  mockSheets.unlinked_imports = createMockSheet('unlinked_imports', [
    ['platform', 'platform_id', 'title', 'views', 'import_date', 'raw_csv_row']
  ]);
  mockSheets.analysis_reports = createMockSheet('analysis_reports', [
    ['report_id', 'generated_at', 'video_count', 'insights_json']
  ]);
  mockSheets.recommendations = createMockSheet('recommendations', [
    ['created_at', 'priority', 'category', 'recommendation', 'platform', 'expected_impact', 'status']
  ]);

  mockSpreadsheet = {
    getSheetByName: jest.fn((name) => mockSheets[name] || null),
    insertSheet: jest.fn((name) => {
      mockSheets[name] = createMockSheet(name, []);
      return mockSheets[name];
    })
  };
}

// Mock getSheet function
function getSheet(sheetName) {
  const sheet = mockSheets[sheetName];
  if (!sheet) throw new Error(`Sheet not found: ${sheetName}`);
  return sheet;
}

function getSpreadsheet() {
  return mockSpreadsheet;
}

// ============================================================
// Re-implement GAS Functions for Testing
// ============================================================

// --- CSVParser.gs functions ---
function mapHeaders(headers, aliases) {
  const result = {};
  Object.keys(aliases).forEach(field => {
    result[field] = -1;
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i].toLowerCase();
      for (const alias of aliases[field]) {
        if (header === alias.toLowerCase() || header.includes(alias.toLowerCase())) {
          result[field] = i;
          return;
        }
      }
    }
  });
  return result;
}

function parseValue(value, fieldName) {
  if (value === null || value === undefined || value === '') return null;
  const str = String(value).trim();
  if (str === '') return null;

  const percentageFields = ['ctr', 'completion_rate', 'engagement_rate'];
  if (percentageFields.includes(fieldName)) {
    if (str.endsWith('%')) {
      const num = parseFloat(str.replace('%', '')) / 100;
      return isNaN(num) ? null : num;
    }
    const num = parseFloat(str);
    return isNaN(num) ? null : num;
  }

  const numericFields = ['views', 'likes', 'comments', 'shares', 'saves', 'reach', 'subscribers_gained', 'watch_time_hours', 'avg_view_duration', 'avg_watch_time'];
  if (numericFields.includes(fieldName)) {
    const num = parseFloat(str.replace(/,/g, ''));
    return isNaN(num) ? null : num;
  }

  if (fieldName.includes('date')) {
    return new Date(str).toISOString();
  }

  return str;
}

function hasRequiredFields(row, platform) {
  const required = {
    youtube: ['video_id', 'views'],
    tiktok: ['video_id', 'views'],
    instagram: ['reel_id', 'views']
  };
  const fields = required[platform] || [];
  return fields.every(f => row[f] !== null && row[f] !== undefined && row[f] !== '');
}

function parseCSV(csvContent, platform) {
  const aliases = CONFIG.COLUMN_ALIASES[platform];
  if (!aliases) throw new Error(`Unknown platform: ${platform}`);

  const parsed = Utilities.parseCsv(csvContent);
  if (parsed.length < 2) throw new Error('CSV has no data rows');

  const headers = parsed[0];
  const headerMap = mapHeaders(headers, aliases);
  const rows = parsed.slice(1);

  const result = [];
  rows.forEach((row, index) => {
    const record = { _platform: platform, _row_index: index + 2 };
    Object.keys(aliases).forEach(field => {
      const col = headerMap[field];
      if (col !== -1 && col < row.length) {
        record[field] = parseValue(row[col], field);
      }
    });
    if (hasRequiredFields(record, platform)) {
      result.push(record);
    }
  });

  return result;
}

// --- Normalizer.gs functions ---
function createEmptyNormalized() {
  return {
    platform_id: null, platform: null, title: null,
    views: null, likes: null, comments: null, shares: null,
    saves: null, engagement_rate: null,
    avg_watch_time_sec: null, completion_rate: null,
    watch_time_hours: null, ctr: null, subscribers_gained: null, reach: null,
    import_date: null, raw_csv_row: null, video_uid: null
  };
}

function normalizeYouTube(row) {
  const normalized = createEmptyNormalized();
  normalized.platform = 'youtube';
  normalized.platform_id = row.video_id;
  normalized.title = row.title;
  normalized.views = row.views;
  normalized.likes = row.likes;
  normalized.comments = row.comments;
  normalized.shares = row.shares;
  normalized.watch_time_hours = row.watch_time_hours;
  normalized.avg_watch_time_sec = row.avg_view_duration;
  if (row.completion_rate) normalized.completion_rate = row.completion_rate;
  normalized.ctr = row.ctr;
  normalized.subscribers_gained = row.subscribers_gained;
  if (normalized.views > 0) {
    const engagements = (normalized.likes || 0) + (normalized.comments || 0) + (normalized.shares || 0);
    normalized.engagement_rate = engagements / normalized.views;
  }
  normalized.import_date = new Date().toISOString();
  return normalized;
}

function normalizeTikTok(row) {
  const normalized = createEmptyNormalized();
  normalized.platform = 'tiktok';
  normalized.platform_id = row.video_id;
  normalized.title = row.title;
  normalized.views = row.views;
  normalized.likes = row.likes;
  normalized.comments = row.comments;
  normalized.shares = row.shares;
  normalized.saves = row.saves;
  normalized.avg_watch_time_sec = row.avg_watch_time;
  normalized.completion_rate = row.completion_rate;
  normalized.engagement_rate = row.engagement_rate;
  if (!normalized.engagement_rate && normalized.views > 0) {
    const engagements = (normalized.likes || 0) + (normalized.comments || 0) + (normalized.shares || 0) + (normalized.saves || 0);
    normalized.engagement_rate = engagements / normalized.views;
  }
  normalized.import_date = new Date().toISOString();
  return normalized;
}

function normalizeInstagram(row) {
  const normalized = createEmptyNormalized();
  normalized.platform = 'instagram';
  normalized.platform_id = row.reel_id;
  normalized.title = row.title;
  normalized.views = row.views;
  normalized.likes = row.likes;
  normalized.comments = row.comments;
  normalized.shares = row.shares;
  normalized.saves = row.saves;
  normalized.avg_watch_time_sec = row.avg_watch_time;
  normalized.reach = row.reach;
  if (normalized.views > 0) {
    const engagements = (normalized.likes || 0) + (normalized.comments || 0) + (normalized.shares || 0) + (normalized.saves || 0);
    normalized.engagement_rate = engagements / normalized.views;
  }
  normalized.import_date = new Date().toISOString();
  return normalized;
}

function normalizeMetrics(parsed, platform) {
  const normalizers = { youtube: normalizeYouTube, tiktok: normalizeTikTok, instagram: normalizeInstagram };
  const normalizer = normalizers[platform];
  if (!normalizer) throw new Error(`No normalizer for platform: ${platform}`);
  return parsed.map(row => normalizer(row));
}

function getPlatformFields(platform) {
  const common = ['video_uid', 'import_date', 'views', 'likes', 'comments', 'shares', 'engagement_rate'];
  const platformSpecific = {
    youtube: [...common, 'watch_time_hours', 'avg_watch_time_sec', 'completion_rate', 'ctr', 'subscribers_gained'],
    tiktok: [...common, 'saves', 'avg_watch_time_sec', 'completion_rate'],
    instagram: [...common, 'saves', 'avg_watch_time_sec', 'reach']
  };
  return platformSpecific[platform] || common;
}

// --- Linker.gs functions ---
function levenshteinDistance(str1, str2) {
  const m = str1.length, n = str2.length;
  const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) dp[i][j] = dp[i - 1][j - 1];
      else dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + 1);
    }
  }
  return dp[m][n];
}

function fuzzyTitleMatch(title1, title2) {
  if (!title1 || !title2) return false;
  const normalize = (str) => str.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
  const n1 = normalize(title1), n2 = normalize(title2);
  if (n1 === n2) return true;
  if (n1.includes(n2) || n2.includes(n1)) return true;
  const distance = levenshteinDistance(n1, n2);
  const maxLen = Math.max(n1.length, n2.length);
  return (1 - distance / maxLen) > 0.85;
}

function getMasterData() {
  try {
    const sheet = getSheet(CONFIG.SHEETS.VIDEOS_MASTER);
    const data = sheet.getDataRange().getValues();
    if (data.length < 2) return [];
    const headers = data[0];
    return data.slice(1).map(row => {
      const record = {};
      headers.forEach((h, i) => { record[h] = row[i]; });
      return record;
    });
  } catch (e) {
    Logger.log(`Error getting master data: ${e.message}`);
    return [];
  }
}

function findVideoUid(metric, platform, masterData) {
  const platformIdField = { youtube: 'youtube_id', tiktok: 'tiktok_id', instagram: 'instagram_id' }[platform];
  const exactMatch = masterData.find(m => m[platformIdField] === metric.platform_id);
  if (exactMatch) return exactMatch.video_uid;
  if (metric.title) {
    const titleMatch = masterData.find(m => fuzzyTitleMatch(m.title, metric.title));
    if (titleMatch) return titleMatch.video_uid;
  }
  return null;
}

function linkVideos(normalized, platform) {
  const masterData = getMasterData();
  const linked = [], unlinked = [];
  normalized.forEach(metric => {
    const videoUid = findVideoUid(metric, platform, masterData);
    if (videoUid) { metric.video_uid = videoUid; linked.push(metric); }
    else unlinked.push(metric);
  });
  return { linked, unlinked };
}

// --- SheetWriter.gs functions ---
function ensureHeaders(sheet, fields) {
  const currentHeaders = sheet.getRange(1, 1, 1, sheet.getMaxColumns()).getValues()[0];
  const hasHeaders = fields.every((field, i) => currentHeaders[i] === field);
  if (!hasHeaders && sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, fields.length).setValues([fields]);
  } else if (!hasHeaders && sheet.getLastRow() > 0) {
    Logger.log(`Warning: Headers mismatch on ${sheet.getName()}`);
  }
}

function writeMetrics(metrics, platform) {
  if (metrics.length === 0) return;
  const sheetName = CONFIG.SHEETS[`METRICS_${platform.toUpperCase()}`];
  const sheet = getSheet(sheetName);
  const fields = getPlatformFields(platform);
  ensureHeaders(sheet, fields);
  const rows = metrics.map(m => fields.map(f => m[f] ?? ''));
  if (rows.length > 0) {
    const startRow = sheet.getLastRow() + 1;
    sheet.getRange(startRow, 1, rows.length, fields.length).setValues(rows);
  }
}

function writeUnlinked(unlinked, platform) {
  if (unlinked.length === 0) return;
  const sheet = getSheet(CONFIG.SHEETS.UNLINKED_IMPORTS);
  const fields = ['platform', 'platform_id', 'title', 'views', 'import_date', 'raw_csv_row'];
  ensureHeaders(sheet, fields);
  const rows = unlinked.map(m => [platform, m.platform_id, m.title, m.views, m.import_date, m.raw_csv_row]);
  if (rows.length > 0) {
    const startRow = sheet.getLastRow() + 1;
    sheet.getRange(startRow, 1, rows.length, fields.length).setValues(rows);
  }
}

function writeAnalysisReport(analysis) {
  const sheet = getSheet(CONFIG.SHEETS.ANALYSIS_REPORTS);
  const fields = ['report_id', 'generated_at', 'video_count', 'insights_json'];
  ensureHeaders(sheet, fields);
  sheet.appendRow([analysis.report_id, analysis.generated_at, analysis.video_count, JSON.stringify(analysis.analysis)]);
}

function writeRecommendations(recommendations) {
  if (recommendations.length === 0) return;
  const sheet = getSheet(CONFIG.SHEETS.RECOMMENDATIONS);
  const fields = ['created_at', 'priority', 'category', 'recommendation', 'platform', 'expected_impact', 'status'];
  ensureHeaders(sheet, fields);
  const now = new Date().toISOString();
  const rows = recommendations.map(r => [now, r.priority, r.category, r.recommendation, r.platform, r.expected_impact, 'pending']);
  if (rows.length > 0) {
    const startRow = sheet.getLastRow() + 1;
    sheet.getRange(startRow, 1, rows.length, fields.length).setValues(rows);
  }
}

// --- KPIEngine.gs functions ---
function getKPITargets() {
  try {
    const sheet = getSheet(CONFIG.SHEETS.KPI_TARGETS);
    const data = sheet.getDataRange().getValues();
    if (data.length < 2) return CONFIG.KPI_DEFAULTS;
    const headers = data[0];
    const targets = {};
    for (let i = 1; i < data.length; i++) {
      const platform = data[i][headers.indexOf('platform')];
      const metric = data[i][headers.indexOf('metric')];
      const value = data[i][headers.indexOf('target_value')];
      if (!targets[platform]) targets[platform] = {};
      targets[platform][metric] = value;
    }
    Object.keys(CONFIG.KPI_DEFAULTS).forEach(platform => {
      if (!targets[platform]) targets[platform] = CONFIG.KPI_DEFAULTS[platform];
      else {
        Object.keys(CONFIG.KPI_DEFAULTS[platform]).forEach(metric => {
          if (targets[platform][metric] === undefined) targets[platform][metric] = CONFIG.KPI_DEFAULTS[platform][metric];
        });
      }
    });
    return targets;
  } catch (e) {
    Logger.log(`Error getting KPI targets: ${e.message}`);
    return CONFIG.KPI_DEFAULTS;
  }
}

function comparePlatformKPIs(metrics, targets) {
  const result = { score: 0, above_target: [], below_target: [], at_target: [], details: {} };
  let metricCount = 0, achievedCount = 0;
  Object.entries(targets).forEach(([metric, target]) => {
    const actual = metrics[metric];
    if (actual === null || actual === undefined) { result.details[metric] = { status: 'no_data', target }; return; }
    metricCount++;
    const ratio = actual / target;
    const gap = actual - target;
    const percentGap = ((actual - target) / target) * 100;
    const detail = { actual, target, ratio, gap, percent_gap: percentGap };
    if (ratio >= 1) { achievedCount++; detail.status = 'above'; result.above_target.push({ metric, ...detail }); }
    else if (ratio >= 0.95) { achievedCount += 0.5; detail.status = 'at'; result.at_target.push({ metric, ...detail }); }
    else { detail.status = 'below'; result.below_target.push({ metric, ...detail }); }
    result.details[metric] = detail;
  });
  result.score = metricCount > 0 ? (achievedCount / metricCount) * 100 : 0;
  return result;
}

function calculatePriority(gap) {
  return Math.min(100, Math.abs(gap) * 100);
}

function getMetricsBundle(videoUids) {
  const bundle = {};
  videoUids.forEach(uid => { bundle[uid] = {}; });
  ['youtube', 'tiktok', 'instagram'].forEach(platform => {
    try {
      const sheetName = CONFIG.SHEETS[`METRICS_${platform.toUpperCase()}`];
      const sheet = getSheet(sheetName);
      const data = sheet.getDataRange().getValues();
      if (data.length < 2) return;
      const headers = data[0];
      const videoUidCol = headers.indexOf('video_uid');
      for (let i = 1; i < data.length; i++) {
        const uid = data[i][videoUidCol];
        if (videoUids.includes(uid)) {
          if (!bundle[uid]) bundle[uid] = {};
          bundle[uid][platform] = {};
          headers.forEach((header, j) => {
            if (header !== 'video_uid' && header !== 'import_date') bundle[uid][platform][header] = data[i][j];
          });
        }
      }
    } catch (e) { Logger.log(`Error getting ${platform} metrics: ${e.message}`); }
  });
  return bundle;
}

function compareKPIs(metricsBundle, kpiTargets) {
  const results = [];
  Object.entries(metricsBundle).forEach(([videoUid, platforms]) => {
    const videoResult = { video_uid: videoUid, platforms: {}, overall_score: 0, improvement_areas: [] };
    let totalScore = 0, platformCount = 0;
    Object.entries(platforms).forEach(([platform, metrics]) => {
      const targets = kpiTargets[platform] || {};
      const comparison = comparePlatformKPIs(metrics, targets);
      videoResult.platforms[platform] = comparison;
      totalScore += comparison.score;
      platformCount++;
      comparison.below_target.forEach(item => {
        videoResult.improvement_areas.push({ platform, metric: item.metric, gap: item.gap, priority: calculatePriority(item.gap) });
      });
    });
    videoResult.overall_score = platformCount > 0 ? totalScore / platformCount : 0;
    videoResult.improvement_areas.sort((a, b) => b.priority - a.priority);
    results.push(videoResult);
  });
  results.sort((a, b) => a.overall_score - b.overall_score);
  return results;
}

function generateKPISummary(kpiResult) {
  const lines = [];
  lines.push(`Video: ${kpiResult.video_uid}`);
  lines.push(`Overall Score: ${kpiResult.overall_score.toFixed(1)}%`);
  lines.push('');
  Object.entries(kpiResult.platforms).forEach(([platform, comparison]) => {
    lines.push(`[${platform.toUpperCase()}]`);
    lines.push(`Score: ${comparison.score.toFixed(1)}%`);
    if (comparison.above_target.length > 0) lines.push('✓ Above target: ' + comparison.above_target.map(m => m.metric).join(', '));
    if (comparison.below_target.length > 0) lines.push('✗ Below target: ' + comparison.below_target.map(m => `${m.metric} (${m.percent_gap.toFixed(1)}%)`).join(', '));
    lines.push('');
  });
  if (kpiResult.improvement_areas.length > 0) {
    lines.push('Priority Improvements:');
    kpiResult.improvement_areas.slice(0, 5).forEach((area, i) => { lines.push(`${i + 1}. [${area.platform}] ${area.metric}`); });
  }
  return lines.join('\n');
}

// --- LLMAnalyzer.gs functions ---
function buildAnalysisContext(metricsBundle, kpiResults) {
  const context = { videos: [], summary: { total_videos: Object.keys(metricsBundle).length, platform_coverage: {}, avg_scores: {} } };
  kpiResults.forEach(result => {
    const videoMetrics = metricsBundle[result.video_uid] || {};
    context.videos.push({ video_uid: result.video_uid, overall_score: result.overall_score, platforms: result.platforms, improvement_areas: result.improvement_areas.slice(0, 3), metrics: videoMetrics });
    Object.keys(result.platforms).forEach(platform => {
      context.summary.platform_coverage[platform] = (context.summary.platform_coverage[platform] || 0) + 1;
    });
  });
  if (kpiResults.length > 0) context.summary.avg_scores.overall = kpiResults.reduce((sum, r) => sum + r.overall_score, 0) / kpiResults.length;
  return context;
}

function parseAnalysisResponse(response) {
  const lines = response.trim().split('\n');
  const insights = [];
  lines.forEach(line => {
    if (line.toLowerCase().startsWith('category\t')) return;
    const parts = line.split('\t');
    if (parts.length >= 4) insights.push({ category: parts[0].trim(), insight: parts[1].trim(), confidence: parts[2].trim(), impact: parts[3].trim() });
  });
  return { insights };
}

function parseRecommendationsResponse(response) {
  const lines = response.trim().split('\n');
  const recommendations = [];
  lines.forEach(line => {
    if (line.toLowerCase().startsWith('priority\t')) return;
    const parts = line.split('\t');
    if (parts.length >= 5) recommendations.push({ priority: parseInt(parts[0].trim()) || 99, category: parts[1].trim(), recommendation: parts[2].trim(), platform: parts[3].trim(), expected_impact: parts[4].trim() });
  });
  recommendations.sort((a, b) => a.priority - b.priority);
  return recommendations;
}

function generateReportId() {
  const datePart = Utilities.formatDate(new Date(), 'GMT', 'yyyyMMdd_HHmmss');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `RPT_${datePart}_${random}`;
}

function callOpenAI(prompt) {
  if (!CONFIG.OPENAI_API_KEY) throw new Error('OpenAI API key not configured');
  let lastError;
  for (let attempt = 0; attempt < CONFIG.RETRY.MAX_ATTEMPTS; attempt++) {
    try {
      const response = UrlFetchApp.fetch('https://api.openai.com/v1/chat/completions', {});
      const responseCode = response.getResponseCode();
      if (responseCode === 200) {
        const json = JSON.parse(response.getContentText());
        return json.choices[0].message.content;
      } else if (responseCode === 429) {
        Utilities.sleep(Math.min(CONFIG.RETRY.BASE_DELAY_MS * Math.pow(2, attempt), CONFIG.RETRY.MAX_DELAY_MS));
        continue;
      } else {
        throw new Error(`OpenAI API error: ${responseCode}`);
      }
    } catch (e) {
      lastError = e;
      Utilities.sleep(Math.min(CONFIG.RETRY.BASE_DELAY_MS * Math.pow(2, attempt), CONFIG.RETRY.MAX_DELAY_MS));
    }
  }
  throw lastError || new Error('OpenAI API call failed after retries');
}

function analyzWithLLM(metricsBundle, kpiResults) {
  const reportId = generateReportId();
  const context = buildAnalysisContext(metricsBundle, kpiResults);
  const analysisResponse = callOpenAI('analysis prompt');
  const parsedAnalysis = parseAnalysisResponse(analysisResponse);
  const recommendationsResponse = callOpenAI('recommendations prompt');
  const recommendations = parseRecommendationsResponse(recommendationsResponse);
  return { report_id: reportId, generated_at: new Date().toISOString(), video_count: Object.keys(metricsBundle).length, analysis: parsedAnalysis, recommendations: recommendations, raw_context: context };
}

// --- Code.gs functions ---
function handleImportCSV(payload) {
  const { platform, csv_data } = payload;
  if (!platform || !csv_data) throw new Error('Missing required fields: platform, csv_data');
  const csvContent = Utilities.newBlob(Utilities.base64Decode(csv_data)).getDataAsString('UTF-8');
  const parsed = parseCSV(csvContent, platform);
  const normalized = normalizeMetrics(parsed, platform);
  const { linked, unlinked } = linkVideos(normalized, platform);
  writeMetrics(linked, platform);
  writeUnlinked(unlinked, platform);
  return { platform: platform, total_rows: parsed.length, linked: linked.length, unlinked: unlinked.length };
}

function handleAnalyze(payload) {
  const { video_uids } = payload;
  if (!video_uids || !Array.isArray(video_uids)) throw new Error('Missing or invalid video_uids array');
  const metricsBundle = getMetricsBundle(video_uids);
  const kpiTargets = getKPITargets();
  const kpiResults = compareKPIs(metricsBundle, kpiTargets);
  const analysis = analyzWithLLM(metricsBundle, kpiResults);
  writeAnalysisReport(analysis);
  writeRecommendations(analysis.recommendations);
  return { analyzed_count: video_uids.length, report_id: analysis.report_id };
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const action = payload.action;
    let result;
    switch (action) {
      case 'import_csv': result = handleImportCSV(payload); break;
      case 'analyze': result = handleAnalyze(payload); break;
      default: throw new Error(`Unknown action: ${action}`);
    }
    return JSON.stringify({ status: 'success', data: result, timestamp: new Date().toISOString() });
  } catch (error) {
    Logger.log(`Error in doPost: ${error.message}`);
    return JSON.stringify({ status: 'error', error: error.message, timestamp: new Date().toISOString() });
  }
}

// ============================================================
// Test Suites
// ============================================================

describe('E2E: End-to-End Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    initializeMockSpreadsheet();
  });

  // ============================================================
  // 1. CSV Import Flow Tests
  // ============================================================
  describe('CSV Import Flow', () => {
    describe('YouTube CSV Import', () => {
      it('should complete full import flow: parse → normalize → link → write', () => {
        mockParseCsv.mockReturnValue([
          ['Video ID', 'Title', 'Views', 'Likes', 'Comments', 'Watch time (hours)', 'CTR'],
          ['yt_abc123', 'Test Video 1', '10000', '500', '50', '250', '5%'],
          ['yt_new001', 'New Unlinked Video', '5000', '200', '20', '100', '3%']
        ]);

        const csvContent = 'Video ID,Title,Views...';
        const parsed = parseCSV(csvContent, 'youtube');
        const normalized = normalizeMetrics(parsed, 'youtube');
        const { linked, unlinked } = linkVideos(normalized, 'youtube');

        expect(parsed).toHaveLength(2);
        expect(parsed[0].video_id).toBe('yt_abc123');
        expect(parsed[0].views).toBe(10000);
        expect(parsed[0].ctr).toBe(0.05);

        expect(normalized[0].platform).toBe('youtube');
        expect(normalized[0].platform_id).toBe('yt_abc123');
        expect(normalized[0].engagement_rate).toBeCloseTo(0.055);

        expect(linked).toHaveLength(1);
        expect(linked[0].video_uid).toBe('VID_202602_0001');
        expect(unlinked).toHaveLength(1);
        expect(unlinked[0].platform_id).toBe('yt_new001');
      });

      it('should write linked metrics to metrics_youtube sheet', () => {
        mockParseCsv.mockReturnValue([
          ['Video ID', 'Title', 'Views', 'Likes'],
          ['yt_abc123', 'Test Video 1', '10000', '500']
        ]);

        const parsed = parseCSV('data', 'youtube');
        const normalized = normalizeMetrics(parsed, 'youtube');
        const { linked } = linkVideos(normalized, 'youtube');
        writeMetrics(linked, 'youtube');

        const sheetData = mockSheets.metrics_youtube._getData();
        expect(sheetData.length).toBeGreaterThan(1);
      });

      it('should write unlinked imports to unlinked_imports sheet', () => {
        mockParseCsv.mockReturnValue([
          ['Video ID', 'Title', 'Views'],
          ['yt_unknown', 'Unknown Video', '1000']
        ]);

        const parsed = parseCSV('data', 'youtube');
        const normalized = normalizeMetrics(parsed, 'youtube');
        const { unlinked } = linkVideos(normalized, 'youtube');
        writeUnlinked(unlinked, 'youtube');

        const sheetData = mockSheets.unlinked_imports._getData();
        expect(sheetData.length).toBeGreaterThan(1);
      });
    });

    describe('TikTok CSV Import', () => {
      it('should complete full import flow for TikTok', () => {
        mockParseCsv.mockReturnValue([
          ['Video ID', 'Video views', 'Likes', 'Shares', 'Saves', 'Watched full video (%)'],
          ['tt_001', '50000', '3000', '500', '200', '40%']
        ]);

        const parsed = parseCSV('data', 'tiktok');
        const normalized = normalizeMetrics(parsed, 'tiktok');
        const { linked } = linkVideos(normalized, 'tiktok');

        expect(parsed[0].video_id).toBe('tt_001');
        expect(parsed[0].views).toBe(50000);
        expect(parsed[0].completion_rate).toBe(0.4);
        expect(normalized[0].platform).toBe('tiktok');
        expect(normalized[0].saves).toBe(200);
        expect(linked).toHaveLength(1);
        expect(linked[0].video_uid).toBe('VID_202602_0001');
      });
    });

    describe('Instagram CSV Import', () => {
      it('should complete full import flow for Instagram', () => {
        mockParseCsv.mockReturnValue([
          ['Reel ID', 'Plays', 'Likes', 'Comments', 'Reach', 'Saves'],
          ['ig_001', '30000', '1500', '100', '25000', '400']
        ]);

        const parsed = parseCSV('data', 'instagram');
        const normalized = normalizeMetrics(parsed, 'instagram');
        const { linked } = linkVideos(normalized, 'instagram');

        expect(parsed[0].reel_id).toBe('ig_001');
        expect(parsed[0].views).toBe(30000);
        expect(parsed[0].reach).toBe(25000);
        expect(normalized[0].platform).toBe('instagram');
        expect(normalized[0].reach).toBe(25000);
        expect(linked).toHaveLength(1);
        expect(linked[0].video_uid).toBe('VID_202602_0001');
      });
    });

    describe('Multi-platform Import', () => {
      it('should handle imports from all platforms for same video', () => {
        mockParseCsv.mockReturnValue([['Video ID', 'Views', 'Likes'], ['yt_abc123', '10000', '500']]);
        const ytParsed = parseCSV('data', 'youtube');
        const ytNorm = normalizeMetrics(ytParsed, 'youtube');
        const { linked: ytLinked } = linkVideos(ytNorm, 'youtube');

        mockParseCsv.mockReturnValue([['Video ID', 'Video views', 'Likes'], ['tt_001', '50000', '3000']]);
        const ttParsed = parseCSV('data', 'tiktok');
        const ttNorm = normalizeMetrics(ttParsed, 'tiktok');
        const { linked: ttLinked } = linkVideos(ttNorm, 'tiktok');

        mockParseCsv.mockReturnValue([['Reel ID', 'Plays', 'Likes'], ['ig_001', '30000', '1500']]);
        const igParsed = parseCSV('data', 'instagram');
        const igNorm = normalizeMetrics(igParsed, 'instagram');
        const { linked: igLinked } = linkVideos(igNorm, 'instagram');

        expect(ytLinked[0].video_uid).toBe('VID_202602_0001');
        expect(ttLinked[0].video_uid).toBe('VID_202602_0001');
        expect(igLinked[0].video_uid).toBe('VID_202602_0001');
      });
    });
  });

  // ============================================================
  // 2. KPI Analysis Flow Tests
  // ============================================================
  describe('KPI Analysis Flow', () => {
    beforeEach(() => {
      mockSheets.metrics_youtube._setData([
        ['video_uid', 'completion_rate', 'ctr', 'engagement_rate', 'views', 'import_date'],
        ['VID_202602_0001', 0.55, 0.06, 0.04, 10000, '2026-02-01'],
        ['VID_202602_0002', 0.35, 0.03, 0.02, 5000, '2026-02-01']
      ]);
      mockSheets.metrics_tiktok._setData([
        ['video_uid', 'completion_rate', 'engagement_rate', 'views'],
        ['VID_202602_0001', 0.45, 0.10, 50000]
      ]);
    });

    it('should fetch metrics bundle for specified videos', () => {
      const bundle = getMetricsBundle(['VID_202602_0001', 'VID_202602_0002']);
      expect(bundle['VID_202602_0001']).toBeDefined();
      expect(bundle['VID_202602_0001'].youtube.completion_rate).toBe(0.55);
      expect(bundle['VID_202602_0001'].tiktok.completion_rate).toBe(0.45);
      expect(bundle['VID_202602_0002'].youtube.completion_rate).toBe(0.35);
    });

    it('should compare KPIs against targets', () => {
      const bundle = getMetricsBundle(['VID_202602_0001']);
      const targets = getKPITargets();
      const results = compareKPIs(bundle, targets);
      expect(results).toHaveLength(1);
      expect(results[0].video_uid).toBe('VID_202602_0001');
      const ytPlatform = results[0].platforms.youtube;
      expect(ytPlatform.above_target.length).toBeGreaterThan(0);
    });

    it('should calculate overall score across platforms', () => {
      const bundle = getMetricsBundle(['VID_202602_0001']);
      const targets = getKPITargets();
      const results = compareKPIs(bundle, targets);
      expect(results[0].overall_score).toBeGreaterThan(0);
    });

    it('should identify improvement areas for underperforming metrics', () => {
      const bundle = getMetricsBundle(['VID_202602_0002']);
      const targets = getKPITargets();
      const results = compareKPIs(bundle, targets);
      expect(results[0].improvement_areas.length).toBeGreaterThan(0);
      expect(results[0].improvement_areas[0].platform).toBe('youtube');
    });

    it('should sort results by overall score (lowest first)', () => {
      const bundle = getMetricsBundle(['VID_202602_0001', 'VID_202602_0002']);
      const targets = getKPITargets();
      const results = compareKPIs(bundle, targets);
      expect(results[0].overall_score).toBeLessThanOrEqual(results[1].overall_score);
    });

    it('should generate human-readable KPI summary', () => {
      const bundle = getMetricsBundle(['VID_202602_0001']);
      const targets = getKPITargets();
      const results = compareKPIs(bundle, targets);
      const summary = generateKPISummary(results[0]);
      expect(summary).toContain('Video: VID_202602_0001');
      expect(summary).toContain('Overall Score:');
      expect(summary).toContain('[YOUTUBE]');
    });
  });

  // ============================================================
  // 3. LLM Analysis Flow Tests (Mocked)
  // ============================================================
  describe('LLM Analysis Flow', () => {
    const mockAnalysisResponse = `trend\tCompletion rates improving over recent videos\thigh\thigh
pattern\tTikTok outperforms YouTube on engagement\tmedium\tmedium
strength\tStrong hook effectiveness in first 3 seconds\thigh\thigh`;

    const mockRecommendationsResponse = `1\thook\tStart with question to boost retention\tall\t+10% completion
2\tpacing\tShorten mid-section by 20%\tyoutube\t+15% watch time`;

    beforeEach(() => {
      mockSheets.metrics_youtube._setData([
        ['video_uid', 'completion_rate', 'ctr', 'engagement_rate', 'views'],
        ['VID_202602_0001', 0.55, 0.06, 0.04, 10000]
      ]);

      let callCount = 0;
      mockFetch.mockImplementation(() => {
        callCount++;
        const content = callCount === 1 ? mockAnalysisResponse : mockRecommendationsResponse;
        return { getResponseCode: () => 200, getContentText: () => JSON.stringify({ choices: [{ message: { content } }] }) };
      });
    });

    it('should build analysis context from metrics and KPI results', () => {
      const metricsBundle = { 'VID_202602_0001': { youtube: { completion_rate: 0.55, ctr: 0.06, views: 10000 } } };
      const kpiResults = [{ video_uid: 'VID_202602_0001', overall_score: 80, platforms: { youtube: { score: 80, above_target: [], below_target: [] } }, improvement_areas: [] }];
      const context = buildAnalysisContext(metricsBundle, kpiResults);
      expect(context.videos).toHaveLength(1);
      expect(context.videos[0].video_uid).toBe('VID_202602_0001');
      expect(context.summary.total_videos).toBe(1);
      expect(context.summary.platform_coverage.youtube).toBe(1);
    });

    it('should call LLM and parse analysis response', () => {
      const metricsBundle = { 'VID_202602_0001': { youtube: { completion_rate: 0.55 } } };
      const kpiResults = [{ video_uid: 'VID_202602_0001', overall_score: 80, platforms: {}, improvement_areas: [] }];
      const result = analyzWithLLM(metricsBundle, kpiResults);
      expect(result.report_id).toMatch(/^RPT_/);
      expect(result.analysis.insights).toBeDefined();
      expect(result.analysis.insights.length).toBeGreaterThan(0);
      expect(result.analysis.insights[0].category).toBe('trend');
    });

    it('should parse recommendations from LLM response', () => {
      const metricsBundle = { 'VID_202602_0001': { youtube: { completion_rate: 0.55 } } };
      const kpiResults = [{ video_uid: 'VID_202602_0001', overall_score: 80, platforms: {}, improvement_areas: [] }];
      const result = analyzWithLLM(metricsBundle, kpiResults);
      expect(result.recommendations).toBeDefined();
      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(result.recommendations[0].priority).toBe(1);
      expect(result.recommendations[0].category).toBe('hook');
    });

    it('should write analysis report to sheet', () => {
      const analysis = { report_id: 'RPT_20260206_001', generated_at: '2026-02-06T12:00:00Z', video_count: 1, analysis: { insights: [] } };
      writeAnalysisReport(analysis);
      const sheetData = mockSheets.analysis_reports._getData();
      expect(sheetData.length).toBeGreaterThan(1);
    });

    it('should write recommendations to sheet', () => {
      const recommendations = [{ priority: 1, category: 'hook', recommendation: 'Test recommendation', platform: 'all', expected_impact: '+10%' }];
      writeRecommendations(recommendations);
      const sheetData = mockSheets.recommendations._getData();
      expect(sheetData.length).toBeGreaterThan(1);
    });

    it('should handle LLM rate limiting with retry', () => {
      let attempts = 0;
      mockFetch.mockImplementation(() => {
        attempts++;
        if (attempts < 2) return { getResponseCode: () => 429, getContentText: () => 'Rate limited' };
        return { getResponseCode: () => 200, getContentText: () => JSON.stringify({ choices: [{ message: { content: mockAnalysisResponse } }] }) };
      });
      const result = callOpenAI('test prompt');
      expect(attempts).toBe(2);
      expect(result).toContain('trend');
    });
  });

  // ============================================================
  // 4. Error Handling Tests
  // ============================================================
  describe('Error Handling', () => {
    describe('Invalid CSV Processing', () => {
      it('should throw error for unknown platform', () => {
        mockParseCsv.mockReturnValue([['Header'], ['Value']]);
        expect(() => parseCSV('data', 'unknown_platform')).toThrow('Unknown platform');
      });

      it('should throw error for CSV with no data rows', () => {
        mockParseCsv.mockReturnValue([['Header Only']]);
        expect(() => parseCSV('data', 'youtube')).toThrow('CSV has no data rows');
      });

      it('should filter out rows missing required fields', () => {
        mockParseCsv.mockReturnValue([
          ['Video ID', 'Views', 'Title'],
          ['vid001', '1000', 'Good Video'],
          ['', '500', 'Missing ID'],
          ['vid002', '', 'Missing Views']
        ]);
        const result = parseCSV('data', 'youtube');
        expect(result).toHaveLength(1);
        expect(result[0].video_id).toBe('vid001');
      });

      it('should handle malformed percentage values', () => {
        mockParseCsv.mockReturnValue([
          ['Video ID', 'Views', 'CTR'],
          ['vid001', '1000', 'not-a-percent']
        ]);
        const result = parseCSV('data', 'youtube');
        expect(result[0].ctr).toBeNull();
      });
    });

    describe('API Failure Fallback', () => {
      it('should throw after max retry attempts', () => {
        mockFetch.mockImplementation(() => { throw new Error('Network error'); });
        expect(() => callOpenAI('test prompt')).toThrow();
        expect(mockFetch).toHaveBeenCalledTimes(CONFIG.RETRY.MAX_ATTEMPTS);
      });

      it('should use KPI defaults when sheet access fails', () => {
        // Temporarily override mockSheets
        const originalKpiSheet = mockSheets.kpi_targets;
        delete mockSheets.kpi_targets;
        const targets = getKPITargets();
        expect(targets).toEqual(CONFIG.KPI_DEFAULTS);
        mockSheets.kpi_targets = originalKpiSheet;
      });
    });

    describe('Partial Failure Handling', () => {
      it('should continue processing when some videos fail to link', () => {
        mockParseCsv.mockReturnValue([
          ['Video ID', 'Views', 'Title'],
          ['yt_abc123', '10000', 'Known Video'],
          ['yt_unknown1', '5000', 'Unknown Video 1'],
          ['yt_unknown2', '3000', 'Unknown Video 2']
        ]);
        const parsed = parseCSV('data', 'youtube');
        const normalized = normalizeMetrics(parsed, 'youtube');
        const { linked, unlinked } = linkVideos(normalized, 'youtube');
        expect(linked).toHaveLength(1);
        expect(unlinked).toHaveLength(2);
        writeMetrics(linked, 'youtube');
        writeUnlinked(unlinked, 'youtube');
        expect(mockSheets.unlinked_imports._getData().length).toBe(3);
      });

      it('should handle empty metrics bundle gracefully', () => {
        mockSheets.metrics_youtube._setData([['video_uid']]);
        mockSheets.metrics_tiktok._setData([['video_uid']]);
        mockSheets.metrics_instagram._setData([['video_uid']]);
        const bundle = getMetricsBundle(['VID_NONEXISTENT']);
        const targets = getKPITargets();
        const results = compareKPIs(bundle, targets);
        expect(results).toHaveLength(1);
        expect(results[0].overall_score).toBe(0);
      });
    });

    describe('Sheet Write Errors', () => {
      it('should log warning for header mismatch on non-empty sheet', () => {
        mockSheets.metrics_youtube._setData([['wrong_header1', 'wrong_header2'], ['data1', 'data2']]);
        const metrics = [{ video_uid: 'VID_001', views: 1000 }];
        writeMetrics(metrics, 'youtube');
        expect(Logger.log).toHaveBeenCalledWith(expect.stringContaining('Warning'));
      });
    });
  });

  // ============================================================
  // 5. Full Integration Tests
  // ============================================================
  describe('Full Integration Flow', () => {
    it('should complete end-to-end flow: import → analyze → report', () => {
      mockParseCsv.mockReturnValue([
        ['Video ID', 'Views', 'Likes', 'CTR', 'Watch time (hours)'],
        ['yt_abc123', '10000', '500', '6%', '250']
      ]);

      const ytParsed = parseCSV('data', 'youtube');
      const ytNorm = normalizeMetrics(ytParsed, 'youtube');
      const { linked } = linkVideos(ytNorm, 'youtube');
      writeMetrics(linked, 'youtube');

      expect(linked).toHaveLength(1);
      expect(linked[0].video_uid).toBe('VID_202602_0001');

      mockSheets.metrics_youtube._setData([
        ['video_uid', 'completion_rate', 'ctr', 'engagement_rate', 'views'],
        ['VID_202602_0001', 0.55, 0.06, 0.05, 10000]
      ]);

      const bundle = getMetricsBundle(['VID_202602_0001']);
      const targets = getKPITargets();
      const kpiResults = compareKPIs(bundle, targets);

      expect(kpiResults).toHaveLength(1);
      expect(kpiResults[0].overall_score).toBeGreaterThan(0);

      let llmCallCount = 0;
      mockFetch.mockImplementation(() => {
        llmCallCount++;
        const content = llmCallCount === 1 ? 'trend\tGood performance overall\thigh\tmedium' : '1\thook\tImprove opening\tall\t+10%';
        return { getResponseCode: () => 200, getContentText: () => JSON.stringify({ choices: [{ message: { content } }] }) };
      });

      const analysis = analyzWithLLM(bundle, kpiResults);
      expect(analysis.report_id).toMatch(/^RPT_/);
      expect(analysis.analysis.insights.length).toBeGreaterThan(0);

      writeAnalysisReport(analysis);
      writeRecommendations(analysis.recommendations);

      expect(mockSheets.analysis_reports._getData().length).toBeGreaterThan(1);
      expect(mockSheets.recommendations._getData().length).toBeGreaterThan(1);
    });

    it('should handle complete doPost workflow for import_csv action', () => {
      mockParseCsv.mockReturnValue([
        ['Video ID', 'Views', 'Likes'],
        ['yt_abc123', '10000', '500']
      ]);

      const mockEvent = {
        postData: { contents: JSON.stringify({ action: 'import_csv', platform: 'youtube', csv_data: Buffer.from('mock csv content').toString('base64') }) }
      };

      const response = doPost(mockEvent);
      const result = JSON.parse(response);

      expect(result.status).toBe('success');
      expect(result.data.platform).toBe('youtube');
      expect(result.data.total_rows).toBe(1);
    });

    it('should handle complete doPost workflow for analyze action', () => {
      mockSheets.metrics_youtube._setData([
        ['video_uid', 'completion_rate', 'ctr', 'views'],
        ['VID_202602_0001', 0.55, 0.06, 10000]
      ]);

      mockFetch.mockImplementation(() => ({
        getResponseCode: () => 200,
        getContentText: () => JSON.stringify({ choices: [{ message: { content: 'trend\tTest insight\thigh\tmedium' } }] })
      }));

      const mockEvent = {
        postData: { contents: JSON.stringify({ action: 'analyze', video_uids: ['VID_202602_0001'] }) }
      };

      const response = doPost(mockEvent);
      const result = JSON.parse(response);

      expect(result.status).toBe('success');
      expect(result.data.analyzed_count).toBe(1);
      expect(result.data.report_id).toMatch(/^RPT_/);
    });

    it('should return error response for invalid action', () => {
      const mockEvent = { postData: { contents: JSON.stringify({ action: 'invalid_action' }) } };
      const response = doPost(mockEvent);
      const result = JSON.parse(response);
      expect(result.status).toBe('error');
      expect(result.error).toContain('Unknown action');
    });
  });
});
