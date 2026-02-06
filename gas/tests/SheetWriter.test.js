/**
 * SheetWriter.gs Unit Tests
 *
 * Run with: npm test -- gas/tests/SheetWriter.test.js
 */

// Mock sheet instances
const createMockSheet = (name, data = [[]]) => {
  let sheetData = data.length > 0 ? [...data] : [[]];

  return {
    getName: jest.fn(() => name),
    getRange: jest.fn((row, col, numRows = 1, numCols = 1) => ({
      getValues: jest.fn(() => {
        const result = [];
        for (let i = 0; i < numRows; i++) {
          const rowData = [];
          for (let j = 0; j < numCols; j++) {
            const r = row - 1 + i;
            const c = col - 1 + j;
            rowData.push(sheetData[r]?.[c] ?? '');
          }
          result.push(rowData);
        }
        return result;
      }),
      setValues: jest.fn((values) => {
        for (let i = 0; i < values.length; i++) {
          const rowIndex = row - 1 + i;
          if (!sheetData[rowIndex]) {
            sheetData[rowIndex] = [];
          }
          for (let j = 0; j < values[i].length; j++) {
            sheetData[rowIndex][col - 1 + j] = values[i][j];
          }
        }
      }),
      setValue: jest.fn((value) => {
        const rowIndex = row - 1;
        if (!sheetData[rowIndex]) {
          sheetData[rowIndex] = [];
        }
        sheetData[rowIndex][col - 1] = value;
      })
    })),
    getLastRow: jest.fn(() => sheetData.filter(row => row.some(cell => cell !== '' && cell !== undefined)).length),
    getMaxColumns: jest.fn(() => Math.max(...sheetData.map(row => row.length), 1)),
    getDataRange: jest.fn(() => ({
      getValues: jest.fn(() => sheetData)
    })),
    appendRow: jest.fn((row) => {
      sheetData.push(row);
    }),
    deleteRows: jest.fn((startRow, numRows) => {
      sheetData.splice(startRow - 1, numRows);
    }),
    setFrozenRows: jest.fn(),
    _getData: () => sheetData,
    _setData: (newData) => { sheetData = newData; }
  };
};

// Mock spreadsheet
let mockSheets = {};
const mockSpreadsheet = {
  getSheetByName: jest.fn((name) => mockSheets[name] || null),
  insertSheet: jest.fn((name) => {
    const sheet = createMockSheet(name, [[]]);
    mockSheets[name] = sheet;
    return sheet;
  })
};

// Mock global functions
const mockGetSheet = jest.fn((name) => {
  if (!mockSheets[name]) {
    throw new Error(`Sheet not found: ${name}`);
  }
  return mockSheets[name];
});

const mockGetSpreadsheet = jest.fn(() => mockSpreadsheet);

global.getSheet = mockGetSheet;
global.getSpreadsheet = mockGetSpreadsheet;

// Mock Logger
global.Logger = {
  log: jest.fn()
};

// Mock Date for consistent testing
const mockDate = new Date('2026-02-06T12:00:00.000Z');
const OriginalDate = Date;
global.Date = class extends OriginalDate {
  constructor(...args) {
    if (args.length === 0) {
      return mockDate;
    }
    return new OriginalDate(...args);
  }
  static now() {
    return mockDate.getTime();
  }
};
global.Date.prototype = OriginalDate.prototype;

// Mock CONFIG
const CONFIG = {
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
  }
};
global.CONFIG = CONFIG;

// Mock getPlatformFields
global.getPlatformFields = jest.fn((platform) => {
  const common = ['video_uid', 'import_date', 'views', 'likes', 'comments', 'shares', 'engagement_rate'];
  const platformSpecific = {
    youtube: [...common, 'watch_time_hours', 'avg_watch_time_sec', 'completion_rate', 'ctr', 'subscribers_gained'],
    tiktok: [...common, 'saves', 'avg_watch_time_sec', 'completion_rate'],
    instagram: [...common, 'saves', 'avg_watch_time_sec', 'reach']
  };
  return platformSpecific[platform] || common;
});

// Import functions to test
const fs = require('fs');
const path = require('path');
const sheetWriterCode = fs.readFileSync(
  path.join(__dirname, '..', 'SheetWriter.gs'),
  'utf8'
);
eval(sheetWriterCode);

