/**
 * Jest setup file for GAS mocks (v2.0)
 * Provides mock implementations of Google Apps Script globals
 */

// Mock Logger
global.Logger = {
  log: jest.fn()
};

// Mock PropertiesService
global.PropertiesService = {
  getScriptProperties: jest.fn(() => ({
    getProperty: jest.fn((key) => {
      const props = {
        SPREADSHEET_ID: 'test-spreadsheet-id',
        OPENAI_API_KEY: 'test-api-key',
        SCENARIOS_INVENTORY_ID: 'test-scenarios-ss-id',
        MOTIONS_INVENTORY_ID: 'test-motions-ss-id',
        CHARACTERS_INVENTORY_ID: 'test-characters-ss-id',
        AUDIO_INVENTORY_ID: 'test-audio-ss-id'
      };
      return props[key] || null;
    }),
    setProperty: jest.fn(),
    setProperties: jest.fn()
  }))
};

// Mock CONFIG (v2.0)
global.CONFIG = {
  VERSION: '2.0.0',
  SPREADSHEET_ID: 'test-spreadsheet-id',
  OPENAI_API_KEY: 'test-api-key',
  OPENAI_MODEL: 'gpt-4o',
  ROOT_FOLDER_ID: 'test-root-folder-id',
  SHEETS: {
    MASTER: 'master',
    PRODUCTION: 'production',
    METRICS_YOUTUBE: 'metrics_youtube',
    METRICS_TIKTOK: 'metrics_tiktok',
    METRICS_INSTAGRAM: 'metrics_instagram',
    KPI_TARGETS: 'kpi_targets',
    ANALYSIS_REPORTS: 'analysis_reports',
    RECOMMENDATIONS: 'recommendations',
    VIDEO_ANALYSIS: 'video_analysis',
    UNLINKED_IMPORTS: 'unlinked_imports'
  },
  INVENTORY_TAB: 'inventory',
  MASTER_COLUMNS: {
    IDENTITY: ['video_uid', 'title', 'status', 'created_date'],
    HOOK: ['hook_scenario_id', 'hook_motion_id', 'hook_audio_id'],
    BODY: ['body_scenario_id', 'body_motion_id', 'body_audio_id'],
    CTA: ['cta_scenario_id', 'cta_motion_id', 'cta_audio_id'],
    CHARACTER: ['character_id'],
    OUTPUT: ['completed_video_url'],
    PLATFORMS: ['youtube_id', 'tiktok_id', 'instagram_id'],
    YT_METRICS: ['yt_views', 'yt_engagement', 'yt_completion'],
    TT_METRICS: ['tt_views', 'tt_engagement', 'tt_completion'],
    IG_METRICS: ['ig_views', 'ig_engagement', 'ig_reach'],
    ANALYSIS: ['overall_score', 'analysis_date', 'top_recommendations'],
    AI_NEXT: [
      'ai_next_hook_scenario', 'ai_next_hook_motion', 'ai_next_hook_audio',
      'ai_next_body_scenario', 'ai_next_body_motion', 'ai_next_body_audio',
      'ai_next_cta_scenario', 'ai_next_cta_motion', 'ai_next_cta_audio',
      'ai_next_character'
    ],
    APPROVAL: ['human_approved', 'approval_notes']
  },
  get MASTER_ALL_COLUMNS() {
    return [].concat(
      this.MASTER_COLUMNS.IDENTITY,
      this.MASTER_COLUMNS.HOOK,
      this.MASTER_COLUMNS.BODY,
      this.MASTER_COLUMNS.CTA,
      this.MASTER_COLUMNS.CHARACTER,
      this.MASTER_COLUMNS.OUTPUT,
      this.MASTER_COLUMNS.PLATFORMS,
      this.MASTER_COLUMNS.YT_METRICS,
      this.MASTER_COLUMNS.TT_METRICS,
      this.MASTER_COLUMNS.IG_METRICS,
      this.MASTER_COLUMNS.ANALYSIS,
      this.MASTER_COLUMNS.AI_NEXT,
      this.MASTER_COLUMNS.APPROVAL
    );
  },
  INVENTORY_COLUMNS: [
    'component_id', 'type', 'name', 'description', 'file_link',
    'tags', 'times_used', 'avg_performance_score', 'created_date', 'status'
  ],
  SCENARIOS_EXTRA_COLUMNS: ['script_en', 'script_jp'],
  COMPONENT_PREFIXES: {
    SCENARIO_HOOK: 'SCN_H_',
    SCENARIO_BODY: 'SCN_B_',
    SCENARIO_CTA: 'SCN_C_',
    MOTION: 'MOT_',
    CHARACTER: 'CHR_',
    AUDIO: 'AUD_'
  },
  COMPONENT_TYPES: {
    SCENARIO: ['hook', 'body', 'cta'],
    MOTION: ['hook', 'body', 'cta'],
    AUDIO: ['voice', 'bgm'],
    CHARACTER: ['character']
  },
  VIDEO_STATUSES: ['draft', 'approved', 'in_production', 'published', 'analyzed'],
  COMPONENT_STATUSES: ['active', 'archived'],
  PROP_KEYS: {
    ROOT_FOLDER_ID: 'ROOT_FOLDER_ID',
    SCENARIOS_FOLDER_ID: 'SCENARIOS_FOLDER_ID',
    MOTIONS_FOLDER_ID: 'MOTIONS_FOLDER_ID',
    CHARACTERS_FOLDER_ID: 'CHARACTERS_FOLDER_ID',
    AUDIO_FOLDER_ID: 'AUDIO_FOLDER_ID',
    ANALYTICS_FOLDER_ID: 'ANALYTICS_FOLDER_ID',
    SCENARIOS_INVENTORY_ID: 'SCENARIOS_INVENTORY_ID',
    MOTIONS_INVENTORY_ID: 'MOTIONS_INVENTORY_ID',
    CHARACTERS_INVENTORY_ID: 'CHARACTERS_INVENTORY_ID',
    AUDIO_INVENTORY_ID: 'AUDIO_INVENTORY_ID'
  },
  KPI_DEFAULTS: {
    youtube: { completion_rate: 0.50, ctr: 0.05, engagement_rate: 0.03 },
    tiktok: { completion_rate: 0.40, engagement_rate: 0.08, avg_watch_time: 10 },
    instagram: { reach_rate: 0.30, avg_watch_time: 15, engagement_rate: 0.05 }
  },
  COLUMN_ALIASES: {
    youtube: {
      video_id: ['Video ID', 'Content'],
      title: ['Video title', 'Title'],
      views: ['Views', 'View count'],
      watch_time_hours: ['Watch time (hours)'],
      avg_view_duration: ['Average view duration'],
      ctr: ['Impressions click-through rate (%)', 'CTR'],
      likes: ['Likes', 'Like count'],
      comments: ['Comments', 'Comment count'],
      shares: ['Shares', 'Share count'],
      subscribers_gained: ['Subscribers', 'Subscribers gained']
    },
    tiktok: {
      video_id: ['Video ID', 'video_id'],
      title: ['Title', 'Video Title'],
      views: ['Video views', 'Views'],
      avg_watch_time: ['Average watch time'],
      completion_rate: ['Watched full video (%)', 'Completion rate'],
      likes: ['Likes'], comments: ['Comments'], shares: ['Shares'],
      saves: ['Saves'], engagement_rate: ['Engagement rate']
    },
    instagram: {
      reel_id: ['Reel ID', 'Media ID'],
      title: ['Caption', 'Title'],
      views: ['Plays', 'Views'],
      reach: ['Reach', 'Accounts reached'],
      avg_watch_time: ['Average watch time'],
      likes: ['Likes'], comments: ['Comments'], shares: ['Shares'],
      saves: ['Saves']
    }
  },
  PRODUCTION_REQUIRED_FIELDS: [
    'character_id', 'hook_scenario_id', 'body_scenario_id', 'cta_scenario_id',
    'hook_motion_id', 'body_motion_id', 'cta_motion_id', 'voice_id', 'script_language'
  ],
  PIPELINE_STATUSES: ['queued', 'queued_dry', 'processing', 'completed', 'error', 'dry_run_complete'],
  RETRY: { MAX_ATTEMPTS: 3, BASE_DELAY_MS: 100, MAX_DELAY_MS: 1000 },
  OPENAI_BATCH_SIZE: 5,
  EXECUTION_TIME_LIMIT_MS: 330000
};

