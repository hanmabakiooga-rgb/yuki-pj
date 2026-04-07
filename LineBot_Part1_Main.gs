// ==========================================
// LINE予約ボット v7.12 - Part1: 設定とメイン処理
// 改善版: エラーハンドリング強化、doPost分割、定数化
// ==========================================

// ===== 設定 =====
const PROPS = PropertiesService.getScriptProperties();
const CONFIG = {
  GEMINI_API_KEY: PROPS.getProperty('GEMINI_API_KEY'),
  LINE_ACCESS_TOKEN: PROPS.getProperty('LINE_ACCESS_TOKEN'),
  CALENDAR_ID: PROPS.getProperty('CALENDAR_ID'),
  SPREADSHEET_ID: PROPS.getProperty('SPREADSHEET_ID'),
  MODEL_NAME: 'gemini-2.0-flash',
  SESSION_TIMEOUT_HOURS: 24
};

// ===== セッション状態定数（マジックストリング排除） =====
const SESSION_STATUS = {
  IDLE: "IDLE",
  SELECTING: "SELECTING",
  MENU_CONFIRM: "MENU_CONFIRM",
  COMPLETED: "COMPLETED",
  MANUAL_MODE: "MANUAL_MODE",
  CANCEL_CONFIRM: "CANCEL_CONFIRM",
  CHANGE_SELECT_BOOKING: "CHANGE_SELECT_BOOKING",
  CANCEL_SELECT_BOOKING: "CANCEL_SELECT_BOOKING",
  CHANGE_SELECTING: "CHANGE_SELECTING"
};

// ===== 営業時間設定 =====
const BUSINESS_HOURS = {
  weekday: { start: 11, end: 20, lastBooking: 18 },
  weekend: { start: 10, end: 19, lastBooking: 17 }
};

// ===== キーワード定数 =====
const NEW_CUSTOMER_KEYWORDS = [
  "初めまして", "はじめまして", "初めて来", "初めてです",
  "スレッズ見て", "threads見て", "スレッズから", "Threadsから", "threadsから",
  "インスタ見て", "instagram見て", "インスタから",
  "ホットペッパー見て", "ホットペッパーから",
  "SNSから", "snsから", "初回", "初めて予約"
];

const NEW_CUSTOMER_PATTERNS = [
  /紹介され/, /ご紹介で/, /友達の紹介/, /知人の紹介/,
  /見つけて.*予約/, /気になって.*連絡/,
  /[Tt]hreads.*から/, /スレッズ.*から/, /インスタ.*から/,
  /[Ii]nstagram.*から/
];

// ===== AIストップ設定 =====
const AI_STOP_KEYWORDS = ["AIストップ", "aiストップ", "AI停止", "手動対応", "botオフ", "BOTオフ", "ボットオフ"];
const AI_STOP_HOURS = 24; // AIストップ後のMANUAL_MODE維持時間（時間）

const MENU_DURATION = {
  "リタッチ": 90, "カラー": 120, "フルカラー": 120,
  "ストレート": 180, "カラトリ": 150, "相談": 120, "ブリーチ": 240,
  // 複合メニュー
  "ストレート+カラー": 300, "ストレート+フルカラー": 300,
  "ストレート+リタッチ": 270, "カラー+カラトリ": 270,
  "フルカラー+カラトリ": 270, "ブリーチ+カラー": 360,
  "ブリーチ+フルカラー": 360, "ブリーチ+カラトリ": 390
};

// ===== メニュー時間取得（複合メニュー対応） =====
function getMenuDuration(menu) {
  if (!menu) return 120;
  // 直接マッチ
  if (MENU_DURATION[menu]) return MENU_DURATION[menu];
  // 「+」区切りの複合メニューを分解して合計
  if (menu.includes("+")) {
    let total = 0;
    const parts = menu.split("+").map(s => s.trim());
    for (const part of parts) {
      total += MENU_DURATION[part] || 120;
    }
    return total;
  }
  return 120;
}

