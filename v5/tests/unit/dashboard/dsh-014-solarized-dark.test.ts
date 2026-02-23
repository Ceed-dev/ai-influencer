/**
 * TEST-DSH-019: Solarized Dark テーマ — CSS変数確認
 * TEST-DSH-058: Dark テーマ CSS変数 全値検証
 * TEST-DSH-059: サイドバー色 テーマ別検証
 */
import * as fs from 'fs';
import * as path from 'path';

describe('FEAT-DSH-014: Solarized Dark theme CSS variables', () => {
  let cssContent: string;

  beforeAll(() => {
    cssContent = fs.readFileSync(
      path.join(__dirname, '../../../dashboard/app/globals.css'),
      'utf-8'
    );
  });

  // TEST-DSH-019: Dark theme CSS variables
  test('TEST-DSH-019: defines Solarized Dark CSS variables', () => {
    // Check all required dark theme values
    expect(cssContent).toContain('--bg: #002b36');
    expect(cssContent).toContain('--fg: #839496');
    expect(cssContent).toContain('--sidebar-bg: #073642');
    expect(cssContent).toContain('--accent-blue: #268bd2');
    expect(cssContent).toContain('--accent-cyan: #2aa198');
    expect(cssContent).toContain('--warning: #b58900');
    expect(cssContent).toContain('--error: #dc322f');
    expect(cssContent).toContain('--success: #859900');
  });

  // TEST-DSH-058: All dark theme values
  test('TEST-DSH-058: all dark theme CSS values present in :root', () => {
    // Extract :root block
    const rootMatch = cssContent.match(/:root\s*\{([^}]+)\}/);
    expect(rootMatch).not.toBeNull();
    const rootBlock = rootMatch![1];

    expect(rootBlock).toContain('#002b36'); // base03 - bg
    expect(rootBlock).toContain('#839496'); // base0 - fg
    expect(rootBlock).toContain('#073642'); // base02 - sidebar
    expect(rootBlock).toContain('#268bd2'); // blue - accent
    expect(rootBlock).toContain('#2aa198'); // cyan - accent
    expect(rootBlock).toContain('#b58900'); // yellow - warning
    expect(rootBlock).toContain('#dc322f'); // red - error
    expect(rootBlock).toContain('#859900'); // green - success
  });

  // TEST-DSH-059: Sidebar color per theme
  test('TEST-DSH-059: sidebar-bg uses base02 for dark theme', () => {
    const rootMatch = cssContent.match(/:root\s*\{([^}]+)\}/);
    expect(rootMatch).not.toBeNull();
    expect(rootMatch![1]).toContain('--sidebar-bg: #073642');
  });
});
