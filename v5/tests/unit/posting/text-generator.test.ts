/**
 * Tests for FEAT-TP-004: Text generator
 */
import {
  getCharacterLimit,
  estimateReadTime,
  buildTextPrompt,
  PLATFORM_TEXT_LIMITS,
} from '@/src/workers/posting/text-generator';

describe('TP-004: Text generator', () => {
  test('YouTube has 5000 char limit', () => {
    expect(getCharacterLimit('youtube')).toBe(5000);
  });

  test('X has 280 char limit', () => {
    expect(getCharacterLimit('x')).toBe(280);
  });

  test('TikTok has 2200 char limit', () => {
    expect(getCharacterLimit('tiktok')).toBe(2200);
  });

  test('Instagram has 2200 char limit', () => {
    expect(getCharacterLimit('instagram')).toBe(2200);
  });

  test('all platforms have limits defined', () => {
    expect(Object.keys(PLATFORM_TEXT_LIMITS).sort()).toEqual(
      ['instagram', 'tiktok', 'x', 'youtube'],
    );
  });

  test('estimateReadTime returns positive value for English', () => {
    const time = estimateReadTime('This is a test sentence with several words.', 'en');
    expect(time).toBeGreaterThan(0);
  });

  test('estimateReadTime returns positive value for Japanese', () => {
    const time = estimateReadTime('これはテストです。日本語のテキストです。', 'jp');
    expect(time).toBeGreaterThan(0);
  });

  test('buildTextPrompt includes character name', () => {
    const prompt = buildTextPrompt({
      contentId: 'CNT_001',
      characterName: 'Yuki',
      characterPersonality: { traits: ['friendly'], speaking_style: 'warm' },
      scenarioData: { topic: 'beauty' },
      scriptLanguage: 'jp',
      platform: 'instagram',
    });
    expect(prompt).toContain('Yuki');
    expect(prompt).toContain('instagram');
    expect(prompt).toContain('Japanese');
  });

  test('buildTextPrompt includes platform limit', () => {
    const prompt = buildTextPrompt({
      contentId: 'CNT_001',
      characterName: 'Emma',
      characterPersonality: {},
      scenarioData: {},
      scriptLanguage: 'en',
      platform: 'x',
    });
    expect(prompt).toContain('280');
  });
});