const AITARO_GREETING = "お問い合わせありがとうございます🙏\n私は店主 川崎殿に創られたAI家来の愛太郎です✨\nAIの愛です 笑\n\nなんなりとお申し付けください！";

const OPERATOR_BOOKING_PATTERN = /[（(](\d{1,2})月(\d{1,2})日?\s*(\d{1,2})[:時]?(\d{0,2})?\s*(リタッチ|カラー|フルカラー|ストレート|カラトリ|相談|白髪染め|ブリーチ)[）)]\s*ご予約確定/;

const CHANGE_KEYWORDS = ["予約変更", "日時変更", "時間変更", "変更したい", "変更して", "変更できる", "変更可能", "変えたい", "ずらしたい", "別の日に", "違う時間", "予定が入って", "早めて", "遅らせて"];
const CANCEL_KEYWORDS = ["キャンセル", "取り消し", "取消", "予約取消", "やめたい", "行けなくなった", "無理になった", "都合悪く"];
const TENTATIVE_CANCEL_KEYWORDS = ["一旦キャンセル", "いったんキャンセル", "また連絡", "後日", "考えます", "検討します", "やっぱりやめ", "やめときます", "やめておきます"];
const REUNION_KEYWORDS = ["お久しぶり", "ご無沙汰", "ごぶさた", "久しぶり", "お元気ですか"];
const RESTART_KEYWORDS = ["やり直す", "最初から", "リセット", "もう一度", "戻る"];
const AVAILABILITY_CHECK_KEYWORDS = ["予約状況", "空き", "空いて", "取れ", "あいて"];
const PRICE_KEYWORDS = ["料金", "値段", "価格", "いくら", "どのくらい", "費用", "おいくら", "金額"];
const SETSUMEISHO_KEYWORDS = ["説明書", "髪の説明書", "説明書ください", "説明書が欲しい", "説明書を作る"];
const PDF_KEYWORDS = ["損する話", "損する話ください", "損する話が欲しい", "損する話を見たい"];
const SONSURU_PDF_URL = "https://drive.google.com/file/d/1_d2DxWJRryA__4k0iQfLzkqwQgDvFWiU/view?usp=sharing";

const PRICE_MESSAGE = `料金のご案内です💇✨

【リタッチ】
6,600円〜　約90分

【フルカラー（トリートメント込）】
11,000円〜　約120分

【Wカラー（トリートメント込）】
25,000円〜

カラーメニューには以下がすべて込みです：
・塗り分けや重ね塗り
・ローライトやセクションカラー
・ブリーチを使わないハイライト
・頭皮ケア前後
・補修トリートメント

【フルカラートリートメント漬け】
15,500円〜　約150分

【髪質整形ストレート＋トリートメント漬け】
15,000円〜　約180分

【トリートメント漬け】
8,800円〜　約90分

※すべて税込みです。
※ご新規様は通常時間より＋30分ほど長くなります。
※お会計は現金のみとなります。

ご予約・ご質問はこちらまでお気軽にどうぞ😊
場所は502号室です🏠`;

const DAY_OF_CONTACT_PATTERNS = [
  /早く着/, /早くつい/, /遅れ/, /遅くなり/, /着きました/, /着きそう/,
  /道に迷/, /パーキング/, /駐車場/, /早くでき/, /遅くでき/
];

// ===== ログレベル =====
const LOG_LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };
const CURRENT_LOG_LEVEL = LOG_LEVELS.INFO;

// ===== 安全な関数参照（未定義関数による停止を防止） =====
function isAvailableFunction(name) {
  return typeof globalThis[name] === 'function';
}

// ===== メインエントリーポイント =====
function doPost(e) {
  let eventContext = null;

  try {
    eventContext = parseLineEvent(e);
    if (!eventContext) return;

    const { message } = eventContext;

    if (message.type === 'image') {
      return handleImageMessage(eventContext);
    }

    return handleTextMessage(eventContext);

  } catch (error) {
    return handleDoPostError(error, eventContext);
  }
}