// Enhanced sheet mock factory
global.createMockSheet = (data = [], name = 'mock_sheet') => {
  let sheetData = data.map(row => [...row]);

  return {
    getName: jest.fn(() => name),
    getDataRange: jest.fn(() => ({
      getValues: jest.fn(() => sheetData)
    })),
    getLastRow: jest.fn(() => sheetData.filter(row => row.some(cell => cell !== '' && cell !== undefined)).length),
    getLastColumn: jest.fn(() => sheetData[0] ? sheetData[0].length : 0),
    getMaxColumns: jest.fn(() => Math.max(...sheetData.map(row => row.length), 1)),
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
      }),
      setBackground: jest.fn(() => ({ setFontColor: jest.fn(() => ({ setFontWeight: jest.fn() })) })),
      setFontColor: jest.fn(() => ({ setFontWeight: jest.fn() })),
      setFontWeight: jest.fn()
    })),
    appendRow: jest.fn((row) => { sheetData.push([...row]); }),
    deleteRows: jest.fn((startRow, numRows) => { sheetData.splice(startRow - 1, numRows); }),
    deleteRow: jest.fn((rowIndex) => { sheetData.splice(rowIndex - 1, 1); }),
    setFrozenRows: jest.fn(),
    setColumnWidth: jest.fn(),
    _getData: () => sheetData,
    _setData: (newData) => { sheetData = newData.map(row => [...row]); }
  };
};

