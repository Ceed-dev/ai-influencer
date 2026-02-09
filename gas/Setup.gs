/**
 * Setup utilities for Video Analytics Hub v2.0
 * Run setupCompleteSystem() from Apps Script editor for first-time setup
 */

/**
 * Main setup function - creates entire Drive structure and all sheets
 * Run this once from the GAS editor
 */
function setupCompleteSystem() {
  var ui = SpreadsheetApp.getUi();
  var props = PropertiesService.getScriptProperties();

  try {
    ui.alert('セットアップ開始',
      'Video Analytics Hub v2.0 のセットアップを開始します。\n\n' +
      '以下が自動作成されます:\n' +
      '- Drive フォルダ構造\n' +
      '- マスタースプレッドシートのタブ\n' +
      '- コンポーネントインベントリ (4つの別スプレッドシート)\n' +
      '- デフォルト KPI 設定\n\n' +
      '処理に数分かかる場合があります。',
      ui.ButtonSet.OK);

    // Step 1: Set master spreadsheet ID
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    props.setProperty('SPREADSHEET_ID', ss.getId());
    Logger.log('Master Spreadsheet ID set: ' + ss.getId());

    // Step 2: Create Drive folder structure
    var folderIds = createDriveFolders_();
    Logger.log('Drive folders created');

    // Step 3: Initialize master spreadsheet tabs
    initializeMasterSheets_(ss);
    Logger.log('Master sheets initialized');

    // Step 4: Create component inventory spreadsheets
    createInventorySpreadsheets_(folderIds);
    Logger.log('Inventory spreadsheets created');

    // Step 5: Add default KPI targets
    addDefaultKPITargets_(ss);
    Logger.log('Default KPIs set');

    // Step 6: Insert demo component data
    insertDemoComponents_();
    Logger.log('Demo component data inserted');

    ui.alert('セットアップ完了！',
      'Video Analytics Hub v2.0 のセットアップが完了しました！\n\n' +
      '✅ Drive フォルダ構造を作成\n' +
      '✅ マスターシートの全タブを初期化\n' +
      '✅ コンポーネントインベントリを作成\n' +
      '✅ デフォルト KPI を設定\n' +
      '✅ デモデータを挿入\n\n' +
      '次のステップ:\n' +
      '1. Script Properties で OPENAI_API_KEY を設定\n' +
      '2. メニューから操作を開始',
      ui.ButtonSet.OK);

  } catch (e) {
    Logger.log('Setup error: ' + e.message + '\n' + e.stack);
    ui.alert('セットアップエラー', e.message, ui.ButtonSet.OK);
  }
}

/**
 * Create Drive folder structure under AI-Influencer root
 * @returns {Object} Map of folder names to folder IDs
 * @private
 */
