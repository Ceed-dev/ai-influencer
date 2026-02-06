/**
 * Configuration settings for Video Analytics Hub
 *
 * IMPORTANT: Sensitive values should be stored in Script Properties, not here.
 * Use PropertiesService.getScriptProperties().setProperty('KEY', 'value')
 */

const CONFIG = {
  // Spreadsheet ID - Set this after creating the Google Sheets
  SPREADSHEET_ID: PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID') || '',

  // OpenAI API Key - Store in Script Properties for security
  OPENAI_API_KEY: PropertiesService.getScriptProperties().getProperty('OPENAI_API_KEY') || '',

  // OpenAI Model
  OPENAI_MODEL: 'gpt-4o',

  // Sheet Names
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

  // KPI Target Defaults (can be overridden in kpi_targets sheet)
  KPI_DEFAULTS: {
    youtube: {
      completion_rate: 0.50,  // 50% completion
      ctr: 0.05,              // 5% CTR
      engagement_rate: 0.03   // 3% engagement
    },
    tiktok: {
      completion_rate: 0.40,  // 40% completion
      engagement_rate: 0.08,  // 8% engagement
      avg_watch_time: 10      // 10 seconds
    },
    instagram: {
      reach_rate: 0.30,       // 30% of followers
      avg_watch_time: 15,     // 15 seconds
      engagement_rate: 0.05   // 5% engagement
    }
  },

  // Column Aliases for CSV parsing (handles platform format changes)
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
  EXECUTION_TIME_LIMIT_MS: 330000  // 5.5 minutes (leaving buffer before 6-min limit)
};

/**
 * Initialize configuration from Script Properties
 * Call this once during setup
 */
function initializeConfig() {
  const props = PropertiesService.getScriptProperties();

  // Check required properties
  const required = ['SPREADSHEET_ID', 'OPENAI_API_KEY'];
  const missing = required.filter(key => !props.getProperty(key));

  if (missing.length > 0) {
    throw new Error(`Missing required Script Properties: ${missing.join(', ')}`);
  }

  Logger.log('Configuration initialized successfully');
  return true;
}

/**
 * Get spreadsheet instance
 */
function getSpreadsheet() {
  if (!CONFIG.SPREADSHEET_ID) {
    throw new Error('SPREADSHEET_ID not configured');
  }
  return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
}

/**
 * Get specific sheet by name
 */
function getSheet(sheetName) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error(`Sheet not found: ${sheetName}`);
  }
  return sheet;
}