// Mock sheets storage
global.mockSheets = {};
global.mockInventorySheets = {};

// Mock getSheet function (master spreadsheet)
global.getSheet = jest.fn((sheetName) => {
  if (global.mockSheets[sheetName]) {
    return global.mockSheets[sheetName];
  }
  throw new Error('Sheet not found: ' + sheetName);
});

// Mock getSpreadsheet
global.mockSpreadsheet = {
  getSheetByName: jest.fn((name) => global.mockSheets[name] || null),
  insertSheet: jest.fn((name) => {
    const sheet = global.createMockSheet([[]], name);
    global.mockSheets[name] = sheet;
    return sheet;
  }),
  getId: jest.fn(() => 'test-spreadsheet-id')
};
global.getSpreadsheet = jest.fn(() => global.mockSpreadsheet);

// Mock getInventorySheet function (for component inventories)
global.getInventorySheet = jest.fn((type) => {
  if (global.mockInventorySheets[type]) {
    return global.mockInventorySheets[type];
  }
  throw new Error('Inventory sheet not found for: ' + type);
});

// Mock getInventorySpreadsheet
global.getInventorySpreadsheet = jest.fn((type) => ({
  getSheetByName: jest.fn(() => global.mockInventorySheets[type] || null)
}));

// Mock nowJapan
global.nowJapan = jest.fn(() => '2026-02-06T21:00:00+09:00');

// Mock truncate
global.truncate = jest.fn((str, len) => {
  if (!str) return '';
  return str.length > len ? str.substring(0, len) + '...' : str;
});

// Mock unique
global.unique = jest.fn((arr) => [...new Set(arr)]);

// Mock getPlatformFields
global.getPlatformFields = jest.fn((platform) => {
  var common = ['video_uid', 'import_date', 'views', 'likes', 'comments', 'shares', 'engagement_rate'];
  var platformSpecific = {
    youtube: common.concat(['watch_time_hours', 'avg_watch_time_sec', 'completion_rate', 'ctr', 'subscribers_gained']),
    tiktok: common.concat(['saves', 'avg_watch_time_sec', 'completion_rate']),
    instagram: common.concat(['saves', 'avg_watch_time_sec', 'reach'])
  };
  return platformSpecific[platform] || common;
});

// ============================================================
// v2.0 Utility function mocks (from Utils.gs)
// ============================================================

// Mock readSheetAsObjects
global.readSheetAsObjects = jest.fn((sheet) => {
  if (!sheet || sheet.getLastRow() < 2) return [];
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  return data.slice(1).map(function(row) {
    var obj = {};
    headers.forEach(function(h, i) { obj[h] = row[i]; });
    // Add _rowIndex (1-based)
    obj._rowIndex = data.indexOf(row) + 1;
    return obj;
  }).filter(function(obj) {
    // Filter empty rows
    return Object.values(obj).some(function(v) { return v !== '' && v !== undefined; });
  });
});

// Mock findRowByColumn
global.findRowByColumn = jest.fn((sheet, column, value) => {
  if (!sheet || sheet.getLastRow() < 2) return null;
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var colIdx = headers.indexOf(column);
  if (colIdx === -1) return null;

  for (var i = 1; i < data.length; i++) {
    if (data[i][colIdx] === value) {
      var obj = {};
      headers.forEach(function(h, j) { obj[h] = data[i][j]; });
      obj._rowIndex = i + 1;
      return obj;
    }
  }
  return null;
});

