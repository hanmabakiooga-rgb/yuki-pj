// ==========================================
// LINE予約ボット - 06: ユーティリティ
// ==========================================

/**
 * ログシートを取得（なければ作成）
 * @return {GoogleAppsScript.Spreadsheet.Sheet}
 */
function getLogSheet() {
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var sheet = ss.getSheetByName(LOG_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(LOG_SHEET_NAME);
    sheet.appendRow(['timestamp', 'type', 'message', 'userId']);
  }
  return sheet;
}

/**
 * ログ記録
 * @param {string} type - ログの種類
 * @param {string} message - ログメッセージ
 * @param {string} userId - 関連するuserId
 */
function logToSheet(type, message, userId) {
  try {
    var sheet = getLogSheet();
    sheet.appendRow([new Date(), type, message, userId || 'unknown']);
  } catch (e) {
    console.error('logToSheet 失敗: ' + e.toString());
  }
}

/**
 * フォーム回答値を取得（あいまいマッチ対応）
 * @param {Object} responses - namedValues
 * @param {string} questionKey - 検索キー
 * @return {string|null}
 */
function getResponseValue(responses, questionKey) {
  // 完全一致
  if (responses[questionKey]) {
    var val = responses[questionKey];
    return Array.isArray(val) ? val[0] : val;
  }
  // 部分一致
  var keys = Object.keys(responses);
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    if (key.indexOf(questionKey) !== -1 || questionKey.indexOf(key) !== -1) {
      var val = responses[key];
      return Array.isArray(val) ? val[0] : val;
    }
  }
  return null;
}

/**
 * フォーム回答を整形
 * @param {Object} responses - namedValues
 * @param {boolean} excludeBlock6 - trueならQ33〜Q35を除外
 * @return {string}
 */
function formatFormAnswers(responses, excludeBlock6) {
  var lines = [];
  var keys = Object.keys(responses);
  for (var i = 0; i < keys.length; i++) {
    var question = keys[i];
    var answerArr = responses[question];

    // 除外キーワードチェック
    var shouldSkip = false;
    for (var j = 0; j < skipKeys.length; j++) {
      if (question.indexOf(skipKeys[j]) !== -1) { shouldSkip = true; break; }
    }
    if (shouldSkip) continue;

    // Block6除外チェック
    if (excludeBlock6) {
      for (var j = 0; j < skipKeysBlock6.length; j++) {
        if (question.indexOf(skipKeysBlock6[j]) !== -1) { shouldSkip = true; break; }
      }
      if (shouldSkip) continue;
    }

    var answer = Array.isArray(answerArr) ? answerArr[0] : answerArr;
    if (answer && String(answer).trim() !== '') {
      lines.push('【' + question + '】\n' + String(answer).trim());
    }
  }
  return lines.join('\n\n');
}

/**
 * 名前の正規化（全角→半角、半角カナ→全角カナ、空白除去）
 * @param {string} name
 * @return {string}
 */
function normalizeName(name) {
  if (!name) return '';
  var s = String(name).trim();
  // 空白除去
  s = s.replace(/[\s\u3000\t]/g, '');
  // 全角英数→半角
  s = s.replace(/[Ａ-Ｚａ-ｚ０-９]/g, function(c) {
    return String.fromCharCode(c.charCodeAt(0) - 0xFEE0);
  });
  // 半角カナ→全角カナ
  var kanaMap = {
    'ｱ':'ア','ｲ':'イ','ｳ':'ウ','ｴ':'エ','ｵ':'オ',
    'ｶ':'カ','ｷ':'キ','ｸ':'ク','ｹ':'ケ','ｺ':'コ',
    'ｻ':'サ','ｼ':'シ','ｽ':'ス','ｾ':'セ','ｿ':'ソ',
    'ﾀ':'タ','ﾁ':'チ','ﾂ':'ツ','ﾃ':'テ','ﾄ':'ト',
    'ﾅ':'ナ','ﾆ':'ニ','ﾇ':'ヌ','ﾈ':'ネ','ﾉ':'ノ',
    'ﾊ':'ハ','ﾋ':'ヒ','ﾌ':'フ','ﾍ':'ヘ','ﾎ':'ホ',
    'ﾏ':'マ','ﾐ':'ミ','ﾑ':'ム','ﾒ':'メ','ﾓ':'モ',
    'ﾔ':'ヤ','ﾕ':'ユ','ﾖ':'ヨ',
    'ﾗ':'ラ','ﾘ':'リ','ﾙ':'ル','ﾚ':'レ','ﾛ':'ロ',
    'ﾜ':'ワ','ｦ':'ヲ','ﾝ':'ン',
    'ｧ':'ァ','ｨ':'ィ','ｩ':'ゥ','ｪ':'ェ','ｫ':'ォ',
    'ｯ':'ッ','ｬ':'ャ','ｭ':'ュ','ｮ':'ョ','ｰ':'ー'
  };
  s = s.replace(/[ｱ-ﾝｧ-ｮｰ]/g, function(c) { return kanaMap[c] || c; });
  return s.toLowerCase();
}
