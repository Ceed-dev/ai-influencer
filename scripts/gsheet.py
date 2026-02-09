#!/usr/bin/env python3
"""Google Sheets CLI utility for Video Analytics Hub.

Usage:
  python3 scripts/gsheet.py tabs                    - List all tabs
  python3 scripts/gsheet.py read <tab> [range]       - Read tab data (e.g., "master" or "master!A1:E5")
  python3 scripts/gsheet.py write <tab> <range> <json> - Write data
  python3 scripts/gsheet.py drive [folder_id]        - List Drive folder contents

Requires: /tmp/google-auth-venv (created by OAuth setup)
"""

import json
import sys
import os

# Add venv packages
VENV_PATH = '/tmp/google-auth-venv/lib/python3.12/site-packages'
if os.path.exists(VENV_PATH):
    sys.path.insert(0, VENV_PATH)

from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOKEN_PATH = os.path.join(BASE_DIR, '.gsheets_token.json')
CREDS_PATH = os.path.join(BASE_DIR, 'video_analytics_hub_claude_code_oauth.json')
SPREADSHEET_ID = '1fI1s_KLcegpiACJYpmpNe9tnQmnZo2o8eHIXNV5SpPg'


def get_creds():
    with open(TOKEN_PATH) as f:
        token_data = json.load(f)
    with open(CREDS_PATH) as f:
        cred_data = json.load(f)['installed']

    creds = Credentials(
        token=token_data['token'],
        refresh_token=token_data['refresh_token'],
        token_uri=token_data.get('token_uri', 'https://oauth2.googleapis.com/token'),
        client_id=cred_data['client_id'],
        client_secret=cred_data['client_secret'],
        scopes=token_data.get('scopes', [])
    )
    if creds.expired or not creds.valid:
        creds.refresh(Request())
        with open(TOKEN_PATH, 'w') as f:
            f.write(creds.to_json())
    return creds


def cmd_tabs():
    creds = get_creds()
    service = build('sheets', 'v4', credentials=creds)
    result = service.spreadsheets().get(spreadsheetId=SPREADSHEET_ID).execute()
    print(f"Spreadsheet: {result['properties']['title']}")
    for s in result['sheets']:
        p = s['properties']
        print(f"  {p['title']} ({p['gridProperties']['rowCount']}x{p['gridProperties']['columnCount']})")


def cmd_read(tab, range_str=None):
    creds = get_creds()
    service = build('sheets', 'v4', credentials=creds)
    if range_str:
        full_range = f"{tab}!{range_str}" if '!' not in range_str else range_str
    else:
        full_range = tab
    result = service.spreadsheets().values().get(
        spreadsheetId=SPREADSHEET_ID, range=full_range
    ).execute()
    values = result.get('values', [])
    if not values:
        print("(empty)")
        return
    # Print as table
    for i, row in enumerate(values):
        prefix = "HDR" if i == 0 else f"R{i}"
        print(f"{prefix}: {json.dumps(row, ensure_ascii=False)}")


def cmd_write(tab, range_str, data_json):
    creds = get_creds()
    service = build('sheets', 'v4', credentials=creds)
    data = json.loads(data_json)
    full_range = f"{tab}!{range_str}"
    body = {'values': data}
    result = service.spreadsheets().values().update(
        spreadsheetId=SPREADSHEET_ID, range=full_range,
        valueInputOption='USER_ENTERED', body=body
    ).execute()
    print(f"Updated {result.get('updatedCells', 0)} cells")


def cmd_drive(folder_id=None):
    creds = get_creds()
    service = build('drive', 'v3', credentials=creds)
    if folder_id:
        q = f"'{folder_id}' in parents"
    else:
        q = "mimeType='application/vnd.google-apps.folder'"
    results = service.files().list(
        q=q, fields='files(id, name, mimeType)', pageSize=50,
        orderBy='name'
    ).execute()
    for f in results.get('files', []):
        print(f"  {f['name']} ({f['mimeType']}) - {f['id']}")


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    cmd = sys.argv[1]
    if cmd == 'tabs':
        cmd_tabs()
    elif cmd == 'read':
        tab = sys.argv[2] if len(sys.argv) > 2 else 'master'
        rng = sys.argv[3] if len(sys.argv) > 3 else None
        cmd_read(tab, rng)
    elif cmd == 'write':
        if len(sys.argv) < 5:
            print("Usage: gsheet.py write <tab> <range> <json>")
            sys.exit(1)
        cmd_write(sys.argv[2], sys.argv[3], sys.argv[4])
    elif cmd == 'drive':
        fid = sys.argv[2] if len(sys.argv) > 2 else None
        cmd_drive(fid)
    else:
        print(f"Unknown command: {cmd}")
        print(__doc__)
        sys.exit(1)
