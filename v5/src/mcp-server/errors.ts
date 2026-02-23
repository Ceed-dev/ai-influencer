/**
 * MCP Server error types for consistent error handling.
 */

export class McpValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'McpValidationError';
  }
}

export class McpNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'McpNotFoundError';
  }
}

export class McpDbError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'McpDbError';
  }
}
