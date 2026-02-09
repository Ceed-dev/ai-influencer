# Video Analytics Hub - Context

This file maintains session history for AI continuity.

## Project Purpose

Manage the complete AI influencer video production lifecycle: component management, video production planning, multi-platform analytics (YouTube Shorts / TikTok / Instagram Reels), and AI-driven improvement recommendations.

## Session History

### 2026-02-06: Project Initialization (v1.0)

**What was done:**
- Created project folder structure
- Created initial documentation (README.md, ARCHITECTURE.md, CONTEXT.md)
- Defined GAS project structure with component breakdown
- Established Google Sheets schema for multi-platform metrics

**Key decisions:**
1. **GAS over GCP VM**: Chose Google Apps Script for simplicity and native Sheets integration
2. **video_uid linking**: Each video gets a unique ID to link across platforms
3. **CSV-first approach**: Platform APIs have severe limitations. CSV export is the primary data source

### 2026-02-06: Phase 2-5 Implementation (v1.0)

**What was done:**
- CSV parsers, normalizers, linkers, KPI engine, LLM analyzer, sheet writer
- 223 tests across 6 test suites
- n8n integration documentation
- Sample CSV files

### 2026-02-09: Complete v2.0 Rebuild

**What was done:**
- **Phase 1: Foundation**
  - `Config.gs` - Complete rewrite with Drive structure, master columns, component types, ID prefixes
  - `Utils.gs` - Added readSheetAsObjects, findRowByColumn, ID generators (generateVideoUid, generateComponentId, etc.)
  - `Setup.gs` - One-click system setup: creates Drive folders, inventory spreadsheets, all sheets, demo data
  - `Migration.gs` - v1 → v2 migration (renames sheets, adds new columns, creates inventory spreadsheets)

- **Phase 2: Data Layer**
  - `ComponentManager.gs` (NEW) - Component CRUD, context building, usage tracking, performance history, recommendation pools
  - `MasterManager.gs` (NEW) - Master sheet operations, production workflow, approval, status management
  - `ScoreUpdater.gs` (NEW) - Component score calculation, normalization, inventory updates

- **Phase 3: Analysis Extension**
  - `LLMAnalyzer.gs` - Rewritten with component-aware prompts, includes component history and top performers in AI context
  - `Linker.gs` - Updated for v2.0 master sheet references
  - `KPIEngine.gs` - Added normalizeOverallScore
  - `SheetWriter.gs` - Added inventory writing, video analysis sheet, enhanced recommendations

- **Phase 4: Integration**
  - `Code.gs` - Complete rewrite with 13 API actions, UI menu with Production/Components submenus

- **Phase 5: Testing**
  - 3 new test files: ComponentManager.test.js, MasterManager.test.js, ScoreUpdater.test.js
  - Updated all existing tests for v2.0 (master sheet references, removed scenario_cuts)
  - Updated setup.js with all v2.0 utility mocks
  - **330 tests passing across 9 test suites**

- **Phase 6: Documentation**
  - Updated all documentation for v2.0

**Key v2.0 decisions:**
1. **Separate inventory spreadsheets**: Each component type (scenarios, motions, characters, audio) has its own spreadsheet, accessed via `SpreadsheetApp.openById()`
2. **Component ID system**: Prefix-based (SCN_H_, MOT_, CHR_, AUD_) for type identification
3. **Production workflow**: draft → approved → in_production → published → analyzed, with human approval gate
4. **Component-aware AI analysis**: AI receives full component context (history, scores, top performers) when analyzing

---

## Technical Notes

### Platform CSV Column Variations

YouTube may change column names between exports. Known variations:
- "Views" / "視聴回数" / "View count"
- "Watch time (hours)" / "総再生時間（時間）"

TikTok variations:
- "Video views" / "Views"
- "Average watch time" / "Avg. watch time"

Instagram variations:
- "Plays" / "Views"
- "Reach" / "Accounts reached"

### GAS Limitations to Remember
- 6-minute execution timeout
- 20MB response size limit
- 100 triggers per user limit
- Properties Service: 500KB total, 9KB per property

### OpenAI Integration Notes
- Use TSV output format for structured responses (more reliable parsing than JSON)
- Batch multiple videos per request to reduce API calls
- Implement exponential backoff for rate limiting
- v2.0: Include component context for better recommendations

### v2.0 Component Score System
- Each analyzed video's overall_score contributes to its components' avg_performance_score
- Scores normalized 0-100 across platforms
- Top-performing components surfaced in AI recommendation prompts
- Score updates cascade: video analyzed → master updated → all linked components updated
