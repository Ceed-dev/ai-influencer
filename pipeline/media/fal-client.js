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
      // Log full error details for debugging
      if (attempt === 0) {
        console.error(`[fal-client] Error on ${endpoint}: status=${status}, message=${err.message}`);
        if (err.body) console.error(`[fal-client] Error body: ${JSON.stringify(err.body)}`);
      }
      // Enrich error message with fal.ai details
      if (err.body && err.body.detail && !err._enriched) {
        const detail = typeof err.body.detail === 'string'
          ? err.body.detail
          : JSON.stringify(err.body.detail);
        err.message = `${err.message}: ${detail}`;
        err._enriched = true;
      }
      const isTimeout = err.message && err.message.includes('timed out');
      const isFetchFailed = err.message && err.message.includes('fetch failed');
      const isTransient = status >= 500 || err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT' || isTimeout || isFetchFailed;
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

/**
 * Upload a buffer to fal.storage and return a temporary public URL.
 * @param {Buffer} buffer - File data
 * @param {string} contentType - MIME type (e.g. 'image/png', 'video/mp4')
 * @returns {Promise<string>} Temporary fal.media URL
 */
async function uploadToFalStorage(buffer, contentType) {
  const blob = new Blob([buffer], { type: contentType });
  const url = await fal.storage.upload(blob);
  return url;
}

/**
 * Download a file from Google Drive by file ID.
 * @param {string} fileId - Drive file ID
 * @returns {Promise<{buffer: Buffer, mimeType: string, name: string}>}
 */
async function downloadFromDrive(fileId) {
  const { getDrive } = require('../sheets/client');
  const drive = getDrive();

  // Get file metadata
  const meta = await drive.files.get({
    fileId,
    fields: 'name, mimeType',
    supportsAllDrives: true,
  });

  // Download content
  const res = await drive.files.get(
    { fileId, alt: 'media', supportsAllDrives: true },
    { responseType: 'arraybuffer' }
  );

  return {
    buffer: Buffer.from(res.data),
    mimeType: meta.data.mimeType,
    name: meta.data.name,
  };
}

module.exports = { submitAndWait, checkStatus, uploadToFalStorage, downloadFromDrive };
