/**
 * DailyKpiFill.gs
 * FOLLOW-KPI スプレッドシートの daily タブ「投稿数」列を、
 * Threads 自動投稿システム（FOLLOW-Autopost）の投稿実績から自動記入する。
 *
 * ─── 設計方針（OPS-LEARNINGS.md 2026-07-12 の教訓を反映）───
 * 設計書の記述を鵜呑みにせず、実行時に実際のシート構造を検証する。
 * 想定と違う構造を検出したら黙って進めず、詳細をログに出して throw で止める。
 *
 * ─── 投稿実績のソース選定 ───
 * 第一候補: sns_queue（post_status='posted' かつ posted_at あり）
 *   → 1投稿=1行で重複がなく、posted_at が実投稿時刻。集計に最適。
 * フォールバック: sns_log（event='posted' 行を queue_id で dedupe）
 *   → append-only のイベントログのため再試行等で重複しうる。dedupe 必須。
 *
 * ─── 手入力との共存（絶対要件）───
 * daily タブの「投稿数」セルに既に値が入っている場合は上書きしない。
 * スキップした事実はログに残す。
 *
 * 依存: 同一 GAS プロジェクトの Config.gs（CONFIG / getProp）があれば利用するが、
 *       無くても DAILY_KPI_DEFAULT_SPREADSHEET_ID で単独動作する。
 * 注意: このプロジェクトは組み込みの Logger を独自オブジェクトで
 *       シャドウしているため（Logger.gs）、本ファイルのログは console.* を使う。
 */

// ───────────────────────── 定数 ─────────────────────────

/** FOLLOW-KPI スプレッドシートID（CONFIG / Script Properties が無い場合の最終フォールバック） */
var DAILY_KPI_DEFAULT_SPREADSHEET_ID = '1Xshvq2dIJKoTLwU8E4VBR-alySOW42h96Uh7NQji4B0';

/** 自動投稿システムの稼働開始日（これより前の日付は集計対象外） */
var DAILY_KPI_START_DATE = '2026-06-27';

/** daily タブ名の候補（先にこの順で探し、無ければ全タブ走査） */
var DAILY_KPI_TAB_CANDIDATES = ['daily', 'Daily', 'DAILY'];

/** daily タブのヘッダー名 */
var DAILY_KPI_DATE_HEADER = '日付';
var DAILY_KPI_POSTCOUNT_HEADER = '投稿数';

/** タイムゾーン（JST 固定） */
var DAILY_KPI_TZ = 'Asia/Tokyo';

/** 日次トリガーのハンドラ名（インストール/アンインストールで参照） */
var DAILY_KPI_TRIGGER_HANDLER = 'fillDailyPostCountsDaily';

// ───────────────────────── 内部ヘルパー ─────────────────────────

/**
 * FOLLOW-KPI スプレッドシートIDを解決する。
 * 優先順: CONFIG.SPREADSHEET_ID → Script Property 'SPREADSHEET_ID' → デフォルト定数。
 * CONFIG / getProp が存在しない環境（単独デプロイ）でも動くよう typeof で防御する。
 * @returns {string} スプレッドシートID
 */
function resolveKpiSpreadsheetId_() {
  try {
    if (typeof CONFIG !== 'undefined' && CONFIG && CONFIG.SPREADSHEET_ID) {
      return CONFIG.SPREADSHEET_ID;
    }
  } catch (e) { /* CONFIG 未定義なら次へ */ }
  try {
    if (typeof getProp === 'function') {
      var fromProp = getProp('SPREADSHEET_ID');
      if (fromProp) return fromProp;
    }
  } catch (e) { /* getProp 未定義なら次へ */ }
  return DAILY_KPI_DEFAULT_SPREADSHEET_ID;
}

/**
 * FOLLOW-KPI スプレッドシートを開く。
 * @returns {GoogleAppsScript.Spreadsheet.Spreadsheet}
 */
