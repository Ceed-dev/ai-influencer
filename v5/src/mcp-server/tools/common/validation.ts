/**
 * FEAT-MCC-042: MCP Common Validation Utilities
 * Spec: 04-mcp-tools.md SS2.13
 * Shared validation helpers used across all MCP tools.
 */
import { McpValidationError } from '../../errors';

/**
 * Validate that a value is present (not undefined, null, or empty string).
 * @throws McpValidationError if the value is missing
 */
export function validateRequired(value: unknown, fieldName: string): void {
  if (value === undefined || value === null) {
    throw new McpValidationError(`${fieldName} is required`);
  }
  if (typeof value === 'string' && value.trim() === '') {
    throw new McpValidationError(`${fieldName} is required`);
  }
}

/**
 * Validate that a string value is one of the allowed enum values.
 * @throws McpValidationError if the value is not in validValues
 */
export function validateEnum<T extends string>(
  value: string,
  validValues: readonly T[],
  fieldName: string,
): asserts value is T {
  if (!validValues.includes(value as T)) {
    throw new McpValidationError(
      `Invalid ${fieldName}: "${value}". Must be one of: ${validValues.join(', ')}`,
    );
  }
}

/**
 * Validate that a number is a positive integer (> 0).
 * @throws McpValidationError if not a positive integer
 */
export function validatePositiveInt(value: number, fieldName: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new McpValidationError(
      `${fieldName} must be a positive integer`,
    );
  }
}
