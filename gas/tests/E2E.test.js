/**
 * E2E Tests - End-to-End Integration Tests
 *
 * Tests the complete flow: CSV Import → Analysis → Report Output
 * Run with: npm test -- gas/tests/E2E.test.js
 */

const fs = require('fs');
const path = require('path');

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

// Mock PropertiesService
global.PropertiesService = {
  getScriptProperties: () => ({
    getProperty: jest.fn((key) => {
      if (key === 'SPREADSHEET_ID') return 'test-spreadsheet-id';
      if (key === 'OPENAI_API_KEY') return 'test-api-key';
      return null;
    })
  })
};

// Mock ContentService
global.ContentService = {
  createTextOutput: jest.fn((content) => ({
    setMimeType: jest.fn(() => content)
  })),
  MimeType: {
    JSON: 'application/json'
  }
};

// Mock UrlFetchApp for LLM calls
const mockFetch = jest.fn();
global.UrlFetchApp = {
  fetch: mockFetch
};

// Mock SpreadsheetApp
const mockSheets = {};
let mockSpreadsheet;

global.SpreadsheetApp = {
  openById: jest.fn(() => mockSpreadsheet)
};

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
          if (!sheetData[row - 1 + i]) {
            sheetData[row - 1 + i] = [];
          }
          for (let j = 0; j < values[i].length; j++) {
            sheetData[row - 1 + i][col - 1 + j] = values[i][j];
          }
        }
      }),
      setValue: jest.fn((value) => {
        if (!sheetData[row - 1]) {
          sheetData[row - 1] = [];
        }
        sheetData[row - 1][col - 1] = value;
      })
    })),
    appendRow: jest.fn((row) => {
      sheetData.push([...row]);
    }),
    deleteRows: jest.fn((startRow, numRows) => {
      sheetData.splice(startRow - 1, numRows);
    }),
    deleteRow: jest.fn((rowIndex) => {
      sheetData.splice(rowIndex - 1, 1);
    }),
    setFrozenRows: jest.fn(),
    insertSheet: jest.fn(),
    // Expose internal data for assertions
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

// Mock CONFIG
global.CONFIG = {
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
  RETRY: {
    MAX_ATTEMPTS: 3,
    BASE_DELAY_MS: 100,
    MAX_DELAY_MS: 500
  }
};

// Helper to mock getSheet and getSpreadsheet
global.getSpreadsheet = jest.fn(() => mockSpreadsheet);
global.getSheet = jest.fn((sheetName) => {
  const sheet = mockSheets[sheetName];
  if (!sheet) {
    throw new Error(`Sheet not found: ${sheetName}`);
  }
  return sheet;
});

// Load GAS source files
const gasFiles = [
  'CSVParser.gs',
  'Normalizer.gs',
  'Linker.gs',
  'KPIEngine.gs',
  'SheetWriter.gs',
  'LLMAnalyzer.gs',
  'Code.gs'
];