function createDriveFolders_() {
  var props = PropertiesService.getScriptProperties();
  var rootFolder;

  try {
    rootFolder = DriveApp.getFolderById(CONFIG.ROOT_FOLDER_ID);
  } catch (e) {
    throw new Error('Root folder not found. Check CONFIG.ROOT_FOLDER_ID: ' + CONFIG.ROOT_FOLDER_ID);
  }

  var folderIds = {};

  // Create top-level folders
  var scenariosFolder = getOrCreateSubfolder_(rootFolder, 'Scenarios');
  var motionsFolder = getOrCreateSubfolder_(rootFolder, 'Motions');
  var charactersFolder = getOrCreateSubfolder_(rootFolder, 'Characters');
  var audioFolder = getOrCreateSubfolder_(rootFolder, 'Audio');
  var analyticsFolder = getOrCreateSubfolder_(rootFolder, 'Analytics');

  // Store top-level folder IDs
  folderIds.scenarios = scenariosFolder.getId();
  folderIds.motions = motionsFolder.getId();
  folderIds.characters = charactersFolder.getId();
  folderIds.audio = audioFolder.getId();
  folderIds.analytics = analyticsFolder.getId();

  props.setProperty(CONFIG.PROP_KEYS.SCENARIOS_FOLDER_ID, folderIds.scenarios);
  props.setProperty(CONFIG.PROP_KEYS.MOTIONS_FOLDER_ID, folderIds.motions);
  props.setProperty(CONFIG.PROP_KEYS.CHARACTERS_FOLDER_ID, folderIds.characters);
  props.setProperty(CONFIG.PROP_KEYS.AUDIO_FOLDER_ID, folderIds.audio);
  props.setProperty(CONFIG.PROP_KEYS.ANALYTICS_FOLDER_ID, folderIds.analytics);

  // Create sub-folders
  getOrCreateSubfolder_(scenariosFolder, 'Hooks');
  getOrCreateSubfolder_(scenariosFolder, 'Bodies');
  getOrCreateSubfolder_(scenariosFolder, 'CTAs');

  getOrCreateSubfolder_(motionsFolder, 'Hooks');
  getOrCreateSubfolder_(motionsFolder, 'Bodies');
  getOrCreateSubfolder_(motionsFolder, 'CTAs');

  getOrCreateSubfolder_(charactersFolder, 'Images');

  getOrCreateSubfolder_(audioFolder, 'Voice');
  getOrCreateSubfolder_(audioFolder, 'BGM');

  var csvImportsFolder = getOrCreateSubfolder_(analyticsFolder, 'CSV_Imports');
  getOrCreateSubfolder_(csvImportsFolder, 'YouTube');
  getOrCreateSubfolder_(csvImportsFolder, 'TikTok');
  getOrCreateSubfolder_(csvImportsFolder, 'Instagram');

  return folderIds;
}

/**
 * Get or create a subfolder
 * @private
 */
function getOrCreateSubfolder_(parentFolder, name) {
  var folders = parentFolder.getFoldersByName(name);
  if (folders.hasNext()) {
    return folders.next();
  }
  return parentFolder.createFolder(name);
}

/**
 * Initialize master spreadsheet tabs
 * @private
 */
function initializeMasterSheets_(ss) {
  var sheetConfigs = [
    {
      name: CONFIG.SHEETS.MASTER,
      headers: CONFIG.MASTER_ALL_COLUMNS
    },
    {
      name: CONFIG.SHEETS.METRICS_YOUTUBE,
      headers: ['video_uid', 'import_date', 'views', 'likes', 'comments', 'shares',
                'engagement_rate', 'watch_time_hours', 'avg_watch_time_sec',
                'completion_rate', 'ctr', 'subscribers_gained']
    },
    {
      name: CONFIG.SHEETS.METRICS_TIKTOK,
      headers: ['video_uid', 'import_date', 'views', 'likes', 'comments', 'shares',
                'engagement_rate', 'saves', 'avg_watch_time_sec', 'completion_rate']
    },
    {
      name: CONFIG.SHEETS.METRICS_INSTAGRAM,
      headers: ['video_uid', 'import_date', 'views', 'likes', 'comments', 'shares',
                'engagement_rate', 'saves', 'avg_watch_time_sec', 'reach']
    },
    {
      name: CONFIG.SHEETS.KPI_TARGETS,
      headers: ['platform', 'metric', 'target_value', 'description']
    },
    {
      name: CONFIG.SHEETS.ANALYSIS_REPORTS,
      headers: ['report_id', 'generated_at', 'video_count', 'insights_json']
    },
    {
      name: CONFIG.SHEETS.RECOMMENDATIONS,
      headers: ['video_uid', 'created_at', 'priority', 'category', 'recommendation',
                'platform', 'expected_impact', 'status', 'compared_to_previous']
    },
    {
      name: CONFIG.SHEETS.VIDEO_ANALYSIS,
      headers: ['video_uid', 'analyzed_at', 'youtube_performance', 'tiktok_performance',
                'instagram_performance', 'cross_platform_insights', 'kpi_achievement',
                'improvements_from_previous', 'prompt_effectiveness', 'recommendations']
    },
    {
      name: CONFIG.SHEETS.UNLINKED_IMPORTS,
      headers: ['platform', 'platform_id', 'title', 'views', 'import_date', 'raw_csv_row']
    }
  ];

  // Delete default Sheet1 if it exists and is empty
  var sheet1 = ss.getSheetByName('Sheet1');

  sheetConfigs.forEach(function(config) {
    var sheet = ss.getSheetByName(config.name);

    if (!sheet) {
      sheet = ss.insertSheet(config.name);
      sheet.getRange(1, 1, 1, config.headers.length).setValues([config.headers]);
      sheet.setFrozenRows(1);

      // Format header row
      sheet.getRange(1, 1, 1, config.headers.length)
        .setBackground(CONFIG.COLORS.HEADER)
        .setFontColor(CONFIG.COLORS.HEADER_FONT)
        .setFontWeight('bold');

      Logger.log('Created sheet: ' + config.name);
    }
  });

  // Apply master sheet formatting
  applyMasterSheetFormatting_(ss);

  // Now safe to delete Sheet1
  if (sheet1 && ss.getSheets().length > 1) {
    try {
      ss.deleteSheet(sheet1);
    } catch (e) {
      // Ignore
    }
  }
}

