// ==========================================
// LINE予約ボット - 09: セットアップ・テスト
// ★ 初回セットアップ後、トリガーの動作確認を必ず行うこと
// ==========================================

/**
 * トリガー設定（初回だけ手動実行）
 * ★ 重要：既存トリガーが重複していないか確認
 */
function createFormTrigger() {
  // 既存のonFormSubmitトリガーを確認
  var triggers = ScriptApp.getProjectTriggers();
  var existing = false;
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'onFormSubmit') {
      console.log('既存のonFormSubmitトリガーが見つかりました。ID: ' + triggers[i].getUniqueId());
      existing = true;
    }
  }

  if (existing) {
    console.log('既存トリガーがあるため、新規作成をスキップします。');
    console.log('再作成したい場合は deleteAllFormTriggers() を先に実行してください。');
    return;
  }

  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  ScriptApp.newTrigger('onFormSubmit')
    .forSpreadsheet(ss)
    .onFormSubmit()
    .create();

  console.log('onFormSubmitトリガーを作成しました');
}

/**
 * 全てのonFormSubmitトリガーを削除
 */
function deleteAllFormTriggers() {
  var triggers = ScriptApp.getProjectTriggers();
  var count = 0;
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'onFormSubmit') {
      ScriptApp.deleteTrigger(triggers[i]);
      count++;
    }
  }
  console.log(count + '個のonFormSubmitトリガーを削除しました');
}

/**
 * 現在のトリガー一覧を表示（デバッグ用）
 */
function listAllTriggers() {
  var triggers = ScriptApp.getProjectTriggers();
  if (triggers.length === 0) {
    console.log('トリガーが設定されていません');
    return;
  }
  for (var i = 0; i < triggers.length; i++) {
    console.log(
      'トリガー' + (i + 1) + ': ' +
      triggers[i].getHandlerFunction() +
      ' / イベント: ' + triggers[i].getEventType() +
      ' / ID: ' + triggers[i].getUniqueId()
    );
  }
}

/**
 * 初期セットアップ（初回だけ手動実行）
 */
function initialSetup() {
  // スクリプトプロパティの確認
  var props = PropertiesService.getScriptProperties().getProperties();
  var required = ['LINE_CHANNEL_ACCESS_TOKEN', 'GEMINI_API_KEY', 'SPREADSHEET_ID', 'MODEL_NAME'];
  var missing = [];
  for (var i = 0; i < required.length; i++) {
    if (!props[required[i]]) {
      missing.push(required[i]);
    }
  }
  if (missing.length > 0) {
    console.error('以下のスクリプトプロパティが未設定です: ' + missing.join(', '));
    console.log('GASエディタ → プロジェクトの設定 → スクリプトプロパティ で設定してください');
    return;
  }
  console.log('スクリプトプロパティ: OK');

  // form_queueシートの確認・作成
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var qSheet = ss.getSheetByName('form_queue');
  if (!qSheet) {
    qSheet = ss.insertSheet('form_queue');
    qSheet.appendRow(['userId', 'timestamp']);
    console.log('form_queueシートを作成しました');
  } else {
    console.log('form_queueシート: 既存');
  }

  // line_usersシートの確認
  var uSheet = ss.getSheetByName(USERS_SHEET_NAME);
  if (!uSheet) {
    uSheet = ss.insertSheet(USERS_SHEET_NAME);
    uSheet.appendRow(['userId', 'displayName', '登録日時']);
    console.log(USERS_SHEET_NAME + 'シートを作成しました');
  } else {
    console.log(USERS_SHEET_NAME + 'シート: 既存');
  }

  // logシートの確認
  var lSheet = ss.getSheetByName(LOG_SHEET_NAME);
  if (!lSheet) {
    lSheet = ss.insertSheet(LOG_SHEET_NAME);
    lSheet.appendRow(['timestamp', 'type', 'message', 'userId']);
    console.log(LOG_SHEET_NAME + 'シートを作成しました');
  } else {
    console.log(LOG_SHEET_NAME + 'シート: 既存');
  }

  // トリガー設定
  createFormTrigger();

  console.log('=== 初期セットアップ完了 ===');
}

/**
 * テスト用：手動実行でFlexカード＋PDF生成をシミュレート
 * ★ ADMIN_USER_IDに送信されるので、先にスクリプトプロパティを設定すること
 */
