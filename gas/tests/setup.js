/**
 * Jest setup file for GAS mocks
 * Provides mock implementations of Google Apps Script globals
 */

// Mock Logger
global.Logger = {
  log: jest.fn()
};

// Mock CONFIG
global.CONFIG = {
  SHEETS: {
    VIDEOS_MASTER: 'videos_master',
    METRICS_YOUTUBE: 'metrics_youtube',
    METRICS_TIKTOK: 'metrics_tiktok',
    METRICS_INSTAGRAM: 'metrics_instagram',
    UNLINKED_IMPORTS: 'unlinked_imports'
  }
};

// Sheet mock factory
global.createMockSheet = (data = []) => {
  let sheetData = [...data];

  return {
    getDataRange: jest.fn(() => ({
      getValues: jest.fn(() => sheetData)
    })),
    getLastRow: jest.fn(() => sheetData.length),
    getRange: jest.fn((row, col) => ({
      setValue: jest.fn((value) => {
        if (sheetData[row - 1]) {
          sheetData[row - 1][col - 1] = value;
        }
      }),
      getValue: jest.fn(() => sheetData[row - 1]?.[col - 1])
    })),
    appendRow: jest.fn((row) => {
      sheetData.push(row);
    }),
    deleteRow: jest.fn((rowIndex) => {
      sheetData.splice(rowIndex - 1, 1);
    })
  };
};

// Mock getSheet function
global.mockSheets = {};
global.getSheet = jest.fn((sheetName) => {
  if (global.mockSheets[sheetName]) {
    return global.mockSheets[sheetName];
  }
  throw new Error(`Sheet not found: ${sheetName}`);
});

// Helper to reset mocks between tests
global.resetMocks = () => {
  global.mockSheets = {};
  jest.clearAllMocks();
};
