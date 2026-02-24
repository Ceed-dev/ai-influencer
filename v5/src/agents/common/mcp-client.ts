/**
 * MCP Client utility for connecting LangGraph nodes to the MCP Server
 * via langchain-mcp-adapters.
 *
 * Spec: 02-architecture.md SS4.3
 *
 * Architecture:
 *   LangGraph.js node -> langchain-mcp-adapters -> MCP Protocol (stdio) -> MCP Server -> PostgreSQL
 *
 * This module:
 * - Initializes a MultiServerMCPClient with stdio transport to the MCP Server
 * - Caches the client connection (singleton)
 * - Provides getMcpTools() to get LangChain-compatible tools
 * - Provides callMcpTool() helper for direct tool invocation by name
 *
 * Note: @langchain/mcp-adapters is loaded lazily via dynamic import() to avoid
 * CJS/ESM compatibility issues at module evaluation time (e.g. in Jest).
 */
import type { StructuredToolInterface } from '@langchain/core/tools';
import path from 'node:path';

// ---------------------------------------------------------------------------
// Singleton state
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _client: any = null;
let _tools: StructuredToolInterface[] | null = null;
let _initPromise: Promise<StructuredToolInterface[]> | null = null;

// ---------------------------------------------------------------------------
// Resolve paths
// ---------------------------------------------------------------------------

/**
 * Resolve the absolute path to the MCP server entry point.
 * In development (tsx), this resolves to the .ts file.
 * In production (compiled), this resolves to the .js file in dist/.
 */
function getMcpServerPath(): string {
  // Compute the project root (v5/) from this file's location:
  // src/agents/common/mcp-client.ts -> 3 levels up
  const projectRoot = path.resolve(__dirname, '..', '..', '..');

  // Check if we're running via tsx (development) or compiled JS (production)
  const isTsx = process.argv[0]?.includes('tsx') ||
    process.execArgv.some(a => a.includes('ts-node') || a.includes('tsx'));

  if (isTsx) {
    return path.join(projectRoot, 'src', 'mcp-server', 'index.ts');
  }
  return path.join(projectRoot, 'dist', 'src', 'mcp-server', 'index.js');
}

// ---------------------------------------------------------------------------
// Client initialization
// ---------------------------------------------------------------------------

/**
 * Create and initialize the MultiServerMCPClient singleton.
 * Spawns the MCP Server as a child process via stdio transport.
 *
 * Uses dynamic import() for @langchain/mcp-adapters to avoid
 * CJS/ESM module loading issues at import time.
 */
async function initializeClient(): Promise<StructuredToolInterface[]> {
  // Dynamic import to avoid CJS/ESM issues at module evaluation time
  const { MultiServerMCPClient } = await import('@langchain/mcp-adapters');

  const mcpServerPath = getMcpServerPath();
  const isTsx = mcpServerPath.endsWith('.ts');

  const command = 'node';
  const args = isTsx
    ? ['--import', 'tsx', mcpServerPath]
    : [mcpServerPath];

  // Use Record<string, Connection> form for constructor
  _client = new MultiServerMCPClient({
    'ai-influencer': {
      transport: 'stdio' as const,
      command,
      args,
      env: {
        ...process.env as Record<string, string>,
        NODE_ENV: process.env['NODE_ENV'] ?? 'production',
      },
      stderr: 'pipe' as const,
      restart: {
        enabled: true,
        maxAttempts: 3,
        delayMs: 2000,
      },
    },
  });

  const tools: StructuredToolInterface[] = await _client.getTools();
  _tools = tools;

  return tools;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get all MCP tools as LangChain-compatible StructuredToolInterface[].
 *
 * The first call initializes the MCP client connection; subsequent calls
 * return the cached tools array. Thread-safe via promise deduplication.
 */
export async function getMcpTools(): Promise<StructuredToolInterface[]> {
  if (_tools) return _tools;

  // Deduplicate concurrent init calls
  if (!_initPromise) {
    _initPromise = initializeClient().finally(() => {
      _initPromise = null;
    });
  }

  return _initPromise;
}

/**
 * Call an MCP tool by name with the given input arguments.
 *
 * This is a convenience wrapper that:
 * 1. Gets the tools from the MCP client
 * 2. Finds the tool by name
 * 3. Invokes it with the provided input
 * 4. Parses the JSON result
 *
 * @param toolName - The MCP tool name (e.g. 'get_recent_intel')
 * @param input - The input arguments for the tool
 * @returns The parsed result from the tool
 * @throws Error if the tool is not found or invocation fails
 */
export async function callMcpTool<T = unknown>(
  toolName: string,
  input: Record<string, unknown> = {},
): Promise<T> {
  const tools = await getMcpTools();
  const tool = tools.find((t) => t.name === toolName);
  if (!tool) {
    const available = tools.map((t) => t.name).join(', ');
    throw new Error(
      `MCP tool not found: "${toolName}". Available tools: ${available}`,
    );
  }

  const result = await tool.invoke(input);

  // The MCP server wraps results in JSON text content blocks.
  // langchain-mcp-adapters returns the text content as a string.
  if (typeof result === 'string') {
    try {
      return JSON.parse(result) as T;
    } catch {
      // If it's not JSON, return as-is cast to T
      return result as unknown as T;
    }
  }

  return result as T;
}

/**
 * Close the MCP client connection and reset singleton state.
 * Should be called during graceful shutdown.
 */
export async function closeMcpClient(): Promise<void> {
  if (_client) {
    await _client.close().catch((err: unknown) => {
      console.warn(
        `[mcp-client] Error closing MCP client: ${err instanceof Error ? err.message : String(err)}`,
      );
    });
    _client = null;
    _tools = null;
  }
}

/**
 * Get the underlying MultiServerMCPClient instance.
 * Mainly useful for advanced operations (e.g. fetching prompts/resources).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getMcpClient(): Promise<any> {
  if (!_client) {
    await getMcpTools(); // ensures initialization
  }
  return _client;
}
