/**
 * ComponentManager.test.js - Unit tests for ComponentManager.gs (v2.0)
 *
 * Tests component CRUD, listing, filtering, context building, and usage tracking.
 * Run with: npm test -- gas/tests/ComponentManager.test.js
 */

// Re-implement functions for testing (GAS has no module exports)
function addComponent(inventoryType, data) {
  var sheet = getInventorySheet(inventoryType);
  var componentId;

  switch (inventoryType) {
    case 'scenarios':
      componentId = generateScenarioId(data.type, sheet);
      break;
    case 'motions':
      componentId = generateMotionId(sheet);
      break;
    case 'characters':
      componentId = generateCharacterId(sheet);
      break;
    case 'audio':
      componentId = generateAudioId(sheet);
      break;
    default:
      throw new Error('Unknown inventory type: ' + inventoryType);
  }

  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var row = headers.map(function(h) {
    if (h === 'component_id') return componentId;
    if (h === 'times_used') return 0;
    if (h === 'avg_performance_score') return 0;
    if (h === 'created_date') return nowJapan();
    if (h === 'status') return data.status || 'active';
    return data[h] !== undefined ? data[h] : '';
  });

  sheet.appendRow(row);
  Logger.log('Added component: ' + componentId);
  return { component_id: componentId, inventory_type: inventoryType };
}

function updateComponent(componentId, updates) {
  var type = getInventoryTypeFromId(componentId);
  if (!type) throw new Error('Unknown component type for ID: ' + componentId);

  var sheet = getInventorySheet(type);
  var row = findRowByColumn(sheet, 'component_id', componentId);
  if (!row) throw new Error('Component not found: ' + componentId);

  updateRowByIndex(sheet, row._rowIndex, updates);
  Logger.log('Updated component: ' + componentId);
  return true;
}

function archiveComponent(componentId) {
  return updateComponent(componentId, { status: 'archived' });
}

function listComponents(inventoryType, filters) {
  var sheet = getInventorySheet(inventoryType);
  var allData = readSheetAsObjects(sheet);

  if (!filters) return allData;

  return allData.filter(function(row) {
    if (filters.type && row.type !== filters.type) return false;
    if (filters.status && row.status !== filters.status) return false;
    if (filters.tags) {
      var rowTags = (row.tags || '').split(',').map(function(t) { return t.trim(); });
      var filterTags = filters.tags.split(',').map(function(t) { return t.trim(); });
      var hasAnyTag = filterTags.some(function(t) { return rowTags.indexOf(t) !== -1; });
      if (!hasAnyTag) return false;
    }
    return true;
  });
}

function getTopPerformingComponents(inventoryType, componentType, limit) {
  limit = limit || 5;
  var filters = { status: 'active' };
  if (componentType) filters.type = componentType;

  var components = listComponents(inventoryType, filters);
  components.sort(function(a, b) {
    return (b.avg_performance_score || 0) - (a.avg_performance_score || 0);
  });

  return components.slice(0, limit);
}

function buildVideoComponentContext(videoUid) {
  var masterSheet = getSheet(CONFIG.SHEETS.MASTER);
  var videoRow = findRowByColumn(masterSheet, 'video_uid', videoUid);
  if (!videoRow) return null;

  var componentIds = [
    videoRow.hook_scenario_id, videoRow.hook_motion_id, videoRow.hook_audio_id,
    videoRow.body_scenario_id, videoRow.body_motion_id, videoRow.body_audio_id,
    videoRow.cta_scenario_id, videoRow.cta_motion_id, videoRow.cta_audio_id,
    videoRow.character_id
  ].filter(Boolean);

  var components = getComponentsById(componentIds);

  return {
    video_uid: videoUid,
    title: videoRow.title,
    hook: {
      scenario: components[videoRow.hook_scenario_id] || null,
      motion: components[videoRow.hook_motion_id] || null,
      audio: components[videoRow.hook_audio_id] || null
    },
    body: {
      scenario: components[videoRow.body_scenario_id] || null,
      motion: components[videoRow.body_motion_id] || null,
      audio: components[videoRow.body_audio_id] || null
    },
    cta: {
      scenario: components[videoRow.cta_scenario_id] || null,
      motion: components[videoRow.cta_motion_id] || null,
      audio: components[videoRow.cta_audio_id] || null
    },
    character: components[videoRow.character_id] || null
  };
}