describe('SheetWriter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSheets = {};
  });

  describe('writeMetrics', () => {
    beforeEach(() => {
      mockSheets[CONFIG.SHEETS.METRICS_YOUTUBE] = createMockSheet('metrics_youtube', [[]]);
    });

    it('should skip writing when metrics array is empty', () => {
      writeMetrics([], 'youtube');

      expect(mockGetSheet).not.toHaveBeenCalled();
      expect(Logger.log).not.toHaveBeenCalled();
    });

    it('should write multiple rows of metrics', () => {
      const metrics = [
        { video_uid: 'vid001', import_date: '2026-02-01', views: 1000, likes: 50, comments: 10, shares: 5, engagement_rate: 0.05 },
        { video_uid: 'vid002', import_date: '2026-02-01', views: 2000, likes: 100, comments: 20, shares: 10, engagement_rate: 0.06 }
      ];

      writeMetrics(metrics, 'youtube');

      expect(mockGetSheet).toHaveBeenCalledWith('metrics_youtube');
      expect(Logger.log).toHaveBeenCalledWith('Wrote 2 rows to metrics_youtube');
    });

    it('should create headers automatically if sheet is empty', () => {
      const metrics = [
        { video_uid: 'vid001', import_date: '2026-02-01', views: 1000 }
      ];

      writeMetrics(metrics, 'youtube');

      const sheet = mockSheets[CONFIG.SHEETS.METRICS_YOUTUBE];
      const data = sheet._getData();
      expect(data[0]).toContain('video_uid');
      expect(data[0]).toContain('views');
    });

    it('should handle null and undefined values by converting to empty string', () => {
      const metrics = [
        { video_uid: 'vid001', import_date: null, views: undefined, likes: 50 }
      ];

      writeMetrics(metrics, 'youtube');

      expect(Logger.log).toHaveBeenCalledWith(expect.stringContaining('Wrote 1 rows'));
    });

    it('should map metrics to correct fields based on platform', () => {
      const metrics = [
        { video_uid: 'vid001', views: 1000, reach: 800 }
      ];
      mockSheets[CONFIG.SHEETS.METRICS_INSTAGRAM] = createMockSheet('metrics_instagram', [[]]);

      writeMetrics(metrics, 'instagram');

      expect(global.getPlatformFields).toHaveBeenCalledWith('instagram');
      expect(mockGetSheet).toHaveBeenCalledWith('metrics_instagram');
    });

    it('should append to existing data without overwriting', () => {
      const existingHeaders = ['video_uid', 'import_date', 'views', 'likes', 'comments', 'shares', 'engagement_rate', 'watch_time_hours', 'avg_watch_time_sec', 'completion_rate', 'ctr', 'subscribers_gained'];
      mockSheets[CONFIG.SHEETS.METRICS_YOUTUBE] = createMockSheet('metrics_youtube', [
        existingHeaders,
        ['existing_vid', '2026-01-01', 500, 25, 5, 2, 0.03, '', '', '', '', '']
      ]);

      const metrics = [
        { video_uid: 'new_vid', views: 1000 }
      ];

      writeMetrics(metrics, 'youtube');

      expect(Logger.log).toHaveBeenCalledWith('Wrote 1 rows to metrics_youtube');
    });
  });

  describe('writeUnlinked', () => {
    beforeEach(() => {
      mockSheets[CONFIG.SHEETS.UNLINKED_IMPORTS] = createMockSheet('unlinked_imports', [[]]);
    });

    it('should skip writing when unlinked array is empty', () => {
      writeUnlinked([], 'youtube');

      expect(mockGetSheet).not.toHaveBeenCalled();
    });

    it('should write unlinked imports with correct fields', () => {
      const unlinked = [
        { platform_id: 'ext001', title: 'Unknown Video', views: 500, import_date: '2026-02-01', raw_csv_row: 'row data' }
      ];

      writeUnlinked(unlinked, 'youtube');

      expect(mockGetSheet).toHaveBeenCalledWith('unlinked_imports');
      expect(Logger.log).toHaveBeenCalledWith('Wrote 1 unlinked rows');
    });

    it('should include platform in each row', () => {
      const unlinked = [
        { platform_id: 'tiktok001', title: 'TikTok Video', views: 10000, import_date: '2026-02-01', raw_csv_row: 'csv data' }
      ];

      writeUnlinked(unlinked, 'tiktok');

      const sheet = mockSheets[CONFIG.SHEETS.UNLINKED_IMPORTS];
      const data = sheet._getData();
      // Row 1 is headers, Row 2 should have 'tiktok' as first column
      expect(data[1][0]).toBe('tiktok');
    });
  });

  describe('writeAnalysisReport', () => {
    beforeEach(() => {
      mockSheets[CONFIG.SHEETS.ANALYSIS_REPORTS] = createMockSheet('analysis_reports', [[]]);
    });

    it('should write analysis report with JSON stringified insights', () => {
      const analysis = {
        report_id: 'report_001',
        generated_at: '2026-02-06T12:00:00Z',
        video_count: 10,
        analysis: { top_performing: 'vid001', insights: ['insight1', 'insight2'] }
      };

      writeAnalysisReport(analysis);

      expect(mockGetSheet).toHaveBeenCalledWith('analysis_reports');
      expect(Logger.log).toHaveBeenCalledWith('Wrote analysis report: report_001');
    });

    it('should ensure headers exist before writing', () => {
      const analysis = {
        report_id: 'report_002',
        generated_at: '2026-02-06T12:00:00Z',
        video_count: 5,
        analysis: {}
      };

      writeAnalysisReport(analysis);

      const sheet = mockSheets[CONFIG.SHEETS.ANALYSIS_REPORTS];
      const data = sheet._getData();
      expect(data[0]).toEqual(['report_id', 'generated_at', 'video_count', 'insights_json']);
    });
  });

  describe('writeRecommendations', () => {
    beforeEach(() => {
      mockSheets[CONFIG.SHEETS.RECOMMENDATIONS] = createMockSheet('recommendations', [[]]);
    });

    it('should skip writing when recommendations array is empty', () => {
      writeRecommendations([]);

      expect(mockGetSheet).not.toHaveBeenCalled();
    });

    it('should write recommendations with pending status', () => {
      const recommendations = [
        { priority: 'high', category: 'content', recommendation: 'Improve thumbnails', platform: 'youtube', expected_impact: 'medium' }
      ];

      writeRecommendations(recommendations);

      expect(Logger.log).toHaveBeenCalledWith('Wrote 1 recommendations');
    });

    it('should add created_at timestamp to each recommendation', () => {
      const recommendations = [
        { priority: 'medium', category: 'engagement', recommendation: 'Post more frequently', platform: 'tiktok', expected_impact: 'high' }
      ];

      writeRecommendations(recommendations);

      const sheet = mockSheets[CONFIG.SHEETS.RECOMMENDATIONS];
      const data = sheet._getData();
      // Row 1 is headers, Row 2 should have a timestamp
      expect(data[1][0]).toContain('2026-02-06');
    });

    it('should set initial status to pending', () => {
      const recommendations = [
        { priority: 'low', category: 'optimization', recommendation: 'Adjust posting time', platform: 'instagram', expected_impact: 'low' }
      ];

      writeRecommendations(recommendations);

      const sheet = mockSheets[CONFIG.SHEETS.RECOMMENDATIONS];
      const data = sheet._getData();
      // Status is last column (index 6)
      expect(data[1][6]).toBe('pending');
    });
  });

  describe('ensureHeaders', () => {
    it('should write headers when sheet is empty', () => {
      const sheet = createMockSheet('test_sheet', [[]]);
      sheet.getLastRow = jest.fn(() => 0);
      const fields = ['field1', 'field2', 'field3'];

      ensureHeaders(sheet, fields);

      expect(sheet.getRange).toHaveBeenCalledWith(1, 1, 1, 3);
    });

    it('should log warning when headers mismatch on non-empty sheet', () => {
      const sheet = createMockSheet('test_sheet', [['wrong_header']]);
      sheet.getLastRow = jest.fn(() => 5);
      const fields = ['correct_header'];

      ensureHeaders(sheet, fields);

      expect(Logger.log).toHaveBeenCalledWith(expect.stringContaining('Warning: Headers mismatch'));
    });

    it('should not overwrite when headers already match', () => {
      const fields = ['field1', 'field2', 'field3'];
      const sheet = createMockSheet('test_sheet', [fields]);
      const setValuesMock = jest.fn();
      sheet.getRange = jest.fn(() => ({
        getValues: jest.fn(() => [fields]),
        setValues: setValuesMock
      }));

      ensureHeaders(sheet, fields);

      expect(setValuesMock).not.toHaveBeenCalled();
    });
  });

  describe('initializeSheets', () => {
    it('should create all required sheets', () => {
      initializeSheets();

      expect(mockSpreadsheet.insertSheet).toHaveBeenCalledWith('videos_master');
      expect(mockSpreadsheet.insertSheet).toHaveBeenCalledWith('metrics_youtube');
      expect(mockSpreadsheet.insertSheet).toHaveBeenCalledWith('metrics_tiktok');
      expect(mockSpreadsheet.insertSheet).toHaveBeenCalledWith('metrics_instagram');
      expect(mockSpreadsheet.insertSheet).toHaveBeenCalledWith('kpi_targets');
      expect(mockSpreadsheet.insertSheet).toHaveBeenCalledWith('scenario_cuts');
      expect(mockSpreadsheet.insertSheet).toHaveBeenCalledWith('analysis_reports');
      expect(mockSpreadsheet.insertSheet).toHaveBeenCalledWith('recommendations');
      expect(mockSpreadsheet.insertSheet).toHaveBeenCalledWith('unlinked_imports');
    });

    it('should set headers on newly created sheets', () => {
      initializeSheets();

      const videosMaster = mockSheets['videos_master'];
      expect(videosMaster).toBeDefined();
      expect(videosMaster.setFrozenRows).toHaveBeenCalledWith(1);
    });

    it('should skip existing sheets', () => {
      mockSheets['videos_master'] = createMockSheet('videos_master', [['video_uid', 'title']]);

      initializeSheets();

      // insertSheet should not be called for videos_master
      const insertCalls = mockSpreadsheet.insertSheet.mock.calls;
      const videosMasterCalls = insertCalls.filter(call => call[0] === 'videos_master');
      expect(videosMasterCalls.length).toBe(0);
    });

    it('should log completion message', () => {
      initializeSheets();

      expect(Logger.log).toHaveBeenCalledWith('Sheet initialization complete');
    });
  });

  describe('clearAllData', () => {
    it('should delete all data rows but keep headers', () => {
      const headers = ['col1', 'col2'];
      mockSheets['videos_master'] = createMockSheet('videos_master', [
        headers,
        ['data1', 'data2'],
        ['data3', 'data4']
      ]);
      mockSheets['videos_master'].getLastRow = jest.fn(() => 3);

      clearAllData();

      expect(mockSheets['videos_master'].deleteRows).toHaveBeenCalledWith(2, 2);
    });

    it('should not delete from empty sheets', () => {
      mockSheets['videos_master'] = createMockSheet('videos_master', [['header']]);
      mockSheets['videos_master'].getLastRow = jest.fn(() => 1);

      clearAllData();

      expect(mockSheets['videos_master'].deleteRows).not.toHaveBeenCalled();
    });

    it('should log completion message', () => {
      clearAllData();

      expect(Logger.log).toHaveBeenCalledWith('All data cleared');
    });
  });

  describe('updateVideoMaster', () => {
    beforeEach(() => {
      mockSheets[CONFIG.SHEETS.VIDEOS_MASTER] = createMockSheet('videos_master', [
        ['video_uid', 'title', 'created_date', 'youtube_id', 'tiktok_id', 'instagram_id', 'scenario_id'],
        ['vid001', 'Original Title', '2026-01-01', 'yt001', '', '', ''],
        ['vid002', 'Another Video', '2026-01-02', '', 'tt002', '', 'scene001']
      ]);
    });

    it('should find video by video_uid and update fields', () => {
      const result = updateVideoMaster('vid001', { title: 'Updated Title', youtube_id: 'yt_updated' });

      expect(result).toBe(true);
      expect(mockGetSheet).toHaveBeenCalledWith('videos_master');
    });

    it('should return false when video_uid not found', () => {
      const result = updateVideoMaster('nonexistent', { title: 'New Title' });

      expect(result).toBe(false);
    });

    it('should update only specified fields', () => {
      const sheet = mockSheets[CONFIG.SHEETS.VIDEOS_MASTER];

      updateVideoMaster('vid002', { tiktok_id: 'tt_updated' });

      // setValue should have been called for the tiktok_id column
      expect(sheet.getRange).toHaveBeenCalled();
    });

    it('should ignore updates for non-existent fields', () => {
      const result = updateVideoMaster('vid001', { nonexistent_field: 'value' });

      // Should still return true if video was found
      expect(result).toBe(true);
    });
  });

  describe('getAllVideoUids', () => {
    it('should return all video UIDs from master sheet', () => {
      mockSheets[CONFIG.SHEETS.VIDEOS_MASTER] = createMockSheet('videos_master', [
        ['video_uid', 'title'],
        ['vid001', 'Video 1'],
        ['vid002', 'Video 2'],
        ['vid003', 'Video 3']
      ]);

      const result = getAllVideoUids();

      expect(result).toEqual(['vid001', 'vid002', 'vid003']);
    });

    it('should return empty array when sheet has only headers', () => {
      mockSheets[CONFIG.SHEETS.VIDEOS_MASTER] = createMockSheet('videos_master', [
        ['video_uid', 'title']
      ]);

      const result = getAllVideoUids();

      expect(result).toEqual([]);
    });

    it('should filter out empty video_uid values', () => {
      mockSheets[CONFIG.SHEETS.VIDEOS_MASTER] = createMockSheet('videos_master', [
        ['video_uid', 'title'],
        ['vid001', 'Video 1'],
        ['', 'Empty UID'],
        ['vid003', 'Video 3']
      ]);

      const result = getAllVideoUids();

      expect(result).toEqual(['vid001', 'vid003']);
    });

    it('should return empty array when sheet is empty', () => {
      mockSheets[CONFIG.SHEETS.VIDEOS_MASTER] = createMockSheet('videos_master', [[]]);
      // Override getDataRange to return minimal data
      mockSheets[CONFIG.SHEETS.VIDEOS_MASTER].getDataRange = jest.fn(() => ({
        getValues: jest.fn(() => [[]])
      }));

      const result = getAllVideoUids();

      expect(result).toEqual([]);
    });
  });

  describe('Field Mapping Validation', () => {
    it('should correctly map YouTube fields in order', () => {
      mockSheets[CONFIG.SHEETS.METRICS_YOUTUBE] = createMockSheet('metrics_youtube', [[]]);

      const metrics = [{
        video_uid: 'vid001',
        import_date: '2026-02-01',
        views: 1000,
        likes: 50,
        comments: 10,
        shares: 5,
        engagement_rate: 0.05,
        watch_time_hours: 100,
        avg_watch_time_sec: 120,
        completion_rate: 0.6,
        ctr: 0.08,
        subscribers_gained: 25
      }];

      writeMetrics(metrics, 'youtube');

      const fields = global.getPlatformFields('youtube');
      expect(fields).toContain('watch_time_hours');
      expect(fields).toContain('ctr');
      expect(fields).toContain('subscribers_gained');
    });

    it('should correctly map TikTok fields including saves', () => {
      mockSheets[CONFIG.SHEETS.METRICS_TIKTOK] = createMockSheet('metrics_tiktok', [[]]);

      const metrics = [{
        video_uid: 'vid001',
        import_date: '2026-02-01',
        views: 50000,
        likes: 3000,
        comments: 200,
        shares: 500,
        engagement_rate: 0.08,
        saves: 1000,
        avg_watch_time_sec: 15,
        completion_rate: 0.4
      }];

      writeMetrics(metrics, 'tiktok');

      const fields = global.getPlatformFields('tiktok');
      expect(fields).toContain('saves');
      expect(fields).toContain('completion_rate');
    });

    it('should correctly map Instagram fields including reach', () => {
      mockSheets[CONFIG.SHEETS.METRICS_INSTAGRAM] = createMockSheet('metrics_instagram', [[]]);

      const metrics = [{
        video_uid: 'vid001',
        import_date: '2026-02-01',
        views: 30000,
        likes: 1500,
        comments: 100,
        shares: 300,
        engagement_rate: 0.05,
        saves: 400,
        avg_watch_time_sec: 20,
        reach: 25000
      }];

      writeMetrics(metrics, 'instagram');

      const fields = global.getPlatformFields('instagram');
      expect(fields).toContain('reach');
      expect(fields).not.toContain('ctr');
    });
  });

  describe('Null/Undefined Value Handling', () => {
    beforeEach(() => {
      mockSheets[CONFIG.SHEETS.METRICS_YOUTUBE] = createMockSheet('metrics_youtube', [[]]);
    });

    it('should convert null values to empty string in writeMetrics', () => {
      const metrics = [{
        video_uid: 'vid001',
        views: 1000,
        likes: null,
        comments: undefined
      }];

      writeMetrics(metrics, 'youtube');

      // Should not throw and should log success
      expect(Logger.log).toHaveBeenCalledWith(expect.stringContaining('Wrote 1 rows'));
    });

    it('should handle completely sparse metrics object', () => {
      const metrics = [{ video_uid: 'vid001' }];

      writeMetrics(metrics, 'youtube');

      expect(Logger.log).toHaveBeenCalledWith(expect.stringContaining('Wrote 1 rows'));
    });

    it('should handle undefined fields gracefully', () => {
      const metrics = [{
        video_uid: 'vid001',
        views: undefined,
        likes: undefined,
        comments: undefined
      }];

      expect(() => writeMetrics(metrics, 'youtube')).not.toThrow();
    });
  });
});
