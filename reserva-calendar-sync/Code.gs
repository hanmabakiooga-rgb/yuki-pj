/**
 * RESERVA予約通知メール（noreply@reserva.be）をGoogleカレンダーに自動登録するスクリプト。
 * 登録するのは「予約者の氏名」「予約内容（メニュー）」「予約日時」の3項目のみ。
 */

var RESERVA_LABEL_NAME = 'RESERVA登録済み';
var RESERVA_SEARCH_QUERY = 'from:noreply@reserva.be subject:予約が入りました';

/**
 * true の間はカレンダーへの書き込みもGmailラベル付与も行わず、
 * 「何件・どの予定を作ろうとしているか」を実行ログに出すだけにする。
 * 初回はこの状態で実行してログを確認し、問題なければ false にして本実行する。
 */
var DRY_RUN = false;

/**
 * トリガーから定期実行するメイン処理。
 */
function syncReservaToCalendar() {
  var threads = GmailApp.search(RESERVA_SEARCH_QUERY + ' -label:"' + RESERVA_LABEL_NAME + '"', 0, 50);

  // 5分おきに動くため実行の大半は空振りになる。未処理メールが無いときは
  // ラベル取得もカレンダー取得もせずここで抜け、実行時間の消費を抑える。
  if (!threads.length) {
    Logger.log('未処理のRESERVAメールはありません');
    return;
  }

  var label = DRY_RUN ? null : getOrCreateLabel_(RESERVA_LABEL_NAME);
  var calendar = CalendarApp.getDefaultCalendar();

  Logger.log('[%s] 対象スレッド %s 件', DRY_RUN ? 'DRY_RUN' : '本実行', threads.length);

  var created = 0;
  var skipped = 0;
  var failed = 0;

  threads.forEach(function (thread) {
    thread.getMessages().forEach(function (message) {
      var info = parseReservaBody_(message.getPlainBody());
      if (!info) {
        failed++;
        Logger.log('解析できませんでした: 件名「%s」/ 受信 %s', message.getSubject(), message.getDate());
        return;
      }

      var range = buildEventRange_(info, message.getDate());
      var title = info.name + '様 - ' + info.menu;
      var duplicate = findDuplicateEvent_(calendar, info.name, range);

      if (duplicate) {
        skipped++;
        Logger.log('重複のためスキップ: 「%s」%s〜%s（既存予定「%s」）',
          title, range.start, range.end, duplicate.getTitle());
        return;
      }

      var overlaps = calendar.getEvents(range.start, range.end);
      if (overlaps.length) {
        Logger.log('※時間帯が重なる別予定あり（登録は行う）: 「%s」%s〜%s / 既存 %s',
          title, range.start, range.end, overlaps.map(function (e) { return e.getTitle(); }).join(', '));
      }

      if (DRY_RUN) {
        Logger.log('作成予定: 「%s」%s〜%s', title, range.start, range.end);
      } else {
        calendar.createEvent(title, range.start, range.end);
        Logger.log('作成しました: 「%s」%s〜%s', title, range.start, range.end);
      }
      created++;
    });

    if (!DRY_RUN) thread.addLabel(label);
  });

  Logger.log('[%s] 完了 — 作成%s件 / 重複スキップ%s件 / 解析失敗%s件',
    DRY_RUN ? 'DRY_RUN' : '本実行', created, skipped, failed);
}

/**
 * 導入時に一度だけ手動実行する初期化処理。
 * 既存のRESERVA通知メールすべてに「登録済み」ラベルを付けるだけで、予定は一切作らない。
 *
 * RESERVAの予約はこれまで手作業でカレンダーに書き写す運用だったため、受信箱に残っている
 * 過去メールをそのまま処理すると、既に入っている予定を大量に二重登録してしまう。
 * これを実行してから自動同期を有効にすることで、「これ以降に届く新規予約だけ」を対象にできる。
 */
function markExistingAsProcessed() {
  var label = getOrCreateLabel_(RESERVA_LABEL_NAME);
  var threads = GmailApp.search(RESERVA_SEARCH_QUERY + ' -label:"' + RESERVA_LABEL_NAME + '"', 0, 500);

  threads.forEach(function (thread) {
    thread.addLabel(label);
  });

  Logger.log('既存メール %s 件に「%s」ラベルを付与しました（予定は作成していません）',
    threads.length, RESERVA_LABEL_NAME);
}

/**
 * 動作確認用。ラベルの有無に関係なく、重複でない予約を1件だけ実際にカレンダーへ登録する。
 * DRY_RUN の値に関係なく必ず書き込む点に注意（これは書き込みを確認するための関数のため）。
 * ラベルは付けないので、作られた予定を消せば実行前の状態に戻せる。
 */
function syncSingleForVerification() {
  var threads = GmailApp.search(RESERVA_SEARCH_QUERY, 0, 50);
  var calendar = CalendarApp.getDefaultCalendar();

  for (var t = 0; t < threads.length; t++) {
    var messages = threads[t].getMessages();
    for (var m = 0; m < messages.length; m++) {
      var info = parseReservaBody_(messages[m].getPlainBody());
      if (!info) continue;

      var range = buildEventRange_(info, messages[m].getDate());
      if (findDuplicateEvent_(calendar, info.name, range)) continue;

      var title = info.name + '様 - ' + info.menu;
      var event = calendar.createEvent(title, range.start, range.end);
      Logger.log('確認用に1件だけ作成しました: 「%s」%s〜%s / eventId=%s',
        title, range.start, range.end, event.getId());
      return;
    }
  }

  Logger.log('重複でない予約が見つかりませんでした（作成なし）');
}

