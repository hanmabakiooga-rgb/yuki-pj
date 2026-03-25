// ==========================================
// LINE予約ボット v7.15 - Part4: 説明書自動生成（Flexメッセージ＋PDF版）
// Googleフォーム回答 → Gemini生成 → PDF作成 → FlexメッセージでLINE送信
// 既存コード（Part1〜3）は一切変更不要
// ★ LINEブラウザ プリフィル無視 対策済み
// ★ BLOCK6（HEJへの相談）はPDFから除外
//
// 【前提】Part1〜3で以下が定義済み：
//   CONFIG（.SPREADSHEET_ID, .LINE_CHANNEL_ACCESS_TOKEN, .GEMINI_API_KEY, .MODEL_NAME）
//   sendPushMessage(userId, text)
//   logToSheet(type, message, userId)
// ==========================================


// ===== PDF配信（軽量リダイレクト方式） =====
// WebアプリURL?pdf=ファイルID → Google Drive直ダウンロードURLへ即リダイレクト
// HTMLは数百バイトだけなのでLINEアプリ内ブラウザでもログイン画面が出ない
function doGet(e) {
  var fileId = e && e.parameter && e.parameter.pdf;
  if (!fileId) {
    return HtmlService.createHtmlOutput('<p>パラメータが不正です。</p>');
  }

  try {
    var file = DriveApp.getFileById(fileId);
    // 念のため共有設定（すでにcreateSetsumeishoPdfで設定済みだが安全策）
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    var driveUrl = 'https://drive.google.com/uc?id=' + fileId + '&export=download';

    // 超軽量HTML: meta refreshで即リダイレクト + 手動リンクも用意
    var html = '<!DOCTYPE html><html><head>'
      + '<meta charset="UTF-8">'
      + '<meta http-equiv="refresh" content="0;url=' + driveUrl + '">'
      + '<meta name="viewport" content="width=device-width,initial-scale=1.0">'
      + '<title>PDF - 髪の説明書</title>'
      + '<style>'
      + 'body{margin:0;padding:40px 20px;font-family:sans-serif;text-align:center;background:#f5f0eb}'
      + 'p{color:#666;font-size:14px;margin-bottom:20px}'
      + 'a{display:inline-block;padding:14px 32px;background:#8B6F5E;color:#fff;'
      + 'text-decoration:none;border-radius:8px;font-size:16px;font-weight:bold}'
      + '</style></head><body>'
      + '<p>PDFを準備中...</p>'
      + '<a href="' + driveUrl + '">ダウンロードが始まらない場合はこちら</a>'
      + '</body></html>';

    return HtmlService.createHtmlOutput(html)
      .setTitle('髪の説明書')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  } catch (err) {
    return HtmlService.createHtmlOutput(
      '<p>ファイルが見つかりません。<br>リンクの有効期限が切れている可能性があります。</p>'
    );
  }
}


// ===== 【設定】シート名 =====
const FORM_SHEET_NAME = 'フォームの回答 1';
const USERS_SHEET_NAME = 'line_users';

// ===== 【設定】WebアプリURL =====
// GASエディタで一度 initWebAppUrl() を実行してください（初回のみ）
function getWebAppUrl() {
  var url = PropertiesService.getScriptProperties().getProperty('WEB_APP_URL');
  if (!url) {
    // フォールバック: 実行時に取得を試みる
    try {
      url = ScriptApp.getService().getUrl();
      if (url) {
        PropertiesService.getScriptProperties().setProperty('WEB_APP_URL', url);
      }
    } catch (e) {}
  }
  return url || '';
}

// GASエディタで一度だけ手動実行 → WebアプリURLをスクリプトプロパティに保存
function initWebAppUrl() {
  var url = ScriptApp.getService().getUrl();
  if (url) {
    PropertiesService.getScriptProperties().setProperty('WEB_APP_URL', url);
    console.log('WebアプリURL保存完了: ' + url);
  } else {
    console.log('エラー: WebアプリURLが取得できません。先にデプロイしてください。');
  }
}

// フォーム回答整形時に除外するキーワード
const skipKeys       = ['識別コード', 'タイムスタンプ', 'Timestamp'];
const skipKeysBlock6 = ['Q33', 'Q34', 'Q35'];