// ===== イベントパース =====
function parseLineEvent(e) {
  if (!e || !e.postData) return null;

  try {
    const contents = JSON.parse(e.postData.contents);
    const event = contents.events[0];
    if (!event || event.type !== 'message') return null;

    return {
      replyToken: event.replyToken,
      userId: event.source.userId,
      message: event.message,
      now: new Date()
    };
  } catch (error) {
    logWithLevel(LOG_LEVELS.ERROR, "parseLineEvent failed: " + error.toString(), null);
    return null;
  }
}

// ===== 画像メッセージ処理 =====
function handleImageMessage(context) {
  const { replyToken, userId } = context;
  const session = getSessionSafe(userId);

  logToSheet("USER", "[画像受信]", userId);

  let imageReply = "お写真ありがとうございます✨\n参考にさせていただきますね！";

  if (session.status === SESSION_STATUS.SELECTING) {
    imageReply += "\n\n引き続き、ご希望の番号をお選びください！";
  } else if (session.status !== SESSION_STATUS.COMPLETED && session.status !== SESSION_STATUS.MANUAL_MODE) {
    imageReply += "\n\nご希望の日時とメニューを教えていただけますか？";
  }

  logToSheet("AI", imageReply, userId);
  return replyToLine(replyToken, imageReply);
}

// ===== テキストメッセージ処理 =====
function handleTextMessage(context) {
  const { replyToken, userId, message, now } = context;
  const userMessage = (message.text || "").trim();
  if (!userMessage) return;

  if (isAvailableFunction('isThreadsPostCommand') && isThreadsPostCommand(userMessage)) {
    logToSheet("USER", userMessage, userId);
    if (isAvailableFunction('handleThreadsPostRequest')) {
      return handleThreadsPostRequest(userId, replyToken, userMessage, now);
    }
  }
  if (isAvailableFunction('isThreadsListCommand') && isThreadsListCommand(userMessage)) {
    logToSheet("USER", userMessage, userId);
    if (isAvailableFunction('listScheduledPosts')) {
      return listScheduledPosts(userId, replyToken, now, userMessage);
    }
  }

  let userName = "お客様";
  try {
    userName = getUserDisplayNameSafe(userId);
  } catch (e) {
    logWithLevel(LOG_LEVELS.WARN, "getUserDisplayName failed: " + e.toString(), userId);
  }
  logToSheet("USER", userMessage, userId);

  let session = getSessionSafe(userId);

  for (const kw of AI_STOP_KEYWORDS) {
    if (userMessage.includes(kw)) {
      const stopUntil = now.getTime() + AI_STOP_HOURS * 3600 * 1000;
      saveSession(userId, { ...session, status: SESSION_STATUS.MANUAL_MODE, aiStopUntil: stopUntil, timestamp: now });
      const stopMsg = "AIをストップしました✅\n24時間、川崎殿が直接対応中です🙇‍♂️\n解除するには「対応完了」と入力してください。";
      logToSheet("SYSTEM", "AIストップ（手動対応モード）", userId);
      return replyToLine(replyToken, stopMsg);
    }
  }

  if (session.aiStopUntil && now.getTime() < session.aiStopUntil) {
    if (session.status !== SESSION_STATUS.MANUAL_MODE) {
      session.status = SESSION_STATUS.MANUAL_MODE;
      saveSession(userId, { ...session, timestamp: now });
    }
  }

  const shouldGreet = checkAndSendDailyGreeting(userId, now);
  const keywordResult = handleKeywords(userMessage, userId, replyToken, session, now);
  if (keywordResult) return keywordResult;

  session = checkSessionTimeout(session, userId, now);

  if (session.status !== SESSION_STATUS.MANUAL_MODE && checkNewCustomerKeyword(userMessage)) {
    return handleNewCustomer(userId, replyToken, session, now);
  }

  if (session.status !== SESSION_STATUS.MANUAL_MODE && checkDayOfContactKeyword(userMessage)) {
    return handleDayOfContact(userId, replyToken, session, now);
  }

  if (session.status === SESSION_STATUS.MANUAL_MODE) {
    return handleManualMode(userId, replyToken, userMessage, userName, session, now);
  }

  const stateResult = handleBySessionStatus(userId, replyToken, userMessage, session, userName, now);
  if (stateResult) return stateResult;

  const changeResult = handleChangeOrCancelIntent(userId, replyToken, userMessage, userName, session, now);
  if (changeResult) return changeResult;

  if (session.status === SESSION_STATUS.COMPLETED) {
    return handleCompletedStatus(userId, replyToken, userMessage, session, userName, now, shouldGreet);
  }

  if (session.status === SESSION_STATUS.SELECTING) {
    return handleSelectingStatus(userId, replyToken, userMessage, session, userName, now);
  }

  return handleAIBookingFlow(userId, replyToken, userMessage, session, userName, now, shouldGreet);
}

