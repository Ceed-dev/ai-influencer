/**
 * Setup utilities for Video Analytics Hub
 * Run these functions from Apps Script editor
 */

/**
 * Complete setup: move to folder, delete old, initialize sheets
 */
function completeSetup() {
  var ui = SpreadsheetApp.getUi();

  // Step 1: Get folder ID from user
  var folderResult = ui.prompt(
    'Step 1: Enter Folder ID',
    'Enter the AI-Influencer folder ID (from the URL after /folders/):\n\nExample: If URL is drive.google.com/drive/folders/ABC123\nEnter: ABC123',
    ui.ButtonSet.OK_CANCEL
  );

  if (folderResult.getSelectedButton() !== ui.Button.OK) return;

  var folderId = folderResult.getResponseText().trim();

  try {
    // Move to folder
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var file = DriveApp.getFileById(ss.getId());
    var targetFolder = DriveApp.getFolderById(folderId);
    file.moveTo(targetFolder);
    Logger.log('Moved to: ' + targetFolder.getName());

    // Step 2: Ask about deleting old spreadsheet
    var deleteResult = ui.alert(
      'Step 2: Delete Old Spreadsheet?',
      'Do you want to delete the old Video_Analytics_Hub spreadsheet?\n(ID: 1qf4hcwBbMwnCe_wZ7ggfHcNwmne8Ms2ghTvhMivvANc)',
      ui.ButtonSet.YES_NO
    );

    if (deleteResult === ui.Button.YES) {
      try {
        var oldFile = DriveApp.getFileById('1qf4hcwBbMwnCe_wZ7ggfHcNwmne8Ms2ghTvhMivvANc');
        oldFile.setTrashed(true);
        Logger.log('Old spreadsheet trashed');
      } catch (e) {
        Logger.log('Could not delete old file: ' + e.message);
      }
    }

    // Step 3: Initialize sheets
    setupVideoAnalyticsHub();

    ui.alert(
      'Setup Complete!',
      'Video Analytics Hub is ready!\n\n' +
      'Moved to AI-Influencer folder\n' +
      'All sheets created\n' +
      'Default KPIs set\n\n' +
      'Next: Set your OpenAI API Key in Script Properties',
      ui.ButtonSet.OK
    );

  } catch (e) {
    ui.alert('Setup Error', e.message, ui.ButtonSet.OK);
  }
}

/**
 * Move this spreadsheet to a specific folder (manual version)
 */
function moveToAIInfluencerFolder() {
  var ui = SpreadsheetApp.getUi();
  var result = ui.prompt(
    'Enter Folder ID',
    'Paste the folder ID from the AI-Influencer folder URL:',
    ui.ButtonSet.OK_CANCEL
  );

  if (result.getSelectedButton() === ui.Button.OK) {
    var folderId = result.getResponseText().trim();
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var file = DriveApp.getFileById(ss.getId());
    var targetFolder = DriveApp.getFolderById(folderId);
    file.moveTo(targetFolder);
    ui.alert('Success', 'Moved to folder: ' + targetFolder.getName(), ui.ButtonSet.OK);
  }
}

/**
 * Delete the old spreadsheet
 */
function deleteOldSpreadsheet() {
  var ui = SpreadsheetApp.getUi();
  var oldId = '1qf4hcwBbMwnCe_wZ7ggfHcNwmne8Ms2ghTvhMivvANc';

  try {
    var file = DriveApp.getFileById(oldId);
    file.setTrashed(true);
    ui.alert('Success', 'Old spreadsheet moved to trash', ui.ButtonSet.OK);
  } catch (e) {
    ui.alert('Error', e.message, ui.ButtonSet.OK);
  }
}

/**
 * Test external API access - Run this to grant UrlFetchApp permission
 */
function testExternalAccess() {
  // Simple fetch to test permission
  var response = UrlFetchApp.fetch('https://httpbin.org/get');
  Logger.log('External access test: ' + response.getResponseCode());

  var ui = SpreadsheetApp.getUi();
  ui.alert('Success', 'External API access is now authorized!\n\nYou can now run "Analyze All Videos".', ui.ButtonSet.OK);
}

