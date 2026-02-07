/**
 * LLM Analyzer - OpenAI integration for video performance analysis
 */

/**
 * Analyze metrics using LLM
 * @param {Object} metricsBundle - Metrics grouped by video_uid
 * @param {Array<Object>} kpiResults - KPI comparison results
 * @returns {Object} Analysis results with recommendations
 */
function analyzWithLLM(metricsBundle, kpiResults) {
  const reportId = generateReportId();

  // Build context for LLM
  const context = buildAnalysisContext(metricsBundle, kpiResults);

  // Generate analysis
  const analysisResponse = callOpenAI(buildAnalysisPrompt(context));

  // Parse response
  const parsedAnalysis = parseAnalysisResponse(analysisResponse);

  // Generate recommendations
  const recommendationsResponse = callOpenAI(buildRecommendationsPrompt(context, parsedAnalysis));

  // Parse recommendations
  const recommendations = parseRecommendationsResponse(recommendationsResponse);

  return {
    report_id: reportId,
    generated_at: new Date().toISOString(),
    video_count: Object.keys(metricsBundle).length,
    analysis: parsedAnalysis,
    recommendations: recommendations,
    raw_context: context
  };
}

/**
 * Build analysis context from metrics and KPI results
 */
function buildAnalysisContext(metricsBundle, kpiResults) {
  const context = {
    videos: [],
    summary: {
      total_videos: Object.keys(metricsBundle).length,
      platform_coverage: {},
      avg_scores: {}
    }
  };

  // Process each video
  kpiResults.forEach(result => {
    const videoMetrics = metricsBundle[result.video_uid] || {};

    context.videos.push({
      video_uid: result.video_uid,
      overall_score: result.overall_score,
      platforms: result.platforms,
      improvement_areas: result.improvement_areas.slice(0, 3),
      metrics: videoMetrics
    });

    // Update platform coverage
    Object.keys(result.platforms).forEach(platform => {
      context.summary.platform_coverage[platform] =
        (context.summary.platform_coverage[platform] || 0) + 1;
    });
  });

  // Calculate average scores
  if (kpiResults.length > 0) {
    context.summary.avg_scores.overall =
      kpiResults.reduce((sum, r) => sum + r.overall_score, 0) / kpiResults.length;
  }

  return context;
}

/**
 * Build analysis prompt
 */
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

/**
 * Build recommendations prompt
 */
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

/**
 * Call OpenAI API
 */