function handleKeywords(userMessage, userId, replyToken) {
  if (PDF_KEYWORDS.some(keyword => userMessage.includes(keyword))) {
    const pdfMsg = "ありがとうございます！\n\n「髪のことを知らないと損する話」のPDFはこちらです👇\n\n"
      + SONSURU_PDF_URL
      + "\n\nあなただけの「髪の説明書」も無料で作れます。\nPDFの最終ページからどうぞ🌿";
    logToSheet("AI", pdfMsg, userId);
    return replyToLine(replyToken, pdfMsg);
  }

  if (["住所", "メニュー", "住所・メニュー", "アクセス", "場所"].some(keyword => userMessage.includes(keyword))) {
    const infoMsg = "【住所】\n大阪市西区新町1-6-18\nテラスレジデンス502\n\n小さな隠れサロンで\nおしゃれでもラグジュアリーでもありませんが\nゆっくりとできる環境は整えさせてもらっています！\n飲み物は持参となっております🙏\n\n【メニュー】\n▼リタッチ\n6,600円〜 約90分\n\n▼フルカラー（トリートメント込）\n11,000円〜 約120分\n\n▼Wカラー（トリートメント込）\n25,000円〜\n\n▼フルカラートリートメント漬け\n15,500円〜 約150分\n\n▼髪質整形ストレート＋トリートメント漬け\n15,000円〜 約180分\n\n▼トリートメント漬け\n8,800円〜 約90分\n\n※すべて税込み\n※新規様は通常時間より30分ほど長くなります\n※お会計は現金のみ\n\nご予約・ご質問はこちらまでお気軽にどうぞ😊";
    logToSheet("AI", infoMsg, userId);
    return replyToLine(replyToken, infoMsg);
  }

  for (const keyword of SETSUMEISHO_KEYWORDS) {
    if (userMessage.includes(keyword)) {
      sendFormUrl(userId);
      const msg = "フォームをお送りしました！LINEの通知をご確認ください📋";
      logToSheet("AI", "説明書フォームURL送信（キーワード: " + keyword + "）", userId);
      return replyToLine(replyToken, msg);
    }
  }

  for (const keyword of RESTART_KEYWORDS) {
    if (userMessage.includes(keyword)) {
      saveSession(userId, createEmptySession());
      const msg = "了解です！最初からやり直しますね✨\n\nご希望の日時とメニューを教えてください！\n例：「明日14時でフルカラー」";
      logToSheet("AI", msg, userId);
      return replyToLine(replyToken, msg);
    }
  }

  for (const keyword of PRICE_KEYWORDS) {
    if (userMessage.includes(keyword)) {
      logToSheet("AI", PRICE_MESSAGE, userId);
      return replyToLine(replyToken, PRICE_MESSAGE);
    }
  }

  for (const keyword of TENTATIVE_CANCEL_KEYWORDS) {
    if (userMessage.includes(keyword)) {
      saveSession(userId, createEmptySession());
      const msg = "ご丁寧にありがとうございます🙏\nまた日時お決まりましたらご連絡お待ちしております✨";
      logToSheet("AI", msg, userId);
      return replyToLine(replyToken, msg);
    }
  }

  return null;
}

