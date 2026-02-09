/**
 * Configuration settings for Video Analytics Hub v2.0
 *
 * IMPORTANT: Sensitive values should be stored in Script Properties, not here.
 * Use PropertiesService.getScriptProperties().setProperty('KEY', 'value')
 */

const CONFIG = {
  // Version
  VERSION: '2.0.0',

  // Spreadsheet ID - Set this after creating the Google Sheets
  SPREADSHEET_ID: PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID') || '',

  // OpenAI API Key - Read from Script Properties, fallback to _config sheet
  OPENAI_API_KEY: PropertiesService.getScriptProperties().getProperty('OPENAI_API_KEY') || getConfigFromSheet_('OPENAI_API_KEY') || '',

  // OpenAI Model
  OPENAI_MODEL: 'gpt-4o',

  // Root Drive folder ID
  ROOT_FOLDER_ID: '1KRQuZ4W7u5CXRamjvN4xmavfu-7TPb0X',

  // Drive Folder Structure
  DRIVE_FOLDERS: {
    ROOT: 'AI-Influencer',
    SCENARIOS: 'Scenarios',
    SCENARIOS_HOOKS: 'Scenarios/Hooks',
    SCENARIOS_BODIES: 'Scenarios/Bodies',
    SCENARIOS_CTAS: 'Scenarios/CTAs',
    MOTIONS: 'Motions',
    MOTIONS_HOOKS: 'Motions/Hooks',
    MOTIONS_BODIES: 'Motions/Bodies',
    MOTIONS_CTAS: 'Motions/CTAs',
    CHARACTERS: 'Characters',
    CHARACTERS_IMAGES: 'Characters/Images',
    AUDIO: 'Audio',
    AUDIO_VOICE: 'Audio/Voice',
    AUDIO_BGM: 'Audio/BGM',
    ANALYTICS: 'Analytics',
    CSV_IMPORTS: 'Analytics/CSV_Imports',
    CSV_YOUTUBE: 'Analytics/CSV_Imports/YouTube',
    CSV_TIKTOK: 'Analytics/CSV_Imports/TikTok',
    CSV_INSTAGRAM: 'Analytics/CSV_Imports/Instagram'
  },

  // Script Property keys for Drive folder/sheet IDs
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

  // Master Spreadsheet Sheet Names (bound script)
  SHEETS: {
    MASTER: 'master',
    METRICS_YOUTUBE: 'metrics_youtube',
    METRICS_TIKTOK: 'metrics_tiktok',
    METRICS_INSTAGRAM: 'metrics_instagram',
    KPI_TARGETS: 'kpi_targets',
    ANALYSIS_REPORTS: 'analysis_reports',
    RECOMMENDATIONS: 'recommendations',
    VIDEO_ANALYSIS: 'video_analysis',
    UNLINKED_IMPORTS: 'unlinked_imports'
  },

  // Inventory sheet tab name (same across all inventory spreadsheets)
  INVENTORY_TAB: 'inventory',

  // Master Sheet Column Groups
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

  // All master columns in order
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

  // Inventory Common Columns
  INVENTORY_COLUMNS: [
    'component_id', 'type', 'name', 'description', 'file_link',
    'tags', 'times_used', 'avg_performance_score', 'created_date', 'status'
  ],

  // Scenarios Inventory has extra columns
  SCENARIOS_EXTRA_COLUMNS: ['script_en', 'script_jp'],

  // Component ID Prefixes
  COMPONENT_PREFIXES: {
    SCENARIO_HOOK: 'SCN_H_',
    SCENARIO_BODY: 'SCN_B_',
    SCENARIO_CTA: 'SCN_C_',
    MOTION: 'MOT_',
    CHARACTER: 'CHR_',
    AUDIO: 'AUD_'
  },

  // Component Types
  COMPONENT_TYPES: {
    SCENARIO: ['hook', 'body', 'cta'],
    MOTION: ['hook', 'body', 'cta'],
    AUDIO: ['voice', 'bgm'],
    CHARACTER: ['character']
  },

  // Video Production Statuses
  VIDEO_STATUSES: ['draft', 'approved', 'in_production', 'published', 'analyzed'],

  // Component statuses
  COMPONENT_STATUSES: ['active', 'archived'],

  // Dropdown options for data validation
  DROPDOWN_OPTIONS: {
    STATUS: ['pending', 'approved', 'rejected', 'in_progress'],
    CATEGORY: ['hook', 'pacing', 'content', 'format', 'platform', 'thumbnail', 'audio', 'other'],
    PRIORITY: ['1', '2', '3', '4', '5'],
    PLATFORM: ['youtube', 'tiktok', 'instagram', 'all'],
    VIDEO_STATUS: ['draft', 'approved', 'in_production', 'published', 'analyzed'],
    COMPONENT_STATUS: ['active', 'archived']
  },

  // Colors for conditional formatting
  COLORS: {
    STATUS: {
      'pending': '#FFF3CD',
      'approved': '#D4EDDA',
      'rejected': '#F8D7DA',
      'in_progress': '#CCE5FF'
    },
    VIDEO_STATUS: {
      'draft': '#E2E3E5',
      'approved': '#D4EDDA',
      'in_production': '#CCE5FF',
      'published': '#D1ECF1',
      'analyzed': '#C3E6CB'
    },
    PRIORITY: {
      '1': '#F8D7DA',
      '2': '#FFE5D0',
      '3': '#FFF3CD',
      '4': '#D4EDDA',
      '5': '#E2E3E5'
    },
    HEADER: '#4285f4',
    HEADER_FONT: '#ffffff'
  },

  // KPI Target Defaults
  KPI_DEFAULTS: {
    youtube: {
      completion_rate: 0.50,
      ctr: 0.05,
      engagement_rate: 0.03
    },
    tiktok: {
      completion_rate: 0.40,
      engagement_rate: 0.08,
      avg_watch_time: 10
    },
    instagram: {
      reach_rate: 0.30,
      avg_watch_time: 15,
      engagement_rate: 0.05
    }
  },

  // Column Aliases for CSV parsing
  COLUMN_ALIASES: {
    youtube: {
      video_id: ['Video ID', 'Content', 'コンテンツ'],
      title: ['Video title', 'Title', '動画タイトル', 'タイトル'],
      views: ['Views', 'View count', '視聴回数'],
      watch_time_hours: ['Watch time (hours)', '総再生時間（時間）', 'Watch time'],
      avg_view_duration: ['Average view duration', '平均視聴時間', 'Avg. duration'],
      ctr: ['Impressions click-through rate (%)', 'CTR', 'インプレッションのクリック率（%）'],
      likes: ['Likes', 'Like count', '高評価'],
      comments: ['Comments', 'Comment count', 'コメント'],
      shares: ['Shares', 'Share count', '共有'],
      subscribers_gained: ['Subscribers', 'Subscribers gained', 'チャンネル登録者']
    },
    tiktok: {
      video_id: ['Video ID', 'video_id', 'ID'],
      title: ['Title', 'Video Title', 'Description'],
      views: ['Video views', 'Views', 'Total views'],
      avg_watch_time: ['Average watch time', 'Avg. watch time', 'Avg watch time (s)'],
      completion_rate: ['Watched full video (%)', 'Completion rate', 'Full video views (%)'],
      likes: ['Likes', 'Like count', 'Total likes'],
      comments: ['Comments', 'Comment count', 'Total comments'],
      shares: ['Shares', 'Share count', 'Total shares'],
      saves: ['Saves', 'Save count', 'Total saves'],
      engagement_rate: ['Engagement rate', 'Engagement rate (%)']
    },
    instagram: {
      reel_id: ['Reel ID', 'Media ID', 'ID'],
      title: ['Caption', 'Title', 'Description'],
      views: ['Plays', 'Views', 'Video Views', 'Total plays'],
      reach: ['Reach', 'Accounts reached', 'Unique views'],
      avg_watch_time: ['Average watch time', 'Avg. watch time', 'Avg time watched'],
      likes: ['Likes', 'Like count', 'Total likes'],
      comments: ['Comments', 'Comment count', 'Total comments'],
      shares: ['Shares', 'Share count', 'Total shares'],
      saves: ['Saves', 'Save count', 'Total saves']
    }
  },

  // Retry configuration
  RETRY: {
    MAX_ATTEMPTS: 5,
    BASE_DELAY_MS: 1000,
    MAX_DELAY_MS: 8000
  },

  // Batch size for OpenAI requests
  OPENAI_BATCH_SIZE: 5,

  // GAS execution timeout handling
  EXECUTION_TIME_LIMIT_MS: 330000
};

