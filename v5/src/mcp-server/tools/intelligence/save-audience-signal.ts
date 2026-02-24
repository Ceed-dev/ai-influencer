/**
 * FEAT-MCI-005: save_audience_signal
 * Spec: 04-agent-design.md §4.2 #4
 */
import type {
  SaveAudienceSignalInput,
  SaveAudienceSignalOutput,
} from '@/types/mcp-tools';
import { getPool } from '../../db';
import { McpValidationError } from '../../errors';

export async function saveAudienceSignal(
  input: SaveAudienceSignalInput,
): Promise<SaveAudienceSignalOutput> {
  if (!input.signal_type || input.signal_type.trim().length === 0) {
    throw new McpValidationError('signal_type is required and must not be empty');
  }

  if (!input.topic || input.topic.trim().length === 0) {
    throw new McpValidationError('topic is required and must not be empty');
  }

  if (!input.sentiment || input.sentiment.trim().length === 0) {
    throw new McpValidationError('sentiment is required and must not be empty');
  }

  if (!input.sample_data || typeof input.sample_data !== 'object') {
    throw new McpValidationError('sample_data is required and must be an object');
  }

  const pool = getPool();
  const data = {
    signal_type: input.signal_type,
    topic: input.topic,
    sentiment: input.sentiment,
    sample_data: input.sample_data,
  };

  const res = await pool.query(
    `INSERT INTO market_intel (intel_type, data, relevance_score)
     VALUES ('audience_signal', $1, 1.0)
     RETURNING id`,
    [JSON.stringify(data)],
  );

  return { id: res.rows[0].id };
}
