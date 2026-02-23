/**
 * FEAT-MCC-008: plan_content
 * Spec: 04-agent-design.md S4.4 #5
 * Creates a content plan with sections, returns content_id.
 */
import type {
  PlanContentInput,
  PlanContentOutput,
} from '@/types/mcp-tools';
import type { ContentFormat } from '@/types/database';
import { withTransaction } from '../../db';
import { McpValidationError, McpDbError } from '../../errors';

const VALID_FORMATS: ContentFormat[] = ['short_video', 'text_post', 'image_post'];

/**
 * Generate content_id in format: CNT_{YYYYMM}_{seq4}
 */
function generateContentId(): string {
  const now = new Date();
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const seq = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  return `CNT_${ym}_${seq}`;
}

export async function planContent(
  input: PlanContentInput,
): Promise<PlanContentOutput> {
  if (!VALID_FORMATS.includes(input.content_format)) {
    throw new McpValidationError(
      `Invalid content_format: "${input.content_format}". Must be one of: ${VALID_FORMATS.join(', ')}`,
    );
  }

  const contentId = generateContentId();

  try {
    await withTransaction(async (client) => {
      // Insert content record
      await client.query(
        `
        INSERT INTO content (content_id, hypothesis_id, character_id, script_language, content_format, status)
        VALUES ($1, $2, $3, $4, $5, 'planned')
        `,
        [contentId, input.hypothesis_id, input.character_id, input.script_language, input.content_format],
      );

      // Insert content_sections
      for (let i = 0; i < input.sections.length; i++) {
        const section = input.sections[i];
        if (!section) continue;
        await client.query(
          `
          INSERT INTO content_sections (content_id, section_label, component_id, section_order)
          VALUES ($1, $2, $3, $4)
          `,
          [contentId, section.section_label, section.component_id, i + 1],
        );
      }
    });

    return { content_id: contentId };
  } catch (err) {
    if (err instanceof McpValidationError) throw err;
    throw new McpDbError('Failed to create content plan', err);
  }
}
