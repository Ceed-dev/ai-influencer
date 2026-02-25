/**
 * FEAT-INT-014: Agent-to-human communication
 * Spec: 04-agent-design.md §4.12 (#6, #7), 02-architecture.md §7
 *
 * Allows agents to send messages to humans via agent_communications table.
 * Message types: struggle, proposal, question, status_report, anomaly_alert, milestone
 * All config from DB system_settings — no hardcoding.
 */
import type { PoolClient } from 'pg';
import type {
  AgentType,
  CommunicationMessageType,
  Priority,
} from '@/types/database';

/** Input for sending an agent message */
export interface SendMessageInput {
  agentType: AgentType;
  messageType: CommunicationMessageType;
  priority: Priority;
  content: string;
  context?: Record<string, unknown> | null;
  cycleId?: number | null;
}

/** Result of sending a message */
export interface SendMessageResult {
  messageId: string;
  createdAt: string;
}

/** Human response to an agent message */
export interface HumanResponse {
  messageId: string;
  responseContent: string;
  respondedAt: string;
}

/**
 * Send a message from an agent to the human dashboard.
 * INSERTs into agent_communications with status='unread'.
 */
export async function sendAgentMessage(
  client: PoolClient,
  input: SendMessageInput,
): Promise<SendMessageResult> {
  const res = await client.query(
    `INSERT INTO agent_communications
       (agent_type, message_type, priority, content, context, cycle_id, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'unread')
     RETURNING id, created_at`,
    [
      input.agentType,
      input.messageType,
      input.priority,
      input.content,
      input.context ? JSON.stringify(input.context) : null,
      input.cycleId ?? null,
    ],
  );

  const row = res.rows[0] as Record<string, unknown>;
  return {
    messageId: row['id'] as string,
    createdAt: String(row['created_at']),
  };
}

/**
 * Get unread human responses for a specific agent type.
 * Returns messages where human_response IS NOT NULL and status = 'responded'.
 */
export async function getHumanResponses(
  client: PoolClient,
  agentType: AgentType,
): Promise<HumanResponse[]> {
  const res = await client.query(
    `SELECT id, human_response, human_responded_at
     FROM agent_communications
     WHERE agent_type = $1
       AND status = 'responded'
       AND human_response IS NOT NULL
     ORDER BY human_responded_at DESC`,
    [agentType],
  );

  return res.rows.map((row) => {
    const r = row as Record<string, unknown>;
    return {
      messageId: r['id'] as string,
      responseContent: r['human_response'] as string,
      respondedAt: String(r['human_responded_at']),
    };
  });
}

/**
 * Mark agent messages as read (acknowledged by agent).
 */
export async function markMessagesRead(
  client: PoolClient,
  messageIds: string[],
): Promise<number> {
  if (messageIds.length === 0) return 0;

  const res = await client.query(
    `UPDATE agent_communications
     SET status = 'archived'
     WHERE id = ANY($1) AND status = 'responded'`,
    [messageIds],
  );

  return res.rowCount ?? 0;
}