function getReunionPrefix(userMessage) {
  for (const keyword of REUNION_KEYWORDS) {
    if (userMessage.includes(keyword)) {
      return keyword + "です！ご連絡ありがとうございます✨\n\n";
    }
  }
  return "";
}

function checkSessionTimeout(session, userId, now) {
  if (session.timestamp) {
    const hoursDiff = (now.getTime() - new Date(session.timestamp).getTime()) / (1000 * 60 * 60);
    if (hoursDiff > CONFIG.SESSION_TIMEOUT_HOURS) {
      const newSession = createEmptySession();
      saveSession(userId, newSession);
      logToSheet("SYSTEM", "セッションタイムアウト（24時間）", userId);
      return newSession;
    }
  }
  return session;
}

function handleNewCustomer(userId, replyToken, session, now) {
  const handoffMsg = "お問い合わせありがとうございます！川崎から連絡させてもらいます🙇‍♂️\n\n予約をスムーズに進めるために、以下を事前にお伝えください：\n📅 日時のご希望\n💇 髪のお悩み\n🎨 今回のカラーのご希望\n\nお手数おかけしますがよろしくお願いします！";
  saveSession(userId, { ...session, status: SESSION_STATUS.MANUAL_MODE, timestamp: now });
  logToSheet("AI", handoffMsg, userId);
  return replyToLine(replyToken, handoffMsg);
}

function handleManualMode(userId, replyToken, userMessage, userName, session, now) {
  if (userMessage === "対応完了") {
    saveSession(userId, createEmptySession());
    logToSheet("SYSTEM", "MANUAL_MODE解除", userId);
    return replyToLine(replyToken, "対応完了しました✨");
  }

  const operatorMatch = userMessage.match(OPERATOR_BOOKING_PATTERN);
  if (operatorMatch) {
    const result = processOperatorBooking(operatorMatch, userName, now);
    if (result.success) {
      saveSession(userId, { date: result.date, time: result.time, menu: result.menu, status: SESSION_STATUS.COMPLETED, timestamp: now });
      logToSheet("AI", result.message, userId);
      return replyToLine(replyToken, result.message);
    }
  }

  return;
}

function handleBySessionStatus(userId, replyToken, userMessage, session, userName, now) {
  switch (session.status) {
    case SESSION_STATUS.CANCEL_CONFIRM:
      return handleCancelConfirmResponse(userId, replyToken, userMessage, session, userName, now);
    case SESSION_STATUS.CHANGE_SELECT_BOOKING:
      return handleChangeSelectBooking(userId, replyToken, userMessage, session, userName, now);
    case SESSION_STATUS.CANCEL_SELECT_BOOKING:
      return handleCancelSelectBooking(userId, replyToken, userMessage, session, userName, now);
    case SESSION_STATUS.CHANGE_SELECTING:
      return handleChangeSelecting(userId, replyToken, userMessage, session, userName, now);
    default:
      return null;
  }
}

function handleChangeOrCancelIntent(userId, replyToken, userMessage, userName, session, now) {
  const changeIntent = detectChangeOrCancelIntent(userMessage);
  if (!changeIntent) return null;

  const bookings = findUserBookings(userName, now);
  if (bookings.length === 0) {
    const noBookingMsg = "現在、ご予約が見つかりません📅\n新規予約をご希望でしたら、日時とメニューを教えてください！";
    logToSheet("AI", noBookingMsg, userId);
    return replyToLine(replyToken, noBookingMsg);
  }

  if (changeIntent === "CHANGE") {
    return initiateBookingChange(userId, replyToken, bookings, session, now);
  }
  if (changeIntent === "CANCEL") {
    return initiateBookingCancel(userId, replyToken, bookings, session, now);
  }

  return null;
}

