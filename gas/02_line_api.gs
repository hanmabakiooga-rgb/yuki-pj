// ==========================================
// LINE予約ボット - 02: LINE API 送信
// ==========================================

/**
 * LINEプッシュメッセージ送信（テキスト）
 * @param {string} userId - 送信先のLINE userId
 * @param {string} text - 送信するテキスト
 * @return {boolean} 送信成功ならtrue
 */
function sendPushMessage(userId, text) {
  if (!CONFIG.LINE_CHANNEL_ACCESS_TOKEN) {
    console.error('LINE_CHANNEL_ACCESS_TOKEN が未設定です');
    return false;
  }
  var url = 'https://api.line.me/v2/bot/message/push';
  var payload = {
    to: userId,
    messages: [{ type: 'text', text: text }]
  };
  try {
    var res = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + CONFIG.LINE_CHANNEL_ACCESS_TOKEN },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
    var code = res.getResponseCode();
    if (code !== 200) {
      console.error('sendPushMessage 失敗 [' + code + ']: ' + res.getContentText());
      return false;
    }
    return true;
  } catch (e) {
    console.error('sendPushMessage 例外: ' + e.toString());
    return false;
  }
}

/**
 * Flexメッセージ送信
 * @param {string} userId - 送信先のLINE userId
 * @param {Object} flexContents - Flexメッセージのcontents
 * @return {boolean} 送信成功ならtrue
 */
function sendFlexPushMessage(userId, flexContents) {
  if (!CONFIG.LINE_CHANNEL_ACCESS_TOKEN) {
    console.error('LINE_CHANNEL_ACCESS_TOKEN が未設定です');
    return false;
  }
  var url = 'https://api.line.me/v2/bot/message/push';
  var payload = {
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
    var res = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + CONFIG.LINE_CHANNEL_ACCESS_TOKEN },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
    var code = res.getResponseCode();
    if (code !== 200) {
      console.error('sendFlexPushMessage 失敗 [' + code + ']: ' + res.getContentText());
      return false;
    }
    return true;
  } catch (e) {
    console.error('sendFlexPushMessage 例外: ' + e.toString());
    return false;
  }
}

/**
 * LINE表示名を取得
 * @param {string} userId
 * @return {string} 表示名（取得失敗時は'お客様'）
 */
function getLineDisplayName(userId) {
  if (!CONFIG.LINE_CHANNEL_ACCESS_TOKEN) return 'お客様';
  try {
    var url = 'https://api.line.me/v2/bot/profile/' + userId;
    var res = UrlFetchApp.fetch(url, {
      method: 'get',
      headers: { Authorization: 'Bearer ' + CONFIG.LINE_CHANNEL_ACCESS_TOKEN },
      muteHttpExceptions: true
    });
    if (res.getResponseCode() === 200) {
      var profile = JSON.parse(res.getContentText());
      return profile.displayName || 'お客様';
    }
  } catch (e) {
    console.warn('LINE表示名取得失敗: ' + e.toString());
  }
  return 'お客様';
}