/**
 * Apply formatting to master sheet (status dropdown, checkbox, column widths)
 * @private
 */
function applyMasterSheetFormatting_(ss) {
  var sheet = ss.getSheetByName(CONFIG.SHEETS.MASTER);
  if (!sheet) return;

  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var lastRow = Math.max(sheet.getLastRow(), 100);

  // Status dropdown
  var statusCol = headers.indexOf('status') + 1;
  if (statusCol > 0) {
    var statusRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(CONFIG.VIDEO_STATUSES, true)
      .setAllowInvalid(true)
      .build();
    sheet.getRange(2, statusCol, lastRow - 1, 1).setDataValidation(statusRule);
    applyVideoStatusFormatting_(sheet, statusCol, lastRow);
  }

  // human_approved checkbox
  var approvedCol = headers.indexOf('human_approved') + 1;
  if (approvedCol > 0) {
    var checkboxRule = SpreadsheetApp.newDataValidation()
      .requireCheckbox()
      .build();
    sheet.getRange(2, approvedCol, lastRow - 1, 1).setDataValidation(checkboxRule);
  }

  // Set column widths for key columns
  var widthMap = {
    'video_uid': 140, 'title': 250, 'status': 120, 'created_date': 150,
    'hook_scenario_id': 130, 'hook_motion_id': 130, 'hook_audio_id': 130,
    'body_scenario_id': 130, 'body_motion_id': 130, 'body_audio_id': 130,
    'cta_scenario_id': 130, 'cta_motion_id': 130, 'cta_audio_id': 130,
    'character_id': 120, 'completed_video_url': 200,
    'youtube_id': 120, 'tiktok_id': 120, 'instagram_id': 120,
    'overall_score': 100, 'top_recommendations': 300,
    'human_approved': 100, 'approval_notes': 250
  };

  headers.forEach(function(h, idx) {
    if (widthMap[h]) {
      sheet.setColumnWidth(idx + 1, widthMap[h]);
    }
  });
}

/**
 * Apply conditional formatting for video status
 * @private
 */
function applyVideoStatusFormatting_(sheet, col, lastRow) {
  var range = sheet.getRange(2, col, lastRow - 1, 1);
  var rules = sheet.getConditionalFormatRules();

  Object.entries(CONFIG.COLORS.VIDEO_STATUS).forEach(function(entry) {
    var status = entry[0];
    var color = entry[1];
    var rule = SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo(status)
      .setBackground(color)
      .setRanges([range])
      .build();
    rules.push(rule);
  });

  sheet.setConditionalFormatRules(rules);
}

/**
 * Create component inventory spreadsheets in their respective folders
 * @private
 */
