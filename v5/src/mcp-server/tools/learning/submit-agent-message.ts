/**
 * MCI-024: submit_agent_message — INSERT into agent_communications
 * Spec: 04-agent-design.md §4.12 #6
 */
import type {
  SubmitAgentMessageInput,
  SubmitAgentMessageOutput,
} from '@/types/mcp-tools';
import { getPool } from '../../db';
import { McpValidationError } from '../../errors';

const VALID_AGENT_TYPES = [
  'strategist', 'researcher', 'analyst', 'planner', 'tool_specialist', 'data_curator',
] as const;

const VALID_MESSAGE_TYPES = [
  'struggle', 'proposal', 'question', 'status_report', 'anomaly_alert', 'milestone',
] as const;

export async function submitAgentMessage(
  input: SubmitAgentMessageInput,
): Promise<SubmitAgentMessageOutput> {
  if (!VALID_AGENT_TYPES.includes(input.agent_type as typeof VALID_AGENT_TYPES[number])) {
    throw new McpValidationError(
      `Invalid agent_type: "${input.agent_type}". Must be one of: ${VALID_AGENT_TYPES.join(', ')}`,
    );
  }
  if (!VALID_MESSAGE_TYPES.includes(input.message_type as typeof VALID_MESSAGE_TYPES[number])) {
    throw new McpValidationError(
      `Invalid message_type: "${input.message_type}". Must be one of: ${VALID_MESSAGE_TYPES.join(', ')}`,
    );
  }
  if (!input.content || input.content.trim().length === 0) {
    throw new McpValidationError('content is required');
  }

  const pool = getPool();

  // Map numeric priority to text value expected by DB constraint
  let priorityText = 'normal';
  if (input.priority !== undefined && input.priority !== null) {
    if (typeof input.priority === 'string') {
      priorityText = input.priority;
    } else {
      if (input.priority <= 2) priorityText = 'low';
      else if (input.priority <= 4) priorityText = 'normal';
      else if (input.priority <= 7) priorityText = 'high';
      else priorityText = 'urgent';
    }
  }

  const res = await pool.query(
    `INSERT INTO agent_communications
       (agent_type, message_type, content, priority)
     VALUES ($1, $2, $3, $4)
     RETURNING id, ('x' || substr(id::text, 1, 8))::bit(32)::int AS numeric_id`,
    [
      input.agent_type,
      input.message_type,
      input.content,
      priorityText,
    ],
  );

  return { id: Number(res.rows[0]['numeric_id']) };
}
