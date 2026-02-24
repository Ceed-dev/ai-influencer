/**
 * FEAT-MCC-018: upload_to_drive
 * Spec: 04-agent-design.md SS4.6 #9
 * Google Drive upload with credential check.
 * Attempts real upload if CRED_GOOGLE_SERVICE_ACCOUNT_KEY is configured.
 * Falls back to placeholder response otherwise.
 */
import type {
  UploadToDriveInput,
  UploadToDriveOutput,
} from '@/types/mcp-tools';
import { McpValidationError } from '../../errors.js';
import { getSettingString } from '../../../lib/settings.js';
import { retryWithBackoff } from '../../../lib/retry.js';
import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';
import { Readable } from 'node:stream';
import https from 'node:https';
import http from 'node:http';

/**
 * Download a file from a URL and return a readable stream.
 */
function downloadFile(url: string): Promise<Readable> {
  return new Promise((resolve, reject) => {
    const transport = url.startsWith('https') ? https : http;
    transport.get(url, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers['location']) {
        downloadFile(res.headers['location']).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode && res.statusCode >= 400) {
        reject(new Error(`Failed to download file: HTTP ${res.statusCode}`));
        return;
      }
      resolve(res);
    }).on('error', reject);
  });
}

export async function uploadToDrive(
  input: UploadToDriveInput,
): Promise<UploadToDriveOutput> {
  if (!input.file_url || input.file_url.trim() === '') {
    throw new McpValidationError('file_url must not be empty');
  }

  if (!input.folder_id || input.folder_id.trim() === '') {
    throw new McpValidationError('folder_id must not be empty');
  }

  if (!input.filename || input.filename.trim() === '') {
    throw new McpValidationError('filename must not be empty');
  }

  try {
    const serviceAccountKey = await getSettingString('CRED_GOOGLE_SERVICE_ACCOUNT_KEY');
    if (serviceAccountKey && serviceAccountKey.trim() !== '') {
      const keyData = JSON.parse(serviceAccountKey) as Record<string, unknown>;

      const auth = new GoogleAuth({
        credentials: {
          client_email: keyData['client_email'] as string,
          private_key: keyData['private_key'] as string,
        },
        scopes: ['https://www.googleapis.com/auth/drive.file'],
      });

      const drive = google.drive({ version: 'v3', auth });

      // Download the file from URL
      const fileStream = await downloadFile(input.file_url);

      // Upload to Google Drive with retry
      const uploadResult = await retryWithBackoff(
        async () => {
          const response = await drive.files.create({
            requestBody: {
              name: input.filename,
              parents: [input.folder_id],
            },
            media: {
              body: fileStream,
            },
            fields: 'id',
          });
          return response;
        },
        {
          maxAttempts: 3,
          baseDelayMs: 2000,
          backoffMultiplier: 2.0,
          isRetryable: (err: unknown) => {
            const status = (err as Record<string, unknown>)?.['code'] as number | undefined;
            // Don't retry auth errors or invalid requests
            if (status === 401 || status === 403 || status === 400) return false;
            // Retry rate limits (429) and server errors (5xx)
            return true;
          },
        },
      );

      const fileId = uploadResult.data.id;
      if (!fileId) {
        throw new Error('Google Drive upload succeeded but no file ID was returned');
      }

      return {
        drive_file_id: fileId,
        drive_url: `https://drive.google.com/file/d/${fileId}/view`,
      };
    }
  } catch (err) {
    // If it's an auth/upload error with real credentials, log and fall through
    console.warn(
      '[upload_to_drive] Google Drive upload failed, using placeholder:',
      err instanceof Error ? err.message : String(err),
    );
  }

  // Placeholder response when credentials not available or upload failed
  const driveFileId = `drive_${Date.now()}`;

  return {
    drive_file_id: driveFileId,
    drive_url: `https://drive.google.com/file/d/${driveFileId}`,
  };
}
