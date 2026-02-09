/**
 * Migration - v1 to v2 data migration
 * Run migrateV1toV2() from the Apps Script editor
 */

/**
 * Migrate v1 data to v2 structure
 * - Renames videos_master → master with new columns
 * - Removes scenario_cuts sheet (replaced by component system)
 * - Preserves existing metrics data
 */
function migrateV1toV2() {
  var ui = SpreadsheetApp.getUi();
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var confirm = ui.alert('v1 → v2 マイグレーション',
    'Video Analytics Hub v1 のデータを v2 形式に移行します。\n\n' +
    '以下の変更が行われます:\n' +
    '- videos_master → master にリネーム（新カラム追加）\n' +
    '- scenario_cuts は保持（参照用）\n' +
    '- メトリクスデータはそのまま保持\n' +
    '- 既存の video_uid は引き継ぎ\n\n' +
    '続行しますか？',
    ui.ButtonSet.YES_NO);

  if (confirm !== ui.Button.YES) return;

  try {
    var results = [];

    // Step 1: Migrate videos_master to master
    results.push(migrateMasterSheet_(ss));

    // Step 2: Update recommendations schema
    results.push(migrateRecommendationsSheet_(ss));

    // Step 3: Ensure new sheets exist
    results.push(ensureNewSheets_(ss));

    // Step 4: Update Config properties
    var props = PropertiesService.getScriptProperties();
    props.setProperty('MIGRATION_V2_COMPLETED', new Date().toISOString());

    ui.alert('マイグレーション完了',
      results.join('\n') + '\n\n' +
      '次のステップ: setupCompleteSystem() を実行して\n' +
      'Drive フォルダとインベントリを作成してください。',
      ui.ButtonSet.OK);

  } catch (e) {
    Logger.log('Migration error: ' + e.message + '\n' + e.stack);
    ui.alert('マイグレーションエラー', e.message, ui.ButtonSet.OK);
  }
}

/**
 * Migrate videos_master sheet to new master format
 * @private
 */
function migrateMasterSheet_(ss) {
  var oldSheet = ss.getSheetByName('videos_master');
  if (!oldSheet) {
    return '⏭ videos_master が見つかりません（スキップ）';
  }

  // Check if already migrated
  var newSheet = ss.getSheetByName(CONFIG.SHEETS.MASTER);
  if (newSheet) {
    return '✅ master シートは既に存在します（スキップ）';
  }

  // Read old data
  var oldData = oldSheet.getDataRange().getValues();
  var oldHeaders = oldData[0];

  // Create new master sheet
  newSheet = ss.insertSheet(CONFIG.SHEETS.MASTER);
  var newHeaders = CONFIG.MASTER_ALL_COLUMNS;
  newSheet.getRange(1, 1, 1, newHeaders.length).setValues([newHeaders]);
  newSheet.setFrozenRows(1);

  // Format header
  newSheet.getRange(1, 1, 1, newHeaders.length)
    .setBackground(CONFIG.COLORS.HEADER)
    .setFontColor(CONFIG.COLORS.HEADER_FONT)
    .setFontWeight('bold');

  // Map old data to new format
  var migratedCount = 0;
  for (var i = 1; i < oldData.length; i++) {
    var oldRow = {};
    oldHeaders.forEach(function(h, idx) {
      oldRow[h] = oldData[i][idx];
    });

    // Map old columns to new columns
    var newRow = newHeaders.map(function(h) {
      // Direct mappings
      if (h === 'video_uid') return oldRow['video_uid'] || '';
      if (h === 'title') return oldRow['title'] || '';
      if (h === 'status') return 'analyzed'; // Existing videos were already analyzed
      if (h === 'created_date') return oldRow['created_date'] || '';
      if (h === 'youtube_id') return oldRow['youtube_id'] || '';
      if (h === 'tiktok_id') return oldRow['tiktok_id'] || '';
      if (h === 'instagram_id') return oldRow['instagram_id'] || '';
      if (h === 'human_approved') return true; // Existing videos are implicitly approved
      return '';
    });

    newSheet.appendRow(newRow);
    migratedCount++;
  }

  return '✅ ' + migratedCount + ' 動画を master シートに移行しました';
}