function openKpiSpreadsheet_() {
  return SpreadsheetApp.openById(resolveKpiSpreadsheetId_());
}

/**
 * 任意の値を JST の 'yyyy-MM-dd' 文字列に正規化する。
 * Date 型・'2026-06-07' / '2026/6/7' / '2026-06-07 12:34' 等の文字列に対応。
 * 正規化できない値は null を返す（呼び出し側でスキップ判断する）。
 * @param {*} value セル値（Date か文字列を想定）
 * @returns {string|null} 'yyyy-MM-dd' 形式、または null
 */
function normalizeDateJst_(value) {
  if (value === null || value === undefined || value === '') return null;

  // Date 型（Sheets の日付セルは通常こちら）
  if (Object.prototype.toString.call(value) === '[object Date]') {
    if (isNaN(value.getTime())) return null;
    return Utilities.formatDate(value, DAILY_KPI_TZ, 'yyyy-MM-dd');
  }

  var s = String(value).trim();
  if (!s) return null;

  // 'yyyy-MM-dd' / 'yyyy/M/d'（末尾に時刻が付いていても先頭部分で判定）
  var m = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (m) {
    var y = m[1];
    var mo = ('0' + m[2]).slice(-2);
    var d = ('0' + m[3]).slice(-2);
    return y + '-' + mo + '-' + d;
  }
  return null;
}

/**
 * 'yyyy-MM-dd' 文字列に日数を加算した 'yyyy-MM-dd' を返す（JST 基準）。
 * @param {string} dateStr 'yyyy-MM-dd'
 * @param {number} days 加算日数（負も可）
 * @returns {string} 'yyyy-MM-dd'
 */
function addDaysJst_(dateStr, days) {
  var parts = dateStr.split('-');
  // UTC 正午で構築すれば ±14h のタイムゾーンずれでも日付が変わらない
  var d = new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12, 0, 0));
  d.setUTCDate(d.getUTCDate() + days);
  return Utilities.formatDate(d, 'UTC', 'yyyy-MM-dd');
}

/**
 * JST での「今日」の 'yyyy-MM-dd' を返す。
 * @returns {string} 'yyyy-MM-dd'
 */
function todayJst_() {
  return Utilities.formatDate(new Date(), DAILY_KPI_TZ, 'yyyy-MM-dd');
}

/**
 * daily タブを自動特定する。
 * 1) タブ名候補（daily/Daily/DAILY）を順に試す（ただしヘッダーA1が「日付」であることも検証）
 * 2) 無ければ全タブを走査し、1行目A列が「日付」のタブを採用
 * 見つからなければ、実際のタブ名一覧をログに出して throw で止める。
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss FOLLOW-KPI スプレッドシート
 * @returns {GoogleAppsScript.Spreadsheet.Sheet} daily タブ
 */
function findDailySheet_(ss) {
  // 1) 名前候補を先に試す
  for (var i = 0; i < DAILY_KPI_TAB_CANDIDATES.length; i++) {
    var sheet = ss.getSheetByName(DAILY_KPI_TAB_CANDIDATES[i]);
    if (sheet) {
      var a1 = String(sheet.getRange(1, 1).getValue()).trim();
      if (a1 === DAILY_KPI_DATE_HEADER) {
        console.log('[DailyKpiFill] dailyタブ特定（名前一致）: ' + sheet.getName());
        return sheet;
      }
      console.warn('[DailyKpiFill] タブ "' + sheet.getName() + '" は存在するがA1が「' +
        DAILY_KPI_DATE_HEADER + '」でない（実際: "' + a1 + '"）。走査を続行。');
    }
  }

  // 2) 全タブ走査（1行目A列が「日付」のタブ）
  var sheets = ss.getSheets();
  for (var j = 0; j < sheets.length; j++) {
    var s = sheets[j];
    var head = String(s.getRange(1, 1).getValue()).trim();
    if (head === DAILY_KPI_DATE_HEADER) {
      console.log('[DailyKpiFill] dailyタブ特定（ヘッダー走査）: ' + s.getName());
      return s;
    }
  }

  // 見つからない → 状況をログに出して停止
  var names = sheets.map(function (x) { return x.getName(); }).join(', ');
  var msg = '[DailyKpiFill] dailyタブが見つかりません。' +
    '候補名(' + DAILY_KPI_TAB_CANDIDATES.join('/') + ')にも、' +
    '1行目A列が「' + DAILY_KPI_DATE_HEADER + '」のタブにも該当なし。' +
    ' 実際のタブ一覧: [' + names + ']';
  console.error(msg);
  throw new Error(msg);
}