function callOpenAI(prompt) {
  if (!CONFIG.OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured');
  }

  const payload = {
    model: CONFIG.OPENAI_MODEL,
    messages: [
      {
        role: 'system',
        content: 'You are an expert video performance analyst. Respond only with the requested TSV format.'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    temperature: 0.7,
    max_tokens: 2000
  };

  const options = {
    method: 'post',
    headers: {
      'Authorization': `Bearer ${CONFIG.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  // Retry with exponential backoff
  let lastError;
  for (let attempt = 0; attempt < CONFIG.RETRY.MAX_ATTEMPTS; attempt++) {
    try {
      const response = UrlFetchApp.fetch('https://api.openai.com/v1/chat/completions', options);
      const responseCode = response.getResponseCode();

      if (responseCode === 200) {
        const json = JSON.parse(response.getContentText());
        return json.choices[0].message.content;
      } else if (responseCode === 429) {
        // Rate limited - wait and retry
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

/**
 * Parse TSV analysis response
 */
function parseAnalysisResponse(response) {
  const lines = response.trim().split('\n');
  const insights = [];

  lines.forEach(line => {
    // Skip header row if present
    if (line.toLowerCase().startsWith('category\t')) return;

    const parts = line.split('\t');
    if (parts.length >= 4) {
      insights.push({
        category: parts[0].trim(),
        insight: parts[1].trim(),
        confidence: parts[2].trim(),
        impact: parts[3].trim()
      });
    }
  });

  return { insights };
}

/**
 * Parse TSV recommendations response
 */
function parseRecommendationsResponse(response) {
  const lines = response.trim().split('\n');
  const recommendations = [];

  lines.forEach(line => {
    // Skip header row if present
    if (line.toLowerCase().startsWith('priority\t')) return;

    const parts = line.split('\t');
    if (parts.length >= 5) {
      recommendations.push({
        priority: parseInt(parts[0].trim()) || 99,
        category: parts[1].trim(),
        recommendation: parts[2].trim(),
        platform: parts[3].trim(),
        expected_impact: parts[4].trim()
      });
    }
  });

  // Sort by priority
  recommendations.sort((a, b) => a.priority - b.priority);

  return recommendations;
}

/**
 * Generate unique report ID
 */
function generateReportId() {
  const now = new Date();
  const datePart = Utilities.formatDate(now, 'GMT', 'yyyyMMdd_HHmmss');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `RPT_${datePart}_${random}`;
}

/**
 * Analyze a single video across all platforms
 * @param {string} videoUid - The video UID to analyze
 * @returns {Object} Per-video analysis results
 */
function analyzeVideoSingle(videoUid) {
  // Get video master data
  const videoData = getVideoMasterData(videoUid);
  if (!videoData) {
    throw new Error(`Video not found: ${videoUid}`);
  }

  // Get metrics from all platforms
  const metrics = {
    youtube: getLatestMetrics(videoUid, 'youtube'),
    tiktok: getLatestMetrics(videoUid, 'tiktok'),
    instagram: getLatestMetrics(videoUid, 'instagram')
  };

  // Get previous analysis for this video
  const previousAnalysis = getPreviousVideoAnalysis(videoUid);

  // Get KPI target for this video
  const kpiTarget = videoData.kpi_target;

  // Build context
  const context = {
    video_uid: videoUid,
    title: videoData.title,
    kpi_target: kpiTarget,
    prompt_doc_1: videoData.prompt_doc_1,
    prompt_doc_2: videoData.prompt_doc_2,
    metrics: metrics,
    previous_analysis: previousAnalysis,
    kpi_targets: getKPITargets()
  };

  // Call LLM for single video analysis
  const analysisResponse = callOpenAI(buildSingleVideoAnalysisPrompt(context));
  const analysis = parseSingleVideoAnalysisResponse(analysisResponse);

  return {
    video_uid: videoUid,
    analyzed_at: nowJapan(),
    youtube_performance: analysis.youtube_performance,
    tiktok_performance: analysis.tiktok_performance,
    instagram_performance: analysis.instagram_performance,
    cross_platform_insights: analysis.cross_platform_insights,
    kpi_achievement: analysis.kpi_achievement,
    improvements_from_previous: analysis.improvements_from_previous,
    prompt_effectiveness: analysis.prompt_effectiveness,
    recommendations: analysis.recommendations
  };
}

/**
 * Build prompt for single video cross-platform analysis
 */
function buildSingleVideoAnalysisPrompt(context) {
  const previousInfo = context.previous_analysis
    ? `\n\nPREVIOUS ANALYSIS (${context.previous_analysis.analyzed_at}):\n${JSON.stringify(context.previous_analysis, null, 2)}`
    : '\n\nPREVIOUS ANALYSIS: None (first analysis for this video)';

  const promptInfo = (context.prompt_doc_1 || context.prompt_doc_2)
    ? `\n\nPROMPT DOCUMENTS:\n- Scenario Prompt: ${context.prompt_doc_1 || 'Not provided'}\n- Visual Prompt: ${context.prompt_doc_2 || 'Not provided'}`
    : '';

  return `You are an expert AI video performance analyst. Analyze a single video's performance across multiple platforms.

VIDEO INFORMATION:
- Video UID: ${context.video_uid}
- Title: ${context.title || 'Unknown'}
- KPI Target: ${context.kpi_target || 'Not set'}
${promptInfo}

METRICS BY PLATFORM:
YouTube: ${JSON.stringify(context.metrics.youtube || 'No data', null, 2)}
TikTok: ${JSON.stringify(context.metrics.tiktok || 'No data', null, 2)}
Instagram: ${JSON.stringify(context.metrics.instagram || 'No data', null, 2)}

KPI TARGETS:
${JSON.stringify(context.kpi_targets, null, 2)}
${previousInfo}

ANALYSIS TASKS:
1. Summarize performance on each platform (1-2 sentences each)
2. Compare cross-platform performance and identify patterns
3. Evaluate KPI achievement (exceeded/met/partially_met/not_met)
4. Compare to previous analysis if available - what improved? what got worse?
5. If prompt documents are provided, comment on prompt effectiveness
6. Provide 2-3 specific recommendations for next video

OUTPUT FORMAT (JSON):
Return a JSON object with these keys:
{
  "youtube_performance": "summary string",
  "tiktok_performance": "summary string",
  "instagram_performance": "summary string",
  "cross_platform_insights": "key differences and patterns",
  "kpi_achievement": "exceeded|met|partially_met|not_met",
  "improvements_from_previous": "what improved vs previous analysis (or 'N/A - first analysis')",
  "prompt_effectiveness": "analysis of how prompts affected results (or 'N/A - no prompts provided')",
  "recommendations": "2-3 specific actionable recommendations for next video"
}

Respond with ONLY the JSON object, no additional text.`;
}

/**
 * Parse single video analysis response
 */
function parseSingleVideoAnalysisResponse(response) {
  try {
    // Clean up response - remove markdown code blocks if present
    let cleaned = response.trim();
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.slice(7);
    }
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.slice(3);
    }
    if (cleaned.endsWith('```')) {
      cleaned = cleaned.slice(0, -3);
    }

    return JSON.parse(cleaned.trim());
  } catch (e) {
    Logger.log('Failed to parse single video analysis: ' + e.message);
    Logger.log('Response was: ' + response);
    return {
      youtube_performance: 'Parse error',
      tiktok_performance: 'Parse error',
      instagram_performance: 'Parse error',
      cross_platform_insights: response,
      kpi_achievement: 'not_met',
      improvements_from_previous: 'Parse error',
      prompt_effectiveness: 'Parse error',
      recommendations: 'Parse error - see cross_platform_insights'
    };
  }
}

/**
 * Get video master data
 */
function getVideoMasterData(videoUid) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.VIDEOS_MASTER);
  if (!sheet || sheet.getLastRow() < 2) return null;

  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === videoUid) {
      const row = {};
      headers.forEach((h, idx) => {
        row[h] = data[i][idx];
      });
      return row;
    }
  }

  return null;
}