/**
 * Create README sheet with system overview
 * Adds protection so only owner can edit
 */
function createReadmeSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetName = '📖 README';

  // Delete if exists
  var existing = ss.getSheetByName(sheetName);
  if (existing) {
    ss.deleteSheet(existing);
  }

  // Create new sheet
  var sheet = ss.insertSheet(sheetName, 0);

  // Set column widths
  sheet.setColumnWidth(1, 600);

  // Content
  var content = [
    ['📊 Video Analytics Hub - システム概要'],
    [''],
    ['■ 目的'],
    ['YouTube Shorts / TikTok / Instagram Reels の動画パフォーマンスを一元管理し、'],
    ['AIで分析して次の動画制作への改善提案を自動生成するシステム。'],
    [''],
    ['■ シート構成（9タブ）'],
    [''],
    ['シート名              | 役割                                    | 人間が操作？'],
    ['─────────────────────────────────────────────────────────────────────────'],
    ['videos_master        | 動画のマスターデータ（IDの紐付け）        | ✅ 登録・編集'],
    ['metrics_youtube      | YouTubeのパフォーマンスデータ            | ❌ 閲覧のみ'],
    ['metrics_tiktok       | TikTokのパフォーマンスデータ             | ❌ 閲覧のみ'],
    ['metrics_instagram    | Instagramのパフォーマンスデータ          | ❌ 閲覧のみ'],
    ['kpi_targets          | KPI目標値（完走率50%等）                 | ✅ 目標値を調整'],
    ['scenario_cuts        | 動画のカット情報（将来用）               | 🔸 任意'],
    ['analysis_reports     | AI分析レポート（自動生成）               | ❌ 閲覧のみ'],
    ['recommendations      | 改善提案（自動生成）                     | ✅ 承認/却下'],
    ['unlinked_imports     | 紐付けできなかったインポートデータ       | ✅ 確認・対応'],
    [''],
    ['■ データフロー'],
    [''],
    ['1. CSVをインポート（YouTube/TikTok/Instagram）'],
    ['   ↓'],
    ['2. videos_master と照合'],
    ['   ├── 一致 → metrics_xxx シートに保存'],
    ['   └── 不一致 → unlinked_imports に保存（要対応）'],
    ['   ↓'],
    ['3. 「分析実行」→ KPI目標と比較 → OpenAIで分析'],
    ['   ↓'],
    ['4. analysis_reports に結果保存'],
    ['   ↓'],
    ['5. recommendations に改善提案を出力'],
    ['   ↓'],
    ['6. 人間が確認・承認 → 次の動画制作に活用'],
    [''],
    ['■ 人間がやること'],
    [''],
    ['【初期設定（1回だけ）】'],
    ['1. videos_master に動画を登録'],
    ['   - video_uid: 内部管理ID（例: VID_001）'],
    ['   - youtube_id: YouTubeの動画ID'],
    ['   - tiktok_id: TikTokの動画ID'],
    ['   - instagram_id: InstagramのリールID'],
    [''],
    ['2. kpi_targets で目標値を調整（任意）'],
    [''],
    ['【日常運用】'],
    ['1. CSV インポート（メニューから or n8n自動）'],
    ['2. unlinked_imports を確認'],
    ['   - 紐付けできなかったデータがあれば対応'],
    ['   - videos_master にIDを追加するか、手動でリンク'],
    ['3. 分析を実行（メニューから or n8n自動）'],
    ['4. recommendations を確認'],
    ['   - 改善提案を読んで、使えるか判断'],
    ['   - status 列で「承認」「却下」「保留」をマーク'],
    [''],
    ['■ メニューの使い方'],
    [''],
    ['上部メニュー「📊 Video Analytics」から以下の操作が可能：'],
    ['- 📥 Import YouTube CSV: YouTube StudioからエクスポートしたCSVをインポート'],
    ['- 📥 Import TikTok CSV: TikTokからエクスポートしたCSVをインポート'],
    ['- 📥 Import Instagram CSV: InstagramからエクスポートしたCSVをインポート'],
    ['- 🔍 Analyze All Videos: 全動画のAI分析を実行'],
    ['- 📋 Check Status: 現在の状態を確認'],
    [''],
    ['■ 注意事項'],
    [''],
    ['- このシートは編集しないでください（オーナーのみ編集可能）'],
    ['- データシートは直接編集せず、必ずメニューから操作してください'],
    ['- 問題が発生した場合はオーナーに連絡してください'],
  ];

  // Write content
  sheet.getRange(1, 1, content.length, 1).setValues(content);

  // Format title
  sheet.getRange(1, 1).setFontSize(18).setFontWeight('bold').setBackground('#4285f4').setFontColor('#ffffff');

  // Format section headers
  var sectionRows = [3, 7, 21, 35, 53, 62];
  sectionRows.forEach(function(row) {
    sheet.getRange(row, 1).setFontSize(12).setFontWeight('bold').setBackground('#e8f0fe');
  });

  // Format table header
  sheet.getRange(9, 1).setFontFamily('Courier New').setBackground('#f1f3f4');
  sheet.getRange(10, 1).setFontFamily('Courier New').setBackground('#f1f3f4');

  // Format table rows
  for (var i = 11; i <= 19; i++) {
    sheet.getRange(i, 1).setFontFamily('Courier New');
  }

  // Hide gridlines for cleaner look
  sheet.setHiddenGridlines(true);

  // Protect the sheet (only owner can edit)
  var protection = sheet.protect().setDescription('README - Owner only');

  // Remove all editors except owner
  var me = Session.getEffectiveUser();
  protection.addEditor(me);
  protection.removeEditors(protection.getEditors());
  if (protection.canDomainEdit()) {
    protection.setDomainEdit(false);
  }

  Logger.log('README sheet created and protected');

  var ui = SpreadsheetApp.getUi();
  ui.alert('完了', '📖 README シートを作成し、保護を設定しました。\nオーナーのみ編集可能です。', ui.ButtonSet.OK);
}