/**
 * 初回のみ手動実行し、5分おきの定期実行トリガーを登録する。
 * GASにGmail受信を起点にするトリガーは無いため、短い間隔のポーリングで即時性に近づけている。
 * everyMinutes() に指定できるのは 1・5・10・15・30 のいずれか。
 */
function createTrigger() {
  // 先に同じ関数の既存トリガーを消してから作り直すことで、何度実行しても常に1つに保つ。
  // トリガーが重複していると5分ごとに複数のプロセスが同時に走り、
  // 両方が同じ未処理メールを拾って「ラベルが付く前に二重登録する」競合が起こりうる。
  var removed = 0;
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === 'syncReservaToCalendar') {
      ScriptApp.deleteTrigger(trigger);
      removed++;
    }
  });

  ScriptApp.newTrigger('syncReservaToCalendar')
    .timeBased()
    .everyMinutes(5)
    .create();

  Logger.log('トリガーを登録しました（5分おき）。既存の重複 %s 件を削除済み', removed);
}

/**
 * 現在登録されているトリガーを一覧表示する。
 * 「登録できているか」「createTriggerを複数回実行して重複していないか」の確認用。
 */
function listTriggers() {
  var triggers = ScriptApp.getProjectTriggers();
  Logger.log('登録済みトリガー: %s 件', triggers.length);
  triggers.forEach(function (trigger) {
    Logger.log('- %s / %s', trigger.getHandlerFunction(), trigger.getEventType());
  });
}

function getOrCreateLabel_(name) {
  return GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name);
}

/**
 * 同じ予約が既にカレンダーにある場合はその予定を返す（無ければ null）。
 * LINE予約ボットや手入力で先に登録済みのケースを二重登録しないためのチェック。
 *
 * 同一予約とみなす条件は次のいずれか:
 *   1. 開始時刻が一致する予定が既にある
 *   2. 時間帯が重なっていて、タイトルに予約者名（またはその姓）が含まれる
 *
 * 1を「開始・終了の両方一致」ではなく開始時刻だけにしているのは、手入力側は
 * メニューの標準時間ではなく実際の施術見込みで終了時刻を入れており、
 * 開始は一致するが終了はずれる、というケースが実データで大半だったため。
 * 同じ開始時刻に別の客を入れることは実運用上まず無いので、誤検知は起きにくい。
 *
 * 2の名前一致は、漢字表記（RESERVA）とひらがな・愛称表記（手入力）が食い違うと
 * すり抜ける。あくまで1の補助として置いている。
 */
function findDuplicateEvent_(calendar, name, range) {
  var candidates = calendar.getEvents(range.start, range.end);
  var surname = name.split(/[\s　]+/)[0];

  for (var i = 0; i < candidates.length; i++) {
    var event = candidates[i];
    if (event.getStartTime().getTime() === range.start.getTime()) return event;

    var title = event.getTitle();
    if (title.indexOf(name) !== -1) return event;
    if (surname && surname !== name && title.indexOf(surname) !== -1) return event;
  }
  return null;
}

function parseReservaBody_(body) {
  var lines = body.split('\n').map(function (line) {
    return line.trim();
  });

  function extractAfter(header) {
    var idx = lines.indexOf(header);
    if (idx === -1) return null;
    var content = [];
    for (var i = idx + 1; i < lines.length; i++) {
      if (lines[i].indexOf('■') === 0) break;
      if (lines[i] === '') continue;
      content.push(lines[i]);
    }
    return content.length ? content.join(' ').trim() : null;
  }

  var menu = extractAfter('■予約内容');
  var name = extractAfter('■予約者の氏名');
  var datetime = extractAfter('■予約日時');
  if (!menu || !name || !datetime) return null;

  var m = datetime.match(/(\d{1,2})月(\d{1,2})日\([^)]+\)\s*(\d{1,2}):(\d{2})[～~](\d{1,2}):(\d{2})/);
  if (!m) return null;

  return {
    menu: menu,
    name: name,
    month: parseInt(m[1], 10),
    day: parseInt(m[2], 10),
    startHour: parseInt(m[3], 10),
    startMinute: parseInt(m[4], 10),
    endHour: parseInt(m[5], 10),
    endMinute: parseInt(m[6], 10)
  };
}

/**
 * メール受信年をベースに開始/終了Datetimeを組み立てる。
 * 受信日より60日以上過去になる場合は年またぎの予約とみなし翌年にする
 * （例: 12月に届いた翌年1月分の予約通知）。
 */
function buildEventRange_(info, emailDate) {
  var year = emailDate.getFullYear();
  var start = new Date(year, info.month - 1, info.day, info.startHour, info.startMinute);
  var end = new Date(year, info.month - 1, info.day, info.endHour, info.endMinute);

  var sixtyDaysMs = 60 * 24 * 60 * 60 * 1000;
  if (start.getTime() < emailDate.getTime() - sixtyDaysMs) {
    start.setFullYear(year + 1);
    end.setFullYear(year + 1);
  }

  return { start: start, end: end };
}
