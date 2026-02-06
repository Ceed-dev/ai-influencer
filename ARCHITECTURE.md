# Video Analytics Hub - Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Human Workflow                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   [YouTube Studio]  [TikTok Analytics]  [IG Professional Dashboard] │
│         │                  │                      │                  │
│         ▼                  ▼                      ▼                  │
│   [Export CSV]       [Export CSV]          [Export CSV]             │
│         │                  │                      │                  │
│         └──────────────────┼──────────────────────┘                  │
│                            ▼                                         │
│                   [Upload to Google Drive]                           │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         n8n Workflow                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   [Google Drive Trigger] ──► [Read CSV] ──► [Call GAS Web App]      │
│                                                                      │
│                                   │                                  │
│                                   ▼                                  │
│                         [Receive Analysis]                           │
│                                   │                                  │
│                                   ▼                                  │
│                  [Feed to Video Creation Workflow]                   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Google Apps Script (GAS)                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐            │
│   │  Code.gs    │    │ CSVParser.gs│    │ Normalizer  │            │
│   │ (Endpoints) │───►│ (Parse CSV) │───►│ (Unify)     │            │
│   └─────────────┘    └─────────────┘    └─────────────┘            │
│                                               │                      │
│                                               ▼                      │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐            │
│   │ SheetWriter │◄───│ LLMAnalyzer │◄───│  Linker.gs  │            │
│   │ (Output)    │    │ (OpenAI)    │    │ (video_uid) │            │
│   └─────────────┘    └─────────────┘    └─────────────┘            │
│         │                  │                                         │
│         ▼                  ▼                                         │
│   [Google Sheets]   [OpenAI API]                                    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Data Model

### video_uid Concept

Each video has a unique identifier (`video_uid`) that links across platforms:

```
video_uid: "VID_2024_001"
├── youtube_id: "dQw4w9WgXcQ"
├── tiktok_id: "7123456789012345678"
└── instagram_id: "Cxyz123ABC"
```

### Metrics Flow

```
[Platform CSV] ─► [Raw Import] ─► [Normalized Metrics] ─► [Linked Metrics]
                       │                  │                     │
                       ▼                  ▼                     ▼
               raw_csv_row         unified schema        video_uid joined
```

## Component Details

### CSVParser.gs
- Auto-detects platform from CSV headers
- Handles column name variations (aliases)
- Preserves raw CSV row for debugging

### Normalizer.gs
- Converts platform-specific metrics to unified schema
- Handles missing fields gracefully
- Applies data type conversions

### Linker.gs
- Matches videos by title/timestamp/platform ID
- Handles fuzzy matching for title variations
- Routes unmatched imports to review queue

### KPIEngine.gs
- Compares metrics against targets
- Calculates performance deltas
- Ranks videos by improvement potential

### LLMAnalyzer.gs
- Constructs analysis prompts
- Parses TSV responses from OpenAI
- Handles rate limiting and retries

## Google Sheets Schema

### videos_master
| Column | Type | Description |
|--------|------|-------------|
| video_uid | String | Primary key |
| title | String | Video title |
| created_date | Date | Upload date |
| youtube_id | String | YouTube video ID |
| tiktok_id | String | TikTok video ID |
| instagram_id | String | Instagram Reel ID |
| scenario_id | String | Link to scenario_cuts |

### metrics_youtube
| Column | Type | Description |
|--------|------|-------------|
| video_uid | String | Foreign key |
| import_date | Date | Data import timestamp |
| views | Number | Total views |
| watch_time_hours | Number | Total watch time |
| avg_view_duration | Number | Average view duration (seconds) |
| completion_rate | Number | Completion rate (0-1) |
| ctr | Number | Click-through rate |
| likes | Number | Like count |
| comments | Number | Comment count |
| shares | Number | Share count |
| subscribers_gained | Number | New subscribers |

### metrics_tiktok
| Column | Type | Description |
|--------|------|-------------|
| video_uid | String | Foreign key |
| import_date | Date | Data import timestamp |
| views | Number | Total views |
| avg_watch_time | Number | Average watch time (seconds) |
| completion_rate | Number | Completion rate (0-1) |
| likes | Number | Like count |
| comments | Number | Comment count |
| shares | Number | Share count |
| saves | Number | Save count |
| engagement_rate | Number | Engagement rate |

### metrics_instagram
| Column | Type | Description |
|--------|------|-------------|
| video_uid | String | Foreign key |
| import_date | Date | Data import timestamp |
| views | Number | Total views (plays) |
| reach | Number | Unique accounts reached |
| avg_watch_time | Number | Average watch time (seconds) |
| likes | Number | Like count |
| comments | Number | Comment count |
| shares | Number | Share count |
| saves | Number | Save count |

## Error Handling

### Retry Strategy
```
Attempt 1: Immediate
Attempt 2: 1 second delay
Attempt 3: 2 seconds delay
Attempt 4: 4 seconds delay
Attempt 5: 8 seconds delay (max)
```

### GAS 6-Minute Timeout Handling
1. Save processing state to Properties Service
2. Create time-based trigger for continuation
3. Resume from saved state

## Security Considerations

- OpenAI API key stored in Script Properties (not in code)
- Spreadsheet access limited to service account
- Web App requires authentication
- No PII stored in analytics data