/**
 * Upgrade existing sheets to new structure
 * - Add new columns to videos_master
 * - Create video_analysis sheet
 * - Add dropdowns and conditional formatting
 */
function upgradeSheetStructure() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();

  try {
    // 1. Upgrade videos_master
    upgradeVideosMaster(ss);

    // 2. Create video_analysis sheet
    createVideoAnalysisSheet(ss);

    // 3. Upgrade recommendations sheet
    upgradeRecommendationsSheet(ss);

    // 4. Apply formatting to all relevant sheets
    applyDropdownsAndFormatting(ss);

    ui.alert('アップグレード完了',
      '以下の変更を適用しました：\n\n' +
      '✅ videos_master に新カラム追加\n' +
      '   (kpi_target, prompt_doc_1, prompt_doc_2)\n\n' +
      '✅ video_analysis シート作成\n' +
      '   (動画ごとの分析結果)\n\n' +
      '✅ ドロップダウン・条件付き書式適用\n' +
      '   (status, category, priority, platform)\n\n' +
      '✅ 日付フォーマットを日本時間に変更',
      ui.ButtonSet.OK);

  } catch (e) {
    ui.alert('エラー', e.message, ui.ButtonSet.OK);
    Logger.log('Upgrade error: ' + e.message);
  }
}

/**
 * Upgrade videos_master with new columns
 */
function upgradeVideosMaster(ss) {
  var sheet = ss.getSheetByName('videos_master');
  if (!sheet) {
    throw new Error('videos_master sheet not found');
  }

  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var newColumns = ['kpi_target', 'prompt_doc_1', 'prompt_doc_2'];

  newColumns.forEach(function(col) {
    if (headers.indexOf(col) === -1) {
      var nextCol = sheet.getLastColumn() + 1;
      sheet.getRange(1, nextCol).setValue(col);
      sheet.getRange(1, nextCol)
        .setBackground('#4285f4')
        .setFontColor('#ffffff')
        .setFontWeight('bold');
      Logger.log('Added column: ' + col);
    }
  });
}

