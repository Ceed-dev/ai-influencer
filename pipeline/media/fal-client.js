'use strict';

const { fal } = require('@fal-ai/client');
const config = require('../config');

// Configure fal client with API key
fal.config({ credentials: config.fal.apiKey });

const RETRY_DELAYS = [2000, 5000, 10000]; // ms

/**
 * Submit a request to fal.ai and wait for the result with automatic polling.
 * Retries on transient errors (5xx, network).
 */
async function submitAndWait(endpoint, input, opts = {}) {
  const timeout = opts.timeout || config.fal.defaultTimeout;
  const maxRetries = opts.maxRetries || 3;

  let lastError;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await fal.subscribe(endpoint, {
        input,
        logs: opts.logs || false,
        timeout,
        onQueueUpdate: opts.onQueueUpdate || undefined,
      });
      return result.data;
    } catch (err) {
      lastError = err;
      const status = err.status || err.statusCode;
      const isTransient = status >= 500 || err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT';
      if (!isTransient || attempt >= maxRetries - 1) throw err;

      const delay = RETRY_DELAYS[attempt] || 10000;
      console.warn(`fal.ai transient error (attempt ${attempt + 1}/${maxRetries}), retrying in ${delay}ms...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastError;
}

/**
 * Check status of a queued request.
 */
async function checkStatus(endpoint, requestId) {
  const status = await fal.queue.status(endpoint, { requestId, logs: false });
  return status;
}

module.exports = { submitAndWait, checkStatus };