/**
 * Get latest metrics for a video from a specific platform
 */
function getLatestMetrics(videoUid, platform) {
  const sheetName = `metrics_${platform}`;
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);

  if (!sheet || sheet.getLastRow() < 2) return null;

  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  // Find the most recent entry for this video
  let latestRow = null;
  let latestDate = null;

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === videoUid) {
      const importDate = data[i][1]; // import_date column
      if (!latestDate || importDate > latestDate) {
        latestDate = importDate;
        latestRow = data[i];
      }
    }
  }

  if (!latestRow) return null;

  const metrics = {};
  headers.forEach((h, idx) => {
    metrics[h] = latestRow[idx];
  });

  return metrics;
}

/**
 * Get previous analysis for a video
 */
function getPreviousVideoAnalysis(videoUid) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.VIDEO_ANALYSIS);

  if (!sheet || sheet.getLastRow() < 2) return null;

  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  // Find the most recent analysis for this video
  let latestRow = null;
  let latestDate = null;

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === videoUid) {
      const analyzedAt = data[i][1]; // analyzed_at column
      if (!latestDate || analyzedAt > latestDate) {
        latestDate = analyzedAt;
        latestRow = data[i];
      }
    }
  }

  if (!latestRow) return null;

  const analysis = {};
  headers.forEach((h, idx) => {
    analysis[h] = latestRow[idx];
  });

  return analysis;
}

/**
 * Get previous recommendations for context
 */
function getPreviousRecommendations(limit = 20) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.RECOMMENDATIONS);

  if (!sheet || sheet.getLastRow() < 2) return [];

  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  // Get last N recommendations
  const startRow = Math.max(1, data.length - limit);
  const recommendations = [];

  for (let i = startRow; i < data.length; i++) {
    const rec = {};
    headers.forEach((h, idx) => {
      rec[h] = data[i][idx];
    });
    recommendations.push(rec);
  }

  return recommendations;
}

/**
 * Enhanced analysis with historical context
 */
function analyzWithLLMEnhanced(metricsBundle, kpiResults) {
  const reportId = generateReportId();

  // Get previous recommendations for context
  const previousRecs = getPreviousRecommendations();

  // Build context with historical data
  const context = buildAnalysisContext(metricsBundle, kpiResults);
  context.previous_recommendations = previousRecs;

  // Generate analysis with historical awareness
  const analysisPrompt = buildAnalysisPromptEnhanced(context);
  const analysisResponse = callOpenAI(analysisPrompt);
  const parsedAnalysis = parseAnalysisResponse(analysisResponse);

  // Generate recommendations with comparison to previous
  const recommendationsPrompt = buildRecommendationsPromptEnhanced(context, parsedAnalysis);
  const recommendationsResponse = callOpenAI(recommendationsPrompt);
  const recommendations = parseRecommendationsResponseEnhanced(recommendationsResponse);

  return {
    report_id: reportId,
    generated_at: nowJapan(),
    video_count: Object.keys(metricsBundle).length,
    analysis: parsedAnalysis,
    recommendations: recommendations,
    raw_context: context
  };
}

/**
 * Enhanced analysis prompt with historical context
 */