/**
 * Create video_analysis sheet for per-video analysis
 */
function createVideoAnalysisSheet(ss) {
  var sheetName = 'video_analysis';
  var existing = ss.getSheetByName(sheetName);

  if (existing) {
    Logger.log('video_analysis sheet already exists');
    return;
  }

  var sheet = ss.insertSheet(sheetName);
  var headers = [
    'video_uid',
    'analyzed_at',
    'youtube_performance',
    'tiktok_performance',
    'instagram_performance',
    'cross_platform_insights',
    'kpi_achievement',
    'improvements_from_previous',
    'prompt_effectiveness',
    'recommendations'
  ];

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, headers.length)
    .setBackground('#4285f4')
    .setFontColor('#ffffff')
    .setFontWeight('bold');

  // Set column widths for readability
  sheet.setColumnWidth(1, 100);  // video_uid
  sheet.setColumnWidth(2, 150);  // analyzed_at
  sheet.setColumnWidth(3, 200);  // youtube_performance
  sheet.setColumnWidth(4, 200);  // tiktok_performance
  sheet.setColumnWidth(5, 200);  // instagram_performance
  sheet.setColumnWidth(6, 300);  // cross_platform_insights
  sheet.setColumnWidth(7, 150);  // kpi_achievement
  sheet.setColumnWidth(8, 250);  // improvements_from_previous
  sheet.setColumnWidth(9, 250);  // prompt_effectiveness
  sheet.setColumnWidth(10, 300); // recommendations

  Logger.log('Created video_analysis sheet');
}

/**
 * Upgrade recommendations sheet with new columns
 */
function upgradeRecommendationsSheet(ss) {
  var sheet = ss.getSheetByName('recommendations');
  if (!sheet) {
    throw new Error('recommendations sheet not found');
  }

  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var newColumns = ['video_uid', 'compared_to_previous'];

  // Insert video_uid as first column if not exists
  if (headers.indexOf('video_uid') === -1) {
    sheet.insertColumnBefore(1);
    sheet.getRange(1, 1).setValue('video_uid');
    sheet.getRange(1, 1)
      .setBackground('#4285f4')
      .setFontColor('#ffffff')
      .setFontWeight('bold');
    Logger.log('Added video_uid column to recommendations');
  }

  // Re-read headers after potential insert
  headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  // Add compared_to_previous if not exists
  if (headers.indexOf('compared_to_previous') === -1) {
    var nextCol = sheet.getLastColumn() + 1;
    sheet.getRange(1, nextCol).setValue('compared_to_previous');
    sheet.getRange(1, nextCol)
      .setBackground('#4285f4')
      .setFontColor('#ffffff')
      .setFontWeight('bold');
    Logger.log('Added compared_to_previous column to recommendations');
  }
}

/**
 * Apply dropdowns and conditional formatting
 * Note: setAllowInvalid(true) allows existing data that doesn't match dropdown options
 */
