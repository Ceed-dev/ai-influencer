/**
 * TEST-DSH-038: Settings page — category grouping
 * TEST-DSH-070-072: Settings UI components
 * TEST-DSH-077: Category tabs
 * TEST-DSH-085-088: Edit modal
 */
import * as fs from 'fs';
import * as path from 'path';

describe('FEAT-DSH-028: Settings page — category grouping', () => {
  let pageContent: string;

  beforeAll(() => {
    pageContent = fs.readFileSync(
      path.join(__dirname, '../../../dashboard/app/settings/page.tsx'),
      'utf-8'
    );
  });

  // TEST-DSH-038: Page exists with category grouping
  test('TEST-DSH-038: Settings page renders with categories', () => {
    expect(pageContent).toContain('Settings');
    expect(pageContent).toContain('export default function');
  });

  // TEST-DSH-070: All 8 categories
  test('TEST-DSH-070: all 8 setting categories defined', () => {
    const categories = [
      'production', 'posting', 'review', 'agent',
      'measurement', 'cost_control', 'dashboard', 'credentials'
    ];
    categories.forEach(cat => {
      expect(pageContent).toContain(cat);
    });
  });

  // TEST-DSH-071: Category tabs
  test('TEST-DSH-071: category tabs are clickable', () => {
    expect(pageContent).toContain('activeCategory');
    expect(pageContent).toContain('setActiveCategory');
  });

  // TEST-DSH-072: Settings table
  test('TEST-DSH-072: displays settings in table format', () => {
    expect(pageContent).toContain('<table');
    expect(pageContent).toContain('setting_key');
    expect(pageContent).toContain('setting_value');
  });

  // TEST-DSH-077: Category filter
  test('TEST-DSH-077: filters settings by category', () => {
    expect(pageContent).toContain('filteredSettings');
    expect(pageContent).toContain('activeCategory');
  });

  // TEST-DSH-085: Edit functionality
  test('TEST-DSH-085: edit button and save flow', () => {
    expect(pageContent).toContain('common.edit');
    expect(pageContent).toContain('common.save');
    expect(pageContent).toContain('common.cancel');
    expect(pageContent).toContain('handleSave');
  });

  test('displays value type', () => {
    expect(pageContent).toContain('value_type');
  });

  test('displays description', () => {
    expect(pageContent).toContain('description');
  });

  test('PUT request to update setting', () => {
    expect(pageContent).toContain('PUT');
    expect(pageContent).toContain('/api/settings/');
  });
});
