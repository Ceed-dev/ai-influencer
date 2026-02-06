# n8n Integration Guide

This document describes how to integrate n8n workflows with the Video Analytics Hub GAS Web App.

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
│                                                   ▼          │
│                                          ┌──────────────┐   │
│                                          │   Response   │   │
│                                          │   Handler    │   │
│                                          └──────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   GAS Web App (Google Apps Script)           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   doPost(e) ─► Parse JSON ─► Route by action:               │
│                                                              │
│     • import_csv  ─► CSVParser ─► Normalizer ─► Sheets      │
│     • analyze     ─► KPIEngine ─► LLMAnalyzer ─► Reports    │
│     • link_videos ─► Linker ─► Update Mappings              │
│     • get_status  ─► Return current stats                   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Google Sheets                           │
│  (videos_master, metrics_youtube, metrics_tiktok, etc.)     │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Trigger**: n8n workflow starts (scheduled or Drive file detected)
2. **CSV Processing**: Read CSV file and encode as Base64
3. **API Call**: POST to GAS Web App with encoded CSV
4. **Processing**: GAS parses, normalizes, and links data
5. **Storage**: Metrics stored in Google Sheets
6. **Response**: Success/error status returned to n8n

---

## 2. GAS Web App Endpoint Specification

### Base URL

```
https://script.google.com/macros/s/{DEPLOYMENT_ID}/exec
```

Replace `{DEPLOYMENT_ID}` with your actual Web App deployment ID.

### doGet(e) - Health Check Endpoint

**Purpose**: Verify the Web App is running and accessible.

**Request**:
```http
GET https://script.google.com/macros/s/{DEPLOYMENT_ID}/exec
```

**Response**:
```json
{
  "status": "ok",
  "version": "1.0.0",
  "timestamp": "2026-02-06T11:30:00.000Z"
}
```

### doPost(e) - Main Processing Endpoint

**Purpose**: Handle all data operations (CSV import, analysis, linking).

**Request Headers**:
```http
Content-Type: application/json
```

**Common Response Format**:

Success:
```json
{
  "status": "success",
  "data": { ... },
  "timestamp": "2026-02-06T11:30:00.000Z"
}
```

Error:
```json
{
  "status": "error",
  "error": "Error message description",
  "timestamp": "2026-02-06T11:30:00.000Z"
}
```

---

### Action: `import_csv`

Import analytics CSV data from a platform.