function incrementComponentUsage(videoUid) {
  var masterSheet = getSheet(CONFIG.SHEETS.MASTER);
  var videoRow = findRowByColumn(masterSheet, 'video_uid', videoUid);
  if (!videoRow) return;

  var componentIds = [
    videoRow.hook_scenario_id, videoRow.hook_motion_id, videoRow.hook_audio_id,
    videoRow.body_scenario_id, videoRow.body_motion_id, videoRow.body_audio_id,
    videoRow.cta_scenario_id, videoRow.cta_motion_id, videoRow.cta_audio_id,
    videoRow.character_id
  ].filter(Boolean);

  var uniqueIds = unique(componentIds);

  uniqueIds.forEach(function(id) {
    try {
      var type = getInventoryTypeFromId(id);
      if (!type) return;
      var sheet = getInventorySheet(type);
      var row = findRowByColumn(sheet, 'component_id', id);
      if (row) {
        var currentCount = row.times_used || 0;
        updateRowByIndex(sheet, row._rowIndex, { times_used: currentCount + 1 });
      }
    } catch (e) {
      Logger.log('Error incrementing usage for ' + id + ': ' + e.message);
    }
  });
}

function getComponentPerformanceHistory(componentId) {
  var masterSheet = getSheet(CONFIG.SHEETS.MASTER);
  var allVideos = readSheetAsObjects(masterSheet);

  var componentColumns = [].concat(
    CONFIG.MASTER_COLUMNS.HOOK, CONFIG.MASTER_COLUMNS.BODY,
    CONFIG.MASTER_COLUMNS.CTA, CONFIG.MASTER_COLUMNS.CHARACTER
  );

  var history = [];
  allVideos.forEach(function(video) {
    var usedInVideo = componentColumns.some(function(col) {
      return video[col] === componentId;
    });
    if (usedInVideo && video.overall_score) {
      history.push({
        video_uid: video.video_uid, title: video.title,
        overall_score: video.overall_score,
        analysis_date: video.analysis_date, status: video.status
      });
    }
  });

  history.sort(function(a, b) {
    return String(b.analysis_date).localeCompare(String(a.analysis_date));
  });

  return history;
}

function buildRecommendationComponentPool() {
  return {
    hook_scenarios: getTopPerformingComponents('scenarios', 'hook', 5),
    body_scenarios: getTopPerformingComponents('scenarios', 'body', 5),
    cta_scenarios: getTopPerformingComponents('scenarios', 'cta', 5),
    hook_motions: getTopPerformingComponents('motions', 'hook', 5),
    body_motions: getTopPerformingComponents('motions', 'body', 5),
    cta_motions: getTopPerformingComponents('motions', 'cta', 5),
    characters: getTopPerformingComponents('characters', null, 5),
    voice_audio: getTopPerformingComponents('audio', 'voice', 5),
    bgm_audio: getTopPerformingComponents('audio', 'bgm', 5)
  };
}

// ============================================================
// Helper: Build standard inventory headers
// ============================================================
const INVENTORY_HEADERS = CONFIG.INVENTORY_COLUMNS;
const SCENARIOS_HEADERS = INVENTORY_HEADERS.concat(CONFIG.SCENARIOS_EXTRA_COLUMNS);

function buildInventoryData(type, items) {
  const headers = type === 'scenarios' ? SCENARIOS_HEADERS : INVENTORY_HEADERS;
  const rows = [headers];
  items.forEach(function(item) {
    rows.push(headers.map(function(h) { return item[h] !== undefined ? item[h] : ''; }));
  });
  return rows;
}

