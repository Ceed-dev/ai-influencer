/**
 * TEST-DSH-021: フォント — Nunito 使用確認
 * TEST-DSH-060: Nunito フォント適用確認
 */
import * as fs from 'fs';
import * as path from 'path';

describe('FEAT-DSH-016: Nunito font usage', () => {
  let cssContent: string;
  let tailwindConfig: string;

  beforeAll(() => {
    cssContent = fs.readFileSync(
      path.join(__dirname, '../../../dashboard/app/globals.css'),
      'utf-8'
    );
    tailwindConfig = fs.readFileSync(
      path.join(__dirname, '../../../dashboard/tailwind.config.ts'),
      'utf-8'
    );
  });

  // TEST-DSH-021: Nunito font is loaded
  test('TEST-DSH-021: Google Fonts Nunito is imported', () => {
    expect(cssContent).toContain('Nunito');
    expect(cssContent).toMatch(/fonts\.googleapis\.com.*Nunito/);
  });

  // TEST-DSH-060: Nunito applied to body
  test('TEST-DSH-060: body uses Nunito font-family', () => {
    expect(cssContent).toMatch(/body\s*\{[^}]*font-family:\s*["']?Nunito/);
  });

  test('Tailwind config defines Nunito as sans font', () => {
    expect(tailwindConfig).toContain('Nunito');
    expect(tailwindConfig).toContain('sans');
  });

  test('JetBrains Mono is configured for monospace', () => {
    // CSS imports via Google Fonts URL (uses + for spaces)
    expect(cssContent).toContain('JetBrains+Mono');
    // Tailwind config uses normal name
    expect(tailwindConfig).toContain('JetBrains Mono');
    expect(tailwindConfig).toContain('mono');
  });

  test('body font-size is 14px as specified', () => {
    expect(cssContent).toMatch(/body\s*\{[^}]*font-size:\s*14px/);
  });
});