/**
 * Read a config value from the _config sheet (fallback for Script Properties)
 * The _config sheet has columns: key, value, description
 * @param {string} key - The config key to look up
 * @returns {string|null} The value or null if not found
 * @private
 */
function getConfigFromSheet_(key) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) return null;
    var configSheet = ss.getSheetByName('_config');
    if (!configSheet || configSheet.getLastRow() < 2) return null;
    var data = configSheet.getRange(2, 1, configSheet.getLastRow() - 1, 2).getValues();
    for (var i = 0; i < data.length; i++) {
      if (data[i][0] === key) {
        // Also migrate to Script Properties for future use
        try {
          PropertiesService.getScriptProperties().setProperty(key, data[i][1]);
          Logger.log('Migrated ' + key + ' from _config sheet to Script Properties');
        } catch (e) {
          // Ignore migration errors
        }
        return data[i][1];
      }
    }
  } catch (e) {
    // Silently fail - this is a fallback mechanism
  }
  return null;
}

/**
 * Migrate all config values from _config sheet to Script Properties
 * Run this once after setting up config values via the Sheets API
 */
function migrateConfigToProperties() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var configSheet = ss.getSheetByName('_config');
  if (!configSheet || configSheet.getLastRow() < 2) {
    Logger.log('No _config sheet or no data');
    return;
  }
  var data = configSheet.getRange(2, 1, configSheet.getLastRow() - 1, 2).getValues();
  var props = PropertiesService.getScriptProperties();
  var migrated = 0;
  for (var i = 0; i < data.length; i++) {
    if (data[i][0] && data[i][1]) {
      props.setProperty(data[i][0], data[i][1]);
      migrated++;
      Logger.log('Set Script Property: ' + data[i][0]);
    }
  }
  Logger.log('Migrated ' + migrated + ' config values');
  return migrated;
}

