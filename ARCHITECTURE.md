# Video Analytics Hub v2.0 - Architecture

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
│             [Upload to Google Drive CSV_Imports/]                    │
│                                                                      │
│   [Review AI Recommendations] ──► [Approve/Reject] ──► [n8n]       │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         n8n Workflow                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   [Drive Trigger] ──► [Read CSV] ──► [POST: import_csv]            │
│                                                                      │
│   [Schedule] ──► [GET: get_approved] ──► [GET: get_production]     │
│       │               │                        │                     │
│       │               ▼                        ▼                     │
│       │        [Read Component Data]    [Video Creation WF]         │
│       │                                        │                     │
│       └──► [POST: analyze_all] ──► [POST: update_scores]           │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Google Apps Script (GAS) v2.0                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐            │
│   │  Code.gs    │    │ CSVParser.gs│    │ Normalizer  │            │
│   │ (Endpoints) │───►│ (Parse CSV) │───►│ (Unify)     │            │
│   └─────────────┘    └─────────────┘    └─────────────┘            │
│         │                                      │                     │
│         │  ┌───────────────────────────────────┘                     │
│         │  ▼                                                         │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐            │
│   │ SheetWriter │◄───│ LLMAnalyzer │◄───│  Linker.gs  │            │
│   │ (Output)    │    │ (OpenAI)    │    │ (video_uid) │            │
│   └─────────────┘    └─────────────┘    └─────────────┘            │
│         │                  │                    │                     │
│         │            ┌─────┘                    │                     │
│         ▼            ▼                          ▼                    │
│   ┌──────────┐  ┌──────────┐  ┌───────────────────────┐            │
│   │Component │  │  Score   │  │   MasterManager.gs    │            │
│   │Manager.gs│  │Updater.gs│  │ (Production Workflow) │            │
│   └──────────┘  └──────────┘  └───────────────────────┘            │
│         │            │                    │                          │
│         ▼            ▼                    ▼                          │
│   [Inventory    [Master     [Google Sheets]   [OpenAI API]          │
│    Spreadsheets] Spreadsheet]                                       │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Data Model

### video_uid Concept

Each video production has a unique identifier (`video_uid`) that links across platforms and connects to all components:

```
video_uid: "VID_202602_0001"
├── youtube_id: "dQw4w9WgXcQ"
├── tiktok_id: "7123456789012345678"
├── instagram_id: "Cxyz123ABC"
├── hook_scenario_id: "SCN_H_0001" ──► Scenarios Inventory
├── hook_motion_id: "MOT_0001"    ──► Motions Inventory
├── hook_audio_id: "AUD_0001"     ──► Audio Inventory
├── body_scenario_id: "SCN_B_0001"
├── body_motion_id: "MOT_0002"
├── character_id: "CHR_0001"      ──► Characters Inventory
└── status: "draft" → "approved" → "in_production" → "published" → "analyzed"
```

### Component ID Prefixes

| Prefix | Type |
|--------|------|
| `SCN_H_` | Scenario - Hook |
| `SCN_B_` | Scenario - Body |
| `SCN_C_` | Scenario - CTA |
| `MOT_` | Motion |
| `CHR_` | Character |
| `AUD_` | Audio |
| `VID_` | Video UID |

### Metrics Flow

```
[Platform CSV] ─► [Raw Import] ─► [Normalized Metrics] ─► [Linked Metrics]
                       │                  │                     │
                       ▼                  ▼                     ▼
               raw_csv_row         unified schema        video_uid joined
                                                               │
                                                               ▼
                                                    [Master Snapshot Update]
                                                               │
                                                               ▼
                                                    [Component Score Update]
```

## Component Details

### Code.gs
- Web App endpoints (doGet/doPost)
- Routes 13 actions: import_csv, analyze, analyze_single, analyze_all, link_videos, create_production, approve_video, update_status, add_component, update_component, get_components, update_scores, get_status
- UI menu with submenus for Import, Analyze, Production, Components

### CSVParser.gs
- Auto-detects platform from CSV headers
- Handles column name variations (aliases) in EN/JP
- Preserves raw CSV row for debugging

### Normalizer.gs
- Converts platform-specific metrics to unified schema
- Handles missing fields gracefully
- Applies data type conversions

### Linker.gs
- Matches videos by title/timestamp/platform ID
- Handles fuzzy matching for title variations
- Routes unmatched imports to unlinked_imports sheet

### KPIEngine.gs
- Compares metrics against configurable targets
- Calculates performance deltas and scores
- Ranks videos by improvement potential
- Normalizes overall scores across platforms