// ===== フォーム送信トリガー（メイン） =====
function onFormSubmit(e) {
  console.log('=== onFormSubmit 開始 ===');

  try {
    // --- イベントオブジェクトの検証 ---
    if (!e || !e.namedValues) {
      console.error('イベントオブジェクトが不正です: ' + JSON.stringify(e));
      notifyAdmin('onFormSubmitにイベントオブジェクトが渡されていません。トリガー設定を確認してください。');
      return;
    }

    const responses = e.namedValues;
    console.log('フォーム回答キー: ' + Object.keys(responses).join(', '));

    // --- Step 1: userIdを取得 ---
    let userId = null;
    const userIdRaw = getResponseValue(responses, '識別コード');
    console.log('Q00 識別コード(raw): [' + userIdRaw + ']');

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

    // --- Step 2: LINE表示名を取得 ---
    let displayName = 'お客様';
    try {
      const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
      const usersSheet = ss.getSheetByName(USERS_SHEET_NAME);
      if (usersSheet) {
        const data = usersSheet.getDataRange().getValues();
        for (let i = 1; i < data.length; i++) {
          if (String(data[i][0]).trim() === userId) {
            displayName = String(data[i][1]).trim() || 'お客様';
            break;
          }
        }
      }
    } catch (nameErr) {
      console.warn('表示名取得失敗: ' + nameErr.toString());
    }
    console.log('表示名: ' + displayName);

    // --- Step 3: フォーム回答を整形 ---
    const formattedAnswersAll = formatFormAnswers(responses, false);
    const formattedAnswersPdf = formatFormAnswers(responses, true);
    console.log('回答整形完了 (全体: ' + formattedAnswersAll.length + '文字, PDF用: ' + formattedAnswersPdf.length + '文字)');

    // --- Step 4: Geminiで説明書を生成 ---
    console.log('Gemini生成開始...');
    const setsumeisho = generateSetsumeishoWithGemini(formattedAnswersAll, displayName);
    console.log('Gemini生成完了 (' + setsumeisho.length + '文字)');

    // --- Step 5: PDFを作成 ---
    console.log('PDF作成開始...');
    const pdfUrl = createSetsumeishoPdf(setsumeisho, formattedAnswersPdf, displayName);
    console.log('PDF作成完了: ' + pdfUrl);

    // --- Step 6: LINE送信（Flexメッセージ） ---
    console.log('Flexメッセージ送信...');
    const flexOk = sendFlexPushMessage(userId, buildFlexCard(displayName, pdfUrl));
    if (!flexOk) {
      notifyAdmin(displayName + 'さんへのFlexメッセージ送信に失敗しました。PDF URL: ' + pdfUrl);
    }

    Utilities.sleep(500);

    // --- Step 7: LINE送信（CTAテキスト） ---
    console.log('CTAメッセージ送信...');
    sendPushMessage(userId, buildCtaMessage());

    logToSheet('FORM', displayName + 'さんへ説明書PDFを送信しました', userId);
    console.log('=== onFormSubmit 完了 ===');

  } catch (err) {
    console.error('onFormSubmit 例外: ' + err.toString() + '\n' + (err.stack || ''));
    logToSheet('FORM_ERROR', err.toString(), 'unknown');
    notifyAdmin('onFormSubmit例外エラー: ' + err.toString());
  }
}


// ===== 管理者にLINE通知 =====
function notifyAdmin(message) {
  const adminId = CONFIG.ADMIN_USER_ID
    || PropertiesService.getScriptProperties().getProperty('ADMIN_USER_ID');
  if (adminId) {
    try {
      sendPushMessage(adminId, '⚠️ ' + message);
    } catch (e) {
      console.error('管理者通知失敗: ' + e.toString());
    }
  } else {
    console.warn('ADMIN_USER_IDが未設定のため管理者通知をスキップ');
  }
}