/**
 * シートの1行目ヘッダーから、指定ヘッダー名の列番号（1始まり）を返す。
 * 見つからなければ、実際のヘッダーをログに出して throw で止める。
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet 対象シート
 * @param {string} headerName 探すヘッダー名
 * @returns {number} 列番号（1始まり）
 */
function findHeaderColumn_(sheet, headerName) {
  var lastCol = sheet.getLastColumn();
  if (lastCol < 1) {
    throw new Error('[DailyKpiFill] シート "' + sheet.getName() + '" にヘッダー行がありません。');
  }
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0]
    .map(function (h) { return String(h).trim(); });
  var idx = headers.indexOf(headerName);
  if (idx === -1) {
    var msg = '[DailyKpiFill] シート "' + sheet.getName() + '" にヘッダー「' + headerName +
      '」が見つかりません。実際のヘッダー: [' + headers.join(', ') + ']';
    console.error(msg);
    throw new Error(msg);
  }
  return idx + 1;
}

/**
 * 投稿実績を日別に集計する。
 * 第一候補: sns_queue の post_status='posted' かつ posted_at あり（1投稿=1行）。
 * フォールバック: sns_log の event='posted' 行を queue_id で dedupe。
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss FOLLOW-KPI スプレッドシート
 * @param {string} startDateStr 集計開始日 'yyyy-MM-dd'（この日を含む）
 * @param {string} endDateStr 集計終了日 'yyyy-MM-dd'（この日を含む）
 * @returns {{counts: Object<string, number>, source: string}} 日付→投稿数のマップと使用ソース名
 */
