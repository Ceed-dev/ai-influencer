/**
 * Common types for measurement analytics adapters
 * Spec: 04-agent-design.md §4.8, 02-architecture.md §12
 */

/** OAuth credentials extracted from accounts.auth_credentials.oauth JSONB */
export interface OAuthCredentials {
  // YouTube (OAuth2)
  client_id?: string;
  client_secret?: string;
  refresh_token?: string;
  access_token?: string;
  channel_id?: string;
  // TikTok (OAuth2)
  client_key?: string;
  open_id?: string;
  // Instagram (Facebook OAuth)
  app_id?: string;
  app_secret?: string;
  long_lived_token?: string;
  ig_user_id?: string;
  page_id?: string;
  // X (OAuth 1.0a)
  api_key?: string;
  api_secret?: string;
  access_token_secret?: string;
  user_id?: string;
}

/** Error thrown when API returns 429 rate limit */
export class RateLimitError extends Error {
  public readonly retryAfterSeconds: number | null;
  constructor(retryAfter: number | null) {
    super(`Rate limited${retryAfter ? ` — retry after ${retryAfter}s` : ''}`);
    this.name = 'RateLimitError';
    this.retryAfterSeconds = retryAfter;
  }
}

/** Error thrown when API returns 401 Unauthorized */
export class UnauthorizedError extends Error {
  constructor(platform: string) {
    super(`Unauthorized: ${platform} access token expired or invalid`);
    this.name = 'UnauthorizedError';
  }
}

/** Error thrown when API returns a client error (400) that shouldn't be retried */
export class ClientError extends Error {
  public readonly statusCode: number;
  constructor(statusCode: number, message: string) {
    super(`Client error ${statusCode}: ${message}`);
    this.name = 'ClientError';
    this.statusCode = statusCode;
  }
}

/**
 * Parse a fetch response and throw appropriate typed errors.
 * Returns the parsed JSON body on success.
 */
export async function handleApiResponse(
  resp: Response,
  platform: string,
): Promise<Record<string, unknown>> {
  if (resp.status === 401) {
    throw new UnauthorizedError(platform);
  }
  if (resp.status === 429) {
    const retryAfter = resp.headers.get('Retry-After');
    throw new RateLimitError(retryAfter ? parseInt(retryAfter, 10) : null);
  }
  if (resp.status >= 400 && resp.status < 500) {
    const body = await resp.text();
    throw new ClientError(resp.status, body);
  }
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`${platform} API error (${resp.status}): ${body}`);
  }
  return (await resp.json()) as Record<string, unknown>;
}

/**
 * Determine if an error is retryable (server errors, rate limits, network errors).
 * Client errors (400-level except 401/429) are NOT retryable.
 */
export function isRetryableError(err: unknown): boolean {
  if (err instanceof ClientError) return false;
  if (err instanceof UnauthorizedError) return false;
  // RateLimitError, server errors, network errors → retryable
  return true;
}