function applyDropdownsAndFormatting(ss) {
  // Recommendations sheet
  var recSheet = ss.getSheetByName('recommendations');
  if (recSheet) {
    var headers = recSheet.getRange(1, 1, 1, recSheet.getLastColumn()).getValues()[0];
    var lastRow = Math.max(recSheet.getLastRow(), 100);

    // Status dropdown
    var statusCol = headers.indexOf('status') + 1;
    if (statusCol > 0) {
      var statusRule = SpreadsheetApp.newDataValidation()
        .requireValueInList(['pending', 'approved', 'rejected', 'in_progress'], true)
        .setAllowInvalid(true)  // Allow invalid to prevent #ERROR on existing data
        .build();
      recSheet.getRange(2, statusCol, lastRow - 1, 1).setDataValidation(statusRule);

      // Conditional formatting for status
      applyStatusConditionalFormatting(recSheet, statusCol, lastRow);
    }

    // Category dropdown
    var categoryCol = headers.indexOf('category') + 1;
    if (categoryCol > 0) {
      var categoryRule = SpreadsheetApp.newDataValidation()
        .requireValueInList(['hook', 'pacing', 'content', 'format', 'platform', 'thumbnail', 'audio', 'other'], true)
        .setAllowInvalid(true)
        .build();
      recSheet.getRange(2, categoryCol, lastRow - 1, 1).setDataValidation(categoryRule);
    }

    // Priority dropdown (1-10 to accommodate various priority values)
    var priorityCol = headers.indexOf('priority') + 1;
    if (priorityCol > 0) {
      var priorityRule = SpreadsheetApp.newDataValidation()
        .requireValueInList(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'], true)
        .setAllowInvalid(true)
        .build();
      recSheet.getRange(2, priorityCol, lastRow - 1, 1).setDataValidation(priorityRule);

      // Conditional formatting for priority
      applyPriorityConditionalFormatting(recSheet, priorityCol, lastRow);
    }

    // Platform dropdown
    var platformCol = headers.indexOf('platform') + 1;
    if (platformCol > 0) {
      var platformRule = SpreadsheetApp.newDataValidation()
        .requireValueInList(['youtube', 'tiktok', 'instagram', 'all'], true)
        .setAllowInvalid(true)
        .build();
      recSheet.getRange(2, platformCol, lastRow - 1, 1).setDataValidation(platformRule);
    }

    // expected_impact: Remove any data validation (should be free text)
    var expectedImpactCol = headers.indexOf('expected_impact') + 1;
    if (expectedImpactCol > 0) {
      recSheet.getRange(2, expectedImpactCol, lastRow - 1, 1).clearDataValidations();
      Logger.log('Cleared data validation from expected_impact column');
    }

    Logger.log('Applied dropdowns to recommendations sheet');
  }

  // Video analysis sheet
  var vaSheet = ss.getSheetByName('video_analysis');
  if (vaSheet) {
    // KPI achievement dropdown
    var vaHeaders = vaSheet.getRange(1, 1, 1, vaSheet.getLastColumn()).getValues()[0];
    var kpiCol = vaHeaders.indexOf('kpi_achievement') + 1;
    if (kpiCol > 0) {
      var kpiRule = SpreadsheetApp.newDataValidation()
        .requireValueInList(['exceeded', 'met', 'partially_met', 'not_met'], true)
        .setAllowInvalid(true)
        .build();
      vaSheet.getRange(2, kpiCol, 100, 1).setDataValidation(kpiRule);
    }
  }
}

/**
 * Fix validation errors in existing data
 * Run this from Apps Script menu to clean up red triangles and #ERROR!
 */
function fixValidationErrors() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();

  var recSheet = ss.getSheetByName('recommendations');
  if (!recSheet) {
    ui.alert('Error', 'recommendations sheet not found', ui.ButtonSet.OK);
    return;
  }

  var headers = recSheet.getRange(1, 1, 1, recSheet.getLastColumn()).getValues()[0];
  var lastRow = recSheet.getLastRow();
  if (lastRow < 2) {
    ui.alert('Info', 'No data to fix', ui.ButtonSet.OK);
    return;
  }

  // Clear all data validations first
  recSheet.getRange(2, 1, lastRow - 1, recSheet.getLastColumn()).clearDataValidations();
  Logger.log('Cleared all data validations');

  // Re-apply with setAllowInvalid(true)
  applyDropdownsAndFormatting(ss);

  ui.alert('完了', 'Validation エラーを修正しました。\n赤い三角や #ERROR! は解消されているはずです。', ui.ButtonSet.OK);
}

/**
 * Clean up old data with ISO date format
 * Converts ISO dates to Japan timezone format
 */