function collectPostCountsByDate_(ss, startDateStr, endDateStr) {
  var counts = {};

  /**
   * 日付文字列が集計範囲内かどうか（文字列比較で判定できる形式なのでそのまま比較）
   * @param {string} dstr 'yyyy-MM-dd'
   * @returns {boolean}
   */
  function inRange(dstr) {
    return dstr >= startDateStr && dstr <= endDateStr;
  }

  // ── 第一候補: sns_queue ──
  var queueSheet = ss.getSheetByName('sns_queue');
  if (queueSheet && queueSheet.getLastRow() >= 2) {
    var qHeaders = queueSheet.getRange(1, 1, 1, queueSheet.getLastColumn()).getValues()[0]
      .map(function (h) { return String(h).trim(); });
    var statusIdx = qHeaders.indexOf('post_status');
    var postedAtIdx = qHeaders.indexOf('posted_at');

    if (statusIdx !== -1 && postedAtIdx !== -1) {
      var qData = queueSheet.getRange(2, 1, queueSheet.getLastRow() - 1, queueSheet.getLastColumn()).getValues();
      for (var i = 0; i < qData.length; i++) {
        var status = String(qData[i][statusIdx]).trim();
        var postedAt = qData[i][postedAtIdx];
        if (status !== 'posted') continue;
        var dstr = normalizeDateJst_(postedAt);
        if (!dstr) continue; // posted なのに posted_at 不正 → カウント対象外
        if (!inRange(dstr)) continue;
        counts[dstr] = (counts[dstr] || 0) + 1;
      }
      console.log('[DailyKpiFill] ソース=sns_queue で集計（' +
        Object.keys(counts).length + '日分）');
      return { counts: counts, source: 'sns_queue' };
    }
    console.warn('[DailyKpiFill] sns_queue に post_status / posted_at 列が見つからない' +
      '（実ヘッダー: [' + qHeaders.join(', ') + ']）。sns_log にフォールバック。');
  } else {
    console.warn('[DailyKpiFill] sns_queue タブが無い、またはデータ行なし。sns_log にフォールバック。');
  }

  // ── フォールバック: sns_log（event='posted' を queue_id で dedupe）──
  var logSheet = ss.getSheetByName('sns_log');
  if (!logSheet || logSheet.getLastRow() < 2) {
    var msg = '[DailyKpiFill] 投稿実績ソースが見つかりません。sns_queue も sns_log も利用不可。' +
      ' 実際のタブ一覧: [' +
      ss.getSheets().map(function (x) { return x.getName(); }).join(', ') + ']';
    console.error(msg);
    throw new Error(msg);
  }

  var lHeaders = logSheet.getRange(1, 1, 1, logSheet.getLastColumn()).getValues()[0]
    .map(function (h) { return String(h).trim(); });
  var tsIdx = lHeaders.indexOf('timestamp');
  var qidIdx = lHeaders.indexOf('queue_id');
  var eventIdx = lHeaders.indexOf('event');
  if (tsIdx === -1 || qidIdx === -1 || eventIdx === -1) {
    var msg2 = '[DailyKpiFill] sns_log のヘッダーが想定と異なります。' +
      ' 必要: timestamp / queue_id / event、実際: [' + lHeaders.join(', ') + ']';
    console.error(msg2);
    throw new Error(msg2);
  }

  var lData = logSheet.getRange(2, 1, logSheet.getLastRow() - 1, logSheet.getLastColumn()).getValues();
  var seenQueueIds = {}; // queue_id → true（再試行等による重複 posted イベントを除外）
  for (var k = 0; k < lData.length; k++) {
    if (String(lData[k][eventIdx]).trim() !== 'posted') continue;
    var qid = String(lData[k][qidIdx]).trim();
    var dedupeKey = qid || ('__ts_' + String(lData[k][tsIdx])); // queue_id 空なら timestamp で代用
    if (seenQueueIds[dedupeKey]) continue;
    seenQueueIds[dedupeKey] = true;
    var ldstr = normalizeDateJst_(lData[k][tsIdx]);
    if (!ldstr || !inRange(ldstr)) continue;
    counts[ldstr] = (counts[ldstr] || 0) + 1;
  }
  console.log('[DailyKpiFill] ソース=sns_log（dedupe後）で集計（' +
    Object.keys(counts).length + '日分）');
  return { counts: counts, source: 'sns_log' };
}

/**
 * 指定した日付範囲について daily タブの「投稿数」列を記入する共通ロジック。
 * fillDailyPostCounts / fillDailyPostCountsDaily の両方から呼ばれる。
 * 既に値が入っているセル（手入力想定）は絶対に上書きせず、スキップとしてログに残す。
 * @param {string} startDateStr 対象開始日 'yyyy-MM-dd'（この日を含む）
 * @param {string} endDateStr 対象終了日 'yyyy-MM-dd'（この日を含む）
 * @returns {{written: number, skippedExisting: number, missingDates: string[], totalPosts: number, source: string}} 実行結果サマリ
 */
