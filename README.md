# Video Analytics Hub

AI Influencer Video Performance Analytics System for YouTube Shorts / TikTok / Instagram Reels.

## Overview

This system analyzes video performance metrics across platforms and generates improvement recommendations for future content creation.

## Architecture

```
[CSV Upload] → [n8n Trigger] → [GAS Web App]
                                     │
                 ┌───────────────────┘
                 ▼
         [CSV Parser] → [Normalizer] → [video_uid Linker]
                                            │
                 ┌──────────────────────────┘
                 ▼
         [KPI Comparison] → [OpenAI Analysis] → [Report Sheets]
                                                      │
                 ┌────────────────────────────────────┘
                 ▼
         [n8n: Feed to Video Creation WF]
```

## Tech Stack

- **Backend**: Google Apps Script (GAS)
- **Database**: Google Sheets
- **Workflow**: n8n
- **AI Analysis**: OpenAI API

## Platform API Limitations

### YouTube
- CSV Export: 500 rows limit, 24-48h delay
- Analytics API: Retention curve available (elapsedVideoTimeRatio)
- GAP: "Viewed vs Swiped Away" is UI-only, not available via API

### TikTok
- CSV Export: All metrics available (watch time, completion rate), 60-day limit
- Official API: view/like/comment/share ONLY
- GAP: avg_watch_time, completion_rate require CSV (not API)

### Instagram Reels
- Graph API: views, reach, avg_watch_time available
- CSV Export: Available from Professional Dashboard
- GAP: Follower attribution unavailable, 90-day limit

## Google Sheets Structure

| Sheet Name | Purpose |
|------------|---------|
| `videos_master` | Master list of all videos (video_uid, platform IDs) |
| `metrics_youtube` | YouTube-specific metrics |
| `metrics_tiktok` | TikTok-specific metrics |
| `metrics_instagram` | Instagram-specific metrics |
| `kpi_targets` | KPI target values |
| `scenario_cuts` | Per-cut scenario information |
| `analysis_reports` | Analysis results |
| `recommendations` | Improvement recommendations |
| `unlinked_imports` | Imports pending video_uid linking |

## GAS Project Structure

```
gas/
├── Code.gs           # Web App endpoints
├── Config.gs         # Settings & constants
├── CSVParser.gs      # Platform-specific parsers
├── Normalizer.gs     # Unified schema conversion
├── Linker.gs         # video_uid matching
├── KPIEngine.gs      # KPI comparison
├── LLMAnalyzer.gs    # OpenAI integration
├── SheetWriter.gs    # Sheets write operations
└── Utils.gs          # Utilities
```

## Setup

### 1. Create Google Sheets
1. Create a new Google Sheets document
2. Create sheets as defined in the structure above
3. Note the Spreadsheet ID from the URL

### 2. Deploy GAS Web App
1. Create new Apps Script project
2. Copy all `.gs` files from `gas/` directory
3. Update `Config.gs` with your Spreadsheet ID and OpenAI API key
4. Deploy as Web App (Execute as: Me, Access: Anyone with link)

### 3. Configure n8n
1. Create workflow triggered by Google Drive file upload
2. Configure webhook to call GAS Web App
3. Pass CSV content in request body

## Configuration

Edit `gas/Config.gs`:

```javascript
const CONFIG = {
  SPREADSHEET_ID: 'your-spreadsheet-id',
  OPENAI_API_KEY: 'your-openai-api-key',
  KPI_TARGETS: {
    youtube: { completion_rate: 0.5, ctr: 0.05 },
    tiktok: { completion_rate: 0.4, engagement_rate: 0.08 },
    instagram: { reach_rate: 0.3, avg_watch_time: 15 }
  }
};
```

## Usage

### Manual CSV Upload
1. Export CSV from each platform's analytics dashboard
2. Upload to designated Google Drive folder
3. n8n workflow processes automatically

### API Call (from n8n)
```
POST https://script.google.com/macros/s/{DEPLOYMENT_ID}/exec
Content-Type: application/json

{
  "platform": "youtube|tiktok|instagram",
  "csv_data": "base64-encoded-csv"
}
```

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| CSV format changes | Column name aliases, raw_csv_row preservation |
| GAS 6-min timeout | State persistence + continuation triggers |
| OpenAI rate limits | Batch processing + exponential backoff |
| Platform data limits | Daily snapshot archival |

## License

Private - Internal Use Only
