/**
 * MCI-017: create_component — INSERT into components
 * Spec: 04-agent-design.md §4.10 #2
 */
import type {
  CreateComponentInput,
  CreateComponentOutput,
} from '@/types/mcp-tools';
import { getPool } from '../../db';
import { McpValidationError } from '../../errors';

const VALID_TYPES = ['scenario', 'motion', 'audio', 'image'] as const;

const TYPE_PREFIXES: Record<string, string> = {
  scenario: 'SCN',
  motion: 'MOT',
  audio: 'AUD',
  image: 'IMG',
};

export async function createComponent(
  input: CreateComponentInput,
): Promise<CreateComponentOutput> {
  if (!VALID_TYPES.includes(input.type as typeof VALID_TYPES[number])) {
    throw new McpValidationError(
      `Invalid type: "${input.type}". Must be one of: ${VALID_TYPES.join(', ')}`,
    );
  }
  if (!input.name || input.name.trim().length === 0) {
    throw new McpValidationError('name is required');
  }
  if (!input.subtype || input.subtype.trim().length === 0) {
    throw new McpValidationError('subtype is required');
  }

  const pool = getPool();

  // Generate component_id
  const prefix = TYPE_PREFIXES[input.type] ?? 'CMP';
  const countRes = await pool.query(
    `SELECT COUNT(*)::int AS cnt FROM components WHERE type = $1`,
    [input.type],
  );
  const count = ((countRes.rows[0] as Record<string, unknown>)['cnt'] as number) + 1;
  const componentId = `${prefix}_${String(count).padStart(4, '0')}`;

  const res = await pool.query(
    `INSERT INTO components (component_id, type, subtype, name, data, tags, drive_file_id, curated_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'auto')
     RETURNING component_id`,
    [
      componentId,
      input.type,
      input.subtype,
      input.name,
      JSON.stringify(input.data),
      input.tags,
      input.drive_file_id ?? null,
    ],
  );

  return { component_id: res.rows[0]['component_id'] as string };
}
