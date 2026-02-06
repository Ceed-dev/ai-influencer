/**
 * CSVParser.gs Unit Tests
 *
 * Run with: npm test -- gas/tests/CSVParser.test.js
 */

// Mock GAS globals before requiring the module
const mockParseCsv = jest.fn();
const mockGetScriptProperties = jest.fn();

global.Utilities = {
  parseCsv: mockParseCsv
};

global.PropertiesService = {
  getScriptProperties: () => ({
    getProperty: mockGetScriptProperties
  })
};

// Mock CONFIG
const CONFIG = {
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
  }
};

global.CONFIG = CONFIG;

// Import functions to test (simulating GAS function exports)
// In real GAS, these are global functions. For testing, we'll define them here.
const fs = require('fs');
const path = require('path');
const csvParserCode = fs.readFileSync(
  path.join(__dirname, '..', 'CSVParser.gs'),
  'utf8'
);
eval(csvParserCode);

describe('CSVParser', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('parseCSV', () => {
    it('should parse YouTube CSV with English headers', () => {
      const csvContent = `Video ID,Title,Views,Likes,Comments
abc123,Test Video,1000,50,10
def456,Another Video,2000,100,20`;

      mockParseCsv.mockReturnValue([
        ['Video ID', 'Title', 'Views', 'Likes', 'Comments'],
        ['abc123', 'Test Video', '1000', '50', '10'],
        ['def456', 'Another Video', '2000', '100', '20']
      ]);

      const result = parseCSV(csvContent, 'youtube');

      expect(result).toHaveLength(2);
      expect(result[0].video_id).toBe('abc123');
      expect(result[0].views).toBe(1000);
      expect(result[0].likes).toBe(50);
      expect(result[1].video_id).toBe('def456');
    });

    it('should parse TikTok CSV with English headers', () => {
      const csvContent = `Video ID,Video views,Likes,Shares
vid001,5000,200,50`;

      mockParseCsv.mockReturnValue([
        ['Video ID', 'Video views', 'Likes', 'Shares'],
        ['vid001', '5000', '200', '50']
      ]);

      const result = parseCSV(csvContent, 'tiktok');

      expect(result).toHaveLength(1);
      expect(result[0].video_id).toBe('vid001');
      expect(result[0].views).toBe(5000);
      expect(result[0].shares).toBe(50);
    });

    it('should parse Instagram CSV with reel_id', () => {
      const csvContent = `Reel ID,Plays,Likes
reel001,3000,150`;

      mockParseCsv.mockReturnValue([
        ['Reel ID', 'Plays', 'Likes'],
        ['reel001', '3000', '150']
      ]);

      const result = parseCSV(csvContent, 'instagram');

      expect(result).toHaveLength(1);
      expect(result[0].reel_id).toBe('reel001');
      expect(result[0].views).toBe(3000);
    });

    it('should throw error for unknown platform', () => {
      mockParseCsv.mockReturnValue([
        ['Header'],
        ['Value']
      ]);

      expect(() => parseCSV('data', 'unknown')).toThrow('Unknown platform: unknown');
    });

    it('should throw error for CSV with no data rows', () => {
      mockParseCsv.mockReturnValue([['Header']]);

      expect(() => parseCSV('header only', 'youtube')).toThrow('CSV has no data rows');
    });

    it('should filter out rows without required fields', () => {
      mockParseCsv.mockReturnValue([
        ['Video ID', 'Title', 'Views'],
        ['abc123', 'Valid', '1000'],
        ['', 'Missing ID', '500'],  // Missing video_id
        ['def456', 'Missing Views', '']  // Missing views
      ]);

      const result = parseCSV('data', 'youtube');

      expect(result).toHaveLength(1);
      expect(result[0].video_id).toBe('abc123');
    });
  });

  describe('mapHeaders', () => {
    it('should map English YouTube headers', () => {
      const headers = ['Video ID', 'Title', 'Views', 'Likes'];
      const aliases = CONFIG.COLUMN_ALIASES.youtube;

      const result = mapHeaders(headers, aliases);

      expect(result.video_id).toBe(0);
      expect(result.title).toBe(1);
      expect(result.views).toBe(2);
      expect(result.likes).toBe(3);
    });

    it('should map Japanese YouTube headers', () => {
      const headers = ['コンテンツ', '動画タイトル', '視聴回数', '高評価'];
      const aliases = CONFIG.COLUMN_ALIASES.youtube;

      const result = mapHeaders(headers, aliases);

      expect(result.video_id).toBe(0);
      expect(result.title).toBe(1);
      expect(result.views).toBe(2);
      expect(result.likes).toBe(3);
    });

    it('should handle partial header match (includes)', () => {
      const headers = ['Video ID (unique)', 'Total Views'];
      const aliases = CONFIG.COLUMN_ALIASES.youtube;

      const result = mapHeaders(headers, aliases);

      expect(result.video_id).toBe(0);
      // 'Total Views' contains 'Views'
      expect(result.views).toBe(1);
    });

    it('should return -1 for missing headers', () => {
      const headers = ['Unknown Column'];
      const aliases = CONFIG.COLUMN_ALIASES.youtube;

      const result = mapHeaders(headers, aliases);

      expect(result.video_id).toBe(-1);
      expect(result.views).toBe(-1);
    });

    it('should handle case-insensitive matching', () => {
      const headers = ['VIDEO ID', 'VIEWS', 'likes'];
      const aliases = CONFIG.COLUMN_ALIASES.youtube;

      const result = mapHeaders(headers, aliases);

      expect(result.video_id).toBe(0);
      expect(result.views).toBe(1);
      expect(result.likes).toBe(2);
    });
  });

  describe('parseValue', () => {
    it('should return null for empty values', () => {
      expect(parseValue('', 'views')).toBeNull();
      expect(parseValue(null, 'views')).toBeNull();
      expect(parseValue(undefined, 'views')).toBeNull();
    });

    it('should parse numeric values with commas', () => {
      expect(parseValue('1,000', 'views')).toBe(1000);
      expect(parseValue('1,234,567', 'views')).toBe(1234567);
    });

    it('should parse percentage values with % symbol', () => {
      // 5% -> 0.05
      expect(parseValue('5%', 'ctr')).toBe(0.05);
      expect(parseValue('50%', 'completion_rate')).toBe(0.5);
      expect(parseValue('100%', 'engagement_rate')).toBe(1);
    });

    it('should keep small percentages as-is if already decimal', () => {
      // Values <= 1 without % are kept as-is
      expect(parseValue('0.05', 'ctr')).toBe(0.05);
      expect(parseValue('0.5', 'completion_rate')).toBe(0.5);
    });

    it('should parse date fields to ISO format', () => {
      const result = parseValue('2024-01-15', 'publish_date');
      expect(result).toContain('2024-01-15');
    });

    it('should return string for non-numeric, non-date fields', () => {
      expect(parseValue('My Video Title', 'title')).toBe('My Video Title');
    });

    it('should return null for NaN numeric fields', () => {
      expect(parseValue('not a number', 'views')).toBeNull();
      expect(parseValue('abc', 'likes')).toBeNull();
    });

    it('should trim whitespace', () => {
      expect(parseValue('  My Title  ', 'title')).toBe('My Title');
      expect(parseValue(' 1000 ', 'views')).toBe(1000);
    });

    it('should handle avg_view_duration field', () => {
      expect(parseValue('120', 'avg_view_duration')).toBe(120);
    });

    it('should handle watch_time_hours field', () => {
      expect(parseValue('24.5', 'watch_time_hours')).toBe(24.5);
    });
  });

  describe('hasRequiredFields', () => {
    it('should return true for YouTube row with required fields', () => {
      const row = { video_id: 'abc123', views: 1000 };
      expect(hasRequiredFields(row, 'youtube')).toBe(true);
    });

    it('should return false for YouTube row missing video_id', () => {
      const row = { views: 1000 };
      expect(hasRequiredFields(row, 'youtube')).toBe(false);
    });

    it('should return false for YouTube row missing views', () => {
      const row = { video_id: 'abc123' };
      expect(hasRequiredFields(row, 'youtube')).toBe(false);
    });

    it('should return false for YouTube row with null video_id', () => {
      const row = { video_id: null, views: 1000 };
      expect(hasRequiredFields(row, 'youtube')).toBe(false);
    });

    it('should return true for TikTok row with required fields', () => {
      const row = { video_id: 'vid001', views: 5000 };
      expect(hasRequiredFields(row, 'tiktok')).toBe(true);
    });

    it('should return true for Instagram row with required fields', () => {
      const row = { reel_id: 'reel001', views: 3000 };
      expect(hasRequiredFields(row, 'instagram')).toBe(true);
    });

    it('should return true for unknown platform (no required fields)', () => {
      const row = {};
      expect(hasRequiredFields(row, 'unknown')).toBe(true);
    });
  });

  describe('detectPlatform', () => {
    it('should detect YouTube from watch time header', () => {
      expect(detectPlatform('Video ID,Watch time,Views')).toBe('youtube');
    });

    it('should detect YouTube from Japanese header', () => {
      expect(detectPlatform('コンテンツ,総再生時間（時間）,視聴回数')).toBe('youtube');
    });

    it('should detect TikTok from tiktok keyword', () => {
      expect(detectPlatform('TikTok Video ID,Views')).toBe('tiktok');
    });

    it('should detect TikTok from video views header', () => {
      expect(detectPlatform('ID,Video views,Likes')).toBe('tiktok');
    });

    it('should detect Instagram from reel header', () => {
      expect(detectPlatform('Reel ID,Plays,Likes')).toBe('instagram');
    });

    it('should detect Instagram from plays header', () => {
      expect(detectPlatform('ID,Plays,Engagement')).toBe('instagram');
    });

    it('should return null for unknown format', () => {
      expect(detectPlatform('Unknown,Headers,Here')).toBeNull();
    });

    it('should be case-insensitive', () => {
      expect(detectPlatform('WATCH TIME,VIEWS')).toBe('youtube');
      expect(detectPlatform('REEL,PLAYS')).toBe('instagram');
    });
  });

  describe('validateParsedData', () => {
    it('should return empty array for valid data', () => {
      const parsed = [
        { _row_index: 2, views: 1000, likes: 50, ctr: 0.05, completion_rate: 0.5 },
        { _row_index: 3, views: 2000, likes: 100, ctr: 0.08, completion_rate: 0.6 }
      ];

      const errors = validateParsedData(parsed, 'youtube');
      expect(errors).toHaveLength(0);
    });

    it('should detect negative view count', () => {
      const parsed = [
        { _row_index: 2, views: -100, likes: 50 }
      ];

      const errors = validateParsedData(parsed, 'youtube');
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('Row 2');
      expect(errors[0]).toContain('views');
      expect(errors[0]).toContain('negative');
    });

    it('should detect negative likes count', () => {
      const parsed = [
        { _row_index: 2, views: 1000, likes: -10 }
      ];

      const errors = validateParsedData(parsed, 'youtube');
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('likes');
    });

    it('should detect CTR out of range (> 1)', () => {
      const parsed = [
        { _row_index: 2, views: 1000, ctr: 1.5 }
      ];

      const errors = validateParsedData(parsed, 'youtube');
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('ctr');
      expect(errors[0]).toContain('out of range');
    });

    it('should detect negative CTR', () => {
      const parsed = [
        { _row_index: 2, views: 1000, ctr: -0.1 }
      ];

      const errors = validateParsedData(parsed, 'youtube');
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('ctr');
    });

    it('should detect completion_rate out of range', () => {
      const parsed = [
        { _row_index: 2, views: 1000, completion_rate: 1.2 }
      ];

      const errors = validateParsedData(parsed, 'youtube');
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('completion_rate');
    });

    it('should detect engagement_rate out of range', () => {
      const parsed = [
        { _row_index: 2, views: 1000, engagement_rate: 2.0 }
      ];

      const errors = validateParsedData(parsed, 'youtube');
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('engagement_rate');
    });

    it('should detect multiple errors in same row', () => {
      const parsed = [
        { _row_index: 2, views: -100, likes: -50, ctr: 1.5 }
      ];

      const errors = validateParsedData(parsed, 'youtube');
      expect(errors).toHaveLength(3);
    });

    it('should detect errors across multiple rows', () => {
      const parsed = [
        { _row_index: 2, views: -100 },
        { _row_index: 3, ctr: 1.5 }
      ];

      const errors = validateParsedData(parsed, 'youtube');
      expect(errors).toHaveLength(2);
      expect(errors[0]).toContain('Row 2');
      expect(errors[1]).toContain('Row 3');
    });

    it('should ignore null values in validation', () => {
      const parsed = [
        { _row_index: 2, views: null, likes: null, ctr: null }
      ];

      const errors = validateParsedData(parsed, 'youtube');
      expect(errors).toHaveLength(0);
    });

    it('should allow edge case values (0 and 1 for rates)', () => {
      const parsed = [
        { _row_index: 2, views: 0, ctr: 0, completion_rate: 1 }
      ];

      const errors = validateParsedData(parsed, 'youtube');
      expect(errors).toHaveLength(0);
    });
  });

  describe('Integration: Full CSV Parsing Flow', () => {
    it('should handle complete YouTube analytics CSV', () => {
      const csvContent = `Video ID,Video title,Views,Watch time (hours),CTR,Likes,Comments
abc123,My First Video,"10,000",250,5%,500,50
def456,Second Video,5000,100,3.5%,200,20`;

      mockParseCsv.mockReturnValue([
        ['Video ID', 'Video title', 'Views', 'Watch time (hours)', 'CTR', 'Likes', 'Comments'],
        ['abc123', 'My First Video', '10,000', '250', '5%', '500', '50'],
        ['def456', 'Second Video', '5000', '100', '3.5%', '200', '20']
      ]);

      const result = parseCSV(csvContent, 'youtube');

      expect(result).toHaveLength(2);

      // First row
      expect(result[0].video_id).toBe('abc123');
      expect(result[0].title).toBe('My First Video');
      expect(result[0].views).toBe(10000);
      expect(result[0].watch_time_hours).toBe(250);
      expect(result[0].ctr).toBe(0.05);
      expect(result[0].likes).toBe(500);

      // Second row
      expect(result[1].video_id).toBe('def456');
      expect(result[1].views).toBe(5000);
      expect(result[1].ctr).toBe(0.035);

      // Metadata
      expect(result[0]._platform).toBe('youtube');
      expect(result[0]._row_index).toBe(2);
    });

    it('should handle Japanese YouTube analytics CSV', () => {
      const csvContent = `コンテンツ,動画タイトル,視聴回数,総再生時間（時間）
video001,テスト動画,1000,25`;

      mockParseCsv.mockReturnValue([
        ['コンテンツ', '動画タイトル', '視聴回数', '総再生時間（時間）'],
        ['video001', 'テスト動画', '1000', '25']
      ]);

      const result = parseCSV(csvContent, 'youtube');

      expect(result).toHaveLength(1);
      expect(result[0].video_id).toBe('video001');
      expect(result[0].title).toBe('テスト動画');
      expect(result[0].views).toBe(1000);
    });

    it('should handle complete TikTok analytics CSV', () => {
      mockParseCsv.mockReturnValue([
        ['Video ID', 'Video views', 'Average watch time', 'Watched full video (%)', 'Likes', 'Shares', 'Saves'],
        ['tiktok001', '50000', '15', '40%', '3000', '500', '200']
      ]);

      const result = parseCSV('data', 'tiktok');

      expect(result).toHaveLength(1);
      expect(result[0].video_id).toBe('tiktok001');
      expect(result[0].views).toBe(50000);
      expect(result[0].avg_watch_time).toBe(15);
      expect(result[0].completion_rate).toBe(0.4);
      expect(result[0].saves).toBe(200);
    });

    it('should handle complete Instagram Reels analytics CSV', () => {
      mockParseCsv.mockReturnValue([
        ['Reel ID', 'Plays', 'Reach', 'Likes', 'Comments', 'Shares', 'Saves'],
        ['reel001', '30000', '25000', '1500', '100', '300', '400']
      ]);

      const result = parseCSV('data', 'instagram');

      expect(result).toHaveLength(1);
      expect(result[0].reel_id).toBe('reel001');
      expect(result[0].views).toBe(30000);
      expect(result[0].reach).toBe(25000);
      expect(result[0].likes).toBe(1500);
    });
  });
});