function createInventorySpreadsheets_(folderIds) {
  var props = PropertiesService.getScriptProperties();

  // Scenarios Inventory
  var scenariosSs = createInventorySpreadsheet_(
    folderIds.scenarios,
    'Scenarios Inventory',
    CONFIG.INVENTORY_COLUMNS.concat(CONFIG.SCENARIOS_EXTRA_COLUMNS)
  );
  props.setProperty(CONFIG.PROP_KEYS.SCENARIOS_INVENTORY_ID, scenariosSs.getId());

  // Motions Inventory
  var motionsSs = createInventorySpreadsheet_(
    folderIds.motions,
    'Motions Inventory',
    CONFIG.INVENTORY_COLUMNS
  );
  props.setProperty(CONFIG.PROP_KEYS.MOTIONS_INVENTORY_ID, motionsSs.getId());

  // Characters Inventory
  var charactersSs = createInventorySpreadsheet_(
    folderIds.characters,
    'Characters Inventory',
    CONFIG.INVENTORY_COLUMNS
  );
  props.setProperty(CONFIG.PROP_KEYS.CHARACTERS_INVENTORY_ID, charactersSs.getId());

  // Audio Inventory
  var audioSs = createInventorySpreadsheet_(
    folderIds.audio,
    'Audio Inventory',
    CONFIG.INVENTORY_COLUMNS
  );
  props.setProperty(CONFIG.PROP_KEYS.AUDIO_INVENTORY_ID, audioSs.getId());
}

/**
 * Create a single inventory spreadsheet in a folder
 * @private
 */
function createInventorySpreadsheet_(folderId, name, columns) {
  var folder = DriveApp.getFolderById(folderId);

  // Check if already exists
  var files = folder.getFilesByName(name);
  if (files.hasNext()) {
    var existingFile = files.next();
    var existingSs = SpreadsheetApp.openById(existingFile.getId());
    Logger.log('Inventory already exists: ' + name);
    return existingSs;
  }

  // Create new spreadsheet
  var ss = SpreadsheetApp.create(name);
  var file = DriveApp.getFileById(ss.getId());
  file.moveTo(folder);

  // Set up inventory tab
  var sheet = ss.getSheets()[0];
  sheet.setName(CONFIG.INVENTORY_TAB);
  sheet.getRange(1, 1, 1, columns.length).setValues([columns]);
  sheet.setFrozenRows(1);

  // Format header
  sheet.getRange(1, 1, 1, columns.length)
    .setBackground(CONFIG.COLORS.HEADER)
    .setFontColor(CONFIG.COLORS.HEADER_FONT)
    .setFontWeight('bold');

  // Component status dropdown
  var statusCol = columns.indexOf('status') + 1;
  if (statusCol > 0) {
    var statusRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(CONFIG.COMPONENT_STATUSES, true)
      .setAllowInvalid(true)
      .build();
    sheet.getRange(2, statusCol, 100, 1).setDataValidation(statusRule);
  }

  // Set column widths
  var widthMap = {
    'component_id': 140, 'type': 80, 'name': 200, 'description': 300,
    'file_link': 250, 'tags': 200, 'times_used': 80,
    'avg_performance_score': 120, 'created_date': 150, 'status': 80,
    'script_en': 400, 'script_jp': 400
  };

  columns.forEach(function(col, idx) {
    if (widthMap[col]) {
      sheet.setColumnWidth(idx + 1, widthMap[col]);
    }
  });

  Logger.log('Created inventory: ' + name);
  return ss;
}

/**
 * Add default KPI targets
 * @private
 */
function addDefaultKPITargets_(ss) {
  var kpiSheet = ss.getSheetByName(CONFIG.SHEETS.KPI_TARGETS);
  if (!kpiSheet || kpiSheet.getLastRow() > 1) return;

  var defaultKPIs = [
    ['youtube', 'completion_rate', '0.5', '50% of viewers watch to end'],
    ['youtube', 'ctr', '0.05', '5% click-through rate'],
    ['youtube', 'engagement_rate', '0.03', '3% engagement'],
    ['tiktok', 'completion_rate', '0.4', '40% watch to end'],
    ['tiktok', 'engagement_rate', '0.08', '8% engagement'],
    ['tiktok', 'avg_watch_time_sec', '10', '10 seconds average'],
    ['instagram', 'reach_rate', '0.3', '30% of followers reached'],
    ['instagram', 'avg_watch_time_sec', '15', '15 seconds average'],
    ['instagram', 'engagement_rate', '0.05', '5% engagement']
  ];

  kpiSheet.getRange(2, 1, defaultKPIs.length, 4).setValues(defaultKPIs);
}

/**
 * Insert demo component data into inventory spreadsheets
 * @private
 */