gasFiles.forEach(file => {
  const filePath = path.join(__dirname, '..', file);
  if (fs.existsSync(filePath)) {
    const code = fs.readFileSync(filePath, 'utf8');
    // Skip the CONFIG declaration since we mock it globally
    const modifiedCode = code.replace(/^const CONFIG = \{[\s\S]*?\};$/m, '');
    eval(modifiedCode);
  }
});

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
        // Arrange: YouTube CSV data
        mockParseCsv.mockReturnValue([
          ['Video ID', 'Title', 'Views', 'Likes', 'Comments', 'Watch time (hours)', 'CTR'],
          ['yt_abc123', 'Test Video 1', '10000', '500', '50', '250', '5%'],
          ['yt_new001', 'New Unlinked Video', '5000', '200', '20', '100', '3%']
        ]);

        // Act: Simulate handleImportCSV
        const csvContent = 'Video ID,Title,Views...'; // Base64 decoded content
        const parsed = parseCSV(csvContent, 'youtube');
        const normalized = normalizeMetrics(parsed, 'youtube');
        const { linked, unlinked } = linkVideos(normalized, 'youtube');

        // Assert: Parse results
        expect(parsed).toHaveLength(2);
        expect(parsed[0].video_id).toBe('yt_abc123');
        expect(parsed[0].views).toBe(10000);
        expect(parsed[0].ctr).toBe(0.05);

        // Assert: Normalization
        expect(normalized[0].platform).toBe('youtube');
        expect(normalized[0].platform_id).toBe('yt_abc123');
        expect(normalized[0].engagement_rate).toBeCloseTo(0.055); // (500+50+0)/10000

        // Assert: Linking
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

        // Verify sheet was updated
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
        // Import YouTube
        mockParseCsv.mockReturnValue([
          ['Video ID', 'Views', 'Likes'],
          ['yt_abc123', '10000', '500']
        ]);
        const ytParsed = parseCSV('data', 'youtube');
        const ytNorm = normalizeMetrics(ytParsed, 'youtube');
        const { linked: ytLinked } = linkVideos(ytNorm, 'youtube');

        // Import TikTok
        mockParseCsv.mockReturnValue([
          ['Video ID', 'Video views', 'Likes'],
          ['tt_001', '50000', '3000']
        ]);
        const ttParsed = parseCSV('data', 'tiktok');
        const ttNorm = normalizeMetrics(ttParsed, 'tiktok');
        const { linked: ttLinked } = linkVideos(ttNorm, 'tiktok');

        // Import Instagram
        mockParseCsv.mockReturnValue([
          ['Reel ID', 'Plays', 'Likes'],
          ['ig_001', '30000', '1500']
        ]);
        const igParsed = parseCSV('data', 'instagram');
        const igNorm = normalizeMetrics(igParsed, 'instagram');
        const { linked: igLinked } = linkVideos(igNorm, 'instagram');

        // All should link to same video_uid
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
      // Setup metrics data in sheets
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

      // YouTube: completion 0.55 > 0.50 (above), ctr 0.06 > 0.05 (above)
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

      // VID_0002 has low completion (0.35 < 0.50) and low ctr (0.03 < 0.05)
      expect(results[0].improvement_areas.length).toBeGreaterThan(0);
      expect(results[0].improvement_areas[0].platform).toBe('youtube');
    });

    it('should sort results by overall score (lowest first)', () => {
      const bundle = getMetricsBundle(['VID_202602_0001', 'VID_202602_0002']);
      const targets = getKPITargets();
      const results = compareKPIs(bundle, targets);

      // Lower score should come first
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
strength\tStrong hook effectiveness in first 3 seconds\thigh\thigh
weakness\tLower retention in mid-section\tmedium\thigh
opportunity\tCross-platform content repurposing potential\tmedium\tmedium`;

    const mockRecommendationsResponse = `1\thook\tStart with question to boost retention\tall\t+10% completion
2\tpacing\tShorten mid-section by 20%\tyoutube\t+15% watch time
3\tplatform\tUse trending sounds on TikTok\ttiktok\t+25% views
4\tformat\tTest vertical format on YouTube Shorts\tyoutube\t+30% reach`;

    beforeEach(() => {
      mockSheets.metrics_youtube._setData([
        ['video_uid', 'completion_rate', 'ctr', 'engagement_rate', 'views'],
        ['VID_202602_0001', 0.55, 0.06, 0.04, 10000]
      ]);

      // Mock OpenAI API responses
      let callCount = 0;
      mockFetch.mockImplementation(() => {
        callCount++;
        const content = callCount === 1 ? mockAnalysisResponse : mockRecommendationsResponse;
        return {
          getResponseCode: () => 200,
          getContentText: () => JSON.stringify({
            choices: [{ message: { content } }]
          })
        };
      });
    });

    it('should build analysis context from metrics and KPI results', () => {
      const metricsBundle = {
        'VID_202602_0001': {
          youtube: { completion_rate: 0.55, ctr: 0.06, views: 10000 }
        }
      };

      const kpiResults = [{
        video_uid: 'VID_202602_0001',
        overall_score: 80,
        platforms: { youtube: { score: 80, above_target: [], below_target: [] } },
        improvement_areas: []
      }];

      const context = buildAnalysisContext(metricsBundle, kpiResults);

      expect(context.videos).toHaveLength(1);
      expect(context.videos[0].video_uid).toBe('VID_202602_0001');
      expect(context.summary.total_videos).toBe(1);
      expect(context.summary.platform_coverage.youtube).toBe(1);
    });

    it('should call LLM and parse analysis response', () => {
      const metricsBundle = {
        'VID_202602_0001': { youtube: { completion_rate: 0.55 } }
      };
      const kpiResults = [{
        video_uid: 'VID_202602_0001',
        overall_score: 80,
        platforms: {},
        improvement_areas: []
      }];

      const result = analyzWithLLM(metricsBundle, kpiResults);

      expect(result.report_id).toMatch(/^RPT_/);
      expect(result.analysis.insights).toBeDefined();
      expect(result.analysis.insights.length).toBeGreaterThan(0);
      expect(result.analysis.insights[0].category).toBe('trend');
    });

    it('should parse recommendations from LLM response', () => {
      const metricsBundle = {
        'VID_202602_0001': { youtube: { completion_rate: 0.55 } }
      };
      const kpiResults = [{
        video_uid: 'VID_202602_0001',
        overall_score: 80,
        platforms: {},
        improvement_areas: []
      }];

      const result = analyzWithLLM(metricsBundle, kpiResults);

      expect(result.recommendations).toBeDefined();
      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(result.recommendations[0].priority).toBe(1);
      expect(result.recommendations[0].category).toBe('hook');
    });

    it('should write analysis report to sheet', () => {
      const analysis = {
        report_id: 'RPT_20260206_001',
        generated_at: '2026-02-06T12:00:00Z',
        video_count: 1,
        analysis: { insights: [] }
      };

      writeAnalysisReport(analysis);

      const sheetData = mockSheets.analysis_reports._getData();
      expect(sheetData.length).toBeGreaterThan(1);
    });

    it('should write recommendations to sheet', () => {
      const recommendations = [
        { priority: 1, category: 'hook', recommendation: 'Test recommendation', platform: 'all', expected_impact: '+10%' }
      ];

      writeRecommendations(recommendations);

      const sheetData = mockSheets.recommendations._getData();
      expect(sheetData.length).toBeGreaterThan(1);
    });

    it('should handle LLM rate limiting with retry', () => {
      let attempts = 0;
      mockFetch.mockImplementation(() => {
        attempts++;
        if (attempts < 2) {
          return {
            getResponseCode: () => 429,
            getContentText: () => 'Rate limited'
          };
        }
        return {
          getResponseCode: () => 200,
          getContentText: () => JSON.stringify({
            choices: [{ message: { content: mockAnalysisResponse } }]
          })
        };
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
        mockParseCsv.mockReturnValue([
          ['Header'],
          ['Value']
        ]);

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
          ['', '500', 'Missing ID'],  // No video_id
          ['vid002', '', 'Missing Views']  // No views
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
        mockFetch.mockImplementation(() => {
          throw new Error('Network error');
        });

        expect(() => callOpenAI('test prompt')).toThrow();
        expect(mockFetch).toHaveBeenCalledTimes(CONFIG.RETRY.MAX_ATTEMPTS);
      });

      it('should use KPI defaults when sheet access fails', () => {
        global.getSheet.mockImplementation(() => {
          throw new Error('Sheet not found');
        });

        const targets = getKPITargets();

        expect(targets).toEqual(CONFIG.KPI_DEFAULTS);
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

        // Both operations should work independently
        writeMetrics(linked, 'youtube');
        writeUnlinked(unlinked, 'youtube');

        expect(mockSheets.unlinked_imports._getData().length).toBe(3); // Header + 2 unlinked
      });

      it('should handle empty metrics bundle gracefully', () => {
        global.getSheet.mockImplementation((name) => {
          if (name.startsWith('metrics_')) {
            return createMockSheet(name, [['video_uid']]);
          }
          return mockSheets[name];
        });

        const bundle = getMetricsBundle(['VID_NONEXISTENT']);
        const targets = getKPITargets();
        const results = compareKPIs(bundle, targets);

        expect(results).toHaveLength(1);
        expect(results[0].overall_score).toBe(0);
      });
    });

    describe('Sheet Write Errors', () => {
      it('should log warning for header mismatch on non-empty sheet', () => {
        mockSheets.metrics_youtube._setData([
          ['wrong_header1', 'wrong_header2'],
          ['data1', 'data2']
        ]);

        const metrics = [{
          video_uid: 'VID_001',
          views: 1000
        }];

        // Should not throw, but log warning
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
      // Step 1: Import YouTube CSV
      mockParseCsv.mockReturnValue([
        ['Video ID', 'Views', 'Likes', 'CTR', 'Watch time (hours)'],
        ['yt_abc123', '10000', '500', '6%', '250']
      ]);

      const ytParsed = parseCSV('data', 'youtube');
      const ytNorm = normalizeMetrics(ytParsed, 'youtube');
      const { linked } = linkVideos(ytNorm, 'youtube');
      writeMetrics(linked, 'youtube');

      // Verify import
      expect(linked).toHaveLength(1);
      expect(linked[0].video_uid).toBe('VID_202602_0001');

      // Step 2: Update metrics sheet for KPI analysis
      mockSheets.metrics_youtube._setData([
        ['video_uid', 'completion_rate', 'ctr', 'engagement_rate', 'views'],
        ['VID_202602_0001', 0.55, 0.06, 0.05, 10000]
      ]);

      // Step 3: Run KPI Analysis
      const bundle = getMetricsBundle(['VID_202602_0001']);
      const targets = getKPITargets();
      const kpiResults = compareKPIs(bundle, targets);

      expect(kpiResults).toHaveLength(1);
      expect(kpiResults[0].overall_score).toBeGreaterThan(0);

      // Step 4: Mock LLM for analysis
      let llmCallCount = 0;
      mockFetch.mockImplementation(() => {
        llmCallCount++;
        const content = llmCallCount === 1
          ? 'trend\tGood performance overall\thigh\tmedium'
          : '1\thook\tImprove opening\tall\t+10%';
        return {
          getResponseCode: () => 200,
          getContentText: () => JSON.stringify({
            choices: [{ message: { content } }]
          })
        };
      });

      // Step 5: Run LLM Analysis
      const analysis = analyzWithLLM(bundle, kpiResults);

      expect(analysis.report_id).toMatch(/^RPT_/);
      expect(analysis.analysis.insights.length).toBeGreaterThan(0);

      // Step 6: Write Reports
      writeAnalysisReport(analysis);
      writeRecommendations(analysis.recommendations);

      // Verify reports written
      expect(mockSheets.analysis_reports._getData().length).toBeGreaterThan(1);
      expect(mockSheets.recommendations._getData().length).toBeGreaterThan(1);
    });

    it('should handle complete doPost workflow for import_csv action', () => {
      mockParseCsv.mockReturnValue([
        ['Video ID', 'Views', 'Likes'],
        ['yt_abc123', '10000', '500']
      ]);

      const mockEvent = {
        postData: {
          contents: JSON.stringify({
            action: 'import_csv',
            platform: 'youtube',
            csv_data: Buffer.from('mock csv content').toString('base64')
          })
        }
      };

      const response = doPost(mockEvent);
      const result = JSON.parse(response);

      expect(result.status).toBe('success');
      expect(result.data.platform).toBe('youtube');
      expect(result.data.total_rows).toBe(1);
    });

    it('should handle complete doPost workflow for analyze action', () => {
      // Setup metrics
      mockSheets.metrics_youtube._setData([
        ['video_uid', 'completion_rate', 'ctr', 'views'],
        ['VID_202602_0001', 0.55, 0.06, 10000]
      ]);

      // Mock LLM
      mockFetch.mockImplementation(() => ({
        getResponseCode: () => 200,
        getContentText: () => JSON.stringify({
          choices: [{ message: { content: 'trend\tTest insight\thigh\tmedium' } }]
        })
      }));

      const mockEvent = {
        postData: {
          contents: JSON.stringify({
            action: 'analyze',
            video_uids: ['VID_202602_0001']
          })
        }
      };

      const response = doPost(mockEvent);
      const result = JSON.parse(response);

      expect(result.status).toBe('success');
      expect(result.data.analyzed_count).toBe(1);
      expect(result.data.report_id).toMatch(/^RPT_/);
    });

    it('should return error response for invalid action', () => {
      const mockEvent = {
        postData: {
          contents: JSON.stringify({
            action: 'invalid_action'
          })
        }
      };

      const response = doPost(mockEvent);
      const result = JSON.parse(response);

      expect(result.status).toBe('error');
      expect(result.error).toContain('Unknown action');
    });
  });
});