// ===== Flexメッセージ送信 =====
function sendFlexPushMessage(userId, flexContents) {
  const url = 'https://api.line.me/v2/bot/message/push';
  const payload = {
    to: userId,
    messages: [
      {
        type: 'flex',
        altText: '「あなただけの髪の説明書」ができました',
        contents: flexContents
      }
    ]
  };

  try {
    const res = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      headers: {
        Authorization: 'Bearer ' + CONFIG.LINE_ACCESS_TOKEN
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    const code = res.getResponseCode();
    if (code !== 200) {
      console.error('sendFlexPushMessage 失敗 [' + code + ']: ' + res.getContentText());
      return false;
    }
    console.log('sendFlexPushMessage 成功');
    return true;
  } catch (e) {
    console.error('sendFlexPushMessage 例外: ' + e.toString());
    return false;
  }
}


// ===== Flexカード：PDF案内 =====
function buildFlexCard(displayName, pdfUrl) {
  const today = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy年MM月dd日');
  return {
    type: 'bubble',
    size: 'mega',
    header: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: '#8B6F5E',
      paddingAll: '20px',
      contents: [
        {
          type: 'text',
          text: '髪の説明書',
          color: '#ffffff',
          size: 'xl',
          weight: 'bold'
        },
        {
          type: 'text',
          text: displayName + 'さん専用',
          color: '#f0e0d6',
          size: 'sm',
          margin: 'sm'
        }
      ]
    },
    body: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '20px',
      contents: [
        {
          type: 'text',
          text: 'フォームのご回答ありがとうございます',
          wrap: true,
          size: 'sm',
          color: '#555555'
        },
        {
          type: 'text',
          text: 'あなただけの髪の説明書ができました。\n美容室でそのまま担当さんに見せてください。',
          wrap: true,
          size: 'sm',
          color: '#555555',
          margin: 'md'
        },
        {
          type: 'separator',
          margin: 'lg'
        },
        {
          type: 'box',
          layout: 'horizontal',
          margin: 'lg',
          contents: [
            {
              type: 'text',
              text: '作成日',
              size: 'xs',
              color: '#aaaaaa',
              flex: 2
            },
            {
              type: 'text',
              text: today,
              size: 'xs',
              color: '#555555',
              flex: 5
            }
          ]
        }
      ]
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '16px',
      contents: [
        {
          type: 'button',
          style: 'primary',
          color: '#8B6F5E',
          height: 'sm',
          action: {
            type: 'uri',
            label: 'PDFを開く・保存する',
            uri: pdfUrl
          }
        }
      ]
    }
  };
}


// ===== CTA テキストメッセージ =====
function buildCtaMessage() {
  return '大阪四ツ橋のHEJにご来店の場合は、このPDFをそのままLINEで送っていただければ事前に確認します😊\nご予約・ご相談はこのLINEからどうぞ！';
}


// ===== PDF作成 → Driveに保存 → 共有URLを返す =====
function createSetsumeishoPdf(setsumeisho, formAnswersPdf, displayName) {
  const today = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy年MM月dd日');
  const title = displayName + 'さんの髪の説明書';

  const doc  = DocumentApp.create(title);
  const body = doc.getBody();

  // タイトル
  const titlePara = body.appendParagraph(title);
  titlePara.setHeading(DocumentApp.ParagraphHeading.HEADING1);
  titlePara.setAlignment(DocumentApp.HorizontalAlignment.CENTER);

  // 作成日
  const datePara = body.appendParagraph('作成日：' + today);
  datePara.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  datePara.setFontSize(10);

  body.appendParagraph('━━━━━━━━━━━━━━━━━━━━━━━').setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  body.appendParagraph('');

  // Gemini生成の説明書本文
  body.appendParagraph(setsumeisho).setFontSize(11);
  body.appendParagraph('');

  body.appendParagraph('━━━━━━━━━━━━━━━━━━━━━━━').setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  body.appendParagraph('');

  // フォーム回答詳細（Block6除外）
  const detailHeader = body.appendParagraph('【フォーム回答詳細】');
  detailHeader.setHeading(DocumentApp.ParagraphHeading.HEADING2);
  body.appendParagraph(formAnswersPdf).setFontSize(10);

  doc.saveAndClose();

  // PDFとしてエクスポートしてDriveに保存
  const docFile = DriveApp.getFileById(doc.getId());
  const pdfBlob = docFile.getAs('application/pdf');
  pdfBlob.setName(title + '.pdf');
  const pdfFile = DriveApp.createFile(pdfBlob);

  // 元のGoogle Docはゴミ箱へ
  docFile.setTrashed(true);

  // 常にDrive共有を設定（doGetリダイレクト先でも必要）
  pdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  // WebアプリURL経由（軽量リダイレクトページ → Drive直ダウンロード）
  const webAppUrl = getWebAppUrl();
  if (webAppUrl) {
    return webAppUrl + '?pdf=' + pdfFile.getId();
  }
  // フォールバック: Google Driveの直接ダウンロードURL
  return 'https://drive.google.com/uc?id=' + pdfFile.getId() + '&export=download';
}


// ===== フォーム回答を整形 =====
// excludeBlock6 = true のとき Q33〜Q35 を除外
function formatFormAnswers(responses, excludeBlock6) {
  const lines = [];
  for (const [question, answerArr] of Object.entries(responses)) {
    if (skipKeys.some(k => question.includes(k))) continue;
    if (excludeBlock6 && skipKeysBlock6.some(k => question.includes(k))) continue;

    const answer = Array.isArray(answerArr) ? answerArr[0] : answerArr;
    if (answer && String(answer).trim() !== '') {
      lines.push('【' + question + '】\n' + String(answer).trim());
    }
  }
  return lines.join('\n\n');
}