function buildAnalysisPromptEnhanced(context) {
  const prevRecsInfo = context.previous_recommendations && context.previous_recommendations.length > 0
    ? `\n\nPREVIOUS RECOMMENDATIONS (last ${context.previous_recommendations.length}):\n${JSON.stringify(context.previous_recommendations.slice(-5), null, 2)}`
    : '\n\nPREVIOUS RECOMMENDATIONS: None';

  return `You are an AI video performance analyst. Analyze the following video metrics and provide insights.

CONTEXT:
${JSON.stringify(context.videos, null, 2)}

SUMMARY:
${JSON.stringify(context.summary, null, 2)}
${prevRecsInfo}

TASK:
Analyze the performance data and identify:
1. Overall performance trends
2. Platform-specific patterns
3. Content elements that correlate with success
4. Areas needing improvement
5. IMPORTANT: Compare to previous recommendations - were they followed? Did they help?

OUTPUT FORMAT (TSV - Tab Separated Values):
Return your analysis in TSV format with the following columns:
category\tinsight\tconfidence\timpact

Categories: trend, pattern, strength, weakness, opportunity, improvement_from_previous
Confidence: high, medium, low
Impact: high, medium, low

Example:
trend\tCompletion rates declining over past 3 videos\thigh\thigh
improvement_from_previous\tHook recommendations were implemented and improved CTR by 15%\tmedium\thigh

Provide 5-10 rows of analysis, including at least one "improvement_from_previous" row.`;
}

/**
 * Enhanced recommendations prompt with comparison
 */
function buildRecommendationsPromptEnhanced(context, analysis) {
  return `You are an AI video content strategist. Based on the analysis, provide actionable recommendations.

CONTEXT:
${JSON.stringify(context.videos, null, 2)}

ANALYSIS:
${JSON.stringify(analysis, null, 2)}

PREVIOUS RECOMMENDATIONS:
${JSON.stringify(context.previous_recommendations ? context.previous_recommendations.slice(-5) : [], null, 2)}

TASK:
Provide specific, actionable recommendations for the next video:
1. Content hooks and openers
2. Pacing and structure
3. Platform-specific optimizations
4. Topics and formats to test
5. IMPORTANT: Note if this recommendation is NEW or a CONTINUATION of a previous unfollowed recommendation

OUTPUT FORMAT (TSV - Tab Separated Values):
Return recommendations in TSV format with the following columns:
priority\tcategory\trecommendation\tplatform\texpected_impact\tcompared_to_previous

Priority: 1 (highest) to 5 (lowest)
Category: hook, pacing, content, format, platform, thumbnail, audio
Platform: youtube, tiktok, instagram, all
Compared to previous: "NEW", "CONTINUATION", or "IMPROVED from [previous rec summary]"

Example:
1\thook\tStart with a controversial statement\tall\t+15% completion\tNEW
2\tpacing\tKeep cuts under 3 seconds\ttiktok\t+20% retention\tCONTINUATION - still not implemented

Provide 5-8 prioritized recommendations.`;
}

/**
 * Parse enhanced recommendations response
 */
function parseRecommendationsResponseEnhanced(response) {
  const lines = response.trim().split('\n');
  const recommendations = [];

  lines.forEach(line => {
    if (line.toLowerCase().startsWith('priority\t')) return;

    const parts = line.split('\t');
    if (parts.length >= 5) {
      recommendations.push({
        priority: parseInt(parts[0].trim()) || 99,
        category: parts[1].trim(),
        recommendation: parts[2].trim(),
        platform: parts[3].trim(),
        expected_impact: parts[4].trim(),
        compared_to_previous: parts[5] ? parts[5].trim() : 'NEW'
      });
    }
  });

  recommendations.sort((a, b) => a.priority - b.priority);
  return recommendations;
}

/**
 * Write single video analysis to sheet
 */
function writeVideoAnalysis(analysis) {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.SHEETS.VIDEO_ANALYSIS);

  if (!sheet) {
    // Create sheet if it doesn't exist
    sheet = ss.insertSheet(CONFIG.SHEETS.VIDEO_ANALYSIS);
    const headers = [
      'video_uid', 'analyzed_at', 'youtube_performance', 'tiktok_performance',
      'instagram_performance', 'cross_platform_insights', 'kpi_achievement',
      'improvements_from_previous', 'prompt_effectiveness', 'recommendations'
    ];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length)
      .setBackground('#4285f4')
      .setFontColor('#ffffff')
      .setFontWeight('bold');
  }

  // Append analysis row
  const row = [
    analysis.video_uid,
    analysis.analyzed_at,
    analysis.youtube_performance,
    analysis.tiktok_performance,
    analysis.instagram_performance,
    analysis.cross_platform_insights,
    analysis.kpi_achievement,
    analysis.improvements_from_previous,
    analysis.prompt_effectiveness,
    analysis.recommendations
  ];

  sheet.appendRow(row);
  Logger.log(`Written video analysis for: ${analysis.video_uid}`);
}
