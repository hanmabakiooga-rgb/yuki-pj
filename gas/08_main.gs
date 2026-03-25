// ==========================================
// LINE予約ボット - 08: メイン（フォーム送信ハンドラ）
// フォーム回答 → Gemini生成 → PDF作成 → LINE送信
// ==========================================

/**
 * フォーム送信トリガー（メイン）
 * スプレッドシートのフォーム送信イベントで呼び出される
 *
 * 【修正点】
 * 1. CONFIG未定義エラーの防止（01_config.gsで定義）
 * 2. sendPushMessage等の依存関数を02_line_api.gsで定義
 * 3. LINE APIエラーのログ出力追加
 * 4. form_queueの検索ウィンドウを60分に拡大
 * 5. Date比較をgetTime()で明示化
 * 6. 各ステップのエラーハンドリング強化
 * 7. 管理者への通知を確実に送信
 */
function onFormSubmit(e) {
  console.log('=== onFormSubmit 開始 ===');

  try {
    // イベントオブジェクトの検証
    if (!e || !e.namedValues) {
      console.error('イベントオブジェクトが不正です: ' + JSON.stringify(e));
      notifyAdmin('onFormSubmitにイベントオブジェクトが渡されていません');
      return;
    }

    var responses = e.namedValues;
    console.log('フォーム回答キー: ' + Object.keys(responses).join(', '));

    // --- Step 1: userIdを取得 ---
    var userId = null;
    var userIdRaw = getResponseValue(responses, '識別コード');
    console.log('Q00 識別コード(raw): ' + userIdRaw);

    if (userIdRaw && String(userIdRaw).trim() !== '') {
      userId = String(userIdRaw).trim();
      console.log('Q00からuserIdを取得: ' + userId);
    } else {
      console.log('Q00が空のため、form_queueから逆引き開始');
      userId = lookupUserIdFromQueue();
      if (!userId) {
        console.error('userIdが取得できませんでした（Q00空・キュー一致なし）');
        notifyAdmin('フォーム回答がありましたがuserIdの紐付けができませんでした。手動確認をお願いします。');
        return;
      }
      console.log('form_queueからuserIdをマッチ: ' + userId);
    }

    // --- Step 2: 表示名を取得 ---
    var displayName = lookupDisplayNameByUserId(userId);
    console.log('表示名: ' + displayName);

    // --- Step 3: フォーム回答を整形 ---
    var formattedAnswersAll = formatFormAnswers(responses, false);
    var formattedAnswersPdf = formatFormAnswers(responses, true);
    console.log('フォーム回答整形完了 (全体: ' + formattedAnswersAll.length + '文字, PDF用: ' + formattedAnswersPdf.length + '文字)');

    // --- Step 4: Geminiで説明書を生成 ---
    console.log('Gemini生成開始...');
    var setsumeisho = generateSetsumeishoWithGemini(formattedAnswersAll, displayName);
    console.log('Gemini生成完了 (' + setsumeisho.length + '文字)');

    // --- Step 5: PDFを作成 ---
    console.log('PDF作成開始...');
    var pdfUrl = createSetsumeishoPdf(setsumeisho, formattedAnswersPdf, displayName);
    console.log('PDF作成完了: ' + pdfUrl);

    // --- Step 6: LINE送信（Flexメッセージ） ---
    console.log('Flexメッセージ送信開始...');
    var flexResult = sendFlexPushMessage(userId, buildFlexCard(displayName, pdfUrl));
    if (!flexResult) {
      console.error('Flexメッセージ送信失敗');
      notifyAdmin(displayName + 'さんへのFlexメッセージ送信に失敗しました。PDF URL: ' + pdfUrl);
    }

    Utilities.sleep(500);

    // --- Step 7: LINE送信（CTAテキスト） ---
    console.log('CTAメッセージ送信開始...');
    var ctaResult = sendPushMessage(userId, buildCtaMessage());
    if (!ctaResult) {
      console.error('CTAメッセージ送信失敗');
    }

    logToSheet('FORM', displayName + 'さんへ説明書PDFを送信しました', userId);
    console.log('=== onFormSubmit 完了 ===');

  } catch (err) {
    console.error('onFormSubmit 例外: ' + err.toString() + '\nStack: ' + (err.stack || ''));
    logToSheet('FORM_ERROR', err.toString(), 'unknown');
    notifyAdmin('onFormSubmit例外エラー: ' + err.toString());
  }
}

/**
 * 管理者にLINE通知
 * @param {string} message
 */
function notifyAdmin(message) {
  if (CONFIG.ADMIN_USER_ID) {
    try {
      sendPushMessage(CONFIG.ADMIN_USER_ID, '⚠️ ' + message);
    } catch (e) {
      console.error('管理者通知失敗: ' + e.toString());
    }
  } else {
    console.warn('ADMIN_USER_IDが未設定のため管理者通知をスキップ');
  }
}

/**
 * 説明書フォームURL送信（キュー保存つき）
 * @param {string} userId
 */
function sendFormUrl(userId) {
  var formBase = 'https://docs.google.com/forms/d/e/1FAIpQLSeUpXV7g5SOGwg1jIVHERaLMVp5lNnj-5Sxgrr3TyNBvlODWw/viewform';
  var formUrl  = formBase + '?entry.1222464951=' + encodeURIComponent(userId);

  var msg = '「あなただけの髪の説明書」を作ります\n\n' +
    '下のフォームに回答してください（約5分）\n' +
    '回答後、LINEにPDFをお送りします\n\n' +
    '▼ フォームはこちら\n' + formUrl;

  sendPushMessage(userId, msg);

  // form_queueにuserIdとタイムスタンプを保存
  try {
    var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    var qSheet = ss.getSheetByName('form_queue');
    if (!qSheet) {
      qSheet = ss.insertSheet('form_queue');
      qSheet.appendRow(['userId', 'timestamp']);
    }
    qSheet.appendRow([userId, new Date()]);
    console.log('form_queueに保存: ' + userId);
  } catch (qErr) {
    console.error('form_queue保存失敗: ' + qErr.toString());
  }
}
