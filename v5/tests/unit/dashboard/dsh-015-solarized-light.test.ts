/**
 * TEST-DSH-020: Solarized Light テーマ — 切替確認
 * TEST-DSH-054-057: Light theme variants
 */
import * as fs from 'fs';
import * as path from 'path';

describe('FEAT-DSH-015: Solarized Light theme + toggle', () => {
  let cssContent: string;

  beforeAll(() => {
    cssContent = fs.readFileSync(
      path.join(__dirname, '../../../dashboard/app/globals.css'),
      'utf-8'
    );
  });

  // TEST-DSH-020: Light theme variables
  test('TEST-DSH-020: defines Solarized Light CSS variables', () => {
    // Light theme should be defined
    const lightMatch = cssContent.match(/\[data-theme="light"\]\s*\{([^}]+)\}/);
    expect(lightMatch).not.toBeNull();
    const lightBlock = lightMatch![1];

    expect(lightBlock).toContain('--bg: #fdf6e3');     // base3
    expect(lightBlock).toContain('--fg: #586e75');     // base01 — higher contrast
    expect(lightBlock).toContain('--sidebar-bg: #eee8d5'); // base2
  });

  test('light and dark themes have different bg/fg values', () => {
    const rootMatch = cssContent.match(/:root\s*\{([^}]+)\}/);
    const lightMatch = cssContent.match(/\[data-theme="light"\]\s*\{([^}]+)\}/);

    expect(rootMatch).not.toBeNull();
    expect(lightMatch).not.toBeNull();

    // Dark bg = #002b36, Light bg = #fdf6e3
    expect(rootMatch![1]).toContain('--bg: #002b36');
    expect(lightMatch![1]).toContain('--bg: #fdf6e3');

    // Dark fg = #93a1a1 (base1), Light fg = #586e75 (base01) — high contrast
    expect(rootMatch![1]).toContain('--fg: #93a1a1');
    expect(lightMatch![1]).toContain('--fg: #586e75');
  });

  test('accent colors are consistent between themes', () => {
    const rootMatch = cssContent.match(/:root\s*\{([^}]+)\}/);
    const lightMatch = cssContent.match(/\[data-theme="light"\]\s*\{([^}]+)\}/);

    // Accent colors should be the same in both themes
    expect(rootMatch![1]).toContain('--accent-blue: #268bd2');
    expect(lightMatch![1]).toContain('--accent-blue: #268bd2');
    expect(rootMatch![1]).toContain('--accent-cyan: #2aa198');
    expect(lightMatch![1]).toContain('--accent-cyan: #2aa198');
  });
});
