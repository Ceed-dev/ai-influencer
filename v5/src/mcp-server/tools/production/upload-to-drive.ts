/**
 * FEAT-MCC-018: upload_to_drive
 * Spec: 04-agent-design.md SS4.6 #9
 * Placeholder for Google Drive upload.
 * Validates inputs; actual Drive API integration is in video-worker.
 */
import type {
  UploadToDriveInput,
  UploadToDriveOutput,
} from '@/types/mcp-tools';
import { McpValidationError } from '../../errors';

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

  const driveFileId = `drive_${Date.now()}`;

  return {
    drive_file_id: driveFileId,
    drive_url: `https://drive.google.com/file/d/${driveFileId}`,
  };
}