function fillDailyPostCountsRange_(startDateStr, endDateStr) {
  console.log('[DailyKpiFill] 開始: 対象範囲 ' + startDateStr + ' 〜 ' + endDateStr);

  if (startDateStr > endDateStr) {
    console.log('[DailyKpiFill] 対象範囲が空（開始日 > 終了日）。何もせず終了。');
    return { written: 0, skippedExisting: 0, missingDates: [], totalPosts: 0, source: '(none)' };
  }

  var ss = openKpiSpreadsheet_();
  var dailySheet = findDailySheet_(ss);
  var dateCol = findHeaderColumn_(dailySheet, DAILY_KPI_DATE_HEADER);
  var postCountCol = findHeaderColumn_(dailySheet, DAILY_KPI_POSTCOUNT_HEADER);

  // 投稿実績を日別集計
  var result = collectPostCountsByDate_(ss, startDateStr, endDateStr);
  var counts = result.counts;

  // daily タブの日付列を読み、日付文字列 → 行番号のマップを作る
  var lastRow = dailySheet.getLastRow();
  if (lastRow < 2) {
    throw new Error('[DailyKpiFill] dailyタブ "' + dailySheet.getName() + '" にデータ行がありません。');
  }
  var dateValues = dailySheet.getRange(2, dateCol, lastRow - 1, 1).getValues();
  var existingValues = dailySheet.getRange(2, postCountCol, lastRow - 1, 1).getValues();
  var rowByDate = {}; // 'yyyy-MM-dd' → シート行番号（1始まり）
  for (var r = 0; r < dateValues.length; r++) {
    var dstr = normalizeDateJst_(dateValues[r][0]);
    if (dstr && !(dstr in rowByDate)) {
      rowByDate[dstr] = r + 2; // データは2行目から
    }
  }

  // 対象範囲の各日についてセルを埋める（0投稿の日も 0 を記入して「未記入」と区別する）
  var written = 0;
  var skippedExisting = 0;
  var missingDates = [];
  var totalPosts = 0;

  for (var cur = startDateStr; cur <= endDateStr; cur = addDaysJst_(cur, 1)) {
    var count = counts[cur] || 0;
    totalPosts += count;

    var rowNum = rowByDate[cur];
    if (!rowNum) {
      // daily タブに該当日の行が無い（9/4まで存在する前提だが、実物を信じずログに残す）
      missingDates.push(cur);
      console.warn('[DailyKpiFill] dailyタブに日付行が見つからずスキップ: ' + cur);
      continue;
    }

    var existing = existingValues[rowNum - 2][0];
    if (existing !== '' && existing !== null && existing !== undefined) {
      // 手入力値がある → 絶対に上書きしない（絶対要件）
      skippedExisting++;
      console.log('[DailyKpiFill] 既存値ありのため上書きスキップ: ' + cur +
        ' 既存=' + existing + ' 自動集計値=' + count);
      continue;
    }

    dailySheet.getRange(rowNum, postCountCol).setValue(count);
    written++;
  }

  var summary = '[DailyKpiFill] 完了: 記入=' + written + '日分, 既存値スキップ=' + skippedExisting +
    '日分, 日付行なし=' + missingDates.length + '日分, 合計投稿数=' + totalPosts +
    ', ソース=' + result.source +
    ', タブ="' + dailySheet.getName() + '"';
  console.log(summary);
  if (missingDates.length > 0) {
    console.warn('[DailyKpiFill] 行が見つからなかった日付: ' + missingDates.join(', '));
  }

  return {
    written: written,
    skippedExisting: skippedExisting,
    missingDates: missingDates,
    totalPosts: totalPosts,
    source: result.source
  };
}

// ───────────────────────── 公開関数 ─────────────────────────

/**
 * 【診断用】スプレッドシートの全タブ名をログ出力する。
 * コード投入後、最初にこれを実行して daily タブの実名と sns_* タブの存在を確認すること。
 */
function listAllKpiTabs() {
  var ss = openKpiSpreadsheet_();
  console.log('[DailyKpiFill] スプレッドシート名: ' + ss.getName() +
    ' (ID: ' + resolveKpiSpreadsheetId_() + ')');
  var sheets = ss.getSheets();
  console.log('[DailyKpiFill] タブ数: ' + sheets.length);
  sheets.forEach(function (s, i) {
    var a1 = '';
    try {
      a1 = String(s.getRange(1, 1).getValue()).trim();
    } catch (e) {
      a1 = '(読取失敗: ' + e.message + ')';
    }
    console.log('  [' + (i + 1) + '] "' + s.getName() + '"  行数=' + s.getLastRow() +
      '  A1="' + a1 + '"');
  });
}

