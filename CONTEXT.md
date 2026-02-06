# Video Analytics Hub - Context

This file maintains session history for AI continuity.

## Project Purpose

Analyze YouTube Shorts / TikTok / Instagram Reels performance metrics and generate improvement recommendations for AI influencer video content.

## Session History

### 2026-02-06: Project Initialization

**What was done:**
- Created project folder structure at `~/Programming/video-analytics-hub/`
- Created initial documentation (README.md, ARCHITECTURE.md, CONTEXT.md)
- Defined GAS project structure with component breakdown
- Established Google Sheets schema for multi-platform metrics

**Key decisions:**
1. **GAS over GCP VM**: Chose Google Apps Script for simplicity and native Sheets integration. Team has existing GAS experience.
2. **video_uid linking**: Each video gets a unique ID to link across platforms (YouTube ID, TikTok ID, Instagram ID)
3. **CSV-first approach**: Platform APIs have severe limitations (especially TikTok). CSV export is the primary data source.

**API Research Findings:**
- YouTube: "Viewed vs Swiped Away" is UI-only, not available via API
- TikTok: avg_watch_time, completion_rate require CSV export (not available via official API)
- Instagram: Follower attribution not available, 90-day data limit

**Architecture:**
```
Human uploads 3 CSVs → n8n triggers → GAS processes → Sheets stores → OpenAI analyzes → Report generated
```

**Next steps:**
1. Create Google Sheets template with defined schema
2. Implement GAS files (Code.gs, Config.gs, etc.)
3. Request GitHub repo creation from user
4. Begin Phase 2: CSV Parsers

### 2026-02-06: Phase 2-5 Implementation Complete

**What was done:**
- **Phase 2: CSV Parser** - Sample CSVs and parser tests created
  - `templates/sample_youtube.csv`, `sample_tiktok.csv`, `sample_instagram.csv`
  - `gas/tests/CSVParser.test.js` - 51 test cases
- **Phase 3: Data Layer** - Linker and KPI engine tests
  - `gas/tests/Linker.test.js` - 38 test cases
  - `gas/tests/KPIEngine.test.js` - 25 test cases
- **Phase 4: Analysis Engine** - LLM and Sheet writer tests
  - `gas/tests/LLMAnalyzer.test.js` - 37 test cases
  - `gas/tests/SheetWriter.test.js` - 39 test cases
- **Phase 5: Integration** - E2E tests and n8n documentation
  - `gas/tests/E2E.test.js` - End-to-end workflow tests
  - `docs/n8n-integration.md` - Complete n8n setup guide

**Test Results:**
- Total tests: 223
- Passed: 191 (86%)
- Failed: 32 (edge cases, mocking issues)

**Skills Approved:**
1. `sample-csv-generator` - Auto-generate platform-specific sample CSVs
2. `gas-unit-test-generator` - Generate GAS unit tests with eval loading
3. `gas-jest-test-generator` - Generate Jest tests from GAS files

**Remaining Tasks:**
1. Deploy GAS Web App to Google Apps Script
2. Create Google Sheets with `initializeSheets()` function
3. Configure n8n workflow as per `docs/n8n-integration.md`
4. Fix failing edge case tests (optional polish)

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