### LLMAnalyzer.gs (v2.0 Enhanced)
- Constructs analysis prompts with **component context**
- Includes component performance history in prompts
- Generates component-specific recommendations
- Recommends specific components for next video
- Handles rate limiting and retries

### ComponentManager.gs (New in v2.0)
- CRUD operations on inventory spreadsheets
- Builds video component context for AI analysis
- Tracks component usage count
- Retrieves component performance history
- Builds recommendation pools from top-performing components

### MasterManager.gs (New in v2.0)
- Master sheet CRUD operations
- Production workflow: create → approve → update status
- Metrics snapshot updates
- AI recommendation writing

### ScoreUpdater.gs (New in v2.0)
- Calculates average performance score per component
- Normalizes overall scores across platforms
- Updates inventory spreadsheets with new scores
- Generates score summaries

### SheetWriter.gs
- Writes metrics to platform-specific sheets
- Writes analysis reports and recommendations
- Initializes all sheets with headers
- Writes to inventory spreadsheets

## Google Sheets Schema

### master (1 row = 1 video production)

| Group | Columns | Description |
|-------|---------|-------------|
| Identity | video_uid, title, status, created_date | Core identification |
| Hook | hook_scenario_id, hook_motion_id, hook_audio_id | Hook components |
| Body | body_scenario_id, body_motion_id, body_audio_id | Body components |
| CTA | cta_scenario_id, cta_motion_id, cta_audio_id | CTA components |
| Character | character_id | Character reference |
| Output | completed_video_url | Final video URL |
| Platforms | youtube_id, tiktok_id, instagram_id | Platform video IDs |
| YT Metrics | yt_views, yt_engagement, yt_completion | YouTube snapshot |
| TT Metrics | tt_views, tt_engagement, tt_completion | TikTok snapshot |
| IG Metrics | ig_views, ig_engagement, ig_reach | Instagram snapshot |
| Analysis | overall_score, analysis_date, top_recommendations | Analysis results |
| AI Next | ai_next_hook_scenario, ai_next_hook_motion, ... | AI-recommended components |
| Approval | human_approved, approval_notes | Human approval gate |

### Component Inventory (shared schema)

| Column | Description |
|--------|-------------|
| component_id | Unique ID (SCN_H_0001, MOT_0001, etc.) |
| type | hook/body/cta or voice/bgm |
| name | Component name |
| description | Description |
| file_link | Drive/Cloudinary URL |
| tags | Comma-separated tags |
| times_used | Auto-calculated usage count |
| avg_performance_score | Auto-calculated average score |
| created_date | Creation date |
| status | active/archived |

Scenarios Inventory has additional columns: `script_en`, `script_jp`

### metrics_youtube
| Column | Type | Description |
|--------|------|-------------|
| video_uid | String | Foreign key to master |
| import_date | Date | Data import timestamp |
| views | Number | Total views |
| likes | Number | Like count |
| comments | Number | Comment count |
| shares | Number | Share count |
| engagement_rate | Number | Engagement rate |
| watch_time_hours | Number | Total watch time |
| avg_watch_time_sec | Number | Average watch time (seconds) |
| completion_rate | Number | Completion rate (0-1) |
| ctr | Number | Click-through rate |
| subscribers_gained | Number | New subscribers |

### metrics_tiktok
| Column | Type | Description |
|--------|------|-------------|
| video_uid | String | Foreign key to master |
| import_date | Date | Data import timestamp |
| views | Number | Total views |
| likes | Number | Like count |
| comments | Number | Comment count |
| shares | Number | Share count |
| engagement_rate | Number | Engagement rate |
| saves | Number | Save count |
| avg_watch_time_sec | Number | Average watch time (seconds) |
| completion_rate | Number | Completion rate (0-1) |

### metrics_instagram
| Column | Type | Description |
|--------|------|-------------|
| video_uid | String | Foreign key to master |
| import_date | Date | Data import timestamp |
| views | Number | Total views (plays) |
| likes | Number | Like count |
| comments | Number | Comment count |
| shares | Number | Share count |
| engagement_rate | Number | Engagement rate |
| saves | Number | Save count |
| avg_watch_time_sec | Number | Average watch time (seconds) |
| reach | Number | Unique accounts reached |

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
- Inventory spreadsheet IDs stored in Script Properties
- Web App requires authentication
- No PII stored in analytics data
- GAS bound script has native Sheets access (no service account needed)