function insertDemoComponents_() {
  var now = nowJapan();

  // Demo Scenarios
  try {
    var scenariosSheet = getInventorySheet('scenarios');
    if (scenariosSheet.getLastRow() <= 1) {
      var scenariosData = [
        ['SCN_H_0001', 'hook', 'Shocking Question', 'Start with a provocative question', '', 'question,shock,opener', 0, 0, now, 'active', 'Why are you still wasting your mornings?', 'まだ朝の時間を無駄にしてるの？'],
        ['SCN_H_0002', 'hook', 'Stat Reveal', 'Open with a surprising statistic', '', 'stats,data,opener', 0, 0, now, 'active', '90% of people do THIS wrong every day', '90%の人が毎日コレを間違えている'],
        ['SCN_H_0003', 'hook', 'Challenge Hook', 'Challenge the viewer directly', '', 'challenge,direct,opener', 0, 0, now, 'active', 'I bet you cannot do this in under 30 seconds', '30秒以内にできるか賭けよう'],
        ['SCN_B_0001', 'body', 'Step-by-Step Tutorial', 'Walk through process step by step', '', 'tutorial,steps,educational', 0, 0, now, 'active', 'Step 1: Wake up at 5AM. Step 2: ...', 'ステップ1: 朝5時に起きる。ステップ2: ...'],
        ['SCN_B_0002', 'body', 'Story Arc', 'Tell a compelling story with conflict and resolution', '', 'story,narrative,emotional', 0, 0, now, 'active', 'I used to struggle with... until I discovered...', '私は以前...に苦しんでいた。...を発見するまで...'],
        ['SCN_C_0001', 'cta', 'Follow for More', 'Simple follow CTA', '', 'follow,simple,cta', 0, 0, now, 'active', 'Follow for more tips like this!', 'もっとこんなヒントが欲しければフォロー！'],
        ['SCN_C_0002', 'cta', 'Comment Challenge', 'Engage with comment prompt', '', 'comment,engage,cta', 0, 0, now, 'active', 'Comment your answer below!', 'コメントで答えてね！']
      ];
      scenariosSheet.getRange(2, 1, scenariosData.length, scenariosData[0].length).setValues(scenariosData);
    }
  } catch (e) {
    Logger.log('Skipping demo scenarios: ' + e.message);
  }

  // Demo Motions
  try {
    var motionsSheet = getInventorySheet('motions');
    if (motionsSheet.getLastRow() <= 1) {
      var motionsData = [
        ['MOT_0001', 'hook', 'Fast Zoom', 'Quick zoom in with text overlay', '', 'zoom,fast,dynamic', 0, 0, now, 'active'],
        ['MOT_0002', 'hook', 'Slide Reveal', 'Slide transition revealing content', '', 'slide,reveal,clean', 0, 0, now, 'active'],
        ['MOT_0003', 'body', 'Ken Burns Pan', 'Slow pan across scene', '', 'pan,slow,cinematic', 0, 0, now, 'active'],
        ['MOT_0004', 'body', 'Split Screen', 'Side-by-side comparison', '', 'split,compare,dual', 0, 0, now, 'active'],
        ['MOT_0005', 'cta', 'Bounce Text', 'Bouncing text animation for CTA', '', 'bounce,text,attention', 0, 0, now, 'active']
      ];
      motionsSheet.getRange(2, 1, motionsData.length, motionsData[0].length).setValues(motionsData);
    }
  } catch (e) {
    Logger.log('Skipping demo motions: ' + e.message);
  }

  // Demo Characters
  try {
    var charactersSheet = getInventorySheet('characters');
    if (charactersSheet.getLastRow() <= 1) {
      var charactersData = [
        ['CHR_0001', 'character', 'Mika Casual', 'AI Mika in casual style', '', 'casual,friendly,daily', 0, 0, now, 'active'],
        ['CHR_0002', 'character', 'Mika Professional', 'AI Mika in business style', '', 'professional,formal,business', 0, 0, now, 'active'],
        ['CHR_0003', 'character', 'Mika Sporty', 'AI Mika in athletic wear', '', 'sporty,active,fitness', 0, 0, now, 'active']
      ];
      charactersSheet.getRange(2, 1, charactersData.length, charactersData[0].length).setValues(charactersData);
    }
  } catch (e) {
    Logger.log('Skipping demo characters: ' + e.message);
  }

  // Demo Audio
  try {
    var audioSheet = getInventorySheet('audio');
    if (audioSheet.getLastRow() <= 1) {
      var audioData = [
        ['AUD_0001', 'voice', 'Mika Voice Normal', 'Standard Mika voice', '', 'normal,standard,female', 0, 0, now, 'active'],
        ['AUD_0002', 'voice', 'Mika Voice Excited', 'Excited/energetic Mika voice', '', 'excited,energetic,female', 0, 0, now, 'active'],
        ['AUD_0003', 'bgm', 'Upbeat Pop', 'Upbeat pop background music', '', 'upbeat,pop,energetic', 0, 0, now, 'active'],
        ['AUD_0004', 'bgm', 'Chill Lo-fi', 'Relaxed lo-fi beats', '', 'chill,lofi,relaxed', 0, 0, now, 'active']
      ];
      audioSheet.getRange(2, 1, audioData.length, audioData[0].length).setValues(audioData);
    }
  } catch (e) {
    Logger.log('Skipping demo audio: ' + e.message);
  }
}

