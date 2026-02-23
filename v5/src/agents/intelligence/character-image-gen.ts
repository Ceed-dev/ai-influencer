/**
 * FEAT-INT-020: Character image generation/selection
 * Spec: 04-agent-design.md §4.10 (#8), 02-architecture.md §8
 *
 * Generates or selects a character image using fal.ai image generation.
 * Placeholder implementation — actual fal.ai API integration later.
 * All config from DB system_settings — no hardcoding.
 */
import type { PoolClient } from 'pg';

/** Image generation style */
export type ImageStyle = 'anime' | 'realistic' | '3d';

/** Input for character image generation */
export interface CharacterImageInput {
  characterId: string;
  appearanceDescription: string;
  style?: ImageStyle;
}

/** Result of character image generation */
export interface CharacterImageResult {
  characterId: string;
  imageDriveId: string;
  imageUrl: string;
  style: ImageStyle;
  generatedAt: string;
}

/**
 * Build an image generation prompt from appearance description and style.
 */
export function buildImagePrompt(
  appearanceDescription: string,
  style: ImageStyle = 'realistic',
): string {
  const stylePrompts: Record<ImageStyle, string> = {
    anime: 'anime style, high quality illustration, vibrant colors',
    realistic: 'photorealistic, high resolution, professional portrait',
    '3d': '3D rendered character, high quality, Pixar style',
  };

  return `${appearanceDescription}, ${stylePrompts[style]}, social media influencer, centered portrait`;
}

/**
 * Generate a character image (placeholder).
 *
 * In production, this would:
 * 1. Call fal.ai image generation API
 * 2. Upload result to Google Drive
 * 3. Update characters.image_drive_id
 *
 * Currently returns a placeholder result.
 */
export async function generateCharacterImage(
  client: PoolClient,
  input: CharacterImageInput,
): Promise<CharacterImageResult> {
  const style = input.style ?? 'realistic';
  const _prompt = buildImagePrompt(input.appearanceDescription, style);

  // Placeholder: in production, call fal.ai and upload to Drive
  const placeholderDriveId = `placeholder_${input.characterId}_${Date.now()}`;
  const placeholderUrl = `https://drive.google.com/file/d/${placeholderDriveId}`;

  // Update character with image reference
  await client.query(
    `UPDATE characters
     SET image_drive_id = $1, updated_at = NOW()
     WHERE character_id = $2`,
    [placeholderDriveId, input.characterId],
  );

  return {
    characterId: input.characterId,
    imageDriveId: placeholderDriveId,
    imageUrl: placeholderUrl,
    style,
    generatedAt: new Date().toISOString(),
  };
}