**Request Payload**:
```json
{
  "action": "import_csv",
  "platform": "youtube",
  "csv_data": "QmFzZTY0IGVuY29kZWQgQ1NW..."
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| action | string | Yes | Must be `"import_csv"` |
| platform | string | Yes | One of: `"youtube"`, `"tiktok"`, `"instagram"` |
| csv_data | string | Yes | Base64-encoded CSV content |

**Response Data**:
```json
{
  "platform": "youtube",
  "total_rows": 50,
  "linked": 45,
  "unlinked": 5
}
```

---

### Action: `analyze`

Run analysis on specified videos.

**Request Payload**:
```json
{
  "action": "analyze",
  "video_uids": ["VID_2024_001", "VID_2024_002", "VID_2024_003"]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| action | string | Yes | Must be `"analyze"` |
| video_uids | string[] | Yes | Array of video UIDs to analyze |

**Response Data**:
```json
{
  "analyzed_count": 3,
  "report_id": "RPT_20260206_001"
}
```

---

### Action: `link_videos`

Manually link platform IDs to video_uid.

**Request Payload**:
```json
{
  "action": "link_videos",
  "links": [
    {
      "video_uid": "VID_2024_001",
      "platform_id": "dQw4w9WgXcQ",
      "platform": "youtube"
    },
    {
      "video_uid": "VID_2024_002",
      "platform_id": "7123456789012345678",
      "platform": "tiktok"
    }
  ]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| action | string | Yes | Must be `"link_videos"` |
| links | object[] | Yes | Array of link mappings |
| links[].video_uid | string | Yes | Internal video identifier |
| links[].platform_id | string | Yes | Platform-specific video ID |
| links[].platform | string | Yes | Platform name |

**Response Data**:
```json
{
  "processed": 2,
  "successful": 2,
  "failed": 0,
  "details": [
    { "video_uid": "VID_2024_001", "platform_id": "dQw4w9WgXcQ", "platform": "youtube", "status": "success" },
    { "video_uid": "VID_2024_002", "platform_id": "7123456789012345678", "platform": "tiktok", "status": "success" }
  ]
}
```

---

### Action: `get_status`

Get current system status and record counts.

**Request Payload**:
```json
{
  "action": "get_status"
}
```

**Response Data**:
```json
{
  "spreadsheet_id": "1abc...",
  "record_counts": {
    "VIDEOS_MASTER": 150,
    "METRICS_YOUTUBE": 500,
    "METRICS_TIKTOK": 300,
    "METRICS_INSTAGRAM": 200
  },
  "pending_links": 12,
  "last_updated": "2026-02-06T11:30:00.000Z"
}
```

---

## 3. n8n Workflow Configuration

### HTTP Request Node Settings

**Basic Configuration**:
```yaml
Method: POST
URL: https://script.google.com/macros/s/{DEPLOYMENT_ID}/exec
Authentication: None  # Web App handles its own auth
```

**Headers**:
```yaml
Content-Type: application/json
```

**Body (JSON)**:
```json
{
  "action": "import_csv",
  "platform": "{{ $json.platform }}",
  "csv_data": "{{ $json.csv_base64 }}"
}
```

### CSV File Processing

Before sending CSV to GAS, convert file to Base64:

**Using Code Node**:
```javascript
// Read CSV file and encode to Base64
const csvContent = $input.first().binary.data;
const base64Data = csvContent.toString('base64');

return {
  json: {
    csv_base64: base64Data,
    platform: 'youtube'  // or detect from filename
  }
};
```

**Using Read Binary File + Move Binary Data**:
1. **Read Binary File**: Read CSV from path
2. **Move Binary Data**: Convert binary to Base64 string

### Error Handling Configuration

**Recommended Settings**:
```yaml
Continue On Fail: true
Retry On Fail: true
Max Tries: 3
Wait Between Tries: 5000  # 5 seconds
```

**Error Branch Logic**:
```javascript
// Check response status
if ($json.status === 'error') {
  // Log error and potentially notify
  console.log('GAS Error:', $json.error);

  // Optionally send to error notification workflow
  return { json: { error: $json.error, timestamp: new Date() } };
}
```

### Schedule Trigger Configuration

**Daily Import Example**:
```yaml
Trigger: Schedule
Mode: Every Day
Hour: 6
Minute: 0
Timezone: Asia/Tokyo
```

**Weekly Batch Analysis**:
```yaml
Trigger: Schedule
Mode: Every Week
Weekday: Monday
Hour: 9
Minute: 0
```

---

## 4. Sample Workflows

### 4.1 YouTube CSV Auto-Import Workflow

**Description**: Automatically import YouTube analytics CSV when uploaded to Google Drive.

```
[Google Drive Trigger] ──► [Read File] ──► [Code: Base64 Encode] ──► [HTTP Request: import_csv]
        │                                                                      │
        │                                                                      ▼
        │                                                              [IF: Success?]
        │                                                              /           \
        │                                                           Yes            No
        │                                                            │              │
        └────────────────────────────────────────────────────────────▼              ▼
                                                              [Move File to   [Send Error
                                                               Processed]      Notification]
```

**Node Details**:

1. **Google Drive Trigger**
   - Watch Folder: `/Analytics/YouTube/Inbox`
   - Event: File Created

2. **Read File**
   - File ID: `{{ $json.id }}`
   - Binary Property: `data`

3. **Code: Base64 Encode**
   ```javascript
   const binary = $input.first().binary.data;
   return {
     json: {
       csv_base64: binary.toString('base64'),
       platform: 'youtube',
       filename: $input.first().json.name
     }
   };
   ```

4. **HTTP Request: import_csv**
   - Method: POST
   - URL: `{GAS_WEB_APP_URL}`
   - Body:
     ```json
     {
       "action": "import_csv",
       "platform": "{{ $json.platform }}",
       "csv_data": "{{ $json.csv_base64 }}"
     }
     ```

---

### 4.2 All-Platform Batch Processing Workflow

**Description**: Process CSVs from all platforms in a single workflow.

```
[Schedule Trigger] ──► [Google Drive: List Files] ──► [Split In Batches]
                                                             │
                              ┌───────────────────────────────┤
                              │                               │
                              ▼                               ▼
                     [IF: YouTube?]                   [IF: TikTok?]
                              │                               │
                              ▼                               ▼
                     [Process YouTube]               [Process TikTok]
                              │                               │
                              └───────────┬───────────────────┘
                                          ▼
                                  [Aggregate Results]
                                          │
                                          ▼
                                  [HTTP Request: get_status]
                                          │
                                          ▼
                                  [Send Summary Report]
```

**Platform Detection Logic**:
```javascript
const filename = $json.name.toLowerCase();

if (filename.includes('youtube') || filename.includes('yt_')) {
  return { json: { platform: 'youtube', ...inputData } };
} else if (filename.includes('tiktok') || filename.includes('tt_')) {
  return { json: { platform: 'tiktok', ...inputData } };
} else if (filename.includes('instagram') || filename.includes('ig_')) {
  return { json: { platform: 'instagram', ...inputData } };
}
```

---

### 4.3 Weekly Report Generation Workflow

**Description**: Generate weekly analysis report for top-performing videos.

```
[Schedule: Monday 9AM] ──► [HTTP Request: get_status] ──► [Code: Get Top Videos]
                                                                    │
                                                                    ▼
                                                          [HTTP Request: analyze]
                                                                    │
                                                                    ▼
                                                          [Wait: 30 seconds]
                                                                    │
                                                                    ▼
                                                          [Google Sheets: Read Report]
                                                                    │
                                                                    ▼
                                                          [Format Report Email]
                                                                    │
                                                                    ▼
                                                          [Send Email]
```

**Get Top Videos Code**:
```javascript
// Get video UIDs from the past week's imports
// This example assumes you have a way to retrieve recent video_uids
const recentVideoUids = [
  'VID_2024_001',
  'VID_2024_002',
  'VID_2024_003'
];

return {
  json: {
    action: 'analyze',
    video_uids: recentVideoUids.slice(0, 10)  // Limit to 10 videos
  }
};
```

---

## 5. Troubleshooting

### Common Errors and Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| `Missing required fields: platform, csv_data` | Incomplete request payload | Verify both `platform` and `csv_data` are included |
| `Unknown action: xxx` | Invalid action name | Use one of: `import_csv`, `analyze`, `link_videos`, `get_status` |
| `Missing or invalid video_uids array` | video_uids not an array | Ensure `video_uids` is a valid JSON array |
| `Script function not found: doPost` | Deployment issue | Redeploy Web App with latest code |
| `Authorization required` | Web App permissions | Set Web App to "Anyone" or configure OAuth |
| `Timeout (exceeded 6 minutes)` | Large CSV or many videos | Split into smaller batches |

### GAS Execution Logs

**How to Check Logs**:

1. Open Google Apps Script project
2. Click **Executions** in left sidebar
3. View recent executions and their logs
4. Click on specific execution for detailed logs

**Programmatic Log Access**:
```javascript
// In GAS code, logs are written via Logger.log()
Logger.log('Processing started for platform: ' + platform);

// View in Executions panel or use console.log for Cloud Logging
console.log('Detailed debug info:', JSON.stringify(data));
```

### n8n Debug Tips

1. **Enable Debug Mode**: Add `{{ JSON.stringify($json) }}` to see full data
2. **Check Response**: Use "Set" node to capture and inspect responses
3. **Test Endpoint**: Use Postman/curl to test GAS endpoint directly:

```bash
curl -X POST \
  'https://script.google.com/macros/s/{DEPLOYMENT_ID}/exec' \
  -H 'Content-Type: application/json' \
  -d '{
    "action": "get_status"
  }'