function handleCompletedStatus(userId, replyToken, userMessage, session, userName, now, shouldGreet) {
  const isNewBookingRequest = /(\d+月|\d+日|明日|明後日|来週|今週).*予約|予約.*(\d+月|\d+日|明日|明後日)|空き|空いて|取れ/.test(userMessage);

  if (isNewBookingRequest) {
    const newSession = createEmptySession();
    saveSession(userId, newSession);
    return handleAIBookingFlow(userId, replyToken, userMessage, newSession, userName, now, shouldGreet);
  }

  try {
    let response = callGeminiWithContext(userMessage, session, userId);
    if (response.match(/予約を?確定|ご予約確定|承りました|ご予約を?入れ|ご予約完了|予約いたしました/)) {
      response = "ご希望の日時とメニューを教えてください😊\n\n例：「明日14時でフルカラー」「来週の平日でリタッチ」";
    }
    logToSheet("AI", response, userId);
    return replyToLine(replyToken, response);
  } catch (err) {
    logWithLevel(LOG_LEVELS.ERROR, "callGeminiWithContext failed: " + err.toString(), userId);
    const fallback = "ありがとうございます！お待ちしております✨";
    logToSheet("AI", fallback, userId);
    return replyToLine(replyToken, fallback);
  }
}

function handleSelectingStatus(userId, replyToken, userMessage, session, userName, now) {
  let candidates = parseJsonSafe(session.date, []);

  if (candidates.length === 0) {
    session.status = SESSION_STATUS.IDLE;
    saveSession(userId, session);
    return handleAIBookingFlow(userId, replyToken, userMessage, session, userName, now, false);
  }

  const hasNewTimeRequest = /(\d{1,2})[時:]|(\d{1,2})日|(\d{1,2})月|午前|午後|夕方|朝|昼|[一二三四五六七八九十]+時|来週|今週|明日|明後日|ありますか|空いて|他の|別の|違う/.test(userMessage);
  const isNegative = /無理|ダメ|だめ|できない|厳しい|難しい|やめ|キャンセル/.test(userMessage);

  if (hasNewTimeRequest || isNegative) {
    const menuToKeep = session.menu || "";
    saveSession(userId, { ...createEmptySession(), menu: menuToKeep });
    const newSession = { ...createEmptySession(), menu: menuToKeep };
    return handleAIBookingFlow(userId, replyToken, userMessage, newSession, userName, now, false);
  }

  const selectionIndex = parseSelectionIntent(userMessage, candidates);
  if (selectionIndex !== null && candidates[selectionIndex]) {
    const selected = candidates[selectionIndex];
    const slotDate = parseSlotToDate(selected);

    if (slotDate && checkAvailability(slotDate, session.menu, now)) {
      const result = confirmBooking(selected, session.menu, userName, session.purpose);
      if (result.success) {
        saveSession(userId, {
          date: selected.date,
          time: selected.time,
          menu: session.menu,
          purpose: session.purpose,
          status: SESSION_STATUS.COMPLETED,
          timestamp: now
        });
        logToSheet("AI", result.message, userId);
        return replyToLine(replyToken, result.message);
      } else {
        const errorMsg = "予約処理でエラーが発生しました🙇‍♂️ お手数ですが、もう一度お試しください";
        logToSheet("AI", errorMsg, userId);
        return replyToLine(replyToken, errorMsg);
      }
    } else {
      const retryMsg = "申し訳ありません、その時間は埋まってしまいました🙇‍♂️ 別の番号をお選びください！";
      logToSheet("AI", retryMsg, userId);
      return replyToLine(replyToken, retryMsg);
    }
  }

  const failCount = (session.selectFailCount || 0) + 1;
  if (failCount >= 3) {
    saveSession(userId, createEmptySession());
    const resetMsg = "うまく選択できなかったようです🙇‍♂️\n\n最初からやり直しますね！\nご希望の日時とメニューを教えてください✨";
    logToSheet("AI", resetMsg, userId);
    return replyToLine(replyToken, resetMsg);
  }

  saveSession(userId, { ...session, selectFailCount: failCount, timestamp: now });
  const answer = answerQuestionInSelectingState(userMessage, session, candidates, userId);
  logToSheet("AI", answer, userId);
  return replyToLine(replyToken, answer);
}

