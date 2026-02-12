/**
 * Tests for PipelineUI.gs - Pipeline menu handlers
 */

// Load setup mocks
require('./setup');

// Mock SpreadsheetApp (UI + flush)
const mockUi = {
  alert: jest.fn(),
  prompt: jest.fn(),
  Button: { OK: 'OK', YES: 'YES', NO: 'NO', CANCEL: 'CANCEL' },
  ButtonSet: { OK: 'OK', YES_NO: 'YES_NO', OK_CANCEL: 'OK_CANCEL' }
};

global.SpreadsheetApp = {
  getUi: jest.fn(() => mockUi),
  getActiveSpreadsheet: jest.fn(() => global.mockSpreadsheet),
  flush: jest.fn()
};

// Production tab headers matching pipeline/sheets/production-manager.js
const PROD_HEADERS = [
  'video_id', 'account_id', 'title', 'edit_status', 'character_id',
  'hook_scenario_id', 'body_scenario_id', 'cta_scenario_id',
  'hook_motion_id', 'body_motion_id', 'cta_motion_id', 'voice_id',
  'pipeline_status', 'current_phase',
  'hook_video_url', 'body_video_url', 'cta_video_url', 'final_video_url',
  'drive_folder_id', 'error_message', 'processing_time_sec',
  'created_at', 'updated_at'
];

function makeProductionRow(overrides = {}) {
  const defaults = {
    video_id: 'VID_202602_0001',
    account_id: 'ACC_0001',
    title: 'Test Video',
    edit_status: 'ready',
    character_id: 'CHR_0001',
    hook_scenario_id: 'SCN_H_0001',
    body_scenario_id: 'SCN_B_0001',
    cta_scenario_id: 'SCN_C_0001',
    hook_motion_id: 'MOT_0001',
    body_motion_id: 'MOT_0002',
    cta_motion_id: 'MOT_0003',
    voice_id: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
    pipeline_status: '',
    current_phase: ''
  };
  const merged = Object.assign({}, defaults, overrides);
  return PROD_HEADERS.map(h => merged[h] || '');
}

// Add PRODUCTION to CONFIG.SHEETS
beforeEach(() => {
  global.resetMocks();
  CONFIG.SHEETS.PRODUCTION = 'production';
  CONFIG.PRODUCTION_REQUIRED_FIELDS = [
    'character_id', 'hook_scenario_id', 'body_scenario_id', 'cta_scenario_id',
    'hook_motion_id', 'body_motion_id', 'cta_motion_id', 'voice_id'
  ];
  CONFIG.PIPELINE_STATUSES = ['queued', 'queued_dry', 'processing', 'completed', 'error', 'dry_run_complete'];
  jest.clearAllMocks();
});

// Load PipelineUI.gs source (GAS globals, not CommonJS)
const fs = require('fs');
const path = require('path');
const pipelineUiSrc = fs.readFileSync(path.join(__dirname, '../PipelineUI.gs'), 'utf8');
eval(pipelineUiSrc);

describe('PipelineUI - getProductionRows_', () => {
  test('returns empty rows when production tab has no data rows', () => {
    global.mockSheets['production'] = global.createMockSheet([PROD_HEADERS], 'production');
    const result = getProductionRows_();
    expect(result.rows).toHaveLength(0);
  });

  test('returns row objects with _rowIndex', () => {
    global.mockSheets['production'] = global.createMockSheet([
      PROD_HEADERS,
      makeProductionRow()
    ], 'production');
    const result = getProductionRows_();
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].video_id).toBe('VID_202602_0001');
    expect(result.rows[0]._rowIndex).toBe(2);
  });
});

describe('PipelineUI - validateProductionRow_', () => {
  test('returns empty array for valid row', () => {
    const row = {
      character_id: 'CHR_0001',
      hook_scenario_id: 'SCN_H_0001',
      body_scenario_id: 'SCN_B_0001',
      cta_scenario_id: 'SCN_C_0001',
      hook_motion_id: 'MOT_0001',
      body_motion_id: 'MOT_0002',
      cta_motion_id: 'MOT_0003',
      voice_id: 'abc123'
    };
    expect(validateProductionRow_(row)).toEqual([]);
  });

  test('returns missing fields for incomplete row', () => {
    const row = {
      character_id: 'CHR_0001',
      hook_scenario_id: '',
      body_scenario_id: 'SCN_B_0001',
      cta_scenario_id: '',
      hook_motion_id: 'MOT_0001',
      body_motion_id: 'MOT_0002',
      cta_motion_id: 'MOT_0003',
      voice_id: ''
    };
    const missing = validateProductionRow_(row);
    expect(missing).toContain('hook_scenario_id');
    expect(missing).toContain('cta_scenario_id');
    expect(missing).toContain('voice_id');
    expect(missing).toHaveLength(3);
  });
});

describe('PipelineUI - filterReadyRows_', () => {
  test('filters rows with edit_status=ready and empty pipeline_status', () => {
    const rows = [
      { edit_status: 'ready', pipeline_status: '' },
      { edit_status: 'ready', pipeline_status: 'completed' },
      { edit_status: 'draft', pipeline_status: '' },
      { edit_status: 'ready', pipeline_status: 'queued' },
    ];
    const result = filterReadyRows_(rows);
    expect(result).toHaveLength(1);
    expect(result[0].edit_status).toBe('ready');
  });
});