```

### Base64 Encoding Issues

**Problem**: CSV content not properly encoded

**Solution**: Ensure UTF-8 encoding before Base64:
```javascript
// n8n Code Node
const csvString = $input.first().json.csvContent;
const buffer = Buffer.from(csvString, 'utf-8');
const base64 = buffer.toString('base64');
```

**Verify Decoding in GAS**:
```javascript
// GAS side
const decoded = Utilities.newBlob(
  Utilities.base64Decode(csv_data)
).getDataAsString('UTF-8');
Logger.log('Decoded CSV preview:', decoded.substring(0, 200));
```

### Rate Limiting

**GAS Quotas**:
- Web App: 20,000 requests/day
- Execution time: 6 minutes max per execution
- URL Fetch: 20,000 calls/day

**Mitigation**:
- Batch multiple CSVs in single request when possible
- Implement chunking for large datasets
- Add delays between sequential requests in n8n

---

## Appendix: Quick Reference

### Endpoints Summary

| Action | Method | Required Fields |
|--------|--------|-----------------|
| Health Check | GET | (none) |
| import_csv | POST | `action`, `platform`, `csv_data` |
| analyze | POST | `action`, `video_uids` |
| link_videos | POST | `action`, `links` |
| get_status | POST | `action` |

### Platform Values

| Platform | Value | Typical Filename Pattern |
|----------|-------|--------------------------|
| YouTube | `youtube` | `youtube_analytics_*.csv`, `yt_*.csv` |
| TikTok | `tiktok` | `tiktok_*.csv`, `tt_*.csv` |
| Instagram | `instagram` | `instagram_*.csv`, `ig_*.csv` |