function cleanupOldDateFormats() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();
  var updatedCount = 0;

  // Sheets and their date columns
  var sheetsConfig = [
    { name: 'recommendations', col: 'created_at' },
    { name: 'analysis_reports', col: 'generated_at' },
    { name: 'video_analysis', col: 'analyzed_at' }
  ];

  sheetsConfig.forEach(function(config) {
    var sheet = ss.getSheetByName(config.name);
    if (!sheet || sheet.getLastRow() < 2) return;

    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var dateCol = headers.indexOf(config.col) + 1;
    if (dateCol < 1) return;

    var data = sheet.getRange(2, dateCol, sheet.getLastRow() - 1, 1).getValues();

    for (var i = 0; i < data.length; i++) {
      var val = data[i][0];
      if (!val) continue;

      // Check if it's an ISO format (contains T or Z)
      var valStr = String(val);
      if (valStr.includes('T') || valStr.includes('Z') || valStr.includes('-')) {
        try {
          var date = new Date(val);
          if (!isNaN(date.getTime())) {
            var formatted = Utilities.formatDate(date, 'Asia/Tokyo', 'yyyy/MM/dd HH:mm');
            sheet.getRange(i + 2, dateCol).setValue(formatted);
            updatedCount++;
          }
        } catch (e) {
          Logger.log('Could not convert date: ' + val);
        }
      }
    }
  });

  ui.alert('完了', updatedCount + ' 件の日付フォーマットを変換しました。', ui.ButtonSet.OK);
}

/**
 * Apply conditional formatting for status column
 */
function applyStatusConditionalFormatting(sheet, col, lastRow) {
  var range = sheet.getRange(2, col, lastRow - 1, 1);

  // Clear existing rules for this range
  var rules = sheet.getConditionalFormatRules();

  // Pending - Yellow
  var pendingRule = SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo('pending')
    .setBackground('#FFF3CD')
    .setRanges([range])
    .build();

  // Approved - Green
  var approvedRule = SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo('approved')
    .setBackground('#D4EDDA')
    .setRanges([range])
    .build();

  // Rejected - Red
  var rejectedRule = SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo('rejected')
    .setBackground('#F8D7DA')
    .setRanges([range])
    .build();

  // In Progress - Blue
  var inProgressRule = SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo('in_progress')
    .setBackground('#CCE5FF')
    .setRanges([range])
    .build();

  rules.push(pendingRule, approvedRule, rejectedRule, inProgressRule);
  sheet.setConditionalFormatRules(rules);
}

/**
 * Apply conditional formatting for priority column
 */
function applyPriorityConditionalFormatting(sheet, col, lastRow) {
  var range = sheet.getRange(2, col, lastRow - 1, 1);
  var rules = sheet.getConditionalFormatRules();

  // Priority 1 - Red (Highest)
  var p1Rule = SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo('1')
    .setBackground('#F8D7DA')
    .setRanges([range])
    .build();

  // Priority 2 - Orange
  var p2Rule = SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo('2')
    .setBackground('#FFE5D0')
    .setRanges([range])
    .build();

  // Priority 3 - Yellow
  var p3Rule = SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo('3')
    .setBackground('#FFF3CD')
    .setRanges([range])
    .build();

  // Priority 4 - Green
  var p4Rule = SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo('4')
    .setBackground('#D4EDDA')
    .setRanges([range])
    .build();

  // Priority 5 - Gray (Lowest)
  var p5Rule = SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo('5')
    .setBackground('#E2E3E5')
    .setRanges([range])
    .build();

  rules.push(p1Rule, p2Rule, p3Rule, p4Rule, p5Rule);
  sheet.setConditionalFormatRules(rules);
}

/**
 * Format date to Japanese timezone (readable format)
 */
function formatDateJapan(date) {
  if (!date) return '';
  if (typeof date === 'string') {
    date = new Date(date);
  }
  return Utilities.formatDate(date, 'Asia/Tokyo', 'yyyy/MM/dd HH:mm');
}
