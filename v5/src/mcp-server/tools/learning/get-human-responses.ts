/**
 * MCI-025: get_human_responses — SELECT human_directives
 * Spec: 04-agent-design.md §4.12 #7
 */
import type {
  GetHumanResponsesInput,
  GetHumanResponsesOutput,
} from '@/types/mcp-tools';
import { getPool } from '../../db';
import { McpValidationError } from '../../errors';

const VALID_AGENT_TYPES = [
  'strategist', 'researcher', 'analyst', 'planner', 'tool_specialist', 'data_curator',
] as const;

export async function getHumanResponses(
  input: GetHumanResponsesInput,
): Promise<GetHumanResponsesOutput> {
  if (!VALID_AGENT_TYPES.includes(input.agent_type as typeof VALID_AGENT_TYPES[number])) {
    throw new McpValidationError(
      `Invalid agent_type: "${input.agent_type}". Must be one of: ${VALID_AGENT_TYPES.join(', ')}`,
    );
  }

  const pool = getPool();

  const res = await pool.query(
    `SELECT id AS message_id, human_response AS response_content, human_responded_at AS responded_at
     FROM agent_communications
     WHERE agent_type = $1
       AND human_response IS NOT NULL
       AND status = 'responded'
     ORDER BY human_responded_at DESC
     LIMIT 20`,
    [input.agent_type],
  );

  return {
    responses: res.rows.map((r: Record<string, unknown>) => ({
      message_id: r['message_id'] as number,
      response_content: r['response_content'] as string,
      responded_at: (r['responded_at'] as Date).toISOString(),
    })),
  };
}
