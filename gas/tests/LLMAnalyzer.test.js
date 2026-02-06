/**
 * LLMAnalyzer Unit Tests
 *
 * Tests for LLM-based video performance analysis functions.
 * Run with Jest: npm test
 */

// Mock GAS globals
global.UrlFetchApp = {
  fetch: jest.fn(),
};

global.Utilities = {
  sleep: jest.fn(),
  formatDate: jest.fn(),
};

global.Logger = {
  log: jest.fn(),
};

global.CONFIG = {
  OPENAI_API_KEY: 'test-api-key',
  OPENAI_MODEL: 'gpt-4o',
  RETRY: {
    MAX_ATTEMPTS: 3,
    BASE_DELAY_MS: 100,
    MAX_DELAY_MS: 1000,
  },
};

// Import functions (simulating GAS module loading)
const {
  analyzWithLLM,
  buildAnalysisContext,
  buildAnalysisPrompt,
  buildRecommendationsPrompt,
  callOpenAI,
  parseAnalysisResponse,
  parseRecommendationsResponse,
  generateReportId,
} = (() => {
  // Re-implement functions for testing (GAS doesn't export modules)
  // These mirror the implementations in LLMAnalyzer.gs

  function generateReportId() {
    const now = new Date();
    const datePart = Utilities.formatDate(now, 'GMT', 'yyyyMMdd_HHmmss');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `RPT_${datePart}_${random}`;
  }

  function buildAnalysisContext(metricsBundle, kpiResults) {
    const context = {
      videos: [],
      summary: {
        total_videos: Object.keys(metricsBundle).length,
        platform_coverage: {},
        avg_scores: {},
      },
    };

    kpiResults.forEach((result) => {
      const videoMetrics = metricsBundle[result.video_uid] || {};

      context.videos.push({
        video_uid: result.video_uid,
        overall_score: result.overall_score,
        platforms: result.platforms,
        improvement_areas: result.improvement_areas.slice(0, 3),
        metrics: videoMetrics,
      });

      Object.keys(result.platforms).forEach((platform) => {
        context.summary.platform_coverage[platform] =
          (context.summary.platform_coverage[platform] || 0) + 1;
      });
    });

    if (kpiResults.length > 0) {
      context.summary.avg_scores.overall =
        kpiResults.reduce((sum, r) => sum + r.overall_score, 0) / kpiResults.length;
    }

    return context;
  }

  function buildAnalysisPrompt(context) {
    return `You are an AI video performance analyst. Analyze the following video metrics and provide insights.

CONTEXT:
${JSON.stringify(context, null, 2)}

TASK:
Analyze the performance data and identify:
1. Overall performance trends
2. Platform-specific patterns
3. Content elements that correlate with success
4. Areas needing improvement

OUTPUT FORMAT (TSV - Tab Separated Values):
Return your analysis in TSV format with the following columns:
category\tinsight\tconfidence\timpact

Categories: trend, pattern, strength, weakness, opportunity
Confidence: high, medium, low
Impact: high, medium, low

Example:
trend\tCompletion rates declining over past 3 videos\thigh\thigh
strength\tTikTok engagement consistently above target\tmedium\tmedium

Provide 5-10 rows of analysis.`;
  }

  function buildRecommendationsPrompt(context, analysis) {
    return `You are an AI video content strategist. Based on the analysis, provide actionable recommendations.

CONTEXT:
${JSON.stringify(context, null, 2)}

ANALYSIS:
${JSON.stringify(analysis, null, 2)}

TASK:
Provide specific, actionable recommendations for the next video, focusing on:
1. Content hooks and openers
2. Pacing and structure
3. Platform-specific optimizations
4. Topics and formats to test

OUTPUT FORMAT (TSV - Tab Separated Values):
Return recommendations in TSV format with the following columns:
priority\tcategory\trecommendation\tplatform\texpected_impact

Priority: 1 (highest) to 5 (lowest)
Category: hook, pacing, content, format, platform
Platform: youtube, tiktok, instagram, or all
Expected Impact: specific metric improvement expected

Example:
1\thook\tStart with a controversial statement or question in first 2 seconds\tall\t+15% completion rate
2\tplatform\tUse trending TikTok sound for next video\ttiktok\t+20% views

Provide 5-8 prioritized recommendations.`;
  }

  function callOpenAI(prompt) {
    if (!CONFIG.OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured');
    }

    const payload = {
      model: CONFIG.OPENAI_MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are an expert video performance analyst. Respond only with the requested TSV format.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    };

    const options = {
      method: 'post',
      headers: {
        Authorization: `Bearer ${CONFIG.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    };

    let lastError;
    for (let attempt = 0; attempt < CONFIG.RETRY.MAX_ATTEMPTS; attempt++) {
      try {
        const response = UrlFetchApp.fetch('https://api.openai.com/v1/chat/completions', options);
        const responseCode = response.getResponseCode();

        if (responseCode === 200) {
          const json = JSON.parse(response.getContentText());
          return json.choices[0].message.content;
        } else if (responseCode === 429) {
          const delay = Math.min(
            CONFIG.RETRY.BASE_DELAY_MS * Math.pow(2, attempt),
            CONFIG.RETRY.MAX_DELAY_MS
          );
          Utilities.sleep(delay);
          continue;
        } else {
          throw new Error(`OpenAI API error: ${responseCode} - ${response.getContentText()}`);
        }
      } catch (e) {
        lastError = e;
        const delay = Math.min(
          CONFIG.RETRY.BASE_DELAY_MS * Math.pow(2, attempt),
          CONFIG.RETRY.MAX_DELAY_MS
        );
        Utilities.sleep(delay);
      }
    }

    throw lastError || new Error('OpenAI API call failed after retries');
  }

  function parseAnalysisResponse(response) {
    const lines = response.trim().split('\n');
    const insights = [];

    lines.forEach((line) => {
      if (line.toLowerCase().startsWith('category\t')) return;

      const parts = line.split('\t');
      if (parts.length >= 4) {
        insights.push({
          category: parts[0].trim(),
          insight: parts[1].trim(),
          confidence: parts[2].trim(),
          impact: parts[3].trim(),
        });
      }
    });

    return { insights };
  }

  function parseRecommendationsResponse(response) {
    const lines = response.trim().split('\n');
    const recommendations = [];

    lines.forEach((line) => {
      if (line.toLowerCase().startsWith('priority\t')) return;

      const parts = line.split('\t');
      if (parts.length >= 5) {
        recommendations.push({
          priority: parseInt(parts[0].trim()) || 99,
          category: parts[1].trim(),
          recommendation: parts[2].trim(),
          platform: parts[3].trim(),
          expected_impact: parts[4].trim(),
        });
      }
    });

    recommendations.sort((a, b) => a.priority - b.priority);

    return recommendations;
  }

  function analyzWithLLM(metricsBundle, kpiResults) {
    const reportId = generateReportId();
    const context = buildAnalysisContext(metricsBundle, kpiResults);
    const analysisResponse = callOpenAI(buildAnalysisPrompt(context));
    const parsedAnalysis = parseAnalysisResponse(analysisResponse);
    const recommendationsResponse = callOpenAI(buildRecommendationsPrompt(context, parsedAnalysis));
    const recommendations = parseRecommendationsResponse(recommendationsResponse);

    return {
      report_id: reportId,
      generated_at: new Date().toISOString(),
      video_count: Object.keys(metricsBundle).length,
      analysis: parsedAnalysis,
      recommendations: recommendations,
      raw_context: context,
    };
  }

  return {
    analyzWithLLM,
    buildAnalysisContext,
    buildAnalysisPrompt,
    buildRecommendationsPrompt,
    callOpenAI,
    parseAnalysisResponse,
    parseRecommendationsResponse,
    generateReportId,
  };
})();

// ============================================================
// Test Suites
// ============================================================

describe('LLMAnalyzer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.CONFIG.OPENAI_API_KEY = 'test-api-key';
  });

  // ============================================================
  // buildAnalysisContext Tests
  // ============================================================
  describe('buildAnalysisContext', () => {
    test('should aggregate metrics by video_uid', () => {
      const metricsBundle = {
        video_001: {
          youtube: { completion_rate: 0.55, ctr: 0.06 },
          tiktok: { engagement_rate: 0.10 },
        },
        video_002: {
          youtube: { completion_rate: 0.45 },
        },
      };

      const kpiResults = [
        {
          video_uid: 'video_001',
          overall_score: 85,
          platforms: { youtube: {}, tiktok: {} },
          improvement_areas: ['area1', 'area2', 'area3', 'area4'],
        },
        {
          video_uid: 'video_002',
          overall_score: 70,
          platforms: { youtube: {} },
          improvement_areas: ['area1'],
        },
      ];

      const context = buildAnalysisContext(metricsBundle, kpiResults);

      expect(context.videos).toHaveLength(2);
      expect(context.videos[0].video_uid).toBe('video_001');
      expect(context.videos[0].metrics.youtube.completion_rate).toBe(0.55);
      expect(context.videos[1].metrics.youtube.completion_rate).toBe(0.45);
    });

    test('should calculate platform_coverage correctly', () => {
      const metricsBundle = {
        video_001: {},
        video_002: {},
        video_003: {},
      };

      const kpiResults = [
        { video_uid: 'video_001', overall_score: 80, platforms: { youtube: {}, tiktok: {} }, improvement_areas: [] },
        { video_uid: 'video_002', overall_score: 75, platforms: { youtube: {}, instagram: {} }, improvement_areas: [] },
        { video_uid: 'video_003', overall_score: 90, platforms: { youtube: {} }, improvement_areas: [] },
      ];

      const context = buildAnalysisContext(metricsBundle, kpiResults);

      expect(context.summary.platform_coverage.youtube).toBe(3);
      expect(context.summary.platform_coverage.tiktok).toBe(1);
      expect(context.summary.platform_coverage.instagram).toBe(1);
    });

    test('should calculate average score correctly', () => {
      const metricsBundle = { video_001: {}, video_002: {} };

      const kpiResults = [
        { video_uid: 'video_001', overall_score: 80, platforms: {}, improvement_areas: [] },
        { video_uid: 'video_002', overall_score: 60, platforms: {}, improvement_areas: [] },
      ];

      const context = buildAnalysisContext(metricsBundle, kpiResults);

      expect(context.summary.avg_scores.overall).toBe(70);
    });

    test('should limit improvement_areas to 3 items', () => {
      const metricsBundle = { video_001: {} };

      const kpiResults = [
        {
          video_uid: 'video_001',
          overall_score: 50,
          platforms: {},
          improvement_areas: ['area1', 'area2', 'area3', 'area4', 'area5'],
        },
      ];

      const context = buildAnalysisContext(metricsBundle, kpiResults);

      expect(context.videos[0].improvement_areas).toHaveLength(3);
      expect(context.videos[0].improvement_areas).toEqual(['area1', 'area2', 'area3']);
    });

    test('should handle empty kpiResults', () => {
      const metricsBundle = { video_001: {} };
      const kpiResults = [];

      const context = buildAnalysisContext(metricsBundle, kpiResults);

      expect(context.videos).toHaveLength(0);
      expect(context.summary.avg_scores.overall).toBeUndefined();
    });

    test('should handle missing video in metricsBundle', () => {
      const metricsBundle = {};

      const kpiResults = [
        { video_uid: 'video_001', overall_score: 80, platforms: {}, improvement_areas: [] },
      ];

      const context = buildAnalysisContext(metricsBundle, kpiResults);

      expect(context.videos[0].metrics).toEqual({});
    });
  });

  // ============================================================
  // buildAnalysisPrompt Tests
  // ============================================================
  describe('buildAnalysisPrompt', () => {
    test('should include context as JSON', () => {
      const context = {
        videos: [{ video_uid: 'video_001' }],
        summary: { total_videos: 1 },
      };

      const prompt = buildAnalysisPrompt(context);

      expect(prompt).toContain('You are an AI video performance analyst');
      expect(prompt).toContain(JSON.stringify(context, null, 2));
      expect(prompt).toContain('category\tinsight\tconfidence\timpact');
    });

    test('should request TSV format output', () => {
      const context = { videos: [], summary: {} };

      const prompt = buildAnalysisPrompt(context);

      expect(prompt).toContain('TSV');
      expect(prompt).toContain('Tab Separated Values');
    });
  });

  // ============================================================
  // buildRecommendationsPrompt Tests
  // ============================================================
  describe('buildRecommendationsPrompt', () => {
    test('should include both context and analysis', () => {
      const context = { videos: [{ video_uid: 'video_001' }] };
      const analysis = { insights: [{ category: 'trend', insight: 'test' }] };

      const prompt = buildRecommendationsPrompt(context, analysis);

      expect(prompt).toContain('You are an AI video content strategist');
      expect(prompt).toContain(JSON.stringify(context, null, 2));
      expect(prompt).toContain(JSON.stringify(analysis, null, 2));
      expect(prompt).toContain('priority\tcategory\trecommendation\tplatform\texpected_impact');
    });
  });

  // ============================================================
  // parseAnalysisResponse Tests
  // ============================================================
  describe('parseAnalysisResponse', () => {
    test('should parse valid TSV response', () => {
      const response = `trend\tCompletion rates declining\thigh\thigh
pattern\tEngagement spikes on weekends\tmedium\tmedium
weakness\tLow CTR on YouTube\thigh\tlow`;

      const result = parseAnalysisResponse(response);

      expect(result.insights).toHaveLength(3);
      expect(result.insights[0]).toEqual({
        category: 'trend',
        insight: 'Completion rates declining',
        confidence: 'high',
        impact: 'high',
      });
      expect(result.insights[1].category).toBe('pattern');
      expect(result.insights[2].category).toBe('weakness');
    });

    test('should skip header row', () => {
      const response = `category\tinsight\tconfidence\timpact
trend\tTest insight\thigh\thigh`;

      const result = parseAnalysisResponse(response);

      expect(result.insights).toHaveLength(1);
      expect(result.insights[0].category).toBe('trend');
    });

    test('should skip header row case-insensitively', () => {
      const response = `Category\tInsight\tConfidence\tImpact
trend\tTest insight\thigh\thigh`;

      const result = parseAnalysisResponse(response);

      expect(result.insights).toHaveLength(1);
    });

    test('should skip malformed lines (less than 4 columns)', () => {
      const response = `trend\tThis line is incomplete
pattern\tValid line\tmedium\tmedium
weakness\tAnother incomplete`;

      const result = parseAnalysisResponse(response);

      expect(result.insights).toHaveLength(1);
      expect(result.insights[0].category).toBe('pattern');
    });

    test('should trim whitespace from values', () => {
      const response = `  trend  \t  Insight with spaces  \t  high  \t  medium  `;

      const result = parseAnalysisResponse(response);

      expect(result.insights[0]).toEqual({
        category: 'trend',
        insight: 'Insight with spaces',
        confidence: 'high',
        impact: 'medium',
      });
    });

    test('should handle empty response', () => {
      const response = '';

      const result = parseAnalysisResponse(response);

      expect(result.insights).toHaveLength(0);
    });

    test('should handle response with only header', () => {
      const response = 'category\tinsight\tconfidence\timpact';

      const result = parseAnalysisResponse(response);

      expect(result.insights).toHaveLength(0);
    });
  });

  // ============================================================
  // parseRecommendationsResponse Tests
  // ============================================================
  describe('parseRecommendationsResponse', () => {
    test('should parse valid TSV recommendations', () => {
      const response = `1\thook\tStart with a question\tall\t+15% completion
2\tpacing\tQuicker cuts in first 5s\tyoutube\t+10% retention
3\tcontent\tAdd subtitles\ttiktok\t+20% reach`;

      const result = parseRecommendationsResponse(response);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        priority: 1,
        category: 'hook',
        recommendation: 'Start with a question',
        platform: 'all',
        expected_impact: '+15% completion',
      });
    });

    test('should skip header row', () => {
      const response = `priority\tcategory\trecommendation\tplatform\texpected_impact
1\thook\tTest recommendation\tall\t+10%`;

      const result = parseRecommendationsResponse(response);

      expect(result).toHaveLength(1);
      expect(result[0].priority).toBe(1);
    });

    test('should sort by priority ascending', () => {
      const response = `3\tcontent\tThird priority\tall\t+5%
1\thook\tFirst priority\tall\t+15%
2\tpacing\tSecond priority\tall\t+10%`;

      const result = parseRecommendationsResponse(response);

      expect(result[0].priority).toBe(1);
      expect(result[1].priority).toBe(2);
      expect(result[2].priority).toBe(3);
    });

    test('should handle invalid priority as 99', () => {
      const response = `high\thook\tInvalid priority format\tall\t+10%
1\tpacing\tValid priority\tall\t+5%`;

      const result = parseRecommendationsResponse(response);

      expect(result[0].priority).toBe(1); // Sorted first
      expect(result[1].priority).toBe(99); // Invalid becomes 99
    });

    test('should skip malformed lines (less than 5 columns)', () => {
      const response = `1\thook\tIncomplete line
2\tpacing\tValid line\tyoutube\t+10%
3\tcontent\tAnother incomplete\tall`;

      const result = parseRecommendationsResponse(response);

      expect(result).toHaveLength(1);
      expect(result[0].priority).toBe(2);
    });

    test('should handle empty response', () => {
      const response = '';

      const result = parseRecommendationsResponse(response);

      expect(result).toHaveLength(0);
    });
  });

  // ============================================================
  // callOpenAI Tests
  // ============================================================
  describe('callOpenAI', () => {
    test('should throw error when API key is not configured', () => {
      global.CONFIG.OPENAI_API_KEY = '';

      expect(() => callOpenAI('test prompt')).toThrow('OpenAI API key not configured');
    });

    test('should return content on successful response', () => {
      const mockResponse = {
        getResponseCode: () => 200,
        getContentText: () => JSON.stringify({
          choices: [{ message: { content: 'Test response content' } }],
        }),
      };

      UrlFetchApp.fetch.mockReturnValue(mockResponse);

      const result = callOpenAI('test prompt');

      expect(result).toBe('Test response content');
      expect(UrlFetchApp.fetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({
          method: 'post',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-api-key',
          }),
        })
      );
    });

    test('should retry on 429 rate limit response', () => {
      const rateLimitResponse = {
        getResponseCode: () => 429,
        getContentText: () => 'Rate limited',
      };

      const successResponse = {
        getResponseCode: () => 200,
        getContentText: () => JSON.stringify({
          choices: [{ message: { content: 'Success after retry' } }],
        }),
      };

      UrlFetchApp.fetch
        .mockReturnValueOnce(rateLimitResponse)
        .mockReturnValueOnce(successResponse);

      const result = callOpenAI('test prompt');

      expect(result).toBe('Success after retry');
      expect(UrlFetchApp.fetch).toHaveBeenCalledTimes(2);
      expect(Utilities.sleep).toHaveBeenCalledTimes(1);
    });

    test('should apply exponential backoff on retries', () => {
      const rateLimitResponse = {
        getResponseCode: () => 429,
        getContentText: () => 'Rate limited',
      };

      const successResponse = {
        getResponseCode: () => 200,
        getContentText: () => JSON.stringify({
          choices: [{ message: { content: 'Success' } }],
        }),
      };

      UrlFetchApp.fetch
        .mockReturnValueOnce(rateLimitResponse)
        .mockReturnValueOnce(rateLimitResponse)
        .mockReturnValueOnce(successResponse);

      callOpenAI('test prompt');

      // BASE_DELAY_MS = 100
      // Attempt 0: 100 * 2^0 = 100
      // Attempt 1: 100 * 2^1 = 200
      expect(Utilities.sleep).toHaveBeenNthCalledWith(1, 100);
      expect(Utilities.sleep).toHaveBeenNthCalledWith(2, 200);
    });

    test('should cap delay at MAX_DELAY_MS', () => {
      // Set small max delay for testing
      global.CONFIG.RETRY.MAX_DELAY_MS = 150;

      const rateLimitResponse = {
        getResponseCode: () => 429,
        getContentText: () => 'Rate limited',
      };

      const successResponse = {
        getResponseCode: () => 200,
        getContentText: () => JSON.stringify({
          choices: [{ message: { content: 'Success' } }],
        }),
      };

      UrlFetchApp.fetch
        .mockReturnValueOnce(rateLimitResponse)
        .mockReturnValueOnce(rateLimitResponse)
        .mockReturnValueOnce(successResponse);

      callOpenAI('test prompt');

      // Attempt 0: min(100, 150) = 100
      // Attempt 1: min(200, 150) = 150 (capped)
      expect(Utilities.sleep).toHaveBeenNthCalledWith(1, 100);
      expect(Utilities.sleep).toHaveBeenNthCalledWith(2, 150);

      // Reset
      global.CONFIG.RETRY.MAX_DELAY_MS = 1000;
    });

    test('should throw error on non-200/429 response', () => {
      const errorResponse = {
        getResponseCode: () => 500,
        getContentText: () => 'Internal Server Error',
      };

      UrlFetchApp.fetch.mockReturnValue(errorResponse);

      expect(() => callOpenAI('test prompt')).toThrow('OpenAI API error: 500 - Internal Server Error');
    });

    test('should throw last error after max retries exhausted', () => {
      const rateLimitResponse = {
        getResponseCode: () => 429,
        getContentText: () => 'Rate limited',
      };

      UrlFetchApp.fetch.mockReturnValue(rateLimitResponse);

      expect(() => callOpenAI('test prompt')).toThrow();
      expect(UrlFetchApp.fetch).toHaveBeenCalledTimes(3); // MAX_ATTEMPTS = 3
    });

    test('should include correct payload structure', () => {
      const successResponse = {
        getResponseCode: () => 200,
        getContentText: () => JSON.stringify({
          choices: [{ message: { content: 'Response' } }],
        }),
      };

      UrlFetchApp.fetch.mockReturnValue(successResponse);

      callOpenAI('my test prompt');

      const callArgs = UrlFetchApp.fetch.mock.calls[0];
      const options = callArgs[1];
      const payload = JSON.parse(options.payload);

      expect(payload.model).toBe('gpt-4o');
      expect(payload.messages).toHaveLength(2);
      expect(payload.messages[0].role).toBe('system');
      expect(payload.messages[1].role).toBe('user');
      expect(payload.messages[1].content).toBe('my test prompt');
      expect(payload.temperature).toBe(0.7);
      expect(payload.max_tokens).toBe(2000);
    });
  });

  // ============================================================
  // generateReportId Tests
  // ============================================================
  describe('generateReportId', () => {
    test('should generate ID with correct format', () => {
      Utilities.formatDate.mockReturnValue('20260206_114500');

      const reportId = generateReportId();

      expect(reportId).toMatch(/^RPT_20260206_114500_\d{3}$/);
    });

    test('should use GMT timezone for formatting', () => {
      Utilities.formatDate.mockReturnValue('20260206_120000');

      generateReportId();

      expect(Utilities.formatDate).toHaveBeenCalledWith(
        expect.any(Date),
        'GMT',
        'yyyyMMdd_HHmmss'
      );
    });

    test('should generate random suffix between 000 and 999', () => {
      Utilities.formatDate.mockReturnValue('20260206_120000');

      // Generate multiple IDs and check suffix range
      const suffixes = new Set();
      for (let i = 0; i < 100; i++) {
        const id = generateReportId();
        const suffix = id.split('_').pop();
        expect(suffix).toMatch(/^\d{3}$/);
        expect(parseInt(suffix)).toBeGreaterThanOrEqual(0);
        expect(parseInt(suffix)).toBeLessThan(1000);
        suffixes.add(suffix);
      }

      // Should have some variation
      expect(suffixes.size).toBeGreaterThan(1);
    });

    test('should pad random suffix with leading zeros', () => {
      Utilities.formatDate.mockReturnValue('20260206_120000');

      // Mock Math.random to return small values
      const originalRandom = Math.random;
      Math.random = () => 0.005; // Will generate 5

      const reportId = generateReportId();

      expect(reportId).toBe('RPT_20260206_120000_005');

      Math.random = originalRandom;
    });
  });

  // ============================================================
  // analyzWithLLM Integration Tests
  // ============================================================
  describe('analyzWithLLM', () => {
    beforeEach(() => {
      Utilities.formatDate.mockReturnValue('20260206_120000');
    });

    test('should return complete analysis result', () => {
      const analysisResponse = `trend\tEngagement increasing\thigh\thigh`;
      const recommendationsResponse = `1\thook\tUse question opener\tall\t+10%`;

      UrlFetchApp.fetch
        .mockReturnValueOnce({
          getResponseCode: () => 200,
          getContentText: () => JSON.stringify({
            choices: [{ message: { content: analysisResponse } }],
          }),
        })
        .mockReturnValueOnce({
          getResponseCode: () => 200,
          getContentText: () => JSON.stringify({
            choices: [{ message: { content: recommendationsResponse } }],
          }),
        });

      const metricsBundle = {
        video_001: { youtube: { completion_rate: 0.55 } },
      };

      const kpiResults = [
        { video_uid: 'video_001', overall_score: 80, platforms: { youtube: {} }, improvement_areas: [] },
      ];

      const result = analyzWithLLM(metricsBundle, kpiResults);

      expect(result.report_id).toMatch(/^RPT_/);
      expect(result.generated_at).toBeDefined();
      expect(result.video_count).toBe(1);
      expect(result.analysis.insights).toHaveLength(1);
      expect(result.recommendations).toHaveLength(1);
      expect(result.raw_context).toBeDefined();
    });

    test('should call OpenAI twice (analysis + recommendations)', () => {
      const mockResponse = {
        getResponseCode: () => 200,
        getContentText: () => JSON.stringify({
          choices: [{ message: { content: 'trend\tTest\thigh\thigh' } }],
        }),
      };

      UrlFetchApp.fetch.mockReturnValue(mockResponse);

      const metricsBundle = { video_001: {} };
      const kpiResults = [
        { video_uid: 'video_001', overall_score: 80, platforms: {}, improvement_areas: [] },
      ];

      analyzWithLLM(metricsBundle, kpiResults);

      expect(UrlFetchApp.fetch).toHaveBeenCalledTimes(2);
    });

    test('should propagate API errors', () => {
      UrlFetchApp.fetch.mockReturnValue({
        getResponseCode: () => 500,
        getContentText: () => 'Server Error',
      });

      const metricsBundle = { video_001: {} };
      const kpiResults = [
        { video_uid: 'video_001', overall_score: 80, platforms: {}, improvement_areas: [] },
      ];

      expect(() => analyzWithLLM(metricsBundle, kpiResults)).toThrow('OpenAI API error');
    });
  });
});
