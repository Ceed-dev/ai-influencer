# Video Analytics Hub v2.0

AI Influencer Video Performance Analytics System for YouTube Shorts / TikTok / Instagram Reels.

## Overview

This system manages the complete video production lifecycle: **Component Management → Video Production → Publishing → Analytics → AI Improvement Loop**. It analyzes video performance metrics across platforms and generates component-specific improvement recommendations for future content creation.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                       Production Loop                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. PLAN: Select components from inventories → draft             │
│  2. APPROVE: Human reviews AI recommendations → approved         │
│  3. CREATE: n8n reads master + inventories → in_production       │
│  4. PUBLISH: Upload to 3 platforms → published                   │
│  5. IMPORT: CSV export → Google Drive → GAS auto-process         │
│  6. ANALYZE: KPI + OpenAI (with component context) → analyzed    │
│  7. SCORE: Update component performance scores                   │
│  8. SUGGEST: AI recommends components for next video             │
│        └──────────► Loop back to Step 1                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Tech Stack

- **Backend**: Google Apps Script (GAS) - Bound to Master Spreadsheet
- **Database**: Google Sheets (Master) + Separate Inventory Spreadsheets
- **Storage**: Google Drive (folder structure for components)
- **Workflow**: n8n
- **AI Analysis**: OpenAI API (GPT-4o)

## Google Drive Structure

```
AI-Influencer/ (root)
├── 📊 Master Spreadsheet ← GAS Bound Script
│     ├── [tab] master              ← 1 row = 1 video production
│     ├── [tab] metrics_youtube
│     ├── [tab] metrics_tiktok
│     ├── [tab] metrics_instagram
│     ├── [tab] kpi_targets
│     ├── [tab] analysis_reports
│     ├── [tab] recommendations
│     ├── [tab] video_analysis
│     └── [tab] unlinked_imports
│
├── 📁 Scenarios/
│   ├── 📊 Scenarios Inventory (separate spreadsheet)
│   ├── 📁 Hooks/
│   ├── 📁 Bodies/
│   └── 📁 CTAs/
│
├── 📁 Motions/
│   ├── 📊 Motions Inventory (separate spreadsheet)
│   ├── 📁 Hooks/ Bodies/ CTAs/
│
├── 📁 Characters/
│   ├── 📊 Characters Inventory (separate spreadsheet)
│   └── 📁 Images/
│
├── 📁 Audio/
│   ├── 📊 Audio Inventory (separate spreadsheet)
│   ├── 📁 Voice/
│   └── 📁 BGM/
│
└── 📁 Analytics/
    └── 📁 CSV_Imports/
        ├── 📁 YouTube/
        ├── 📁 TikTok/
        └── 📁 Instagram/
```

## GAS Project Structure

```
gas/
├── Code.gs              # Web App endpoints + UI menu
├── Config.gs            # Settings, schema, constants
├── Setup.gs             # One-click system setup (Drive + Sheets)
├── Migration.gs         # v1 → v2 migration
├── CSVParser.gs         # Platform-specific CSV parsers
├── Normalizer.gs        # Unified schema conversion
├── Linker.gs            # video_uid matching
├── KPIEngine.gs         # KPI comparison
├── LLMAnalyzer.gs       # OpenAI integration (component-aware)
├── SheetWriter.gs       # Sheet write operations
├── ComponentManager.gs  # Component CRUD + context building
├── MasterManager.gs     # Master sheet + production workflow
├── ScoreUpdater.gs      # Component performance scoring
└── Utils.gs             # ID generators, helpers
```

## Setup

### 1. One-Click Setup
1. Create a new Google Sheets document
2. Extensions → Apps Script
3. Copy all `.gs` files from `gas/` directory
4. Set Script Properties:
   - `OPENAI_API_KEY`: Your OpenAI API key
   - `SPREADSHEET_ID`: The spreadsheet ID from the URL
5. Run `setupCompleteSystem()` from the menu or script editor
   - Creates all Drive folders
   - Creates all inventory spreadsheets
   - Initializes all sheets with headers
   - Inserts demo data

### 2. Deploy as Web App
1. Deploy → New deployment → Web App
2. Execute as: Me
3. Access: Anyone with link
4. Note the deployment URL for n8n

### 3. Configure n8n
See [n8n Integration Guide](docs/n8n-integration.md) for workflow setup.

## API Endpoints

### GET (Read-only)
| Action | Description |
|--------|-------------|
| (none) | Health check + endpoint list |
| `get_status` | System status + record counts |
| `get_approved` | Approved videos ready for production |
| `get_production` | Production data for a video |
| `get_components` | List components by inventory type |
| `get_score_summary` | Component score summary |

### POST (Write operations)
| Action | Description |
|--------|-------------|
| `import_csv` | Import analytics CSV |
| `analyze` | Analyze specific videos |
| `analyze_single` | Analyze one video |
| `analyze_all` | Analyze all videos (enhanced) |
| `link_videos` | Manually link platform IDs |
| `create_production` | Create new video production |
| `approve_video` | Approve video for production |
| `update_status` | Update video status |
| `add_component` | Add new component to inventory |
| `update_component` | Update existing component |
| `update_scores` | Recalculate component scores |

## Testing

```bash
npm install
npm test
```

**Test coverage**: 330 tests across 9 test suites covering all modules.

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| CSV format changes | Column name aliases, raw_csv_row preservation |
| GAS 6-min timeout | State persistence + continuation triggers |
| OpenAI rate limits | Batch processing + exponential backoff |
| Platform data limits | Daily snapshot archival, metrics history in Sheets |
| Component data loss | Separate inventory spreadsheets, Drive backup |

## License

Private - Internal Use Only