// ===== Geminiで説明書を生成 =====
function generateSetsumeishoWithGemini(formAnswers, displayName) {
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' +
    CONFIG.MODEL_NAME + ':generateContent?key=' + CONFIG.GEMINI_API_KEY;

  const payload = {
    contents: [
      { role: 'user', parts: [{ text: buildSetsumeishoPrompt(formAnswers, displayName) }] }
    ],
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 1500
    }
  };

  try {
    const res = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    const code = res.getResponseCode();
    if (code === 200) {
      const content = JSON.parse(res.getContentText());
      if (content.candidates && content.candidates[0] &&
          content.candidates[0].content && content.candidates[0].content.parts) {
        return content.candidates[0].content.parts[0].text.trim();
      }
      console.error('Gemini レスポンス構造が不正: ' + res.getContentText().substring(0, 500));
    } else {
      console.error('Gemini API エラー [' + code + ']: ' + res.getContentText().substring(0, 500));
    }
  } catch (e) {
    console.error('generateSetsumeishoWithGemini 例外: ' + e.toString());
  }

  // フォールバック：回答をそのまま返す
  console.warn('Gemini生成失敗のため、フォーム回答をそのまま使用します');
  return formAnswers;
}


// ===== 説明書生成プロンプト =====
function buildSetsumeishoPrompt(formAnswers, displayName) {
  return `あなたは美容師川崎（大阪四ツ橋のHEJ Haircolor rab）のアシスタントAIです。
以下はお客様「${displayName}」さんが記入したヘアカウンセリングフォームの回答です。

【フォーム回答】
${formAnswers}

---

この回答をもとに「${displayName}さんの唯一無二の髪の説明書」を作成してください。

【出力形式】
美容師に渡せるコンパクトな説明書として、以下の構成で日本語で出力してください。
箇条書きは使わず、読みやすい短文で書いてください。

■ 朝のリアルな状況
（朝の時間、ドライヤー時間、子ども・家族の有無、スタイリング道具など）

■ 髪質・癖の特徴
（癖の場所・種類、雨の日の変化、量・太さ、乾かした後の状態、履歴など）

■ 理想の仕上がり
（雰囲気、長さ、前髪、顔まわり、参考写真のポイントなど）

■ 過去の失敗・NGリスト
（すかれすぎ、レイヤー失敗、カラー褪色など）

■ カラー・施術の意向
（来店頻度、白髪状況、ブリーチ履歴、TR意向、予算など）

■ 美容室への本音
（言えなかったこと、今一番困っていること、担当への要望など）

■ 川崎へのひとこと
（Q34・Q35の回答をもとに、来店意欲や相談内容を一文で）

【トーンの注意】
・AIっぽくない、温かみのある自然な文章で
・「〜です」「〜ます」調で統一
・専門用語は使わず、美容師が直感的に理解できる言葉で`;
}


// ===== form_queueからタイムスタンプでuserIdを逆引き =====
function lookupUserIdFromQueue() {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const qSheet = ss.getSheetByName('form_queue');
    if (!qSheet) {
      console.warn('form_queueシートが見つかりません');
      return null;
    }

    const data = qSheet.getDataRange().getValues();
    if (data.length <= 1) {
      console.warn('form_queueにデータがありません');
      return null;
    }

    const now = new Date();
    const WINDOW_MS = 60 * 60 * 1000; // ★ 60分に拡大（元は30分）

    let bestRow = -1;
    let bestDiff = WINDOW_MS;

    for (let i = 1; i < data.length; i++) {
      const ts = new Date(data[i][1]);
      const diff = Math.abs(now.getTime() - ts.getTime());
      if (diff < bestDiff) {
        bestDiff = diff;
        bestRow = i;
      }
    }

    if (bestRow === -1) {
      console.warn('form_queueに一致するエントリなし（60分以内）');
      return null;
    }

    const userId = String(data[bestRow][0]).trim();
    qSheet.deleteRow(bestRow + 1);
    console.log('form_queueマッチ: ' + userId + ' (差分: ' + Math.round(bestDiff / 1000) + '秒)');
    return userId;
  } catch (e) {
    console.error('lookupUserIdFromQueue 例外: ' + e.toString());
    return null;
  }
}


