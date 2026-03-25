// ==========================================
// LINE予約ボット - 03: Gemini API
// ==========================================

/**
 * Geminiで説明書を生成
 * @param {string} formAnswers - 整形済みフォーム回答
 * @param {string} displayName - ユーザーの表示名
 * @return {string} 生成された説明書テキスト（失敗時はフォーム回答をそのまま返す）
 */
function generateSetsumeishoWithGemini(formAnswers, displayName) {
  if (!CONFIG.GEMINI_API_KEY) {
    console.error('GEMINI_API_KEY が未設定です');
    return formAnswers;
  }

  var url = 'https://generativelanguage.googleapis.com/v1beta/models/' +
    CONFIG.MODEL_NAME + ':generateContent?key=' + CONFIG.GEMINI_API_KEY;

  var payload = {
    contents: [
      { role: 'user', parts: [{ text: buildSetsumeishoPrompt(formAnswers, displayName) }] }
    ],
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 1500
    }
  };

  try {
    var res = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    var code = res.getResponseCode();
    if (code === 200) {
      var content = JSON.parse(res.getContentText());
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

  // フォールバック：フォーム回答をそのまま返す
  return formAnswers;
}

/**
 * 説明書生成プロンプト
 */
function buildSetsumeishoPrompt(formAnswers, displayName) {
  return 'あなたは美容師川崎（大阪四ツ橋のHEJ Haircolor rab）のアシスタントAIです。\n' +
    '以下はお客様「' + displayName + '」さんが記入したヘアカウンセリングフォームの回答です。\n\n' +
    '【フォーム回答】\n' + formAnswers + '\n\n---\n\n' +
    'この回答をもとに「' + displayName + 'さんの唯一無二の髪の説明書」を作成してください。\n\n' +
    '【出力形式】\n' +
    '美容師に渡せるコンパクトな説明書として、以下の構成で日本語で出力してください。\n' +
    '箇条書きは使わず、読みやすい短文で書いてください。\n\n' +
    '■ 朝のリアルな状況\n' +
    '（朝の時間、ドライヤー時間、子ども・家族の有無、スタイリング道具など）\n\n' +
    '■ 髪質・癖の特徴\n' +
    '（癖の場所・種類、雨の日の変化、量・太さ、乾かした後の状態、履歴など）\n\n' +
    '■ 理想の仕上がり\n' +
    '（雰囲気、長さ、前髪、顔まわり、参考写真のポイントなど）\n\n' +
    '■ 過去の失敗・NGリスト\n' +
    '（すかれすぎ、レイヤー失敗、カラー褪色など）\n\n' +
    '■ カラー・施術の意向\n' +
    '（来店頻度、白髪状況、ブリーチ履歴、TR意向、予算など）\n\n' +
    '■ 美容室への本音\n' +
    '（言えなかったこと、今一番困っていること、担当への要望など）\n\n' +
    '■ 川崎へのひとこと\n' +
    '（Q34・Q35の回答をもとに、来店意欲や相談内容を一文で）\n\n' +
    '【トーンの注意】\n' +
    '・AIっぽくない、温かみのある自然な文章で\n' +
    '・「〜です」「〜ます」調で統一\n' +
    '・専門用語は使わず、美容師が直感的に理解できる言葉で';
}