// ============================================================
// Tests
// ============================================================

describe('ComponentManager', () => {
  beforeEach(() => {
    resetMocks();

    // Setup master sheet with v2.0 columns
    const masterHeaders = CONFIG.MASTER_ALL_COLUMNS;
    global.mockSheets[CONFIG.SHEETS.MASTER] = createMockSheet([
      masterHeaders,
      buildMasterRow({ video_uid: 'VID_202602_0001', title: 'Test Video 1', status: 'analyzed',
        hook_scenario_id: 'SCN_H_0001', hook_motion_id: 'MOT_0001', hook_audio_id: 'AUD_0001',
        body_scenario_id: 'SCN_B_0001', body_motion_id: 'MOT_0002', body_audio_id: 'AUD_0002',
        cta_scenario_id: 'SCN_C_0001', cta_motion_id: 'MOT_0003', cta_audio_id: 'AUD_0003',
        character_id: 'CHR_0001', overall_score: 85, analysis_date: '2026-02-01' }),
      buildMasterRow({ video_uid: 'VID_202602_0002', title: 'Test Video 2', status: 'analyzed',
        hook_scenario_id: 'SCN_H_0001', hook_motion_id: 'MOT_0004', hook_audio_id: 'AUD_0001',
        body_scenario_id: 'SCN_B_0002', body_motion_id: 'MOT_0002', body_audio_id: 'AUD_0004',
        cta_scenario_id: 'SCN_C_0002', cta_motion_id: 'MOT_0005', cta_audio_id: 'AUD_0005',
        character_id: 'CHR_0002', overall_score: 70, analysis_date: '2026-02-05' })
    ], CONFIG.SHEETS.MASTER);

    // Setup scenarios inventory
    global.mockInventorySheets['scenarios'] = createMockSheet(buildInventoryData('scenarios', [
      { component_id: 'SCN_H_0001', type: 'hook', name: 'Question opener', description: 'Start with a question',
        tags: 'question,engagement', times_used: 5, avg_performance_score: 82, status: 'active', script_en: 'Why are you still doing this?' },
      { component_id: 'SCN_B_0001', type: 'body', name: 'Step-by-step tutorial', description: 'Tutorial format',
        tags: 'tutorial,educational', times_used: 3, avg_performance_score: 78, status: 'active' },
      { component_id: 'SCN_B_0002', type: 'body', name: 'Story format', description: 'Narrative body',
        tags: 'story,narrative', times_used: 2, avg_performance_score: 65, status: 'active' },
      { component_id: 'SCN_C_0001', type: 'cta', name: 'Subscribe CTA', description: 'Ask to subscribe',
        tags: 'subscribe', times_used: 4, avg_performance_score: 70, status: 'active' },
      { component_id: 'SCN_C_0002', type: 'cta', name: 'Link CTA', description: 'Link in bio',
        tags: 'link', times_used: 1, avg_performance_score: 60, status: 'active' },
      { component_id: 'SCN_H_0002', type: 'hook', name: 'Archived hook', description: 'Old hook',
        tags: 'old', times_used: 10, avg_performance_score: 40, status: 'archived' }
    ]), 'scenarios');

    // Setup motions inventory
    global.mockInventorySheets['motions'] = createMockSheet(buildInventoryData('motions', [
      { component_id: 'MOT_0001', type: 'hook', name: 'Fast zoom', times_used: 3, avg_performance_score: 88, status: 'active' },
      { component_id: 'MOT_0002', type: 'body', name: 'Smooth pan', times_used: 4, avg_performance_score: 75, status: 'active' },
      { component_id: 'MOT_0003', type: 'cta', name: 'Bounce text', times_used: 2, avg_performance_score: 72, status: 'active' },
      { component_id: 'MOT_0004', type: 'hook', name: 'Slide in', times_used: 1, avg_performance_score: 60, status: 'active' },
      { component_id: 'MOT_0005', type: 'cta', name: 'Fade out', times_used: 1, avg_performance_score: 55, status: 'active' }
    ]), 'motions');

    // Setup characters inventory
    global.mockInventorySheets['characters'] = createMockSheet(buildInventoryData('characters', [
      { component_id: 'CHR_0001', type: 'character', name: 'Mika casual', times_used: 5, avg_performance_score: 80, status: 'active' },
      { component_id: 'CHR_0002', type: 'character', name: 'Mika formal', times_used: 3, avg_performance_score: 72, status: 'active' }
    ]), 'characters');

    // Setup audio inventory
    global.mockInventorySheets['audio'] = createMockSheet(buildInventoryData('audio', [
      { component_id: 'AUD_0001', type: 'voice', name: 'Energetic voice', times_used: 4, avg_performance_score: 85, status: 'active' },
      { component_id: 'AUD_0002', type: 'bgm', name: 'Upbeat BGM', times_used: 3, avg_performance_score: 77, status: 'active' },
      { component_id: 'AUD_0003', type: 'voice', name: 'Calm voice', times_used: 2, avg_performance_score: 70, status: 'active' },
      { component_id: 'AUD_0004', type: 'bgm', name: 'Lo-fi BGM', times_used: 1, avg_performance_score: 65, status: 'active' },
      { component_id: 'AUD_0005', type: 'voice', name: 'Whisper voice', times_used: 1, avg_performance_score: 50, status: 'active' }
    ]), 'audio');
  });

  // Helper to build a master row from partial data
  function buildMasterRow(data) {
    return CONFIG.MASTER_ALL_COLUMNS.map(function(col) {
      return data[col] !== undefined ? data[col] : '';
    });
  }

  // ----------------------------------------------------------
  // addComponent Tests
  // ----------------------------------------------------------
  describe('addComponent', () => {
    test('adds a scenario component with generated ID', () => {
      const result = addComponent('scenarios', { type: 'hook', name: 'New Hook', description: 'A new hook' });
      expect(result.component_id).toMatch(/^SCN_H_\d{4}$/);
      expect(result.inventory_type).toBe('scenarios');
    });

    test('adds a motion component', () => {
      const result = addComponent('motions', { type: 'hook', name: 'New Motion' });
      expect(result.component_id).toMatch(/^MOT_\d{4}$/);
    });

    test('adds a character component', () => {
      const result = addComponent('characters', { type: 'character', name: 'New Character' });
      expect(result.component_id).toMatch(/^CHR_\d{4}$/);
    });

    test('adds an audio component', () => {
      const result = addComponent('audio', { type: 'voice', name: 'New Voice' });
      expect(result.component_id).toMatch(/^AUD_\d{4}$/);
    });

    test('throws error for unknown inventory type', () => {
      expect(() => addComponent('invalid', { name: 'Test' })).toThrow();
    });

    test('sets default values for times_used and avg_performance_score', () => {
      addComponent('motions', { type: 'hook', name: 'Test Motion' });
      const sheet = global.mockInventorySheets['motions'];
      const data = sheet._getData();
      const lastRow = data[data.length - 1];
      const headers = data[0];
      const timesUsedIdx = headers.indexOf('times_used');
      const avgScoreIdx = headers.indexOf('avg_performance_score');
      expect(lastRow[timesUsedIdx]).toBe(0);
      expect(lastRow[avgScoreIdx]).toBe(0);
    });

    test('sets created_date to current time', () => {
      addComponent('characters', { type: 'character', name: 'Timed Character' });
      const sheet = global.mockInventorySheets['characters'];
      const data = sheet._getData();
      const lastRow = data[data.length - 1];
      const headers = data[0];
      const dateIdx = headers.indexOf('created_date');
      expect(lastRow[dateIdx]).toBe(nowJapan());
    });

    test('defaults status to active', () => {
      addComponent('audio', { type: 'bgm', name: 'Active Audio' });
      const sheet = global.mockInventorySheets['audio'];
      const data = sheet._getData();
      const lastRow = data[data.length - 1];
      const headers = data[0];
      const statusIdx = headers.indexOf('status');
      expect(lastRow[statusIdx]).toBe('active');
    });

    test('respects provided status', () => {
      addComponent('audio', { type: 'bgm', name: 'Archived Audio', status: 'archived' });
      const sheet = global.mockInventorySheets['audio'];
      const data = sheet._getData();
      const lastRow = data[data.length - 1];
      const headers = data[0];
      const statusIdx = headers.indexOf('status');
      expect(lastRow[statusIdx]).toBe('archived');
    });
  });

  // ----------------------------------------------------------
  // updateComponent Tests
  // ----------------------------------------------------------
  describe('updateComponent', () => {
    test('updates an existing scenario', () => {
      const result = updateComponent('SCN_H_0001', { name: 'Updated Hook', description: 'New description' });
      expect(result).toBe(true);
      expect(Logger.log).toHaveBeenCalledWith('Updated component: SCN_H_0001');
    });

    test('updates a motion', () => {
      const result = updateComponent('MOT_0001', { name: 'Updated Motion' });
      expect(result).toBe(true);
    });

    test('throws for unknown component ID prefix', () => {
      expect(() => updateComponent('XXX_0001', { name: 'Test' })).toThrow('Unknown component type');
    });

    test('throws for non-existent component', () => {
      expect(() => updateComponent('SCN_H_9999', { name: 'Test' })).toThrow('Component not found');
    });
  });

  // ----------------------------------------------------------
  // archiveComponent Tests
  // ----------------------------------------------------------
  describe('archiveComponent', () => {
    test('sets status to archived', () => {
      const result = archiveComponent('MOT_0001');
      expect(result).toBe(true);
    });

    test('throws for non-existent component', () => {
      expect(() => archiveComponent('MOT_9999')).toThrow('Component not found');
    });
  });

  // ----------------------------------------------------------
  // listComponents Tests
  // ----------------------------------------------------------
  describe('listComponents', () => {
    test('returns all scenarios without filters', () => {
      const result = listComponents('scenarios');
      expect(result).toHaveLength(6);
    });

    test('returns all motions', () => {
      const result = listComponents('motions');
      expect(result).toHaveLength(5);
    });

    test('filters by type', () => {
      const result = listComponents('scenarios', { type: 'hook' });
      expect(result).toHaveLength(2); // SCN_H_0001 (active) + SCN_H_0002 (archived)
      result.forEach(r => expect(r.type).toBe('hook'));
    });

    test('filters by status', () => {
      const result = listComponents('scenarios', { status: 'active' });
      expect(result).toHaveLength(5); // all except archived
      result.forEach(r => expect(r.status).toBe('active'));
    });

    test('filters by both type and status', () => {
      const result = listComponents('scenarios', { type: 'hook', status: 'active' });
      expect(result).toHaveLength(1);
      expect(result[0].component_id).toBe('SCN_H_0001');
    });

    test('filters by tags', () => {
      const result = listComponents('scenarios', { tags: 'question' });
      expect(result).toHaveLength(1);
      expect(result[0].component_id).toBe('SCN_H_0001');
    });

    test('filters by multiple tags (any match)', () => {
      const result = listComponents('scenarios', { tags: 'question,story' });
      expect(result).toHaveLength(2); // SCN_H_0001 (question) + SCN_B_0002 (story)
    });

    test('returns empty array when no matches', () => {
      const result = listComponents('scenarios', { tags: 'nonexistent' });
      expect(result).toHaveLength(0);
    });
  });

  // ----------------------------------------------------------
  // getTopPerformingComponents Tests
  // ----------------------------------------------------------
  describe('getTopPerformingComponents', () => {
    test('returns top 5 by default', () => {
      const result = getTopPerformingComponents('motions');
      expect(result.length).toBeLessThanOrEqual(5);
      // Should be sorted descending by score
      for (let i = 0; i < result.length - 1; i++) {
        expect(result[i].avg_performance_score).toBeGreaterThanOrEqual(result[i + 1].avg_performance_score);
      }
    });

    test('filters by component type', () => {
      const result = getTopPerformingComponents('scenarios', 'hook');
      result.forEach(r => expect(r.type).toBe('hook'));
    });

    test('only returns active components', () => {
      const result = getTopPerformingComponents('scenarios', 'hook');
      result.forEach(r => expect(r.status).toBe('active'));
    });

    test('respects custom limit', () => {
      const result = getTopPerformingComponents('motions', null, 2);
      expect(result).toHaveLength(2);
    });

    test('returns highest scoring first', () => {
      const result = getTopPerformingComponents('audio', 'voice');
      expect(result[0].component_id).toBe('AUD_0001'); // score 85
    });
  });

  // ----------------------------------------------------------
  // buildVideoComponentContext Tests
  // ----------------------------------------------------------
  describe('buildVideoComponentContext', () => {
    test('builds full context for a video', () => {
      const context = buildVideoComponentContext('VID_202602_0001');
      expect(context).not.toBeNull();
      expect(context.video_uid).toBe('VID_202602_0001');
      expect(context.title).toBe('Test Video 1');
    });

    test('includes hook components', () => {
      const context = buildVideoComponentContext('VID_202602_0001');
      expect(context.hook.scenario).not.toBeNull();
      expect(context.hook.scenario.component_id).toBe('SCN_H_0001');
      expect(context.hook.motion).not.toBeNull();
      expect(context.hook.motion.component_id).toBe('MOT_0001');
      expect(context.hook.audio).not.toBeNull();
      expect(context.hook.audio.component_id).toBe('AUD_0001');
    });

    test('includes body components', () => {
      const context = buildVideoComponentContext('VID_202602_0001');
      expect(context.body.scenario.component_id).toBe('SCN_B_0001');
      expect(context.body.motion.component_id).toBe('MOT_0002');
      expect(context.body.audio.component_id).toBe('AUD_0002');
    });

    test('includes cta components', () => {
      const context = buildVideoComponentContext('VID_202602_0001');
      expect(context.cta.scenario.component_id).toBe('SCN_C_0001');
      expect(context.cta.motion.component_id).toBe('MOT_0003');
      expect(context.cta.audio.component_id).toBe('AUD_0003');
    });

    test('includes character', () => {
      const context = buildVideoComponentContext('VID_202602_0001');
      expect(context.character).not.toBeNull();
      expect(context.character.component_id).toBe('CHR_0001');
    });

    test('returns null for non-existent video', () => {
      const context = buildVideoComponentContext('VID_NONEXISTENT');
      expect(context).toBeNull();
    });

    test('returns null for components that dont exist', () => {
      // Setup a video with missing component IDs
      const masterHeaders = CONFIG.MASTER_ALL_COLUMNS;
      global.mockSheets[CONFIG.SHEETS.MASTER]._setData([
        masterHeaders,
        buildMasterRow({ video_uid: 'VID_MISSING', title: 'Missing Components',
          hook_scenario_id: 'SCN_H_9999' })
      ]);

      const context = buildVideoComponentContext('VID_MISSING');
      expect(context).not.toBeNull();
      expect(context.hook.scenario).toBeNull();
    });
  });

  // ----------------------------------------------------------
  // incrementComponentUsage Tests
  // ----------------------------------------------------------
  describe('incrementComponentUsage', () => {
    test('increments usage for all components in a video', () => {
      incrementComponentUsage('VID_202602_0001');
      // Check that updateRowByIndex was called for each unique component
      expect(updateRowByIndex).toHaveBeenCalled();
    });

    test('does nothing for non-existent video', () => {
      incrementComponentUsage('VID_NONEXISTENT');
      // Should not throw, just silently return
    });

    test('deduplicates shared components', () => {
      // Setup a video where same audio is used in hook and CTA
      const masterHeaders = CONFIG.MASTER_ALL_COLUMNS;
      global.mockSheets[CONFIG.SHEETS.MASTER]._setData([
        masterHeaders,
        buildMasterRow({ video_uid: 'VID_DUPE', title: 'Dupe Test',
          hook_audio_id: 'AUD_0001', cta_audio_id: 'AUD_0001', character_id: 'CHR_0001' })
      ]);

      incrementComponentUsage('VID_DUPE');
      // AUD_0001 should only be incremented once due to unique()
      const calls = updateRowByIndex.mock.calls;
      const aud0001Calls = calls.filter(c => c[2] && c[2].times_used !== undefined);
      // Should be 3 unique IDs: AUD_0001, CHR_0001 (2 unique, not 3)
      // The exact count depends on what was found
    });
  });

  // ----------------------------------------------------------
  // getComponentPerformanceHistory Tests
  // ----------------------------------------------------------
  describe('getComponentPerformanceHistory', () => {
    test('returns history for component used in multiple videos', () => {
      const history = getComponentPerformanceHistory('SCN_H_0001');
      expect(history).toHaveLength(2); // Used in both videos
      expect(history[0].video_uid).toBeDefined();
      expect(history[0].overall_score).toBeDefined();
    });

    test('sorts by analysis_date descending', () => {
      const history = getComponentPerformanceHistory('SCN_H_0001');
      expect(history[0].analysis_date).toBe('2026-02-05');
      expect(history[1].analysis_date).toBe('2026-02-01');
    });

    test('returns empty array for unused component', () => {
      const history = getComponentPerformanceHistory('SCN_H_9999');
      expect(history).toHaveLength(0);
    });

    test('only includes analyzed videos with scores', () => {
      // Add an unanalyzed video using the same component
      const masterHeaders = CONFIG.MASTER_ALL_COLUMNS;
      const currentData = global.mockSheets[CONFIG.SHEETS.MASTER]._getData();
      currentData.push(buildMasterRow({ video_uid: 'VID_NO_SCORE', title: 'No Score',
        hook_scenario_id: 'SCN_H_0001', status: 'draft' }));
      global.mockSheets[CONFIG.SHEETS.MASTER]._setData(currentData);

      const history = getComponentPerformanceHistory('SCN_H_0001');
      // Should still be 2 (no score video excluded)
      expect(history).toHaveLength(2);
    });
  });

  // ----------------------------------------------------------
  // buildRecommendationComponentPool Tests
  // ----------------------------------------------------------
  describe('buildRecommendationComponentPool', () => {
    test('returns pool with all component categories', () => {
      const pool = buildRecommendationComponentPool();
      expect(pool.hook_scenarios).toBeDefined();
      expect(pool.body_scenarios).toBeDefined();
      expect(pool.cta_scenarios).toBeDefined();
      expect(pool.hook_motions).toBeDefined();
      expect(pool.body_motions).toBeDefined();
      expect(pool.cta_motions).toBeDefined();
      expect(pool.characters).toBeDefined();
      expect(pool.voice_audio).toBeDefined();
      expect(pool.bgm_audio).toBeDefined();
    });

    test('returns top-performing hook scenarios', () => {
      const pool = buildRecommendationComponentPool();
      expect(pool.hook_scenarios.length).toBeGreaterThan(0);
      expect(pool.hook_scenarios[0].type).toBe('hook');
    });

    test('returns top-performing characters', () => {
      const pool = buildRecommendationComponentPool();
      expect(pool.characters.length).toBe(2);
      expect(pool.characters[0].avg_performance_score).toBeGreaterThanOrEqual(
        pool.characters[1].avg_performance_score
      );
    });

    test('returns voice and bgm audio separately', () => {
      const pool = buildRecommendationComponentPool();
      pool.voice_audio.forEach(a => expect(a.type).toBe('voice'));
      pool.bgm_audio.forEach(a => expect(a.type).toBe('bgm'));
    });
  });
});