/**
 * Migrate recommendations sheet to new schema
 * @private
 */
function migrateRecommendationsSheet_(ss) {
  var sheet = ss.getSheetByName('recommendations');
  if (!sheet) return '⏭ recommendations が見つかりません（スキップ）';

  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  // Add video_uid column if missing
  if (headers.indexOf('video_uid') === -1) {
    sheet.insertColumnBefore(1);
    sheet.getRange(1, 1).setValue('video_uid')
      .setBackground(CONFIG.COLORS.HEADER)
      .setFontColor(CONFIG.COLORS.HEADER_FONT)
      .setFontWeight('bold');

    // Fill with 'all' for existing recommendations
    if (sheet.getLastRow() > 1) {
      var range = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1);
      var values = [];
      for (var i = 0; i < sheet.getLastRow() - 1; i++) {
        values.push(['all']);
      }
      range.setValues(values);
    }
  }

  // Re-read headers
  headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  // Add compared_to_previous column if missing
  if (headers.indexOf('compared_to_previous') === -1) {
    var nextCol = sheet.getLastColumn() + 1;
    sheet.getRange(1, nextCol).setValue('compared_to_previous')
      .setBackground(CONFIG.COLORS.HEADER)
      .setFontColor(CONFIG.COLORS.HEADER_FONT)
      .setFontWeight('bold');
  }

  return '✅ recommendations シートのスキーマを更新しました';
}

/**
 * Ensure new v2 sheets exist
 * @private
 */
function ensureNewSheets_(ss) {
  var created = [];

  // video_analysis sheet
  if (!ss.getSheetByName(CONFIG.SHEETS.VIDEO_ANALYSIS)) {
    var vaSheet = ss.insertSheet(CONFIG.SHEETS.VIDEO_ANALYSIS);
    var vaHeaders = [
      'video_uid', 'analyzed_at', 'youtube_performance', 'tiktok_performance',
      'instagram_performance', 'cross_platform_insights', 'kpi_achievement',
      'improvements_from_previous', 'prompt_effectiveness', 'recommendations'
    ];
    vaSheet.getRange(1, 1, 1, vaHeaders.length).setValues([vaHeaders]);
    vaSheet.setFrozenRows(1);
    vaSheet.getRange(1, 1, 1, vaHeaders.length)
      .setBackground(CONFIG.COLORS.HEADER)
      .setFontColor(CONFIG.COLORS.HEADER_FONT)
      .setFontWeight('bold');
    created.push('video_analysis');
  }

  if (created.length > 0) {
    return '✅ 新規シートを作成: ' + created.join(', ');
  }
  return '✅ 全ての必要なシートが既に存在します';
}

/**
 * Check migration status
 */
function checkMigrationStatus() {
  var props = PropertiesService.getScriptProperties();
  var migrated = props.getProperty('MIGRATION_V2_COMPLETED');
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();

  var status = 'マイグレーション状態:\n\n';

  if (migrated) {
    status += '✅ v2 マイグレーション完了: ' + migrated + '\n';
  } else {
    status += '❌ v2 マイグレーション未実施\n';
  }

  // Check sheets
  var requiredSheets = Object.values(CONFIG.SHEETS);
  requiredSheets.forEach(function(name) {
    var sheet = ss.getSheetByName(name);
    status += (sheet ? '✅' : '❌') + ' ' + name + '\n';
  });

  // Check inventory IDs
  var inventoryTypes = ['SCENARIOS', 'MOTIONS', 'CHARACTERS', 'AUDIO'];
  inventoryTypes.forEach(function(type) {
    var id = props.getProperty(CONFIG.PROP_KEYS[type + '_INVENTORY_ID']);
    status += (id ? '✅' : '❌') + ' ' + type + ' Inventory\n';
  });

  ui.alert('マイグレーション状態', status, ui.ButtonSet.OK);
}
