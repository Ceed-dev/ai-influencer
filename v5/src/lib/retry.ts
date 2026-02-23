/**
 * FEAT-VW-004: Retry with exponential backoff + jitter
 * FEAT-VW-005: Timeout handling
 * Spec: 02-architecture.md §9
 */

export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  backoffMultiplier?: number;
  maxDelayMs?: number;
  jitterFraction?: number;
  timeoutMs?: number;
  isRetryable?: (error: unknown) => boolean;
  onRetry?: (attempt: number, delayMs: number, error: unknown) => void;
}

export function calculateDelay(
  attempt: number,
  baseDelayMs: number,
  backoffMultiplier: number,
  maxDelayMs: number,
  jitterFraction: number,
): number {
  const rawDelay = baseDelayMs * Math.pow(backoffMultiplier, attempt);
  const capped = Math.min(rawDelay, maxDelayMs);
  const jitter = capped * jitterFraction * (2 * Math.random() - 1);
  return Math.max(0, Math.round(capped + jitter));
}

export function withTimeout<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
      reject(new TimeoutError(`Operation timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    fn(controller.signal)
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

export class MaxRetriesExceededError extends Error {
  public readonly lastError: unknown;
  public readonly attempts: number;
  constructor(attempts: number, lastError: unknown) {
    super(`Max retries (${attempts}) exceeded`);
    this.name = 'MaxRetriesExceededError';
    this.lastError = lastError;
    this.attempts = attempts;
  }
}

export async function retryWithBackoff<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelayMs = 1000,
    backoffMultiplier = 2.0,
    maxDelayMs = 300000,
    jitterFraction = 0.2,
    timeoutMs = 600000,
    isRetryable = () => true,
    onRetry,
  } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await withTimeout(fn, timeoutMs);
    } catch (err) {
      lastError = err;
      if (attempt === maxAttempts - 1) break;
      if (!isRetryable(err)) throw err;

      const delay = calculateDelay(attempt, baseDelayMs, backoffMultiplier, maxDelayMs, jitterFraction);
      if (onRetry) onRetry(attempt + 1, delay, err);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw new MaxRetriesExceededError(maxAttempts, lastError);
}