function handleAIBookingFlow(userId, replyToken, userMessage, session, userName, now, shouldGreet) {
  const reunionPrefix = getReunionPrefix(userMessage);
  let greetingPrefix = "";
  if (shouldGreet && session.status === SESSION_STATUS.IDLE) {
    greetingPrefix = AITARO_GREETING + "\n\n";
  }

  const aiResponse = callGeminiSmart(userMessage, now, session, userId);
  const intent = parseAIResponse(aiResponse, now, userId);

  if (intent.isBookingIntent && intent.dates && intent.dates.length > 0) {
    const codeDates = extractDatesFromMessage(userMessage, now);
    intent.dates = crossCheckDates(intent.dates, codeDates, now);
  }

  if (session.status === SESSION_STATUS.MENU_CONFIRM) {
    return handleMenuConfirmStatus(userId, replyToken, userMessage, session, userName, now, reunionPrefix, intent);
  }

  if (intent.dates && intent.dates.length > 0 && intent.menu) {
    return proposeAvailableSlotsWithPrefix(userId, replyToken, intent.dates, intent.menu, userName, now, greetingPrefix + reunionPrefix, intent.timePreference, intent.purpose);
  }

  if (intent.dates && intent.dates.length > 0 && !intent.menu) {
    saveSession(userId, {
      ...session,
      date: JSON.stringify(intent.dates),
      time: intent.timePreference || "",
      purpose: intent.purpose || session.purpose,
      status: SESSION_STATUS.MENU_CONFIRM,
      timestamp: now
    });
    const askMenuMsg = greetingPrefix + reunionPrefix + (intent.needMenuConfirm
      ? "リタッチ（根本のみ）とフルカラー（全体）、どちらをご希望ですか？✨"
      : "メニューは何をご希望ですか？（リタッチ / フルカラー / ストレート / カラトリ / 相談）");
    logToSheet("AI", askMenuMsg, userId);
    return replyToLine(replyToken, askMenuMsg);
  }

  if (intent.menu && (!intent.dates || intent.dates.length === 0)) {
    const searchDates = generateDateRange(now, 14);
    return proposeAvailableSlotsWithPrefix(userId, replyToken, searchDates, intent.menu, userName, now, greetingPrefix + reunionPrefix, intent.timePreference, intent.purpose, false);
  }

  const defaultMsg = "ご希望の日時とメニューを教えてください！📅\n\n例：「明日14時でフルカラー」「来週の平日でリタッチ」";

  let baseMsg = defaultMsg;
  if (intent.message && intent.message.trim()) {
    const msgTrimmed = intent.message.trim();
    const userTrimmed = userMessage.trim();
    const isEcho = (msgTrimmed === userTrimmed)
      || (userTrimmed.includes(msgTrimmed) && msgTrimmed.length < 20)
      || (msgTrimmed.includes(userTrimmed) && msgTrimmed.length < userTrimmed.length + 10);

    if (!isEcho) {
      baseMsg = msgTrimmed;
    }
  }

  let fallbackMsg = greetingPrefix + reunionPrefix + baseMsg;
  if (fallbackMsg.length > 4500) {
    fallbackMsg = fallbackMsg.substring(0, 4500);
  }

  logToSheet("AI", fallbackMsg, userId);
  return replyToLine(replyToken, fallbackMsg);
}

function handleMenuConfirmStatus(userId, replyToken, userMessage, session, userName, now, reunionPrefix, intent) {
  if (/相談.*決め|決め.*相談|迷って/.test(userMessage) && !intent.menu) {
    intent.menu = "相談";
  }

  if (intent.menu) {
    const storedDates = parseStoredDates(session.date, now);
    const timePreference = intent.timePreference || session.time || "";
    if (storedDates.length > 0) {
      return proposeAvailableSlotsWithPrefix(userId, replyToken, storedDates, intent.menu, userName, now, reunionPrefix, timePreference, intent.purpose);
    } else {
      const reAskMsg = reunionPrefix + "すみません、日付が確認できませんでした🙇‍♂️\nもう一度、ご希望の日時を教えていただけますか？\n\n例：「2月12日」「来週の火曜日」";
      saveSession(userId, { ...session, status: SESSION_STATUS.IDLE, timestamp: now });
      logToSheet("AI", reAskMsg, userId);
      return replyToLine(replyToken, reAskMsg);
    }
  }

  const askMenuMsg = reunionPrefix + "リタッチ（根本のみ）とフルカラー（全体）、どちらをご希望ですか？✨";
  logToSheet("AI", askMenuMsg, userId);
  return replyToLine(replyToken, askMenuMsg);
}

