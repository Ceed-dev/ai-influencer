# n8n Integration Guide (v2.0)

This document describes how to integrate n8n workflows with the AI-Influencer GAS Web App.

## 1. Overview

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        n8n Server                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │   Trigger    │───►│  Read CSV    │───►│ HTTP Request │  │
│  │(Schedule/    │    │   (File/     │    │   (POST to   │  │
│  │ Drive Watch) │    │   Base64)    │    │   GAS App)   │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│                                                   │          │
│  ┌──────────────┐    ┌──────────────┐            │          │
│  │  Production  │◄───│ GET Approved │◄───────────┘          │
│  │  Workflow    │    │   Videos     │                        │
│  └──────────────┘    └──────────────┘                        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│               GAS Web App v2.0 (Google Apps Script)          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   doGet(e) ─► Route by action parameter:                     │
│     • (none)          ─► Health check + endpoint list        │
│     • get_status      ─► System status + counts              │
│     • get_approved    ─► Approved videos for production      │
│     • get_production  ─► Full production data for a video    │
│     • get_components  ─► List inventory components           │
│     • get_score_summary ─► Component scores                  │
│                                                              │
│   doPost(e) ─► Parse JSON ─► Route by action:                │
│     • import_csv       ─► CSV import pipeline                │
│     • analyze          ─► KPI + LLM analysis (batch)         │
│     • analyze_single   ─► Single video analysis              │
│     • analyze_all      ─► Full analysis (enhanced)           │
│     • link_videos      ─► Manual video linking               │
│     • create_production ─► New video production              │
│     • approve_video    ─► Approve for production             │
│     • update_status    ─► Update video status                │
│     • add_component    ─► Add to inventory                   │
│     • update_component ─► Update inventory item              │
│     • update_scores    ─► Recalculate component scores       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Google Sheets + Drive                    │
│  Master Spreadsheet: master, metrics_*, recommendations...   │
│  Inventory Spreadsheets: scenarios, motions, characters,     │
│                          audio (separate files)              │
└─────────────────────────────────────────────────────────────┘
```


## 2. GAS Web App Endpoint Specification

### Base URL

```
https://script.google.com/macros/s/{DEPLOYMENT_ID}/exec
```

### Common Response Format

Success:
```json
{
  "status": "success",
  "data": { ... },
  "timestamp": "2026-02-09T11:30:00.000Z"
}
```

Error:
```json
{
  "status": "error",
  "error": "Error message description",
  "timestamp": "2026-02-09T11:30:00.000Z"
}
```


### GET Actions

#### Health Check (no action)

```http
GET https://script.google.com/macros/s/{DEPLOYMENT_ID}/exec
```

Response:
```json
{
  "status": "ok",
  "version": "2.0.0",
  "endpoints": ["GET: get_status, get_approved, ...", "POST: import_csv, analyze, ..."],
  "timestamp": "..."
}
```

#### get_status

```http
GET ...?action=get_status
```

Response:
```json
{
  "version": "2.0.0",
  "record_counts": {
    "MASTER": 150,
    "METRICS_YOUTUBE": 500,
    "METRICS_TIKTOK": 300,
    "METRICS_INSTAGRAM": 200,
    "RECOMMENDATIONS": 45
  },
  "video_statuses": {
    "draft": 3,
    "approved": 2,
    "in_production": 1,
    "published": 12,
    "analyzed": 8
  },
  "last_updated": "2026-02-09T21:00:00+09:00"
}
```

#### get_approved

```http
GET ...?action=get_approved
```

Response:
```json
{
  "count": 2,
  "videos": [
    { "video_uid": "VID_202602_0001", "title": "Morning Routine", "status": "approved", "human_approved": true }
  ]
}
```

#### get_production

```http
GET ...?action=get_production&video_uid=VID_202602_0001
```

Returns full production data including all component IDs, platform IDs, and metadata.

#### get_components

```http
GET ...?action=get_components&inventory_type=scenarios&type=hook&status=active
```

Response:
```json
{
  "inventory_type": "scenarios",
  "count": 5,
  "components": [
    { "component_id": "SCN_H_0001", "type": "hook", "name": "Shocking question", "avg_performance_score": 85, "status": "active" }
  ]
}
```


### POST Actions

#### import_csv

```json
{
  "action": "import_csv",
  "platform": "youtube",
  "csv_data": "QmFzZTY0IGVuY29kZWQgQ1NW..."
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| action | string | Yes | `"import_csv"` |
| platform | string | Yes | `"youtube"`, `"tiktok"`, or `"instagram"` |
| csv_data | string | Yes | Base64-encoded CSV content |

Response:
```json
{ "platform": "youtube", "total_rows": 50, "linked": 45, "unlinked": 5 }
```

#### analyze

```json
{
  "action": "analyze",
  "video_uids": ["VID_202602_0001", "VID_202602_0002"]
}
```

Runs enhanced analysis with component context. Updates scores automatically.

#### analyze_single

```json
{
  "action": "analyze_single",
  "video_uid": "VID_202602_0001"
}
```

#### analyze_all

```json
{ "action": "analyze_all" }
```

Analyzes all videos with enhanced component-aware prompts. Updates all component scores.

#### create_production

```json
{
  "action": "create_production",
  "title": "Morning Routine with AI Mika",
  "hook_scenario_id": "SCN_H_0001",
  "hook_motion_id": "MOT_0001",
  "body_scenario_id": "SCN_B_0003",
  "character_id": "CHR_0001"
}
```

Creates a new video production in master sheet with status "draft".

#### approve_video

```json
{
  "action": "approve_video",
  "video_uid": "VID_202602_0001",
  "notes": "Looks good, proceed with production"
}
```

#### update_status

```json
{
  "action": "update_status",
  "video_uid": "VID_202602_0001",
  "status": "in_production"
}
```

Valid statuses: `draft`, `approved`, `in_production`, `published`, `analyzed`

#### add_component

```json
{
  "action": "add_component",
  "inventory_type": "scenarios",
  "type": "hook",
  "name": "Shocking Question Opener",
  "description": "Opens with a provocative question",
  "script_en": "Why are you still wasting your mornings?",
  "script_jp": "まだ朝の時間を無駄にしてるの？"
}
```

#### update_component

```json
{
  "action": "update_component",
  "component_id": "SCN_H_0001",
  "description": "Updated description",
  "tags": "provocative,question,morning"
}
```

#### update_scores

```json
{ "action": "update_scores" }
```

Or for a specific video:
```json
{ "action": "update_scores", "video_uid": "VID_202602_0001" }
```

#### link_videos

```json
{
  "action": "link_videos",
  "links": [
    { "video_uid": "VID_202602_0001", "platform_id": "dQw4w9WgXcQ", "platform": "youtube" }
  ]
}
```


## 3. n8n Workflow Examples

### 3.1 CSV Auto-Import Workflow

```
[Google Drive Trigger] ──► [Read File] ──► [Code: Base64] ──► [POST: import_csv]
     (CSV_Imports/)                                                    │
                                                                       ▼
                                                               [POST: analyze_all]
                                                                       │
                                                                       ▼
                                                               [POST: update_scores]
```

**Platform Detection Logic**:
```javascript
const filename = $json.name.toLowerCase();
if (filename.includes('youtube') || filename.includes('yt_')) return 'youtube';
if (filename.includes('tiktok') || filename.includes('tt_')) return 'tiktok';
if (filename.includes('instagram') || filename.includes('ig_')) return 'instagram';
```

### 3.2 Production Workflow (v2.0)

```
[Schedule: Daily] ──► [GET: get_approved] ──► [For Each Video]
                                                      │
                                                      ▼
                                              [GET: get_production]
                                                      │
                                                      ▼
                                              [GET: get_components]
                                                      │
                                                      ▼
                                              [Video Creation API]
                                                      │
                                                      ▼
                                              [POST: update_status]
                                              (status: in_production)
                                                      │
                                                      ▼
                                              [Upload to Platforms]
                                                      │
                                                      ▼
                                              [POST: update_status]
                                              (status: published)
```

This is the key v2.0 workflow. n8n:
1. Gets approved videos from master sheet
2. For each video, fetches full production data (component IDs)
3. Fetches component details from inventories (scripts, motions, characters)
4. Calls video creation API with component data
5. Updates video status through the lifecycle

### 3.3 Weekly Analysis + Score Update Workflow

```
[Schedule: Monday 9AM] ──► [POST: analyze_all] ──► [POST: update_scores]
                                                          │
                                                          ▼
                                                  [GET: get_score_summary]
                                                          │
                                                          ▼
                                                  [Format Report Email]
                                                          │
                                                          ▼
                                                  [Send Email]
```


## 4. Error Handling

### HTTP Request Node Settings

```yaml
Method: POST (or GET)
URL: https://script.google.com/macros/s/{DEPLOYMENT_ID}/exec
Authentication: None
Continue On Fail: true
Retry On Fail: true
Max Tries: 3
Wait Between Tries: 5000  # 5 seconds
```

### Error Branch Logic

```javascript
if ($json.status === 'error') {
  console.log('GAS Error:', $json.error);
  return { json: { error: $json.error, timestamp: new Date() } };
}
```


## 5. Troubleshooting

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `Missing required fields: platform, csv_data` | Incomplete payload | Include both fields |
| `Unknown action: xxx` | Invalid action | Check endpoint list above |
| `Missing video_uid` | video_uid not provided | Include video_uid in payload |
| `Missing inventory_type` | Inventory type not specified | Use: scenarios, motions, characters, audio |
| `Video not found: VID_...` | Invalid video_uid | Check master sheet |
| `Inventory sheet not found` | Setup not run | Run setupCompleteSystem() |
| `Timeout (exceeded 6 minutes)` | Too much data | Split into smaller batches |

### Testing Endpoints

```bash
# Health check
curl 'https://script.google.com/macros/s/{DEPLOYMENT_ID}/exec'

# Get status
curl 'https://script.google.com/macros/s/{DEPLOYMENT_ID}/exec?action=get_status'

# Get approved videos
curl 'https://script.google.com/macros/s/{DEPLOYMENT_ID}/exec?action=get_approved'

# Import CSV
curl -X POST \
  'https://script.google.com/macros/s/{DEPLOYMENT_ID}/exec' \
  -H 'Content-Type: application/json' \
  -d '{"action": "import_csv", "platform": "youtube", "csv_data": "..."}'
```

### Rate Limits

- GAS Web App: 20,000 requests/day
- Execution time: 6 minutes max per execution
- URL Fetch: 20,000 calls/day


## Appendix: Quick Reference

### GET Endpoints

| Action | Parameters | Description |
|--------|-----------|-------------|
| (none) | - | Health check |
| get_status | - | System status |
| get_approved | - | Approved videos |
| get_production | video_uid | Production data |
| get_components | inventory_type, type?, status? | Component list |
| get_score_summary | - | Score summary |

### POST Endpoints

| Action | Key Fields | Description |
|--------|-----------|-------------|
| import_csv | platform, csv_data | Import CSV |
| analyze | video_uids[] | Analyze videos |
| analyze_single | video_uid | Analyze one video |
| analyze_all | - | Analyze all videos |
| link_videos | links[] | Link platform IDs |
| create_production | title, component IDs | Create production |
| approve_video | video_uid, notes? | Approve video |
| update_status | video_uid, status | Update status |
| add_component | inventory_type, type, name | Add component |
| update_component | component_id, ...updates | Update component |
| update_scores | video_uid? | Update scores |