/**
 * Insert demo video production data into master sheet
 */
function insertDemoData() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();
  var now = nowJapan();

  var masterSheet = ss.getSheetByName(CONFIG.SHEETS.MASTER);
  if (!masterSheet) {
    ui.alert('エラー', 'master シートが見つかりません。setupCompleteSystem() を実行してください。', ui.ButtonSet.OK);
    return;
  }

  // Check if real data already exists (not just checkbox FALSE values)
  var videoUidCol = 1; // video_uid is first column
  if (masterSheet.getLastRow() > 1) {
    var firstUid = masterSheet.getRange(2, videoUidCol).getValue();
    if (firstUid !== '' && firstUid !== false) {
      ui.alert('情報', 'master シートにはすでにデータがあります。', ui.ButtonSet.OK);
      return;
    }
  }

  var headers = masterSheet.getRange(1, 1, 1, masterSheet.getLastColumn()).getValues()[0];

  var demoVideos = [
    {
      video_uid: 'VID_202602_0001', title: 'AI Mika Day in Tokyo', status: 'analyzed', created_date: now,
      hook_scenario_id: 'SCN_H_0001', hook_motion_id: 'MOT_0001', hook_audio_id: 'AUD_0001',
      body_scenario_id: 'SCN_B_0001', body_motion_id: 'MOT_0003', body_audio_id: 'AUD_0003',
      cta_scenario_id: 'SCN_C_0001', cta_motion_id: 'MOT_0005', cta_audio_id: 'AUD_0001',
      character_id: 'CHR_0001',
      youtube_id: 'YT_VID001', tiktok_id: 'TT_VID001', instagram_id: 'IG_VID001',
      yt_views: 185000, yt_engagement: 4.3, yt_completion: 45,
      tt_views: 620000, tt_engagement: 10.5, tt_completion: 48,
      ig_views: 125000, ig_engagement: 8.3, ig_reach: 105000,
      overall_score: 72, analysis_date: now, human_approved: true
    },
    {
      video_uid: 'VID_202602_0002', title: 'Cooking with AI Mika', status: 'analyzed', created_date: now,
      hook_scenario_id: 'SCN_H_0002', hook_motion_id: 'MOT_0002', hook_audio_id: 'AUD_0002',
      body_scenario_id: 'SCN_B_0002', body_motion_id: 'MOT_0004', body_audio_id: 'AUD_0004',
      cta_scenario_id: 'SCN_C_0002', cta_motion_id: 'MOT_0005', cta_audio_id: 'AUD_0001',
      character_id: 'CHR_0002',
      youtube_id: 'YT_VID002', tiktok_id: 'TT_VID002', instagram_id: 'IG_VID002',
      yt_views: 142000, yt_engagement: 4.0, yt_completion: 40,
      tt_views: 480000, tt_engagement: 8.4, tt_completion: 38,
      ig_views: 98000, ig_engagement: 7.7, ig_reach: 82000,
      overall_score: 65, analysis_date: now, human_approved: true
    },
    {
      video_uid: 'VID_202602_0003', title: 'Morning Routine with AI Mika', status: 'draft', created_date: now,
      hook_scenario_id: 'SCN_H_0003', hook_motion_id: 'MOT_0001', hook_audio_id: 'AUD_0002',
      body_scenario_id: 'SCN_B_0001', body_motion_id: 'MOT_0003', body_audio_id: 'AUD_0003',
      cta_scenario_id: 'SCN_C_0001', cta_motion_id: 'MOT_0005', cta_audio_id: 'AUD_0001',
      character_id: 'CHR_0001',
      human_approved: false
    }
  ];

  demoVideos.forEach(function(video) {
    var row = headers.map(function(h) {
      return video[h] !== undefined ? video[h] : '';
    });
    masterSheet.appendRow(row);
  });

  // Also add metrics for analyzed videos
  var ytSheet = ss.getSheetByName(CONFIG.SHEETS.METRICS_YOUTUBE);
  if (ytSheet && ytSheet.getLastRow() <= 1) {
    var ytData = [
      ['VID_202602_0001', now, 185000, 7200, 520, 280, 4.3, 3200.5, 85, 45, 9.8, 620],
      ['VID_202602_0002', now, 142000, 5100, 380, 195, 4.0, 2450.2, 75, 40, 8.1, 410]
    ];
    ytSheet.getRange(2, 1, ytData.length, ytData[0].length).setValues(ytData);
  }

  var ttSheet = ss.getSheetByName(CONFIG.SHEETS.METRICS_TIKTOK);
  if (ttSheet && ttSheet.getLastRow() <= 1) {
    var ttData = [
      ['VID_202602_0001', now, 620000, 45000, 1800, 7200, 10.5, 11000, 14.2, 48],
      ['VID_202602_0002', now, 480000, 32000, 1100, 4800, 8.4, 7200, 10.5, 38]
    ];
    ttSheet.getRange(2, 1, ttData.length, ttData[0].length).setValues(ttData);
  }

  var igSheet = ss.getSheetByName(CONFIG.SHEETS.METRICS_INSTAGRAM);
  if (igSheet && igSheet.getLastRow() <= 1) {
    var igData = [
      ['VID_202602_0001', now, 125000, 8500, 620, 1200, 8.3, 2800, 20.5, 105000],
      ['VID_202602_0002', now, 98000, 6200, 480, 850, 7.7, 1950, 16.8, 82000]
    ];
    igSheet.getRange(2, 1, igData.length, igData[0].length).setValues(igData);
  }

  ui.alert('デモデータ挿入完了',
    '以下のデータを追加しました:\n\n' +
    '✅ master: 3動画 (2 analyzed, 1 draft)\n' +
    '✅ metrics_youtube: 2レコード\n' +
    '✅ metrics_tiktok: 2レコード\n' +
    '✅ metrics_instagram: 2レコード\n\n' +
    '次に「Analyze All Videos」を実行してください。',
    ui.ButtonSet.OK);
}

