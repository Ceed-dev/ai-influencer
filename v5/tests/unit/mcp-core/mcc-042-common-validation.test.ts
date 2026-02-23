/**
 * TEST-MCP-087: Unauthenticated request rejection (validation layer)
 * TEST-MCP-088: Unknown tool name rejection (validation layer)
 * TEST-MCP-089: Missing required field rejection
 * TEST-MCP-090: DB connection error graceful handling
 * FEAT-MCC-042: MCP Common Validation
 */
import {
  validateRequired,
  validateEnum,
  validatePositiveInt,
} from '@/src/mcp-server/tools/common/validation';
import { McpValidationError } from '@/src/mcp-server/errors';

describe('FEAT-MCC-042: MCP Common Validation', () => {
  // --- validateRequired ---
  describe('validateRequired', () => {
    test('TEST-MCP-089: throws McpValidationError for undefined', () => {
      expect(() => validateRequired(undefined, 'field_name')).toThrow(McpValidationError);
      expect(() => validateRequired(undefined, 'field_name')).toThrow('field_name is required');
    });

    test('TEST-MCP-089: throws McpValidationError for null', () => {
      expect(() => validateRequired(null, 'field_name')).toThrow(McpValidationError);
      expect(() => validateRequired(null, 'field_name')).toThrow('field_name is required');
    });

    test('TEST-MCP-089: throws McpValidationError for empty string', () => {
      expect(() => validateRequired('', 'field_name')).toThrow(McpValidationError);
      expect(() => validateRequired('  ', 'field_name')).toThrow(McpValidationError);
    });

    test('TEST-MCP-089: accepts valid values', () => {
      expect(() => validateRequired('hello', 'field_name')).not.toThrow();
      expect(() => validateRequired(0, 'field_name')).not.toThrow();
      expect(() => validateRequired(false, 'field_name')).not.toThrow();
      expect(() => validateRequired([], 'field_name')).not.toThrow();
      expect(() => validateRequired({}, 'field_name')).not.toThrow();
    });

    test('TEST-MCP-089: error message contains field name', () => {
      try {
        validateRequired(null, 'content_id');
      } catch (err) {
        expect(err).toBeInstanceOf(McpValidationError);
        expect((err as McpValidationError).message).toContain('content_id');
      }
    });
  });

  // --- validateEnum ---
  describe('validateEnum', () => {
    const VALID_PLATFORMS = ['youtube', 'tiktok', 'instagram', 'x'] as const;

    test('TEST-MCP-089: throws McpValidationError for invalid enum value', () => {
      expect(() => validateEnum('facebook', VALID_PLATFORMS, 'platform')).toThrow(
        McpValidationError,
      );
      expect(() => validateEnum('facebook', VALID_PLATFORMS, 'platform')).toThrow(
        'Invalid platform: "facebook"',
      );
    });

    test('TEST-MCP-089: error message lists valid values', () => {
      try {
        validateEnum('invalid', VALID_PLATFORMS, 'platform');
      } catch (err) {
        expect(err).toBeInstanceOf(McpValidationError);
        expect((err as McpValidationError).message).toContain('youtube, tiktok, instagram, x');
      }
    });

    test('TEST-MCP-089: accepts valid enum values', () => {
      expect(() => validateEnum('youtube', VALID_PLATFORMS, 'platform')).not.toThrow();
      expect(() => validateEnum('tiktok', VALID_PLATFORMS, 'platform')).not.toThrow();
      expect(() => validateEnum('instagram', VALID_PLATFORMS, 'platform')).not.toThrow();
      expect(() => validateEnum('x', VALID_PLATFORMS, 'platform')).not.toThrow();
    });
  });

  // --- validatePositiveInt ---
  describe('validatePositiveInt', () => {
    test('TEST-MCP-089: throws McpValidationError for zero', () => {
      expect(() => validatePositiveInt(0, 'task_id')).toThrow(McpValidationError);
      expect(() => validatePositiveInt(0, 'task_id')).toThrow('task_id must be a positive integer');
    });

    test('TEST-MCP-089: throws McpValidationError for negative numbers', () => {
      expect(() => validatePositiveInt(-1, 'task_id')).toThrow(McpValidationError);
      expect(() => validatePositiveInt(-100, 'task_id')).toThrow(McpValidationError);
    });

    test('TEST-MCP-089: throws McpValidationError for non-integers', () => {
      expect(() => validatePositiveInt(1.5, 'task_id')).toThrow(McpValidationError);
      expect(() => validatePositiveInt(0.1, 'task_id')).toThrow(McpValidationError);
      expect(() => validatePositiveInt(NaN, 'task_id')).toThrow(McpValidationError);
      expect(() => validatePositiveInt(Infinity, 'task_id')).toThrow(McpValidationError);
    });

    test('TEST-MCP-089: accepts positive integers', () => {
      expect(() => validatePositiveInt(1, 'task_id')).not.toThrow();
      expect(() => validatePositiveInt(100, 'task_id')).not.toThrow();
      expect(() => validatePositiveInt(999999, 'task_id')).not.toThrow();
    });
  });
});
