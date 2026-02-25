/**
 * MCI-021: generate_character_image
 * Spec: 04-agent-design.md S4.10 #8
 * Generates character image using fal.ai, uploads to Google Drive.
 * Falls back to placeholder when API keys are not configured.
 */
import type {
  GenerateCharacterImageInput,
  GenerateCharacterImageOutput,
} from '@/types/mcp-tools';
import { getPool } from '../../db';
import { McpValidationError, McpNotFoundError } from '../../errors';
import { getSettingString } from '../../../lib/settings.js';
import { fal } from '@fal-ai/client';
import { uploadToDrive } from '../production/upload-to-drive.js';

const VALID_STYLES = ['anime', 'realistic', '3d'] as const;

/** Build a prompt for image generation based on appearance and style */
function buildImagePrompt(
  appearanceDescription: string,
  style: 'anime' | 'realistic' | '3d',
): string {
  const stylePrompts: Record<string, string> = {
    anime: 'anime style, high quality illustration, vibrant colors',
    realistic: 'photorealistic, high resolution, professional portrait',
    '3d': '3D rendered character, high quality, Pixar style',
  };

  return `${appearanceDescription}, ${stylePrompts[style]}, social media influencer, centered portrait`;
}

export async function generateCharacterImage(
  input: GenerateCharacterImageInput,
): Promise<GenerateCharacterImageOutput> {
  if (!input.character_id || input.character_id.trim().length === 0) {
    throw new McpValidationError('character_id is required');
  }
  if (!input.appearance_description || input.appearance_description.trim().length === 0) {
    throw new McpValidationError('appearance_description is required');
  }
  if (input.style && !VALID_STYLES.includes(input.style)) {
    throw new McpValidationError(
      `Invalid style: "${input.style}". Must be one of: ${VALID_STYLES.join(', ')}`,
    );
  }

  const pool = getPool();

  // Verify character exists
  const charRes = await pool.query(
    `SELECT id FROM characters WHERE character_id = $1`,
    [input.character_id],
  );
  if (charRes.rowCount === 0) {
    throw new McpNotFoundError(`Character "${input.character_id}" not found`);
  }

  const style = input.style ?? 'anime';

  // Try real fal.ai generation
  try {
    const falApiKey = await getSettingString('CRED_FAL_AI_API_KEY');
    if (falApiKey && falApiKey.trim() !== '') {
      fal.config({ credentials: falApiKey });

      const prompt = buildImagePrompt(input.appearance_description, style);

      const result = await fal.subscribe('fal-ai/flux-pro/v1.1', {
        input: {
          prompt,
          image_size: 'portrait_4_3',
          num_images: 1,
        },
      });

      const resultData = result.data as Record<string, unknown>;
      const images = resultData['images'] as Array<Record<string, unknown>> | undefined;
      const imageUrl = images?.[0]?.['url'] as string | undefined;

      if (!imageUrl) {
        throw new Error('fal.ai returned no image URL');
      }

      // Upload to Google Drive
      let driveFileId: string;
      let driveUrl: string;
      try {
        const driveFolder = await getSettingString('DRIVE_CHARACTERS_FOLDER_ID').catch(() => '1KRQuZ4W7u5CXRamjvN4xmavfu-7TPb0X');
        const uploadResult = await uploadToDrive({
          file_url: imageUrl,
          folder_id: driveFolder,
          filename: `${input.character_id}_${style}_${Date.now()}.png`,
        });
        driveFileId = uploadResult.drive_file_id;
        driveUrl = uploadResult.drive_url;
      } catch (uploadErr) {
        // Drive upload failed, use the fal.ai URL directly
        console.warn('[generate_character_image] Drive upload failed, using fal.ai URL:', uploadErr instanceof Error ? uploadErr.message : String(uploadErr));
        driveFileId = `fal_${input.character_id}_${Date.now()}`;
        driveUrl = imageUrl;
      }

      // Update character record
      await pool.query(
        `UPDATE characters
         SET appearance = $1,
             image_drive_id = $2,
             generation_metadata = $3
         WHERE character_id = $4`,
        [
          JSON.stringify({
            description: input.appearance_description,
            style,
          }),
          driveFileId,
          JSON.stringify({
            generator: 'fal.ai',
            model: 'flux-pro/v1.1',
            style,
            placeholder: false,
            generated_at: new Date().toISOString(),
            source_url: imageUrl,
          }),
          input.character_id,
        ],
      );

      return {
        image_drive_id: driveFileId,
        image_url: driveUrl,
      };
    }
  } catch (err) {
    console.warn(
      '[generate_character_image] fal.ai generation failed, using placeholder:',
      err instanceof Error ? err.message : String(err),
    );
  }

  // Placeholder response when API key not configured or generation failed
  const placeholderDriveId = `img_${input.character_id}_${Date.now()}`;
  const placeholderUrl = `https://placeholder.fal.ai/images/${placeholderDriveId}.png`;

  await pool.query(
    `UPDATE characters
     SET appearance = $1,
         image_drive_id = $2,
         generation_metadata = $3
     WHERE character_id = $4`,
    [
      JSON.stringify({
        description: input.appearance_description,
        style,
      }),
      placeholderDriveId,
      JSON.stringify({
        generator: 'fal.ai',
        style,
        placeholder: true,
        generated_at: new Date().toISOString(),
      }),
      input.character_id,
    ],
  );

  return {
    image_drive_id: placeholderDriveId,
    image_url: placeholderUrl,
  };
}