/**
 * Clear all demo data
 */
function clearAllDemoData() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();

  var result = ui.alert('確認', '全てのデータを削除しますか？\n（ヘッダー行は残ります）', ui.ButtonSet.YES_NO);
  if (result !== ui.Button.YES) return;

  var sheetNames = Object.values(CONFIG.SHEETS);
  sheetNames.forEach(function(name) {
    var sheet = ss.getSheetByName(name);
    if (sheet && sheet.getLastRow() > 1) {
      sheet.deleteRows(2, sheet.getLastRow() - 1);
    }
  });

  ui.alert('完了', '全てのデータを削除しました。', ui.ButtonSet.OK);
}

/**
 * Test external API access
 */
function testExternalAccess() {
  var response = UrlFetchApp.fetch('https://httpbin.org/get');
  Logger.log('External access test: ' + response.getResponseCode());

  var ui = SpreadsheetApp.getUi();
  ui.alert('Success', 'External API access is now authorized!', ui.ButtonSet.OK);
}

/**
 * Apply dropdowns and conditional formatting to recommendations sheet
 */
function applyDropdownsAndFormatting(ss) {
  if (!ss) ss = SpreadsheetApp.getActiveSpreadsheet();

  var recSheet = ss.getSheetByName(CONFIG.SHEETS.RECOMMENDATIONS);
  if (recSheet) {
    var headers = recSheet.getRange(1, 1, 1, recSheet.getLastColumn()).getValues()[0];
    var lastRow = Math.max(recSheet.getLastRow(), 100);

    // Status dropdown
    var statusCol = headers.indexOf('status') + 1;
    if (statusCol > 0) {
      var statusRule = SpreadsheetApp.newDataValidation()
        .requireValueInList(CONFIG.DROPDOWN_OPTIONS.STATUS, true)
        .setAllowInvalid(true)
        .build();
      recSheet.getRange(2, statusCol, lastRow - 1, 1).setDataValidation(statusRule);
      applyStatusConditionalFormatting(recSheet, statusCol, lastRow);
    }

    // Category dropdown
    var categoryCol = headers.indexOf('category') + 1;
    if (categoryCol > 0) {
      var categoryRule = SpreadsheetApp.newDataValidation()
        .requireValueInList(CONFIG.DROPDOWN_OPTIONS.CATEGORY, true)
        .setAllowInvalid(true)
        .build();
      recSheet.getRange(2, categoryCol, lastRow - 1, 1).setDataValidation(categoryRule);
    }

    // Priority dropdown
    var priorityCol = headers.indexOf('priority') + 1;
    if (priorityCol > 0) {
      var priorityRule = SpreadsheetApp.newDataValidation()
        .requireValueInList(CONFIG.DROPDOWN_OPTIONS.PRIORITY, true)
        .setAllowInvalid(true)
        .build();
      recSheet.getRange(2, priorityCol, lastRow - 1, 1).setDataValidation(priorityRule);
      applyPriorityConditionalFormatting(recSheet, priorityCol, lastRow);
    }

    // Platform dropdown
    var platformCol = headers.indexOf('platform') + 1;
    if (platformCol > 0) {
      var platformRule = SpreadsheetApp.newDataValidation()
        .requireValueInList(CONFIG.DROPDOWN_OPTIONS.PLATFORM, true)
        .setAllowInvalid(true)
        .build();
      recSheet.getRange(2, platformCol, lastRow - 1, 1).setDataValidation(platformRule);
    }
  }

  // Video analysis sheet
  var vaSheet = ss.getSheetByName(CONFIG.SHEETS.VIDEO_ANALYSIS);
  if (vaSheet) {
    var vaHeaders = vaSheet.getRange(1, 1, 1, vaSheet.getLastColumn()).getValues()[0];
    var kpiCol = vaHeaders.indexOf('kpi_achievement') + 1;
    if (kpiCol > 0) {
      var kpiRule = SpreadsheetApp.newDataValidation()
        .requireValueInList(['exceeded', 'met', 'partially_met', 'not_met'], true)
        .setAllowInvalid(true)
        .build();
      vaSheet.getRange(2, kpiCol, 100, 1).setDataValidation(kpiRule);
    }
  }
}

/**
 * Apply conditional formatting for status column
 */
function applyStatusConditionalFormatting(sheet, col, lastRow) {
  var range = sheet.getRange(2, col, lastRow - 1, 1);
  var rules = sheet.getConditionalFormatRules();

  Object.entries(CONFIG.COLORS.STATUS).forEach(function(entry) {
    var status = entry[0];
    var color = entry[1];
    var rule = SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo(status)
      .setBackground(color)
      .setRanges([range])
      .build();
    rules.push(rule);
  });

  sheet.setConditionalFormatRules(rules);
}

/**
 * Apply conditional formatting for priority column
 */
function applyPriorityConditionalFormatting(sheet, col, lastRow) {
  var range = sheet.getRange(2, col, lastRow - 1, 1);
  var rules = sheet.getConditionalFormatRules();

  Object.entries(CONFIG.COLORS.PRIORITY).forEach(function(entry) {
    var priority = entry[0];
    var color = entry[1];
    var rule = SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo(priority)
      .setBackground(color)
      .setRanges([range])
      .build();
    rules.push(rule);
  });

  sheet.setConditionalFormatRules(rules);
}
