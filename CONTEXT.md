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