// ===== 回答値取得ユーティリティ =====
function getResponseValue(responses, questionKey) {
  // 完全一致
  if (responses[questionKey]) {
    const val = responses[questionKey];
    return Array.isArray(val) ? val[0] : val;
  }
  // 部分一致
  for (const key of Object.keys(responses)) {
    if (key.includes(questionKey) || questionKey.includes(key)) {
      const val = responses[key];
      return Array.isArray(val) ? val[0] : val;
    }
  }
  return null;
}


// ===== 説明書フォームURL送信（キュー保存つき） =====
function sendFormUrl(userId) {
  const formBase = 'https://docs.google.com/forms/d/e/1FAIpQLSeUpXV7g5SOGwg1jIVHERaLMVp5lNnj-5Sxgrr3TyNBvlODWw/viewform';
  const formUrl  = formBase + '?entry.1222464951=' + encodeURIComponent(userId);

  const msg = '「あなただけの髪の説明書」を作ります📋\n\n' +
    '下のフォームに回答してください（約5分）\n' +
    '回答後、LINEにPDFをお送りします✨\n\n' +
    '▼ フォームはこちら\n' + formUrl;

  sendPushMessage(userId, msg);

  // form_queueにuserIdとタイムスタンプを保存
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    let qSheet = ss.getSheetByName('form_queue');
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


// ===== トリガー設定（初回だけ手動実行） =====
function createFormTrigger() {
  // 既存トリガーの重複チェック
  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'onFormSubmit') {
      console.log('既存のonFormSubmitトリガーがあります。ID: ' + triggers[i].getUniqueId());
      console.log('再作成する場合は先にdeleteAllFormTriggers()を実行してください。');
      return;
    }
  }

  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  ScriptApp.newTrigger('onFormSubmit')
    .forSpreadsheet(ss)
    .onFormSubmit()
    .create();
  console.log('onFormSubmitトリガーを作成しました');
}


// ===== トリガー全削除 =====
function deleteAllFormTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  let count = 0;
  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'onFormSubmit') {
      ScriptApp.deleteTrigger(triggers[i]);
      count++;
    }
  }
  console.log(count + '個のonFormSubmitトリガーを削除しました');
}


// ===== トリガー一覧表示 =====
function listAllTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  if (triggers.length === 0) {
    console.log('トリガーが設定されていません');
    return;
  }
  triggers.forEach((t, i) => {
    console.log((i + 1) + ': ' + t.getHandlerFunction() + ' / ' + t.getEventType() + ' / ID:' + t.getUniqueId());
  });
}


// ===== テスト用：手動実行でPDF生成＋LINE送信をシミュレート =====
function testFormSubmit() {
  const mockResponses = {
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

  const formattedAll = formatFormAnswers(mockResponses, false);
  const formattedPdf = formatFormAnswers(mockResponses, true);
  const setsumeisho  = generateSetsumeishoWithGemini(formattedAll, 'テストユーザー');
  const pdfUrl       = createSetsumeishoPdf(setsumeisho, formattedPdf, 'テストユーザー');
  const flexCard     = buildFlexCard('テストユーザー', pdfUrl);

  console.log('=== PDF URL ===');
  console.log(pdfUrl);
  console.log('=== Flex JSON ===');
  console.log(JSON.stringify(flexCard, null, 2));
  console.log('=== CTA メッセージ ===');
  console.log(buildCtaMessage());

  // ADMIN_USER_IDがあればテスト送信
  const adminId = CONFIG.ADMIN_USER_ID
    || PropertiesService.getScriptProperties().getProperty('ADMIN_USER_ID');
  if (adminId) {
    console.log('管理者にテスト送信...');
    sendFlexPushMessage(adminId, flexCard);
    Utilities.sleep(500);
    sendPushMessage(adminId, buildCtaMessage());
    console.log('テスト送信完了');
  }
}


// ===== LINEユーザー情報をline_usersシートに保存 =====
function saveLineUser(userId, displayName) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    let sheet = ss.getSheetByName('line_users');
    if (!sheet) {
      sheet = ss.insertSheet('line_users');
      sheet.appendRow(['userId', 'displayName', 'updatedAt']);
    }

    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === userId) {
        sheet.getRange(i + 1, 2).setValue(displayName);
        sheet.getRange(i + 1, 3).setValue(new Date());
        return;
      }
    }

    sheet.appendRow([userId, displayName, new Date()]);
  } catch (e) {
    console.error('saveLineUser失敗: ' + e.toString());
  }
}