function testFormSubmit() {
  var mockResponses = {
    'LINEの表示名（そのままコピーして貼り付けてください）': ['テストユーザー'],
    'Q01　朝、髪にかけられる時間はどのくらいですか？': ['5分'],
    'Q01b　ドライヤーにかけられる時間はどのくらいですか？': ['2〜3分（さっと乾かすだけ）'],
    'Q02　朝のスタイリングで使うものは？（複数選択可）': ['ドライヤーだけ'],
    'Q08　今のヘアスタイルで、朝一番ストレスを感じる瞬間は？': ['もみあげがうねってまとまらない'],
    'Q09　癖・うねりが出やすい場所は？（複数選択可）': ['もみあげ, えり足'],
    'Q16　仕上がりの雰囲気で近いのはどれですか？': ['動きがある・軽い'],
    'Q17　長さはどのくらいを希望しますか？': ['肩〜鎖骨'],
    'Q21　過去に「これは失敗だった」と感じた経験を教えてください': ['すきすぎて広がった'],
    'Q22b　顔周りにレイヤーを入れられてスタイリングできず、パサついて見えた経験はありますか？': ['ある（跳ねて広がって困った）'],
    'Q22c　デザイン重視と再現性重視、どちらが今の自分に合っていますか？': ['再現性重視（毎日同じようにまとまりたい）'],
    'Q33　今、どんなことで一番困っていますか？': ['毎朝10分で済むスタイルにしたい'],
    'Q35　大阪四ツ橋のHEJへの来店、興味はありますか？': ['まずはLINEで相談したい']
  };

  // --- PDF生成テスト ---
  var formattedAll = formatFormAnswers(mockResponses, false);
  var formattedPdf = formatFormAnswers(mockResponses, true);

  console.log('=== 整形済み回答（全体） ===');
  console.log(formattedAll);
  console.log('');
  console.log('=== 整形済み回答（PDF用：Block6除外） ===');
  console.log(formattedPdf);

  var setsumeisho = generateSetsumeishoWithGemini(formattedAll, 'テストユーザー');
  console.log('');
  console.log('=== Gemini生成結果 ===');
  console.log(setsumeisho);

  var pdfUrl = createSetsumeishoPdf(setsumeisho, formattedPdf, 'テストユーザー');
  console.log('');
  console.log('=== PDF URL ===');
  console.log(pdfUrl);

  var flexCard = buildFlexCard('テストユーザー', pdfUrl);
  console.log('');
  console.log('=== Flex JSON ===');
  console.log(JSON.stringify(flexCard, null, 2));

  console.log('');
  console.log('=== CTA メッセージ ===');
  console.log(buildCtaMessage());

  // 管理者にテスト送信
  if (CONFIG.ADMIN_USER_ID) {
    console.log('');
    console.log('管理者にテストFlexメッセージを送信します...');
    sendFlexPushMessage(CONFIG.ADMIN_USER_ID, flexCard);
    Utilities.sleep(500);
    sendPushMessage(CONFIG.ADMIN_USER_ID, buildCtaMessage());
    console.log('テスト送信完了');
  } else {
    console.log('ADMIN_USER_ID未設定のためLINE送信はスキップ');
  }
}

/**
 * デバッグ用：スクリプトプロパティの確認
 */
function checkConfig() {
  var props = PropertiesService.getScriptProperties().getProperties();
  var keys = Object.keys(props);
  for (var i = 0; i < keys.length; i++) {
    var val = props[keys[i]];
    // トークンは一部マスク
    var masked = val.length > 10 ? val.substring(0, 5) + '...' + val.substring(val.length - 5) : '(短い値)';
    console.log(keys[i] + ': ' + masked);
  }

  console.log('');
  console.log('CONFIG.SPREADSHEET_ID: ' + (CONFIG.SPREADSHEET_ID ? 'SET' : 'EMPTY'));
  console.log('CONFIG.LINE_CHANNEL_ACCESS_TOKEN: ' + (CONFIG.LINE_CHANNEL_ACCESS_TOKEN ? 'SET' : 'EMPTY'));
  console.log('CONFIG.GEMINI_API_KEY: ' + (CONFIG.GEMINI_API_KEY ? 'SET' : 'EMPTY'));
  console.log('CONFIG.MODEL_NAME: ' + CONFIG.MODEL_NAME);
  console.log('CONFIG.ADMIN_USER_ID: ' + (CONFIG.ADMIN_USER_ID ? 'SET' : 'EMPTY'));
}
