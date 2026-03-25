// ==========================================
// LINE予約ボット - 01: 設定
// スクリプトプロパティから設定を読み込む
// ==========================================

/**
 * CONFIG オブジェクト
 * GASのスクリプトプロパティに以下を設定してください：
 *   - LINE_CHANNEL_ACCESS_TOKEN
 *   - GEMINI_API_KEY
 *   - SPREADSHEET_ID
 *   - MODEL_NAME （例: gemini-1.5-flash）
 *   - ADMIN_USER_ID （管理者のLINE userId）
 */
var CONFIG = (function() {
  var props = PropertiesService.getScriptProperties();
  return {
    LINE_CHANNEL_ACCESS_TOKEN: props.getProperty('LINE_CHANNEL_ACCESS_TOKEN') || '',
    GEMINI_API_KEY:            props.getProperty('GEMINI_API_KEY') || '',
    SPREADSHEET_ID:            props.getProperty('SPREADSHEET_ID') || '',
    MODEL_NAME:                props.getProperty('MODEL_NAME') || 'gemini-1.5-flash',
    ADMIN_USER_ID:             props.getProperty('ADMIN_USER_ID') || ''
  };
})();

// シート名
var FORM_SHEET_NAME  = 'フォームの回答 1';
var USERS_SHEET_NAME = 'line_users';
var LOG_SHEET_NAME   = 'log';

// フォーム回答整形時に除外するキーワード
var skipKeys       = ['識別コード', 'タイムスタンプ', 'Timestamp'];
// BLOCK6（HEJへの相談）はPDFから除外
var skipKeysBlock6 = ['Q33', 'Q34', 'Q35'];
