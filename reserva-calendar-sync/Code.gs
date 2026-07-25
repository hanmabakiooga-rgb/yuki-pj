/**
 * RESERVA予約通知メール（noreply@reserva.be）をGoogleカレンダーに自動登録するスクリプト。
 * 登録するのは「予約者の氏名」「予約内容（メニュー）」「予約日時」の3項目のみ。
 */

var RESERVA_LABEL_NAME = 'RESERVA登録済み';
var RESERVA_SEARCH_QUERY = 'from:noreply@reserva.be subject:予約が入りました';

/**
 * トリガーから定期実行するメイン処理。
 */
function syncReservaToCalendar() {
  var label = getOrCreateLabel_(RESERVA_LABEL_NAME);
  var threads = GmailApp.search(RESERVA_SEARCH_QUERY + ' -label:"' + RESERVA_LABEL_NAME + '"', 0, 50);
  var calendar = CalendarApp.getDefaultCalendar();

  threads.forEach(function (thread) {
    thread.getMessages().forEach(function (message) {
      var info = parseReservaBody_(message.getPlainBody());
      if (!info) return;

      var range = buildEventRange_(info, message.getDate());
      calendar.createEvent(info.name + '様 - ' + info.menu, range.start, range.end);
    });
    thread.addLabel(label);
  });
}

/**
 * 初回のみ手動実行し、15分おきの定期実行トリガーを登録する。
 */
function createTrigger() {
  ScriptApp.newTrigger('syncReservaToCalendar')
    .timeBased()
    .everyMinutes(15)
    .create();
}

function getOrCreateLabel_(name) {
  return GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name);
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