// Mock findAllRowsByColumn
global.findAllRowsByColumn = jest.fn((sheet, column, value) => {
  if (!sheet || sheet.getLastRow() < 2) return [];
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var colIdx = headers.indexOf(column);
  if (colIdx === -1) return [];

  var results = [];
  for (var i = 1; i < data.length; i++) {
    if (data[i][colIdx] === value) {
      var obj = {};
      headers.forEach(function(h, j) { obj[h] = data[i][j]; });
      obj._rowIndex = i + 1;
      results.push(obj);
    }
  }
  return results;
});

// Mock updateRowByIndex
global.updateRowByIndex = jest.fn((sheet, rowIndex, updates) => {
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  Object.entries(updates).forEach(function(entry) {
    var field = entry[0];
    var value = entry[1];
    var colIdx = headers.indexOf(field);
    if (colIdx !== -1) {
      sheet.getRange(rowIndex, colIdx + 1).setValue(value);
    }
  });
});

// Mock getInventoryTypeFromId
global.getInventoryTypeFromId = jest.fn((componentId) => {
  if (!componentId) return null;
  if (componentId.startsWith('SCN_')) return 'scenarios';
  if (componentId.startsWith('MOT_')) return 'motions';
  if (componentId.startsWith('CHR_')) return 'characters';
  if (componentId.startsWith('AUD_')) return 'audio';
  return null;
});

// Mock getComponentById
global.getComponentById = jest.fn((componentId) => {
  var type = global.getInventoryTypeFromId(componentId);
  if (!type) return null;
  try {
    var sheet = global.getInventorySheet(type);
    return global.findRowByColumn(sheet, 'component_id', componentId);
  } catch (e) {
    return null;
  }
});

// Mock getComponentsById
global.getComponentsById = jest.fn((ids) => {
  var result = {};
  var byType = {};

  ids.forEach(function(id) {
    if (!id) return;
    var type = global.getInventoryTypeFromId(id);
    if (type) {
      if (!byType[type]) byType[type] = [];
      byType[type].push(id);
    }
  });

  Object.entries(byType).forEach(function(entry) {
    var type = entry[0];
    var typeIds = entry[1];
    try {
      var sheet = global.getInventorySheet(type);
      var allData = global.readSheetAsObjects(sheet);
      allData.forEach(function(row) {
        if (typeIds.includes(row.component_id)) {
          result[row.component_id] = row;
        }
      });
    } catch (e) {
      // Ignore errors
    }
  });

  return result;
});

// ============================================================
// v2.0 Component ID Generators (from Utils.gs)
// ============================================================

global.generateComponentId = jest.fn((prefix, sheet) => {
  var maxNum = 0;
  if (sheet && sheet.getLastRow() > 1) {
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      var id = String(data[i][0]);
      if (id.startsWith(prefix)) {
        var numPart = parseInt(id.replace(prefix, ''), 10);
        if (!isNaN(numPart) && numPart > maxNum) {
          maxNum = numPart;
        }
      }
    }
  }
  return prefix + String(maxNum + 1).padStart(4, '0');
});

global.generateScenarioId = jest.fn((type, sheet) => {
  var prefixMap = {
    hook: CONFIG.COMPONENT_PREFIXES.SCENARIO_HOOK,
    body: CONFIG.COMPONENT_PREFIXES.SCENARIO_BODY,
    cta: CONFIG.COMPONENT_PREFIXES.SCENARIO_CTA
  };
  return global.generateComponentId(prefixMap[type], sheet);
});

global.generateMotionId = jest.fn((sheet) => {
  return global.generateComponentId(CONFIG.COMPONENT_PREFIXES.MOTION, sheet);
});

global.generateCharacterId = jest.fn((sheet) => {
  return global.generateComponentId(CONFIG.COMPONENT_PREFIXES.CHARACTER, sheet);
});

global.generateAudioId = jest.fn((sheet) => {
  return global.generateComponentId(CONFIG.COMPONENT_PREFIXES.AUDIO, sheet);
});

global.generateVideoUid = jest.fn(() => {
  var now = new Date();
  var year = now.getFullYear();
  var month = String(now.getMonth() + 1).padStart(2, '0');
  try {
    var sheet = global.getSheet(CONFIG.SHEETS.MASTER);
    var count = Math.max(1, sheet.getLastRow());
    return 'VID_' + year + month + '_' + String(count).padStart(4, '0');
  } catch (e) {
    var random = Math.floor(Math.random() * 10000);
    return 'VID_' + year + month + '_' + String(random).padStart(4, '0');
  }
});

// Helper to reset mocks between tests
global.resetMocks = () => {
  global.mockSheets = {};
  global.mockInventorySheets = {};
  jest.clearAllMocks();
};