describe('PipelineUI - queueReadyVideosPrompt', () => {
  test('shows alert when no ready videos', () => {
    global.mockSheets['production'] = global.createMockSheet([PROD_HEADERS], 'production');
    queueReadyVideosPrompt();
    expect(mockUi.alert).toHaveBeenCalledWith('No Ready Videos', expect.any(String), expect.anything());
  });

  test('shows validation errors for rows with missing fields', () => {
    global.mockSheets['production'] = global.createMockSheet([
      PROD_HEADERS,
      makeProductionRow({ voice_id: '' }) // missing voice_id
    ], 'production');
    queueReadyVideosPrompt();
    expect(mockUi.alert).toHaveBeenCalledWith('Validation Errors', expect.stringContaining('voice_id'), expect.anything());
  });

  test('queues valid rows after user confirms', () => {
    const sheet = global.createMockSheet([
      PROD_HEADERS,
      makeProductionRow(),
      makeProductionRow({ video_id: 'VID_202602_0002' })
    ], 'production');
    global.mockSheets['production'] = sheet;

    // Mock prompt: user enters blank (all)
    mockUi.prompt.mockReturnValueOnce({
      getSelectedButton: () => 'OK',
      getResponseText: () => ''
    });

    queueReadyVideosPrompt();

    // Check that pipeline_status was set to 'queued'
    const data = sheet._getData();
    const psIdx = PROD_HEADERS.indexOf('pipeline_status');
    expect(data[1][psIdx]).toBe('queued');
    expect(data[2][psIdx]).toBe('queued');
  });

  test('respects limit input', () => {
    const sheet = global.createMockSheet([
      PROD_HEADERS,
      makeProductionRow({ video_id: 'VID_202602_0001' }),
      makeProductionRow({ video_id: 'VID_202602_0002' }),
      makeProductionRow({ video_id: 'VID_202602_0003' })
    ], 'production');
    global.mockSheets['production'] = sheet;

    mockUi.prompt.mockReturnValueOnce({
      getSelectedButton: () => 'OK',
      getResponseText: () => '2'
    });

    queueReadyVideosPrompt();

    const data = sheet._getData();
    const psIdx = PROD_HEADERS.indexOf('pipeline_status');
    expect(data[1][psIdx]).toBe('queued');
    expect(data[2][psIdx]).toBe('queued');
    expect(data[3][psIdx]).toBe(''); // 3rd row not queued (limit=2)
  });
});

describe('PipelineUI - queueReadyVideosDryRunPrompt', () => {
  test('sets pipeline_status to queued_dry', () => {
    const sheet = global.createMockSheet([
      PROD_HEADERS,
      makeProductionRow()
    ], 'production');
    global.mockSheets['production'] = sheet;

    mockUi.prompt.mockReturnValueOnce({
      getSelectedButton: () => 'OK',
      getResponseText: () => ''
    });

    queueReadyVideosDryRunPrompt();

    const data = sheet._getData();
    const psIdx = PROD_HEADERS.indexOf('pipeline_status');
    expect(data[1][psIdx]).toBe('queued_dry');
  });
});

describe('PipelineUI - showPipelineStatus', () => {
  test('displays status counts', () => {
    global.mockSheets['production'] = global.createMockSheet([
      PROD_HEADERS,
      makeProductionRow({ pipeline_status: 'queued' }),
      makeProductionRow({ pipeline_status: 'processing', current_phase: 'uploading_character', video_id: 'VID_202602_0002' }),
      makeProductionRow({ pipeline_status: 'completed' }),
      makeProductionRow({ pipeline_status: 'completed' })
    ], 'production');

    showPipelineStatus();

    expect(mockUi.alert).toHaveBeenCalledWith('Pipeline Status', expect.stringContaining('queued: 1'), expect.anything());
    expect(mockUi.alert).toHaveBeenCalledWith('Pipeline Status', expect.stringContaining('completed: 2'), expect.anything());
    expect(mockUi.alert).toHaveBeenCalledWith('Pipeline Status', expect.stringContaining('VID_202602_0002'), expect.anything());
  });
});

describe('PipelineUI - stopPipeline', () => {
  test('clears queued and queued_dry rows', () => {
    const sheet = global.createMockSheet([
      PROD_HEADERS,
      makeProductionRow({ pipeline_status: 'queued' }),
      makeProductionRow({ pipeline_status: 'queued_dry' }),
      makeProductionRow({ pipeline_status: 'processing' }),
      makeProductionRow({ pipeline_status: 'completed' })
    ], 'production');
    global.mockSheets['production'] = sheet;

    // User confirms
    mockUi.alert.mockReturnValueOnce('YES');

    stopPipeline();

    const data = sheet._getData();
    const psIdx = PROD_HEADERS.indexOf('pipeline_status');
    expect(data[1][psIdx]).toBe('');       // was queued → cleared
    expect(data[2][psIdx]).toBe('');       // was queued_dry → cleared
    expect(data[3][psIdx]).toBe('processing'); // not touched
    expect(data[4][psIdx]).toBe('completed');  // not touched
  });
});

describe('PipelineUI - queueSelectedVideos', () => {
  test('shows error when not on production tab', () => {
    global.mockSpreadsheet.getActiveSheet = jest.fn(() => ({
      getName: jest.fn(() => 'master')
    }));
    global.SpreadsheetApp.getActiveSpreadsheet.mockReturnValue({
      ...global.mockSpreadsheet,
      getActiveSheet: jest.fn(() => ({ getName: jest.fn(() => 'master') }))
    });

    queueSelectedVideos();
    expect(mockUi.alert).toHaveBeenCalledWith('Wrong Sheet', expect.stringContaining('production'), expect.anything());
  });
});