function handleDoPostError(error, context) {
  const errorMsg = error.toString();
  const userId = context?.userId || "unknown";
  const replyToken = context?.replyToken;

  console.error("doPost Error: " + errorMsg);
  logWithLevel(LOG_LEVELS.ERROR, "doPost: " + errorMsg, userId);

  if (replyToken && isAvailableFunction('replyToLine')) {
    try {
      replyToLine(replyToken, "すみません、うまく処理できませんでした。もう一度「日時とメニュー」を教えていただけますか？🙏");
    } catch (replyErr) {
      logWithLevel(LOG_LEVELS.ERROR, "Reply failed: " + replyErr.toString(), userId);
    }
  }
}

function checkNewCustomerKeyword(message) {
  const lowerMsg = message.toLowerCase();
  for (const pattern of NEW_CUSTOMER_PATTERNS) {
    if (pattern.test(message)) return true;
  }
  for (const keyword of NEW_CUSTOMER_KEYWORDS) {
    if (lowerMsg.includes(keyword.toLowerCase())) return true;
  }
  return false;
}

function checkDayOfContactKeyword(message) {
  for (const pattern of DAY_OF_CONTACT_PATTERNS) {
    if (pattern.test(message)) return true;
  }
  return false;
}

function handleDayOfContact(userId, replyToken, session, now) {
  const userName = getUserDisplayNameSafe(userId);
  const bookings = findUserBookings(userName, now);

  const todayStr = Utilities.formatDate(now, 'JST', 'yyyy-MM-dd');
  const todayBooking = bookings.find(b => Utilities.formatDate(b.start, 'JST', 'yyyy-MM-dd') === todayStr);

  if (todayBooking) {
    const menu = todayBooking.menu;
    const allTodaySlots = findAvailableSlots(now, menu, now);

    if (allTodaySlots.length > 0) {
      let msg = "ご連絡ありがとうございます！本日のご予約ですね✨\n\n現在の前後の時間帯ですと、以下の時間が空いております。\n\n";
      msg += allTodaySlots.map((s, i) => `${i + 1}. 本日 ${s}〜`).join("\n");
      msg += "\n\n時間変更をご希望の場合は番号でお知らせいただくか、そのままの時間でよろしければ川崎からの返信をお待ちください🙇‍♂️";

      saveSession(userId, { ...session, status: SESSION_STATUS.MANUAL_MODE, timestamp: now });
      logToSheet("AI", "当日連絡＆空き提案", userId);
      return replyToLine(replyToken, msg);
    } else {
      const msg = "ご連絡ありがとうございます！本日のご予約ですね✨\n\nあいにく本日は前後の時間に空き枠がございません🙇‍♂️\n川崎に確認いたしますので、少々お待ちください！";
      saveSession(userId, { ...session, status: SESSION_STATUS.MANUAL_MODE, timestamp: now });
      logToSheet("AI", "当日連絡（空きなし）", userId);
      return replyToLine(replyToken, msg);
    }
  }

  const defaultMsg = "ご連絡ありがとうございます！\nただいま川崎に確認いたしますので、少々お待ちください🙇‍♂️";
  saveSession(userId, { ...session, status: SESSION_STATUS.MANUAL_MODE, timestamp: now });
  logToSheet("AI", "当日連絡（予約不明）", userId);
  return replyToLine(replyToken, defaultMsg);
}