/**
 * Initialize configuration from Script Properties
 */
function initializeConfig() {
  const props = PropertiesService.getScriptProperties();

  const required = ['SPREADSHEET_ID', 'OPENAI_API_KEY'];
  const missing = required.filter(key => !props.getProperty(key));

  if (missing.length > 0) {
    throw new Error(`Missing required Script Properties: ${missing.join(', ')}`);
  }

  Logger.log('Configuration initialized successfully');
  return true;
}

/**
 * Get spreadsheet instance (master spreadsheet, bound script)
 */
function getSpreadsheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss) {
    return ss;
  }

  if (!CONFIG.SPREADSHEET_ID) {
    throw new Error('SPREADSHEET_ID not configured');
  }
  return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
}

/**
 * Get specific sheet by name from master spreadsheet
 */
function getSheet(sheetName) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error(`Sheet not found: ${sheetName}`);
  }
  return sheet;
}

/**
 * Get inventory spreadsheet by type
 * @param {string} type - 'scenarios' | 'motions' | 'characters' | 'audio'
 * @returns {Spreadsheet}
 */
function getInventorySpreadsheet(type) {
  const propKey = CONFIG.PROP_KEYS[`${type.toUpperCase()}_INVENTORY_ID`];
  const ssId = PropertiesService.getScriptProperties().getProperty(propKey);

  if (!ssId) {
    throw new Error(`Inventory spreadsheet ID not set for: ${type}. Run setupCompleteSystem() first.`);
  }

  return SpreadsheetApp.openById(ssId);
}

/**
 * Get inventory sheet (the 'inventory' tab from a component spreadsheet)
 * @param {string} type - 'scenarios' | 'motions' | 'characters' | 'audio'
 * @returns {Sheet}
 */
function getInventorySheet(type) {
  const ss = getInventorySpreadsheet(type);
  const sheet = ss.getSheetByName(CONFIG.INVENTORY_TAB);
  if (!sheet) {
    throw new Error(`Inventory tab not found in ${type} spreadsheet`);
  }
  return sheet;
}
