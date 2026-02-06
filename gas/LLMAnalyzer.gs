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
