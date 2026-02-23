/**
 * FEAT-MCC-033: update_system_config
 * Spec: 04-agent-design.md §4.9 #2
 * Updates a system_settings value, validating key exists and constraints.
 */
import type {
  UpdateSystemConfigInput,
  UpdateSystemConfigOutput,
} from '@/types/mcp-tools';
import type { SystemSettingConstraints, SystemSettingValueType } from '@/types/database';
import { getPool } from '../../db';
import { McpValidationError, McpNotFoundError, McpDbError } from '../../errors';

export async function updateSystemConfig(
  input: UpdateSystemConfigInput,
): Promise<UpdateSystemConfigOutput> {
  if (!input.key || typeof input.key !== 'string' || input.key.trim() === '') {
    throw new McpValidationError('key is required and must be a non-empty string');
  }

  if (input.value === undefined || input.value === null) {
    throw new McpValidationError('value is required and must not be null/undefined');
  }

  const pool = getPool();

  // Check if key exists and get constraints
  const settingRes = await pool.query(
    `SELECT setting_key, value_type, constraints
     FROM system_settings
     WHERE setting_key = $1`,
    [input.key],
  );

  const settingRow = settingRes.rows[0] as {
    setting_key: string;
    value_type: SystemSettingValueType;
    constraints: SystemSettingConstraints | null;
  } | undefined;

  if (!settingRow) {
    throw new McpNotFoundError(`System setting not found: ${input.key}`);
  }

  // Validate constraints
  const constraints = settingRow.constraints;
  if (constraints) {
    if (typeof constraints.min === 'number' && typeof input.value === 'number') {
      if (input.value < constraints.min) {
        throw new McpValidationError(
          `Value ${input.value} is below minimum ${constraints.min} for key "${input.key}"`,
        );
      }
    }
    if (typeof constraints.max === 'number' && typeof input.value === 'number') {
      if (input.value > constraints.max) {
        throw new McpValidationError(
          `Value ${input.value} exceeds maximum ${constraints.max} for key "${input.key}"`,
        );
      }
    }
    if (Array.isArray(constraints.options) && constraints.options.length > 0) {
      if (!constraints.options.includes(String(input.value))) {
        throw new McpValidationError(
          `Value "${String(input.value)}" is not in allowed options: ${constraints.options.join(', ')} for key "${input.key}"`,
        );
      }
    }
  }

  // Update the setting
  const updateRes = await pool.query(
    `UPDATE system_settings
     SET setting_value = $1::jsonb, updated_at = NOW(), updated_by = 'human'
     WHERE setting_key = $2`,
    [JSON.stringify(input.value), input.key],
  );

  if (updateRes.rowCount === 0) {
    throw new McpDbError(`Failed to update system_settings key="${input.key}"`);
  }

  return { success: true };
}