/**
 * 【メイン・手動実行用】稼働開始日（2026-06-27）〜昨日までの全期間について、
 * daily タブの「投稿数」列を投稿実績から埋める（初回バックフィル＋随時の再実行に対応）。
 * 当日分は投稿がまだ続く可能性があるため対象外（翌日の日次トリガーで確定値が入る）。
 * 既に値が入っているセルは上書きしない。
 * @returns {{written: number, skippedExisting: number, missingDates: string[], totalPosts: number, source: string}} 実行結果サマリ
 */
function fillDailyPostCounts() {
  var yesterday = addDaysJst_(todayJst_(), -1);
  return fillDailyPostCountsRange_(DAILY_KPI_START_DATE, yesterday);
}

/**
 * 【日次トリガー用】昨日1日分だけを対象に投稿数を記入する軽量版。
 * 毎日0:30 JST に実行される想定（installDailyKpiTrigger 参照）。
 * ロジックは fillDailyPostCountsRange_ に共通化してあり、範囲だけが異なる。
 * @returns {{written: number, skippedExisting: number, missingDates: string[], totalPosts: number, source: string}} 実行結果サマリ
 */
function fillDailyPostCountsDaily() {
  var yesterday = addDaysJst_(todayJst_(), -1);
  if (yesterday < DAILY_KPI_START_DATE) {
    console.log('[DailyKpiFill] 昨日(' + yesterday + ')は稼働開始日(' +
      DAILY_KPI_START_DATE + ')より前のためスキップ。');
    return { written: 0, skippedExisting: 0, missingDates: [], totalPosts: 0, source: '(none)' };
  }
  return fillDailyPostCountsRange_(yesterday, yesterday);
}

/**
 * 毎日 0:30 JST（0〜1時の間）に fillDailyPostCountsDaily を実行するトリガーを冪等に設置する。
 * 既存の同名ハンドラのトリガーを先に全削除してから作成するため、何度実行しても1本のまま。
 * 注意: GAS の時間トリガーは atHour + nearMinute で「指定時刻の前後15分程度」の揺らぎがある。
 */
function installDailyKpiTrigger() {
  // 既存トリガー削除（冪等性の担保）
  var removed = 0;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === DAILY_KPI_TRIGGER_HANDLER) {
      ScriptApp.deleteTrigger(t);
      removed++;
    }
  });

  // 新規作成: 毎日 0時台の30分近辺（JST はプロジェクトのタイムゾーン設定に依存するため、
  // GAS プロジェクト設定のタイムゾーンが Asia/Tokyo であることを前提とする）
  ScriptApp.newTrigger(DAILY_KPI_TRIGGER_HANDLER)
    .timeBased()
    .everyDays(1)
    .atHour(0)
    .nearMinute(30)
    .create();

  var msg = '[DailyKpiFill] 日次トリガー設置完了（毎日0:30頃 JST に ' +
    DAILY_KPI_TRIGGER_HANDLER + ' を実行）。既存削除=' + removed + '件。' +
    '※GASプロジェクトのタイムゾーンが Asia/Tokyo であることを確認してください。';
  console.log(msg);

  // Notifier が存在すれば LINE 通知（無ければ握りつぶす）
  try {
    if (typeof Notifier !== 'undefined' && Notifier && typeof Notifier.send === 'function') {
      Notifier.send(msg);
    }
  } catch (e) {
    console.warn('[DailyKpiFill] Notifier.send 失敗（通知なしで続行）: ' + e.message);
  }
}

/**
 * fillDailyPostCountsDaily の日次トリガーを削除する。
 */
function uninstallDailyKpiTrigger() {
  var removed = 0;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === DAILY_KPI_TRIGGER_HANDLER) {
      ScriptApp.deleteTrigger(t);
      removed++;
    }
  });
  console.log('[DailyKpiFill] 日次トリガー削除完了: ' + removed + '件削除。');
}
