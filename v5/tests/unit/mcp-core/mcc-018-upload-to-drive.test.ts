/**
 * TEST-MCP-018: upload_to_drive — placeholder validation
 * FEAT-MCC-018
 */
import { uploadToDrive } from '@/src/mcp-server/tools/production/upload-to-drive';
import { McpValidationError } from '@/src/mcp-server/errors';

describe('FEAT-MCC-018: upload_to_drive', () => {
  test('TEST-MCP-018a: returns drive_file_id and drive_url for valid input', async () => {
    const result = await uploadToDrive({
      file_url: 'https://example.com/file.mp4',
      folder_id: 'folder_abc123',
      filename: 'output.mp4',
    });

    expect(result).toHaveProperty('drive_file_id');
    expect(result).toHaveProperty('drive_url');

    expect(typeof result.drive_file_id).toBe('string');
    expect(typeof result.drive_url).toBe('string');

    expect(result.drive_file_id).toMatch(/^drive_\d+$/);
    expect(result.drive_url).toContain('https://drive.google.com/file/d/');
    expect(result.drive_url).toContain(result.drive_file_id);
  });

  test('TEST-MCP-018b: throws McpValidationError for empty file_url', async () => {
    await expect(
      uploadToDrive({
        file_url: '',
        folder_id: 'folder_abc123',
        filename: 'output.mp4',
      }),
    ).rejects.toThrow(McpValidationError);
  });

  test('TEST-MCP-018c: throws McpValidationError for empty folder_id', async () => {
    await expect(
      uploadToDrive({
        file_url: 'https://example.com/file.mp4',
        folder_id: '',
        filename: 'output.mp4',
      }),
    ).rejects.toThrow(McpValidationError);
  });

  test('TEST-MCP-018d: throws McpValidationError for empty filename', async () => {
    await expect(
      uploadToDrive({
        file_url: 'https://example.com/file.mp4',
        folder_id: 'folder_abc123',
        filename: '',
      }),
    ).rejects.toThrow(McpValidationError);
  });

  test('TEST-MCP-018e: throws McpValidationError for whitespace-only inputs', async () => {
    await expect(
      uploadToDrive({
        file_url: '   ',
        folder_id: 'folder_abc123',
        filename: 'output.mp4',
      }),
    ).rejects.toThrow(McpValidationError);
  });
});
