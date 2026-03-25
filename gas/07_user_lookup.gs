// ==========================================
// LINE予約ボット - 07: ユーザー検索・管理
// ==========================================

/**
 * line_usersシートから表示名を取得
 * @param {string} userId
 * @return {string} 表示名（見つからなければ'お客様'）
 */
function lookupDisplayNameByUserId(userId) {
  try {
    var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    var sheet = ss.getSheetByName(USERS_SHEET_NAME);
    if (!sheet) return 'お客様';

    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === userId) {
        var name = String(data[i][1]).trim();
        return name || 'お客様';
      }
    }
  } catch (e) {
    console.warn('lookupDisplayNameByUserId 失敗: ' + e.toString());
  }
  return 'お客様';
}

/**
 * form_queueからタイムスタンプでuserIdを逆引き
 * LINEブラウザでプリフィルが無視される場合のフォールバック
 * @return {string|null} userId
 */
function lookupUserIdFromQueue() {
  try {
    var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    var qSheet = ss.getSheetByName('form_queue');
    if (!qSheet) {
      console.warn('form_queueシートが見つかりません');
      return null;
    }

    var data = qSheet.getDataRange().getValues();
    if (data.length <= 1) {
      console.warn('form_queueにデータがありません');
      return null;
    }

    var now = new Date();
    var WINDOW_MS = 60 * 60 * 1000; // 60分に拡大（元は30分）

    var bestRow = -1;
    var bestDiff = WINDOW_MS;

    for (var i = 1; i < data.length; i++) {
      var ts = new Date(data[i][1]);
      var diff = Math.abs(now.getTime() - ts.getTime());
      if (diff < bestDiff) {
        bestDiff = diff;
        bestRow = i;
      }
    }

    if (bestRow === -1) {
      console.warn('form_queueに一致するエントリがありません（60分以内）');
      return null;
    }

    var userId = String(data[bestRow][0]).trim();
    // マッチした行を削除
    qSheet.deleteRow(bestRow + 1);
    console.log('form_queueからuserIdをマッチ: ' + userId + ' (差分: ' + Math.round(bestDiff / 1000) + '秒)');
    return userId;
  } catch (e) {
    console.error('lookupUserIdFromQueue 例外: ' + e.toString());
    return null;
  }
}

/**
 * userID検索（あいまいマッチ対応）
 * @param {string} displayName
 * @return {string|null} userId
 */
function lookupUserIdByDisplayName(displayName) {
  try {
    var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    var sheet = ss.getSheetByName(USERS_SHEET_NAME);
    if (!sheet) return null;

    var inputNorm = normalizeName(displayName);
    var data = sheet.getDataRange().getValues();

    // 完全一致
    for (var i = 1; i < data.length; i++) {
      if (normalizeName(String(data[i][1])) === inputNorm) {
        return String(data[i][0]).trim();
      }
    }
    // 部分一致
    for (var i = 1; i < data.length; i++) {
      var s = normalizeName(String(data[i][1]));
      if (s.indexOf(inputNorm) !== -1 || inputNorm.indexOf(s) !== -1) {
        return String(data[i][0]).trim();
      }
    }
    return null;
  } catch (e) {
    console.error('lookupUserIdByDisplayName 例外: ' + e.toString());
    return null;
  }
}

/**
 * LINE登録時にuserIDを保存
 * @param {string} userId
 * @param {string} displayName
 */
function saveLineUser(userId, displayName) {
  try {
    var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    var sheet = ss.getSheetByName(USERS_SHEET_NAME);
    if (!sheet) {
      sheet = ss.insertSheet(USERS_SHEET_NAME);
      sheet.appendRow(['userId', 'displayName', '登録日時']);
    }

    // 既存チェック
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === userId) {
        // 既存ユーザー：表示名が変わっていれば更新
        if (String(data[i][1]).trim() !== displayName) {
          sheet.getRange(i + 1, 2).setValue(displayName);
          console.log('ユーザー表示名を更新: ' + displayName);
        }
        return;
      }
    }
    sheet.appendRow([userId, displayName, new Date()]);
    console.log('新規ユーザー登録: ' + displayName);
  } catch (e) {
    console.error('saveLineUser 例外: ' + e.toString());
  }
}
