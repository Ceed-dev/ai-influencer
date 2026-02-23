/**
 * FEAT-MCC-034: submit_human_directive
 * Spec: 04-agent-design.md §4.9 #3
 * Inserts a new human directive into the human_directives table.
 */
import type {
  SubmitHumanDirectiveInput,
  SubmitHumanDirectiveOutput,
} from '@/types/mcp-tools';
import { getPool } from '../../db';
import { McpValidationError, McpDbError } from '../../errors';

export async function submitHumanDirective(
  input: SubmitHumanDirectiveInput,
): Promise<SubmitHumanDirectiveOutput> {
  if (!input.directive_type || input.directive_type.trim() === '') {
    throw new McpValidationError('directive_type is required and must be non-empty');
  }
  if (!input.content || input.content.trim() === '') {
    throw new McpValidationError('content is required and must be non-empty');
  }
  if (typeof input.priority !== 'number') {
    throw new McpValidationError('priority must be a number');
  }

  const pool = getPool();

  const targetAccounts = input.target_accounts ?? null;
  const targetAgents = input.target_agents ?? null;

  const res = await pool.query(
    `INSERT INTO human_directives (directive_type, content, target_accounts, target_agents, priority, status)
     VALUES ($1, $2, $3, $4, $5, 'pending')
     RETURNING id`,
    [input.directive_type, input.content, targetAccounts, targetAgents, input.priority],
  );

  const row = res.rows[0] as { id: number } | undefined;
  if (!row) {
    throw new McpDbError('Failed to insert human directive');
  }

  return { id: row.id };
}
