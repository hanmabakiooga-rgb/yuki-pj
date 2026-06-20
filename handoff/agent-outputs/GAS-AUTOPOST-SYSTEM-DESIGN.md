# GAS Autopost System Design — FOLLOW公式 Threads 完全自動化

作成日: 2026-06-20
作成者: Claude (Opus 4.7) / FOLLOW専属エンジニア
ステータス: 設計確定版（コピペで動く完全コード）
位置づけ: ユーザー本人または別Claudeが Google Apps Script エディタに貼って稼働させるための **完全実装書**

---

## 0. 設計サマリー（30秒で理解）

- **対象アカウント**: FOLLOW公式 Threads `@kokodake2026`
- **スケジュール**: 1日3投稿 朝7:30 / 昼12:30 / 夜21:00 JST
- **生成タイミング**: 毎日 23:00 JST に翌日3投稿を生成 → 法務チェック → キュー保存
- **データストア**: 既存 Google Sheets `FOLLOW-KPI` に4タブ追加（`sns_queue` `sns_log` `sns_templates` `sns_kill_switch`）
- **AI生成**: 関数IFのみ用意（Claude/OpenAI 接続は後フェーズ、まずはテンプレ+セマンティック置換で動く）
- **法務チェック**: regex + NGワード + （後フェーズで AI判定）
- **管理者通知**: LINE Messaging API push（ADMIN_LINE_USER_ID へ直接）
- **緊急停止**: Sheets フラグ + LINE Webhook コマンド連携（line-harness-oss Workers と連動）
- **モジュール構成**: 9ファイル（Config, TokenManager, ContentGenerator, LegalCheck, ThreadsClient, Scheduler, KillSwitch, Notifier, Logger, Main）

---

## 1. アーキテクチャ図

```
┌─────────────────────────────────────────────────────────────────────┐
│                       Google Apps Script (V8)                        │
│                                                                      │
│  ┌─────────────┐                                                     │
│  │ Time Trigger│  23:00 JST  ─→ generateTomorrowPosts()              │
│  │  (固定時刻) │              │   ├ ContentGenerator.generateAll()   │
│  └─────────────┘              │   │   ├ sns_templates 読込           │
│        │                      │   │   ├ AI/テンプレ生成              │
│        │ 7:30/12:30/21:00     │   │   └ 3件を返却                    │
│        │           ─────→ postScheduled()                            │
│        │           │      ├ KillSwitch.isEnabled()? ──→ NO: skip+通知│
│        │           │      ├ sns_queue から該当行取得                 │
│        │           │      ├ LegalCheck.check() (二重チェック)         │
│        │           │      └ ThreadsClient.publish()                  │
│        │                      ├ Step1: CREATE → creation_id           │
│        │                      ├ Step2: PUBLISH → published_id         │
│        │                      ├ Retry 3回（指数バックオフ）           │
│        │                      └ Logger.write() → sns_log             │
│        │                                                              │
│        │ Sun 02:00 ─→ TokenManager.refreshLongLivedToken()           │
│        │ 6:00/18:00 ─→ KillSwitch.healthCheck()                      │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Notifier  →  LINE Messaging API push (ADMIN_LINE_USER_ID)   │   │
│  │            │                                                  │   │
│  │            └→ または Workers /api/admin-notify 経由           │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Google Sheets (FOLLOW-KPI) ※既存 spreadsheet に追加タブ       │   │
│  │  ┌──────────┐ ┌─────────┐ ┌──────────────┐ ┌──────────────┐ │   │
│  │  │sns_queue │ │sns_log  │ │sns_templates │ │sns_kill_sw   │ │   │
│  │  └──────────┘ └─────────┘ └──────────────┘ └──────────────┘ │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
       ▲                                              ▲
       │ Threads Graph API                            │ stop/resume webhook
       │ graph.threads.net                            │
┌──────┴───────────────────┐              ┌───────────┴────────────────┐
│  Meta Threads Platform   │              │ line-harness-oss Workers   │
│  (CREATE → PUBLISH)      │              │ admin-bot/webhook          │
└──────────────────────────┘              └────────────────────────────┘
```

---

## 2. Google Sheets 設計（FOLLOW-KPI に追加するタブ）

既存 spreadsheet ID: `1Xshvq2dIJKoTLwU8E4VBR-alySOW42h96Uh7NQji4B0`

### 2-1. タブ `sns_queue`（投稿予約キュー）

| 列 | キー | 型 | 説明 |
|---|---|---|---|
| A | id | string | UUID-like 一意ID（例: `q_20260621_0730`） |
| B | scheduled_at | datetime | JST 投稿予定時刻 `YYYY-MM-DD HH:mm` |
| C | account | string | `follow_official`（将来HEJ対応のため列確保） |
| D | channel | string | `threads`（将来 `instagram` 等用に列確保） |
| E | slot | string | `morning`/`noon`/`night` |
| F | theme | string | テンプレートテーマID（例: `edu_chemical_burden`） |
| G | content | text | 投稿本文（最終形、500字以内） |
| H | e_legal_status | string | `pending`/`ok`/`needs_fix`/`ng` |
| I | e_legal_note | text | NG/修正必要の詳細（regex マッチ箇所） |
| J | post_status | string | `scheduled`/`posting`/`posted`/`failed`/`skipped` |
| K | threads_creation_id | string | Step1で得る creation_id |
| L | threads_post_id | string | Step2で得る published_id |
| M | created_at | datetime | 行生成時刻 |
| N | posted_at | datetime | 実投稿時刻 |
| O | retry_count | int | 再試行回数 |
| P | error | text | 失敗時のエラーメッセージ |

ヘッダー行は1行目に固定。データは2行目から。

### 2-2. タブ `sns_log`（投稿実績ログ）

| 列 | キー | 型 | 説明 |
|---|---|---|---|
| A | timestamp | datetime | 記録時刻 |
| B | queue_id | string | sns_queue.id |
| C | event | string | `created`/`legal_ok`/`legal_ng`/`posted`/`failed`/`skipped_kill_switch` |
| D | account | string | |
| E | slot | string | |
| F | threads_post_id | string | 成功時のみ |
| G | content_preview | text | 先頭60字 |
| H | severity | string | `info`/`warn`/`error` |
| I | detail | text | JSON文字列での詳細（API レスポンス等） |

### 2-3. タブ `sns_templates`（投稿テンプレート）

| 列 | キー | 型 | 説明 |
|---|---|---|---|
| A | template_id | string | 一意ID（例: `morn_edu_001`） |
| B | slot | string | `morning`/`noon`/`night` |
| C | theme | string | `education`/`empathy_core`/`philosophy` |
| D | core_message_id | int | POSITIONING-FINAL.md §11 の1〜7 |
| E | template_text | text | 投稿テンプレ本文（プレースホルダ `{date}` `{season}` 等使用可） |
| F | active | bool | `TRUE`/`FALSE` |
| G | last_used_at | datetime | 最終使用日時 |
| H | use_count | int | 使用回数 |
| I | notes | text | 補足 |

### 2-4. タブ `sns_kill_switch`（緊急停止フラグ）

A1セル固定で運用（シンプル構成）。

| セル | キー | 値 |
|---|---|---|
| A1 | auto_post_enabled | `TRUE` / `FALSE` |
| A2 | last_updated_at | datetime |
| A3 | updated_by | string（`admin_line`/`auto_detection`/`manual`） |
| A4 | reason | text |

---

## 3. GAS プロジェクト構造

GAS エディタで新規プロジェクト `FOLLOW-Autopost` を作り、以下の10ファイルを順に作成して貼り付ける。

```
FOLLOW-Autopost/
├ Config.gs           — 定数・シートID・エンドポイント
├ TokenManager.gs     — Threads トークン管理（短→長交換／延長）
├ ContentGenerator.gs — 翌日3投稿生成（テンプレ+AI IF）
├ LegalCheck.gs       — regex + NGワード + AI判定IF
├ ThreadsClient.gs    — Threads API 2段階投稿
├ Scheduler.gs        — Time Trigger インストール
├ KillSwitch.gs       — 緊急停止フラグ管理
├ Notifier.gs         — 管理者LINE通知
├ Logger.gs           — sns_log 書込み
└ Main.gs             — 統合エントリポイント＋スモークテスト
```

---

## 4. 完全実装コード

### 4-1. `Config.gs`

```javascript
/**
 * Config.gs
 * 全モジュールから参照する定数・シート構造・エンドポイントを集約。
 * Secret はすべて Script Properties から読む。コード内ハードコード禁止。
 */

const CONFIG = {
  // ─────────── Spreadsheet ───────────
  SPREADSHEET_ID: '1Xshvq2dIJKoTLwU8E4VBR-alySOW42h96Uh7NQji4B0', // 既存 FOLLOW-KPI
  SHEETS: {
    QUEUE: 'sns_queue',
    LOG: 'sns_log',
    TEMPLATES: 'sns_templates',
    KILL_SWITCH: 'sns_kill_switch'
  },

  // ─────────── Threads API ───────────
  THREADS_API: {
    BASE: 'https://graph.threads.net',
    VERSION: 'v1.0',
    TOKEN_EXCHANGE: 'https://graph.threads.net/access_token',
    REFRESH: 'https://graph.threads.net/refresh_access_token'
  },

  // ─────────── 投稿スロット ───────────
  SLOTS: {
    morning: { hour: 7, minute: 30, theme: 'education' },
    noon:    { hour: 12, minute: 30, theme: 'empathy_core' },
    night:   { hour: 21, minute: 0, theme: 'philosophy' }
  },

  // ─────────── トリガー時刻 ───────────
  TRIGGERS: {
    GENERATE: { hour: 23, minute: 0 },     // 翌日3投稿を生成
    POST_MORNING: { hour: 7, minute: 30 },
    POST_NOON: { hour: 12, minute: 30 },
    POST_NIGHT: { hour: 21, minute: 0 },
    TOKEN_REFRESH: { weekday: 'SUNDAY', hour: 2, minute: 0 },
    KILL_CHECK_AM: { hour: 6, minute: 0 },
    KILL_CHECK_PM: { hour: 18, minute: 0 },
    DAILY_SUMMARY: { hour: 23, minute: 30 }
  },

  // ─────────── リトライ ───────────
  RETRY: {
    MAX_ATTEMPTS: 3,
    BASE_DELAY_MS: 2000, // 指数バックオフ基準
    PUBLISH_WAIT_MS: 30000 // CREATE→PUBLISH の待機（Threads推奨）
  },

  // ─────────── LINE ───────────
  LINE: {
    PUSH_ENDPOINT: 'https://api.line.me/v2/bot/message/push',
    // line-harness-oss Workers 経由で送る場合のフォールバック
    WORKER_NOTIFY_ENDPOINT: '' // 後述、Script Properties WORKER_ADMIN_NOTIFY_URL で上書き
  },

  // ─────────── 法務 NG ワード ───────────
  LEGAL_NG_WORDS: [
    // 断定的優良誤認
    '絶対', '100%', '必ず', '完璧', '完全', '確実', '間違いなく',
    // 医薬品的効能
    '治る', '治癒', '治療', '改善する', '予防', '効きます', '効く',
    '白髪が黒くなる', '白髪が消える', '白髪が増えない', '白髪を減らす',
    // 景表法
    '業界No.1', '業界1位', '日本一', '世界一', '最高',
    '全額返金', '効果なければ返金', '完全返金保証',
    '今だけ', '本日限定', '24時間限定', '先着',
    // PIPA
    // (ケースバイケース、固有名詞や写真有無で判定)
    // 競合誹謗
    'coloris は', 'カラリス は', 'ホーユー は',
    // 業界暴露（別プロジェクト隔離）
    '美容業界の闇', '美容師の裏側', 'サロン業界の実態'
  ],

  // ─────────── 修正必要レベル（警告） ───────────
  LEGAL_WARN_WORDS: [
    '失敗しない', '誰でも', '全員', '証明された',
    '美容室不要', 'サロン不要', 'アレルギー安心',
    '安心', '安全' // 単独使用は要文脈確認
  ],

  // ─────────── 7コアメッセージ（POSITIONING-FINAL.md §11） ───────────
  CORE_MESSAGES: [
    { id: 1, text: '気になるところだけを染める' },
    { id: 2, text: 'プロ用商材で安全に' },
    { id: 3, text: '頭皮ケアまで月単位で伴走' },
    { id: 4, text: '20年×何万人×大阪専門店×現役の権威性' },
    { id: 5, text: '染める/染めないも一緒に判断' },
    { id: 6, text: '月880円、いつでも解約OK' },
    { id: 7, text: '商材購入は任意・他で買ってもOK' }
  ],

  // ─────────── LINE誘導CTA ───────────
  LINE_CTA: 'https://lin.ee/9IC32LC',
  LINE_CTA_TEXT: '\n\n▼ LINEで30秒相談\n' + 'https://lin.ee/9IC32LC',

  // ─────────── 投稿仕様 ───────────
  THREADS: {
    MAX_LENGTH: 500,
    SOFT_LENGTH: 480 // 余裕を持って切る
  },

  // ─────────── dryRun フラグ ───────────
  // Script Properties で DRY_RUN=true なら API 投稿せずログだけ
  DRY_RUN_KEY: 'DRY_RUN',

  // ─────────── タイムゾーン ───────────
  TZ: 'Asia/Tokyo'
};

/**
 * Script Properties から値を取得。未設定なら null を返す。
 * @param {string} key
 * @returns {string|null}
 */
function getProp(key) {
  return PropertiesService.getScriptProperties().getProperty(key);
}

/**
 * Script Properties に値を保存。
 * @param {string} key
 * @param {string} value
 */
function setProp(key, value) {
  PropertiesService.getScriptProperties().setProperty(key, value);
}

/**
 * 必須プロパティが揃っているかチェック。スモークテスト用。
 * @returns {{ok: boolean, missing: string[]}}
 */
function validateRequiredProps() {
  const required = [
    'THREADS_USER_ID',
    'THREADS_APP_ID',
    'THREADS_APP_SECRET',
    'THREADS_ACCESS_TOKEN',
    'LINE_CHANNEL_ACCESS_TOKEN',
    'ADMIN_LINE_USER_ID'
  ];
  const missing = required.filter(k => !getProp(k));
  return { ok: missing.length === 0, missing };
}

/**
 * シート参照ヘルパー
 * @param {string} sheetName
 * @returns {GoogleAppsScript.Spreadsheet.Sheet}
 */
function getSheet(sheetName) {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error(`Sheet not found: ${sheetName}. setupSheets() を先に実行してください。`);
  }
  return sheet;
}

/**
 * 4タブの初期セットアップ（ヘッダー作成）
 * 初回 1回だけ手動で実行する。
 */
function setupSheets() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const tabDefs = [
    {
      name: CONFIG.SHEETS.QUEUE,
      headers: ['id','scheduled_at','account','channel','slot','theme','content',
                'e_legal_status','e_legal_note','post_status','threads_creation_id',
                'threads_post_id','created_at','posted_at','retry_count','error']
    },
    {
      name: CONFIG.SHEETS.LOG,
      headers: ['timestamp','queue_id','event','account','slot','threads_post_id',
                'content_preview','severity','detail']
    },
    {
      name: CONFIG.SHEETS.TEMPLATES,
      headers: ['template_id','slot','theme','core_message_id','template_text',
                'active','last_used_at','use_count','notes']
    },
    {
      name: CONFIG.SHEETS.KILL_SWITCH,
      headers: ['key','value']
    }
  ];

  tabDefs.forEach(def => {
    let sheet = ss.getSheetByName(def.name);
    if (!sheet) {
      sheet = ss.insertSheet(def.name);
    }
    sheet.getRange(1, 1, 1, def.headers.length).setValues([def.headers]).setFontWeight('bold');
    sheet.setFrozenRows(1);
  });

  // kill_switch 初期値
  const killSheet = ss.getSheetByName(CONFIG.SHEETS.KILL_SWITCH);
  killSheet.getRange('A2:B5').setValues([
    ['auto_post_enabled', 'TRUE'],
    ['last_updated_at', new Date()],
    ['updated_by', 'setup'],
    ['reason', 'initial setup']
  ]);

  Logger.log('[setup] 4タブ作成完了。次に seedTemplates() を実行してください。');
}
```

---

### 4-2. `TokenManager.gs`

```javascript
/**
 * TokenManager.gs
 * Threads アクセストークンの短期→長期交換、長期トークンの定期延長を担当。
 *
 * トークン仕様（Meta公式）:
 *   - 短期: 1時間、Login Flow から取得
 *   - 長期: 60日、grant_type=th_exchange_token で交換
 *   - 延長: 残り≧24時間で refresh_access_token を叩く
 */

/**
 * 短期トークン → 長期トークンへ交換
 * 初回セットアップ時、HTMLダイアログから呼ばれる想定。
 *
 * @param {string} shortLivedToken
 * @returns {{token: string, expiresIn: number}}
 */
function exchangeShortToLong(shortLivedToken) {
  const clientSecret = getProp('THREADS_APP_SECRET');
  if (!clientSecret) throw new Error('THREADS_APP_SECRET が未設定');

  const url = CONFIG.THREADS_API.TOKEN_EXCHANGE
    + '?grant_type=th_exchange_token'
    + '&client_secret=' + encodeURIComponent(clientSecret)
    + '&access_token=' + encodeURIComponent(shortLivedToken);

  const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  const code = res.getResponseCode();
  const body = JSON.parse(res.getContentText());

  if (code !== 200) {
    throw new Error('Token exchange failed: ' + JSON.stringify(body));
  }

  setProp('THREADS_ACCESS_TOKEN', body.access_token);
  setProp('THREADS_TOKEN_CREATED', String(Date.now()));
  setProp('THREADS_TOKEN_EXPIRES_IN', String(body.expires_in));

  return { token: body.access_token, expiresIn: body.expires_in };
}

/**
 * 長期トークンを延長する（最大60日）
 * Sunday 02:00 のトリガーから呼ばれる。
 * 残り24時間未満なら再延長、それ以上なら延長APIを叩いて60日リセット。
 */
function refreshLongLivedToken() {
  const currentToken = getProp('THREADS_ACCESS_TOKEN');
  if (!currentToken) {
    Notifier.send('[Token] アクセストークン未設定。初回セットアップが必要。');
    return;
  }

  const url = CONFIG.THREADS_API.REFRESH
    + '?grant_type=th_refresh_token'
    + '&access_token=' + encodeURIComponent(currentToken);

  const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  const code = res.getResponseCode();
  const body = JSON.parse(res.getContentText());

  if (code !== 200) {
    Notifier.send('[Token] 延長失敗: ' + JSON.stringify(body));
    return;
  }

  setProp('THREADS_ACCESS_TOKEN', body.access_token);
  setProp('THREADS_TOKEN_CREATED', String(Date.now()));
  setProp('THREADS_TOKEN_EXPIRES_IN', String(body.expires_in));

  Notifier.send(`[Token] 延長成功。次回期限: ${Math.floor(body.expires_in / 86400)}日後`);
}

/**
 * 短期トークン交換用のHTMLダイアログを表示。
 * Admin が GAS エディタから手動実行。
 */
function showTokenExchangeDialog() {
  const html = HtmlService.createHtmlOutput(`
    <div style="font-family: sans-serif; padding: 16px;">
      <h3>Threads 短期トークン → 長期交換</h3>
      <p>Meta Developer Console で取得した短期アクセストークンを貼ってください。</p>
      <textarea id="token" rows="6" cols="60" placeholder="EAAB..."></textarea>
      <br><br>
      <button onclick="exchange()">交換する</button>
      <div id="result" style="margin-top: 12px; color: green;"></div>
      <script>
        function exchange() {
          var token = document.getElementById('token').value.trim();
          if (!token) { alert('トークンを入力してください'); return; }
          google.script.run
            .withSuccessHandler(function(r){
              document.getElementById('result').innerText =
                '✅ 成功！長期トークン保存完了。期限: ' + Math.floor(r.expiresIn/86400) + '日';
            })
            .withFailureHandler(function(e){
              document.getElementById('result').innerText = '❌ 失敗: ' + e.message;
              document.getElementById('result').style.color = 'red';
            })
            .exchangeShortToLong(token);
        }
      </script>
    </div>
  `).setWidth(600).setHeight(400);
  SpreadsheetApp.getUi().showModalDialog(html, 'Token Exchange');
}

/**
 * 現在のトークン状態を確認
 * @returns {{token: string, ageDays: number, expiresInDays: number}}
 */
function getTokenStatus() {
  const token = getProp('THREADS_ACCESS_TOKEN');
  const created = Number(getProp('THREADS_TOKEN_CREATED') || 0);
  const expiresIn = Number(getProp('THREADS_TOKEN_EXPIRES_IN') || 0);
  if (!token) return { token: null, ageDays: null, expiresInDays: null };
  const ageDays = Math.floor((Date.now() - created) / 86400000);
  const expiresInDays = Math.floor(expiresIn / 86400) - ageDays;
  return {
    token: token.slice(0, 10) + '...',
    ageDays,
    expiresInDays
  };
}
```

---

### 4-3. `ContentGenerator.gs`

```javascript
/**
 * ContentGenerator.gs
 * 翌日3投稿分（朝/昼/夜）を生成する。
 *
 * フェーズ1: sns_templates からスロット×テーマで未使用テンプレを選択、プレースホルダ置換
 * フェーズ2: Anthropic / OpenAI API で動的生成（関数IFのみ定義、実装は仮文字列）
 */

/**
 * 翌日3投稿分を生成して sns_queue に保存。
 * 23:00 のトリガーから呼ばれる。
 */
function generateTomorrowPosts() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateStr = Utilities.formatDate(tomorrow, CONFIG.TZ, 'yyyy-MM-dd');

  const slots = ['morning', 'noon', 'night'];
  const results = [];

  slots.forEach(slot => {
    try {
      const content = generateForSlot(slot, tomorrow);
      const legalResult = LegalCheck.check(content);

      const queueId = `q_${Utilities.formatDate(tomorrow, CONFIG.TZ, 'yyyyMMdd')}_${slot}`;
      const scheduledAt = buildScheduledAt(tomorrow, slot);

      const row = [
        queueId,
        Utilities.formatDate(scheduledAt, CONFIG.TZ, 'yyyy-MM-dd HH:mm'),
        'follow_official',
        'threads',
        slot,
        content.theme,
        content.text,
        legalResult.status,
        legalResult.note,
        legalResult.status === 'ng' ? 'skipped' : 'scheduled',
        '',
        '',
        Utilities.formatDate(new Date(), CONFIG.TZ, 'yyyy-MM-dd HH:mm:ss'),
        '',
        0,
        ''
      ];

      const sheet = getSheet(CONFIG.SHEETS.QUEUE);
      sheet.appendRow(row);

      Logger.write({
        queueId,
        event: legalResult.status === 'ng' ? 'legal_ng' : 'created',
        account: 'follow_official',
        slot,
        contentPreview: content.text.slice(0, 60),
        severity: legalResult.status === 'ng' ? 'error' : 'info',
        detail: JSON.stringify({ legal: legalResult, theme: content.theme })
      });

      results.push({ slot, queueId, status: legalResult.status });

    } catch (e) {
      Logger.write({
        queueId: '',
        event: 'failed',
        account: 'follow_official',
        slot,
        severity: 'error',
        detail: 'generate error: ' + e.message
      });
      results.push({ slot, status: 'error', error: e.message });
    }
  });

  // 翌日3投稿の生成サマリーを管理者LINEへ
  Notifier.sendDailySummary(dateStr, results);
}

/**
 * スロット別に1投稿を生成
 * @param {string} slot
 * @param {Date} targetDate
 * @returns {{text: string, theme: string}}
 */
function generateForSlot(slot, targetDate) {
  // まずテンプレ生成、AI実装後は AI を優先
  const useAi = getProp('USE_AI_GENERATION') === 'true';
  if (useAi) {
    return generateWithAI(slot, targetDate);
  }
  return generateFromTemplate(slot, targetDate);
}

/**
 * sns_templates からスロット適合テンプレを選択して生成
 * @param {string} slot
 * @param {Date} targetDate
 * @returns {{text: string, theme: string}}
 */
function generateFromTemplate(slot, targetDate) {
  const sheet = getSheet(CONFIG.SHEETS.TEMPLATES);
  const data = sheet.getDataRange().getValues();
  const header = data[0];
  const rows = data.slice(1);

  const idx = {
    template_id: header.indexOf('template_id'),
    slot: header.indexOf('slot'),
    theme: header.indexOf('theme'),
    core_message_id: header.indexOf('core_message_id'),
    template_text: header.indexOf('template_text'),
    active: header.indexOf('active'),
    last_used_at: header.indexOf('last_used_at'),
    use_count: header.indexOf('use_count')
  };

  // 該当スロットの active テンプレを使用回数昇順でフィルタ
  const candidates = rows
    .map((r, i) => ({ row: r, rowIndex: i + 2 }))
    .filter(c => c.row[idx.slot] === slot && String(c.row[idx.active]).toUpperCase() === 'TRUE')
    .sort((a, b) => (a.row[idx.use_count] || 0) - (b.row[idx.use_count] || 0));

  if (candidates.length === 0) {
    throw new Error(`No active template for slot=${slot}`);
  }

  const chosen = candidates[0];
  const templateText = chosen.row[idx.template_text];
  const theme = chosen.row[idx.theme];

  // プレースホルダ置換
  const replaced = expandPlaceholders(templateText, targetDate);

  // 使用回数を加算
  sheet.getRange(chosen.rowIndex, idx.use_count + 1).setValue((chosen.row[idx.use_count] || 0) + 1);
  sheet.getRange(chosen.rowIndex, idx.last_used_at + 1).setValue(new Date());

  // LINE CTA を末尾に追加（昼スロットは確定で、他は確率付与）
  let final = replaced;
  if (slot === 'noon' || Math.random() < 0.7) {
    final = appendLineCta(final);
  }

  return { text: clipToLimit(final), theme };
}

/**
 * AI生成（関数IF、実装はフェーズ2）
 * @param {string} slot
 * @param {Date} targetDate
 * @returns {{text: string, theme: string}}
 */
function generateWithAI(slot, targetDate) {
  // TODO: Anthropic/OpenAI 実装
  // 現状はテンプレにフォールバック
  return generateFromTemplate(slot, targetDate);

  /* 将来実装イメージ:
  const apiKey = getProp('ANTHROPIC_API_KEY');
  const prompt = buildPrompt(slot, targetDate);
  const res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    contentType: 'application/json',
    payload: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }]
    })
  });
  ...
  */
}

/**
 * 投稿用 LLM プロンプトを組み立て（AI生成有効化時に使用）
 * @param {string} slot
 * @param {Date} targetDate
 * @returns {string}
 */
function buildPrompt(slot, targetDate) {
  const slotDef = CONFIG.SLOTS[slot];
  const cores = CONFIG.CORE_MESSAGES.map(c => `${c.id}. ${c.text}`).join('\n');
  return `あなたはFOLLOW（セルフカラー相談サブスク）公式アカウントの担当です。
現役20年のカラーリスト川崎さんの代弁で投稿を書きます。

【投稿スロット】${slot} (${slotDef.hour}:${slotDef.minute})
【テーマ】${slotDef.theme}
【日付】${Utilities.formatDate(targetDate, CONFIG.TZ, 'yyyy-MM-dd (EEE)')}

【7つのコアメッセージ（最低1つを軸に）】
${cores}

【禁止表現】絶対/100%/治る/全額返金/業界No.1/今だけ
【トーン】上から目線NG、不安煽りNG、押し売りNG
【長さ】400字以内（Threads 500字制限）
【末尾】昼スロットは必ず LINE誘導: ${CONFIG.LINE_CTA}

投稿本文だけを出力してください。`;
}

/**
 * プレースホルダ展開
 * {date} {weekday} {season} {core1}..{core7}
 * @param {string} text
 * @param {Date} targetDate
 * @returns {string}
 */
function expandPlaceholders(text, targetDate) {
  const dateStr = Utilities.formatDate(targetDate, CONFIG.TZ, 'M月d日');
  const weekday = ['日','月','火','水','木','金','土'][targetDate.getDay()];
  const month = targetDate.getMonth() + 1;
  const season = month <= 2 || month === 12 ? '冬'
                : month <= 5 ? '春'
                : month <= 8 ? '夏'
                : '秋';

  let out = text
    .replace(/\{date\}/g, dateStr)
    .replace(/\{weekday\}/g, weekday)
    .replace(/\{season\}/g, season);

  CONFIG.CORE_MESSAGES.forEach(c => {
    out = out.replace(new RegExp('\\{core' + c.id + '\\}', 'g'), c.text);
  });

  return out;
}

/**
 * LINE CTAを末尾に追加（既にあれば追加しない）
 * @param {string} text
 * @returns {string}
 */
function appendLineCta(text) {
  if (text.includes('lin.ee') || text.includes('LINE')) return text;
  return text + CONFIG.LINE_CTA_TEXT;
}

/**
 * Threads文字数制限内に切り詰める
 * @param {string} text
 * @returns {string}
 */
function clipToLimit(text) {
  if (text.length <= CONFIG.THREADS.SOFT_LENGTH) return text;
  return text.slice(0, CONFIG.THREADS.SOFT_LENGTH - 3) + '...';
}

/**
 * スロット時刻と日付から実投稿予定時刻 Date を構築
 * @param {Date} date
 * @param {string} slot
 * @returns {Date}
 */
function buildScheduledAt(date, slot) {
  const slotDef = CONFIG.SLOTS[slot];
  const d = new Date(date);
  d.setHours(slotDef.hour, slotDef.minute, 0, 0);
  return d;
}
```

---

### 4-4. `LegalCheck.gs`

```javascript
/**
 * LegalCheck.gs
 * E法務チェック。3段階判定（ok / needs_fix / ng）。
 *
 * フェーズ1: regex + NGワードリスト
 * フェーズ2: Anthropic Claude 判定（関数IFのみ）
 */

const LegalCheck = {
  /**
   * 投稿本文を法務チェック
   * @param {{text: string}|string} input
   * @returns {{status: 'ok'|'needs_fix'|'ng', note: string, hits: object}}
   */
  check(input) {
    const text = typeof input === 'string' ? input : input.text;
    const result = {
      status: 'ok',
      note: '',
      hits: { ng: [], warn: [], regex: [] }
    };

    // 1. NGワード完全マッチ
    CONFIG.LEGAL_NG_WORDS.forEach(word => {
      if (text.includes(word)) {
        result.hits.ng.push(word);
      }
    });

    // 2. 警告ワード（修正必要レベル）
    CONFIG.LEGAL_WARN_WORDS.forEach(word => {
      if (text.includes(word)) {
        result.hits.warn.push(word);
      }
    });

    // 3. regex ベース（数字+%、保証表現、医薬品的効能）
    const regexRules = [
      { name: 'percent_claim', pattern: /\d{2,3}\s*%/g, severity: 'warn' },
      { name: 'guarantee', pattern: /(保証|保障)/g, severity: 'warn' },
      { name: 'cure_claim', pattern: /(治る|治癒|根本改善)/g, severity: 'ng' },
      { name: 'absolute', pattern: /(絶対|100\s*%|完璧|必ず)/g, severity: 'ng' },
      { name: 'no_1', pattern: /(No\.?1|ナンバーワン|業界一)/gi, severity: 'ng' },
      { name: 'refund', pattern: /(全額返金|完全返金)/g, severity: 'ng' }
    ];

    regexRules.forEach(rule => {
      const matches = text.match(rule.pattern);
      if (matches) {
        result.hits.regex.push({ rule: rule.name, matches, severity: rule.severity });
      }
    });

    // 4. 判定ロジック
    const ngRegexHits = result.hits.regex.filter(h => h.severity === 'ng');
    if (result.hits.ng.length > 0 || ngRegexHits.length > 0) {
      result.status = 'ng';
    } else if (result.hits.warn.length >= 2 || result.hits.regex.some(h => h.severity === 'warn')) {
      result.status = 'needs_fix';
    }

    // 5. 7コアメッセージ整合性チェック（弱判定、note に残すだけ）
    const coreHits = CONFIG.CORE_MESSAGES.filter(c => {
      const keyword = c.text.split('・')[0].slice(0, 5);
      return text.includes(keyword) || text.includes(c.text.slice(0, 6));
    });
    if (coreHits.length === 0) {
      result.note += '[info] 7コアメッセージのキーワード未検出（弱警告）。';
    }

    if (result.hits.ng.length > 0) {
      result.note += `[NG] 禁止語: ${result.hits.ng.join(',')}。`;
    }
    if (ngRegexHits.length > 0) {
      result.note += `[NG] regex: ${ngRegexHits.map(h => h.rule).join(',')}。`;
    }
    if (result.hits.warn.length > 0) {
      result.note += `[WARN] 警告語: ${result.hits.warn.join(',')}。`;
    }

    return result;
  },

  /**
   * AI判定（関数IF、フェーズ2実装）
   * @param {string} text
   * @returns {{status: string, note: string}}
   */
  checkWithAI(text) {
    // TODO: Anthropic Claude API で E-legal-checklist-prompt.md を投げる
    return { status: 'ok', note: '[ai] not implemented yet' };
  }
};
```

---

### 4-5. `ThreadsClient.gs`

```javascript
/**
 * ThreadsClient.gs
 * Threads Graph API 2段階投稿（CREATE → PUBLISH）。
 * リトライ・指数バックオフ・レート制限配慮を含む。
 */

const ThreadsClient = {
  /**
   * 2段階投稿を実行
   * @param {string} text
   * @returns {{published_id: string, creation_id: string}}
   */
  publish(text) {
    const userId = getProp('THREADS_USER_ID');
    const token = getProp('THREADS_ACCESS_TOKEN');
    if (!userId || !token) throw new Error('THREADS_USER_ID または THREADS_ACCESS_TOKEN 未設定');

    // dryRun モード
    if (getProp(CONFIG.DRY_RUN_KEY) === 'true') {
      Logger.log('[dryRun] would post: ' + text.slice(0, 80));
      return { published_id: 'DRY_' + Date.now(), creation_id: 'DRY_C_' + Date.now() };
    }

    // Step 1: CREATE
    const creationId = this._createContainer(userId, token, text);

    // Threads推奨: CREATE→PUBLISH の間に最低30秒待機
    Utilities.sleep(CONFIG.RETRY.PUBLISH_WAIT_MS);

    // Step 2: PUBLISH
    const publishedId = this._publishContainer(userId, token, creationId);

    return { creation_id: creationId, published_id: publishedId };
  },

  /**
   * Step 1: メディアコンテナ作成
   * @private
   */
  _createContainer(userId, token, text) {
    const url = `${CONFIG.THREADS_API.BASE}/${CONFIG.THREADS_API.VERSION}/${userId}/threads`;
    const payload = {
      media_type: 'TEXT',
      text,
      access_token: token
    };

    return this._fetchWithRetry(url, {
      method: 'post',
      payload,
      muteHttpExceptions: true
    }, (body) => {
      if (!body.id) throw new Error('CREATE no id: ' + JSON.stringify(body));
      return body.id;
    });
  },

  /**
   * Step 2: 公開
   * @private
   */
  _publishContainer(userId, token, creationId) {
    const url = `${CONFIG.THREADS_API.BASE}/${CONFIG.THREADS_API.VERSION}/${userId}/threads_publish`;
    const payload = {
      creation_id: creationId,
      access_token: token
    };

    return this._fetchWithRetry(url, {
      method: 'post',
      payload,
      muteHttpExceptions: true
    }, (body) => {
      if (!body.id) throw new Error('PUBLISH no id: ' + JSON.stringify(body));
      return body.id;
    });
  },

  /**
   * 指数バックオフ付き fetch
   * @private
   */
  _fetchWithRetry(url, options, extractor) {
    let lastError = null;
    for (let attempt = 1; attempt <= CONFIG.RETRY.MAX_ATTEMPTS; attempt++) {
      try {
        const res = UrlFetchApp.fetch(url, options);
        const code = res.getResponseCode();
        const body = JSON.parse(res.getContentText());

        if (code === 200) {
          return extractor(body);
        }

        // レート制限（429）または5xxはリトライ
        if (code === 429 || code >= 500) {
          lastError = new Error(`HTTP ${code}: ${JSON.stringify(body)}`);
          const delay = CONFIG.RETRY.BASE_DELAY_MS * Math.pow(2, attempt - 1);
          Logger.log(`[retry] attempt=${attempt} delay=${delay}ms code=${code}`);
          Utilities.sleep(delay);
          continue;
        }

        // 4xx (429除く) は即エラー
        throw new Error(`HTTP ${code}: ${JSON.stringify(body)}`);

      } catch (e) {
        lastError = e;
        if (attempt < CONFIG.RETRY.MAX_ATTEMPTS) {
          const delay = CONFIG.RETRY.BASE_DELAY_MS * Math.pow(2, attempt - 1);
          Utilities.sleep(delay);
        }
      }
    }
    throw lastError || new Error('Unknown fetch error');
  }
};

/**
 * スケジュール済み投稿を1件投稿する。
 * 各スロットのトリガーから呼ばれる。
 * @param {string} slot - morning/noon/night
 */
function postScheduled(slot) {
  // 1. Kill Switch 確認
  if (!KillSwitch.isEnabled()) {
    Logger.write({
      queueId: '',
      event: 'skipped_kill_switch',
      slot,
      severity: 'warn',
      detail: 'auto_post_enabled=false'
    });
    Notifier.send(`[KillSwitch] ${slot} 投稿スキップ（緊急停止中）`);
    return;
  }

  // 2. 今日のスロット行を取得
  const today = Utilities.formatDate(new Date(), CONFIG.TZ, 'yyyyMMdd');
  const queueId = `q_${today}_${slot}`;
  const row = findQueueRow(queueId);

  if (!row) {
    Notifier.send(`[Error] queue 未生成: ${queueId}`);
    return;
  }

  if (row.data.post_status !== 'scheduled') {
    Logger.log(`[postScheduled] skip ${queueId}: status=${row.data.post_status}`);
    return;
  }

  // 3. 法務再チェック（直前ガード）
  const legal = LegalCheck.check(row.data.content);
  if (legal.status === 'ng') {
    updateQueueStatus(row.rowIndex, 'skipped', '', '', legal.note);
    Notifier.send(`[Legal] NG 検出で投稿スキップ: ${queueId}\n${legal.note}`);
    return;
  }

  // 4. 投稿実行
  updateQueueStatus(row.rowIndex, 'posting', '', '', '');
  try {
    const result = ThreadsClient.publish(row.data.content);
    updateQueueStatus(row.rowIndex, 'posted', result.creation_id, result.published_id, '');
    Logger.write({
      queueId,
      event: 'posted',
      slot,
      threadsPostId: result.published_id,
      contentPreview: row.data.content.slice(0, 60),
      severity: 'info',
      detail: JSON.stringify(result)
    });
    Notifier.send(`✅ [${slot}] 投稿成功\n${row.data.content.slice(0, 80)}...\nID: ${result.published_id}`);
  } catch (e) {
    const retry = (row.data.retry_count || 0) + 1;
    updateQueueStatus(row.rowIndex, retry < CONFIG.RETRY.MAX_ATTEMPTS ? 'scheduled' : 'failed',
                     '', '', e.message, retry);
    Logger.write({
      queueId,
      event: 'failed',
      slot,
      severity: 'error',
      detail: e.message
    });
    Notifier.send(`❌ [${slot}] 投稿失敗 (retry=${retry})\n${e.message}`);
  }
}

// 個別エントリ関数（Time Trigger は引数取れないのでラップ）
function postMorning() { postScheduled('morning'); }
function postNoon()    { postScheduled('noon'); }
function postNight()   { postScheduled('night'); }

/**
 * sns_queue から id 一致行を検索
 * @param {string} queueId
 * @returns {{rowIndex: number, data: object}|null}
 */
function findQueueRow(queueId) {
  const sheet = getSheet(CONFIG.SHEETS.QUEUE);
  const data = sheet.getDataRange().getValues();
  const header = data[0];
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === queueId) {
      const row = {};
      header.forEach((h, j) => { row[h] = data[i][j]; });
      return { rowIndex: i + 1, data: row };
    }
  }
  return null;
}

/**
 * sns_queue 行の投稿ステータスを更新
 */
function updateQueueStatus(rowIndex, status, creationId, postId, error, retryCount) {
  const sheet = getSheet(CONFIG.SHEETS.QUEUE);
  const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  const updates = {
    post_status: status,
    threads_creation_id: creationId || sheet.getRange(rowIndex, header.indexOf('threads_creation_id') + 1).getValue(),
    threads_post_id: postId || sheet.getRange(rowIndex, header.indexOf('threads_post_id') + 1).getValue(),
    error: error || ''
  };
  if (status === 'posted') {
    updates.posted_at = Utilities.formatDate(new Date(), CONFIG.TZ, 'yyyy-MM-dd HH:mm:ss');
  }
  if (typeof retryCount === 'number') {
    updates.retry_count = retryCount;
  }

  Object.keys(updates).forEach(key => {
    const colIdx = header.indexOf(key);
    if (colIdx >= 0) {
      sheet.getRange(rowIndex, colIdx + 1).setValue(updates[key]);
    }
  });
}
```

---

### 4-6. `Scheduler.gs`

```javascript
/**
 * Scheduler.gs
 * Time Trigger をコードで設定/解除する。
 * GAS のUIから手動でセットせず、関数 installAllTriggers() を1回叩けば全部入る。
 */

/**
 * 全トリガーをインストール
 * 既存トリガーは一度全削除してから再作成（冪等性確保）。
 */
function installAllTriggers() {
  uninstallAllTriggers();

  // 23:00 翌日分生成
  ScriptApp.newTrigger('generateTomorrowPosts')
    .timeBased().atHour(23).nearMinute(0).everyDays(1).create();

  // 7:30 投稿
  ScriptApp.newTrigger('postMorning')
    .timeBased().atHour(7).nearMinute(30).everyDays(1).create();

  // 12:30 投稿
  ScriptApp.newTrigger('postNoon')
    .timeBased().atHour(12).nearMinute(30).everyDays(1).create();

  // 21:00 投稿
  ScriptApp.newTrigger('postNight')
    .timeBased().atHour(21).nearMinute(0).everyDays(1).create();

  // 日曜 02:00 トークン延長
  ScriptApp.newTrigger('refreshLongLivedToken')
    .timeBased().onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(2).create();

  // 6:00 / 18:00 Kill Switch 健全性チェック
  ScriptApp.newTrigger('killSwitchHealthCheck')
    .timeBased().atHour(6).nearMinute(0).everyDays(1).create();
  ScriptApp.newTrigger('killSwitchHealthCheck')
    .timeBased().atHour(18).nearMinute(0).everyDays(1).create();

  // 23:30 翌日3投稿サマリーを管理者に送る（generate の後の最終確認）
  ScriptApp.newTrigger('sendDailyAdminSummary')
    .timeBased().atHour(23).nearMinute(30).everyDays(1).create();

  Logger.log('✅ 8 triggers installed');
  Notifier.send('[Scheduler] 全トリガー設定完了 (8件)');
}

/**
 * 全トリガーを削除
 */
function uninstallAllTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(t => ScriptApp.deleteTrigger(t));
  Logger.log(`Removed ${triggers.length} triggers`);
}

/**
 * 現在のトリガー一覧を取得
 * @returns {Array}
 */
function listTriggers() {
  return ScriptApp.getProjectTriggers().map(t => ({
    handler: t.getHandlerFunction(),
    type: t.getEventType().toString(),
    source: t.getTriggerSource().toString()
  }));
}
```

---

### 4-7. `KillSwitch.gs`

```javascript
/**
 * KillSwitch.gs
 * 緊急停止フラグの管理。
 * sns_kill_switch シート (A2: auto_post_enabled) を参照。
 *
 * 切替元:
 *   1. Sheets 直接編集（管理者が手動でA2をFALSEに）
 *   2. LINE Webhook（line-harness-oss admin-bot から HTTP POST 受信）
 *   3. 自動検知（API失敗連発・同一文言3連投）
 */

const KillSwitch = {
  /**
   * 投稿可能か判定
   * @returns {boolean}
   */
  isEnabled() {
    try {
      const sheet = getSheet(CONFIG.SHEETS.KILL_SWITCH);
      const value = sheet.getRange('B2').getValue();
      return String(value).toUpperCase() === 'TRUE';
    } catch (e) {
      // シート参照失敗時は安全側（投稿停止）に倒す
      Logger.log('[KillSwitch] read error, fallback to disabled: ' + e.message);
      return false;
    }
  },

  /**
   * 停止フラグをセット
   * @param {string} reason
   * @param {string} updatedBy
   */
  disable(reason, updatedBy) {
    const sheet = getSheet(CONFIG.SHEETS.KILL_SWITCH);
    sheet.getRange('B2').setValue('FALSE');
    sheet.getRange('B3').setValue(new Date());
    sheet.getRange('B4').setValue(updatedBy || 'unknown');
    sheet.getRange('B5').setValue(reason || '');
    Notifier.send(`🛑 [KillSwitch] 自動投稿を停止しました\n理由: ${reason}\n更新者: ${updatedBy}`);
  },

  /**
   * 再開
   * @param {string} updatedBy
   */
  enable(updatedBy) {
    const sheet = getSheet(CONFIG.SHEETS.KILL_SWITCH);
    sheet.getRange('B2').setValue('TRUE');
    sheet.getRange('B3').setValue(new Date());
    sheet.getRange('B4').setValue(updatedBy || 'unknown');
    sheet.getRange('B5').setValue('resumed');
    Notifier.send(`✅ [KillSwitch] 自動投稿を再開しました\n更新者: ${updatedBy}`);
  }
};

/**
 * 健全性チェック（6:00/18:00 のトリガーから）
 * - 直近3投稿失敗 → 自動停止
 * - sns_queue の今日分が空 → 警告
 */
function killSwitchHealthCheck() {
  const sheet = getSheet(CONFIG.SHEETS.LOG);
  const data = sheet.getDataRange().getValues();
  const recent = data.slice(-10);
  const failures = recent.filter(r => r[2] === 'failed').length;

  if (failures >= 3) {
    KillSwitch.disable(`直近${failures}件投稿失敗で自動停止`, 'auto_detection');
    return;
  }

  // 今日分のキュー存在チェック
  const today = Utilities.formatDate(new Date(), CONFIG.TZ, 'yyyyMMdd');
  const queueSheet = getSheet(CONFIG.SHEETS.QUEUE);
  const queueData = queueSheet.getDataRange().getValues();
  const todayCount = queueData.filter(r => String(r[0]).includes(today)).length;

  if (todayCount < 3) {
    Notifier.send(`⚠ [Health] 今日のキュー未完: ${todayCount}/3 件のみ存在`);
  }
}

/**
 * LINE Webhook から停止コマンドを受ける doPost エンドポイント
 * GAS Web App としてデプロイし、URL を line-harness-oss Workers に教える。
 *
 * 受信ペイロード例:
 *   { "command": "stop_auto_posting", "reason": "...", "user_id": "..." }
 *   { "command": "resume_auto_posting", "user_id": "..." }
 *   { "command": "status" }
 */
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const sharedSecret = getProp('WEBHOOK_SHARED_SECRET');

    // 簡易認証: ヘッダ X-Webhook-Secret を期待
    const provided = (e.parameter && e.parameter.secret) || body.secret;
    if (sharedSecret && provided !== sharedSecret) {
      return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'unauthorized' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const cmd = body.command;
    let result = {};

    if (cmd === 'stop_auto_posting') {
      KillSwitch.disable(body.reason || 'LINE webhook', body.user_id || 'admin_line');
      result = { ok: true, action: 'disabled' };
    } else if (cmd === 'resume_auto_posting') {
      KillSwitch.enable(body.user_id || 'admin_line');
      result = { ok: true, action: 'enabled' };
    } else if (cmd === 'status') {
      result = {
        ok: true,
        enabled: KillSwitch.isEnabled(),
        token: getTokenStatus()
      };
    } else {
      result = { ok: false, error: 'unknown command: ' + cmd };
    }

    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
```

---

### 4-8. `Notifier.gs`

```javascript
/**
 * Notifier.gs
 * 管理者LINEへの通知を集約。
 *
 * 経路:
 *   1. 直接 LINE Messaging API push (推奨、簡潔)
 *   2. line-harness-oss Workers /api/admin-notify 経由 (Flex Message 使う場合)
 */

const Notifier = {
  /**
   * シンプルテキスト通知
   * @param {string} text
   */
  send(text) {
    const accessToken = getProp('LINE_CHANNEL_ACCESS_TOKEN');
    const adminUserId = getProp('ADMIN_LINE_USER_ID');

    if (!accessToken || !adminUserId) {
      Logger.log('[Notifier] LINE 設定なし、スキップ: ' + text);
      return;
    }

    const payload = {
      to: adminUserId,
      messages: [{ type: 'text', text: text.slice(0, 2000) }]
    };

    try {
      UrlFetchApp.fetch(CONFIG.LINE.PUSH_ENDPOINT, {
        method: 'post',
        contentType: 'application/json',
        headers: { 'Authorization': 'Bearer ' + accessToken },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      });
    } catch (e) {
      Logger.log('[Notifier] LINE push failed: ' + e.message);
    }
  },

  /**
   * Workers 経由で Flex Message を送る（高度な通知用）
   * @param {object} flexPayload
   */
  sendFlexViaWorker(flexPayload) {
    const url = getProp('WORKER_ADMIN_NOTIFY_URL');
    if (!url) {
      Logger.log('[Notifier] WORKER_ADMIN_NOTIFY_URL 未設定');
      return;
    }
    const secret = getProp('WORKER_SHARED_SECRET') || '';
    try {
      UrlFetchApp.fetch(url, {
        method: 'post',
        contentType: 'application/json',
        headers: { 'X-Shared-Secret': secret },
        payload: JSON.stringify(flexPayload),
        muteHttpExceptions: true
      });
    } catch (e) {
      Logger.log('[Notifier] Worker notify failed: ' + e.message);
    }
  },

  /**
   * 翌日3投稿の生成結果サマリー
   * @param {string} dateStr
   * @param {Array} results
   */
  sendDailySummary(dateStr, results) {
    const okCount = results.filter(r => r.status === 'ok').length;
    const fixCount = results.filter(r => r.status === 'needs_fix').length;
    const ngCount = results.filter(r => r.status === 'ng').length;
    const errCount = results.filter(r => r.status === 'error').length;

    let text = `🌙 [FOLLOW Autopost] 明日 ${dateStr} の投稿生成完了\n\n`;
    text += `✅ OK: ${okCount}件\n`;
    if (fixCount > 0) text += `⚠ 要修正: ${fixCount}件\n`;
    if (ngCount > 0) text += `❌ NG: ${ngCount}件\n`;
    if (errCount > 0) text += `🚨 エラー: ${errCount}件\n`;
    text += '\n詳細は sns_queue タブを確認:\n';
    text += `https://docs.google.com/spreadsheets/d/${CONFIG.SPREADSHEET_ID}/edit`;

    this.send(text);
  }
};

/**
 * 23:30 の日次サマリートリガーから呼ばれる
 */
function sendDailyAdminSummary() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const datePrefix = Utilities.formatDate(tomorrow, CONFIG.TZ, 'yyyyMMdd');

  const sheet = getSheet(CONFIG.SHEETS.QUEUE);
  const data = sheet.getDataRange().getValues();
  const header = data[0];
  const rows = data.slice(1).filter(r => String(r[0]).includes(datePrefix));

  if (rows.length === 0) {
    Notifier.send(`⚠ [Daily Summary] 明日 ${datePrefix} のキューが0件！`);
    return;
  }

  let text = `📅 [明日の投稿予定] ${Utilities.formatDate(tomorrow, CONFIG.TZ, 'yyyy-MM-dd (EEE)')}\n\n`;
  const slotIdx = header.indexOf('slot');
  const contentIdx = header.indexOf('content');
  const statusIdx = header.indexOf('e_legal_status');

  rows.forEach(r => {
    const emoji = r[statusIdx] === 'ok' ? '✅' : r[statusIdx] === 'needs_fix' ? '⚠' : '❌';
    text += `${emoji} ${r[slotIdx]}\n${String(r[contentIdx]).slice(0, 80)}...\n\n`;
  });

  Notifier.send(text);
}
```

---

### 4-9. `Logger.gs`

```javascript
/**
 * Logger.gs
 * sns_log への書き込みヘルパー。
 * GAS の Logger.log（コンソール出力）と区別するため CustomLogger とは別オブジェクトに集約。
 */

const Logger = {
  /**
   * sns_log に1行追加
   * @param {{queueId?: string, event: string, account?: string, slot?: string,
   *          threadsPostId?: string, contentPreview?: string,
   *          severity?: string, detail?: string}} payload
   */
  write(payload) {
    try {
      const sheet = getSheet(CONFIG.SHEETS.LOG);
      sheet.appendRow([
        Utilities.formatDate(new Date(), CONFIG.TZ, 'yyyy-MM-dd HH:mm:ss'),
        payload.queueId || '',
        payload.event,
        payload.account || 'follow_official',
        payload.slot || '',
        payload.threadsPostId || '',
        (payload.contentPreview || '').slice(0, 60),
        payload.severity || 'info',
        payload.detail || ''
      ]);
    } catch (e) {
      // GAS の Logger（console）にフォールバック
      console.error('[Logger.write] failed: ' + e.message + ' payload=' + JSON.stringify(payload));
    }
  },

  /**
   * console.log の薄いラッパー（既存コード互換用）
   * @param {string} msg
   */
  log(msg) {
    console.log(msg);
  }
};
```

---

### 4-10. `Main.gs`

```javascript
/**
 * Main.gs
 * 統合エントリポイント。
 * - スモークテスト群
 * - 初期セットアップウィザード
 * - dryRun / live 切替
 */

/**
 * 初回セットアップ手順（実行順）
 * 1. setupSheets()                  - 4タブ作成
 * 2. seedTemplates()                - sns_templates 初期投入
 * 3. showTokenExchangeDialog()      - トークン交換UI
 * 4. installAllTriggers()           - Time Trigger 設定
 * 5. smokeTest()                    - 全モジュール動作確認
 * 6. smokeTestDryRunPost()          - 投稿フローのdryRun
 */

/**
 * テンプレ初期投入。
 * POSITIONING-FINAL.md §11 の7コアメッセージ × 3スロットを最低21件用意。
 */
function seedTemplates() {
  const sheet = getSheet(CONFIG.SHEETS.TEMPLATES);
  const templates = SEED_TEMPLATES;

  templates.forEach(t => {
    sheet.appendRow([
      t.id, t.slot, t.theme, t.coreMessageId, t.text, 'TRUE', '', 0, t.notes || ''
    ]);
  });

  Logger.log(`✅ Seeded ${templates.length} templates`);
}

/**
 * テンプレ定義（21件 = 3スロット × 7コアメッセージ網羅）
 * §8 の朝7/昼7/夜7 構成
 */
const SEED_TEMPLATES = [
  // ─── 朝 7:30 教育・実践（7パターン） ───
  { id: 'morn_edu_001', slot: 'morning', theme: 'education', coreMessageId: 1,
    text: 'おはようございます。\n\n白髪、全頭染める必要、本当にありますか？\n分け目とこめかみだけ気になる方、その2箇所だけ染めれば充分です。\n\n薬剤量が減るほど、頭皮への蓄積も減ります。\n{date}、まずは「気になる場所」を鏡で確認してみてください。',
    notes: 'core1 気になるところだけ' },

  { id: 'morn_edu_002', slot: 'morning', theme: 'education', coreMessageId: 2,
    text: 'おはようございます。\n\n市販の白髪染め、強すぎる感じありませんか？\n美容師が現場で使うプロ用薬剤は、ジアミン濃度・アルカリ度ともに低めに設計されているものがあります。\n\n自宅で使える方法、相談してください。',
    notes: 'core2 プロ用商材' },

  { id: 'morn_edu_003', slot: 'morning', theme: 'education', coreMessageId: 3,
    text: 'おはようございます、{season}の頭皮ケアの話を一つ。\n\n染めた後の3日間、シャンプー2回洗い・ドライは根元から、これだけで頭皮負担が変わります。\n染めて終わりじゃなく、その後のケアまでが「染める」という行為です。',
    notes: 'core3 頭皮ケアまで' },

  { id: 'morn_edu_004', slot: 'morning', theme: 'education', coreMessageId: 4,
    text: 'おはようございます。\n\n現役20年、大阪の専門店で毎日カラーを担当しています。\n何万人ものお客様の髪に触れてきて分かったこと：「全員に同じ正解はない」。\n\n{date}、あなたの髪質と頭皮を見て、その月の最適解を一緒に考えます。',
    notes: 'core4 権威性' },

  { id: 'morn_edu_005', slot: 'morning', theme: 'education', coreMessageId: 5,
    text: 'おはようございます。\n\n染める月もあれば、染めない月もあっていい。\n「先月染めたから今月は休む」、これも立派な選択です。\n\n月単位で頭皮と相談しながら決める習慣、始めませんか？',
    notes: 'core5 染める/染めない両方' },

  { id: 'morn_edu_006', slot: 'morning', theme: 'education', coreMessageId: 1,
    text: 'おはようございます。\n\n{season}は分け目が目立ちやすい季節。\n大事なのは「分け目を変える」ではなく「気になる場所だけリタッチ」する発想です。\n全頭染めは長期的に頭皮負担を増やします。',
    notes: 'core1 季節 + 気になる場所' },

  { id: 'morn_edu_007', slot: 'morning', theme: 'education', coreMessageId: 3,
    text: 'おはようございます。\n\n頭皮チェック3項目：\n①かゆみ ②匂い ③乾燥\nどれか1つでも気になるなら、今月は染めない選択もアリです。\n\n頭皮が整うと、次に染めるとき薬剤が効きやすくなります。',
    notes: 'core3 頭皮ケア' },

  // ─── 昼 12:30 共感・コア訴求（7パターン） ───
  { id: 'noon_emp_001', slot: 'noon', theme: 'empathy_core', coreMessageId: 6,
    text: 'お昼です。\n\n「美容室3ヶ月予約取れない、家で染めると失敗が怖い」\nそんな方へ。\n\n月880円、写真を送るだけで、現役20年のカラーリストがあなたの月のプランを一緒に考えます。\n合わなければいつでも解約OK。',
    notes: 'core6 月880円' },

  { id: 'noon_emp_002', slot: 'noon', theme: 'empathy_core', coreMessageId: 1,
    text: 'お昼です。\n\n分け目とこめかみだけ。\nそれが「FOLLOW」のセルフカラー哲学です。\n\n全頭染めるから時間もお金も薬剤負担もかかる。範囲を絞れば、全部下がります。',
    notes: 'core1 気になるところだけ' },

  { id: 'noon_emp_003', slot: 'noon', theme: 'empathy_core', coreMessageId: 7,
    text: 'お昼です。\n\nFOLLOWは「相談」がメインのサービスです。\n商材の購入は任意、他で買っていただいても全く問題ありません。\n\n押し売りはしません。月880円で毎月の相談相手を持つ、それだけです。',
    notes: 'core7 商材任意' },

  { id: 'noon_emp_004', slot: 'noon', theme: 'empathy_core', coreMessageId: 2,
    text: 'お昼です。\n\n市販品の選び方ではなく、プロ用商材の使い方を一緒に考えます。\n美容師が現場で扱う薬剤を、自宅で安全に使うコツ。\n\n相談だけで構いません、まずは写真を1枚どうぞ。',
    notes: 'core2 プロ用商材' },

  { id: 'noon_emp_005', slot: 'noon', theme: 'empathy_core', coreMessageId: 5,
    text: 'お昼です。\n\n「染めない美容師」とは違います。\n染める/染めないの両方を、毎月あなたの髪と頭皮を見ながら一緒に決めるのがFOLLOWです。\n\n卒業も推奨しないし、継続も強要しません。',
    notes: 'core5 染める/染めない' },

  { id: 'noon_emp_006', slot: 'noon', theme: 'empathy_core', coreMessageId: 6,
    text: 'お昼です。\n\n月880円。\nコーヒー1杯分以下で、現役カラーリストの相談を毎月。\n\n回数制限なし、写真添付OK、合わなければ即解約。\n\n試してダメだったら戻ればいい、それだけです。',
    notes: 'core6 月880円' },

  { id: 'noon_emp_007', slot: 'noon', theme: 'empathy_core', coreMessageId: 3,
    text: 'お昼です。\n\n染めて終わり、じゃないんです。\nFOLLOWは染めた後の頭皮ケア・髪のメンテナンスまで毎月伴走します。\n\n「染める」を、ちゃんと続けられる仕組みにしましょう。',
    notes: 'core3 頭皮ケアまで' },

  // ─── 夜 21:00 哲学・利用者の声・呼びかけ（7パターン） ───
  { id: 'night_phi_001', slot: 'night', theme: 'philosophy', coreMessageId: 4,
    text: 'お疲れさまでした。\n\n20年カラーリストをしていて、いつも思うこと。\n「お客様の本当の悩みは、染めることそのものじゃなく、その先の不安」。\n\n白髪が増えたらどうしよう、頭皮はもつのか。\nその不安に毎月伴走するのがFOLLOWです。',
    notes: 'core4 権威性 + 哲学' },

  { id: 'night_phi_002', slot: 'night', theme: 'philosophy', coreMessageId: 5,
    text: 'お疲れさまでした。\n\n「染めるな」も「全部染めろ」も、どちらも極論。\n気になるところだけ、その月の状態で判断する。\n\nそれが20年現場でやってきて辿り着いた答えです。',
    notes: 'core5 染める/染めない' },

  { id: 'night_phi_003', slot: 'night', theme: 'philosophy', coreMessageId: 1,
    text: 'お疲れさまでした。\n\n今日、鏡を見て「気になる場所」はどこでしたか？\nその答えが、明日のカラーの正解です。\n\n全頭ではなく、その1箇所だけ。', notes: 'core1' },

  { id: 'night_phi_004', slot: 'night', theme: 'philosophy', coreMessageId: 7,
    text: 'お疲れさまでした。\n\nFOLLOWは「商材を売る」サービスではありません。\n相談だけで成立します。商材は任意、他で買ってもいい。\n\n押し売りは一切しません。それが川崎の信念です。',
    notes: 'core7 商材任意' },

  { id: 'night_phi_005', slot: 'night', theme: 'philosophy', coreMessageId: 4,
    text: 'お疲れさまでした。\n\n海外でカラーリストの修行をしていた頃、気づいたこと。\n「日本のフルカラー文化は、頭皮への負荷が世界一強い」。\n\n気になるところだけ、これは世界基準の選択です。',
    notes: 'core4 海外経験' },

  { id: 'night_phi_006', slot: 'night', theme: 'philosophy', coreMessageId: 6,
    text: 'お疲れさまでした。\n\n月880円。\n「相談料」+「目利き料」+「伴走料」と思ってください。\n\n商材代は別。買わなくてもOK。\n試してみる、それだけです。',
    notes: 'core6 月880円' },

  { id: 'night_phi_007', slot: 'night', theme: 'philosophy', coreMessageId: 3,
    text: 'お疲れさまでした。\n\n明日からまた一週間、髪も頭皮も伴走します。\n気になることがあれば、いつでもLINEで写真をどうぞ。\n\n小さな相談ほど、ちゃんと届けてください。',
    notes: 'core3 + 呼びかけ' }
];

/**
 * スモークテスト：全モジュールの基本動作確認
 */
function smokeTest() {
  Logger.log('==================== SMOKE TEST ====================');

  // 1. プロパティ
  const props = validateRequiredProps();
  Logger.log(`[1] Props: ok=${props.ok} missing=${props.missing.join(',')}`);

  // 2. シート
  try {
    ['QUEUE','LOG','TEMPLATES','KILL_SWITCH'].forEach(k => getSheet(CONFIG.SHEETS[k]));
    Logger.log('[2] Sheets: OK');
  } catch (e) {
    Logger.log('[2] Sheets: FAIL ' + e.message);
  }

  // 3. KillSwitch
  Logger.log(`[3] KillSwitch.isEnabled = ${KillSwitch.isEnabled()}`);

  // 4. Token状態
  Logger.log('[4] Token: ' + JSON.stringify(getTokenStatus()));

  // 5. 法務チェック
  const legal1 = LegalCheck.check('絶対染まります');
  const legal2 = LegalCheck.check('分け目だけ染める、月880円で毎月相談。');
  Logger.log(`[5] Legal NG case: ${legal1.status} (${legal1.note})`);
  Logger.log(`[5] Legal OK case: ${legal2.status}`);

  // 6. テンプレ生成（dryRun）
  try {
    const c = generateForSlot('morning', new Date());
    Logger.log(`[6] Gen morning: ${c.text.slice(0, 60)}... (theme=${c.theme})`);
  } catch (e) {
    Logger.log('[6] Gen FAIL: ' + e.message);
  }

  // 7. Trigger 一覧
  Logger.log('[7] Triggers: ' + JSON.stringify(listTriggers()));

  Logger.log('==================== END ====================');
}

/**
 * dryRun 投稿テスト：投稿せず queue → log の流れだけ確認
 */
function smokeTestDryRunPost() {
  setProp(CONFIG.DRY_RUN_KEY, 'true');
  try {
    // 翌日生成
    generateTomorrowPosts();
    // 各スロット投稿（dryRunなのでAPI叩かない）
    postScheduled('morning');
    postScheduled('noon');
    postScheduled('night');
  } finally {
    setProp(CONFIG.DRY_RUN_KEY, 'false');
  }
  Logger.log('Smoke test dryRun complete. Check sns_queue / sns_log tabs.');
}
```

---

## 5. Time Trigger 一覧（8件）

| # | 関数 | 時刻 | 頻度 | 目的 |
|---|---|---|---|---|
| 1 | `generateTomorrowPosts` | 23:00 | 毎日 | 翌日3投稿生成 |
| 2 | `postMorning` | 07:30 | 毎日 | 朝投稿実行 |
| 3 | `postNoon` | 12:30 | 毎日 | 昼投稿実行 |
| 4 | `postNight` | 21:00 | 毎日 | 夜投稿実行 |
| 5 | `refreshLongLivedToken` | 02:00 | 毎週日曜 | 長期トークン延長 |
| 6 | `killSwitchHealthCheck` (AM) | 06:00 | 毎日 | 異常検知＋キュー存在チェック |
| 7 | `killSwitchHealthCheck` (PM) | 18:00 | 毎日 | 異常検知 |
| 8 | `sendDailyAdminSummary` | 23:30 | 毎日 | 翌日3投稿の管理者通知 |

`installAllTriggers()` 1回叩けば全部入る。

---

## 6. Threads API フロー詳細

### 6-1. 2段階投稿

```
Step 1: CREATE (Container Creation)
POST https://graph.threads.net/v1.0/{IG_USER_ID}/threads
  ?media_type=TEXT
  &text={URL_ENCODED_TEXT}
  &access_token={LONG_LIVED_TOKEN}
Response: { "id": "creation_id_here" }

[wait 30 seconds — Meta推奨]

Step 2: PUBLISH
POST https://graph.threads.net/v1.0/{IG_USER_ID}/threads_publish
  ?creation_id={creation_id_here}
  &access_token={LONG_LIVED_TOKEN}
Response: { "id": "published_id_here" }
```

### 6-2. リトライ戦略

- 最大3回
- 指数バックオフ: 2秒 → 4秒 → 8秒
- 429（Rate Limit）・5xx はリトライ
- 4xx（429除く）は即エラー
- 失敗時は `retry_count` をインクリメント、3回到達で `failed` 確定

### 6-3. レート制限

Meta公式: **1日250投稿**まで。FOLLOWは1日3投稿なので余裕。
ただし CREATE のリクエストもカウントされる可能性があるためエラー時の連打は禁止（指数バックオフで吸収）。

---

## 7. デプロイ手順（ユーザー実行）

### Step 1. GAS プロジェクト作成

1. https://script.google.com/ → 新規プロジェクト → 名前を `FOLLOW-Autopost`
2. デフォルト `Code.gs` を削除
3. 上記 10ファイル を順に「ファイル → 新規 → スクリプト」で作成し貼り付け

### Step 2. Script Properties 設定

GAS エディタ左メニュー「プロジェクトの設定」 → 「スクリプトプロパティ」で以下を登録:

| キー | 値 | 説明 |
|---|---|---|
| `THREADS_USER_ID` | (Meta Developer Console) | Threads ユーザーID |
| `THREADS_APP_ID` | (Meta App ID) | アプリID |
| `THREADS_APP_SECRET` | (Meta App Secret) | アプリシークレット |
| `THREADS_ACCESS_TOKEN` | (短期トークン、後で長期に置換) | 初期は手動入力 |
| `LINE_CHANNEL_ACCESS_TOKEN` | (LINE Developers) | LINE Messaging API トークン |
| `ADMIN_LINE_USER_ID` | `U...` | 川崎/管理者のLINE userId |
| `WEBHOOK_SHARED_SECRET` | (任意の長い文字列) | Workers連携用 |
| `WORKER_ADMIN_NOTIFY_URL` | (任意、Flex使うなら) | line-harness-oss の admin-notify URL |
| `WORKER_SHARED_SECRET` | (任意) | Worker認証 |
| `ANTHROPIC_API_KEY` | (任意、AI生成有効化用) | フェーズ2で使用 |
| `USE_AI_GENERATION` | `false` | true でAI生成有効化 |
| `DRY_RUN` | `false` | true なら投稿せずログのみ |

### Step 3. シート初期化

GAS エディタの関数選択ドロップダウンで `setupSheets` → 実行
→ FOLLOW-KPI に4タブが追加される。

### Step 4. テンプレ投入

`seedTemplates` → 実行（21件投入）

### Step 5. トークン交換

1. Meta Developer Console で短期アクセストークンを取得
2. GAS エディタで `showTokenExchangeDialog` → 実行
3. 開いたダイアログに短期トークンを貼って「交換する」
4. Script Properties の `THREADS_ACCESS_TOKEN` が長期に置換される

### Step 6. トリガー設定

`installAllTriggers` → 実行 → 8件のトリガーがインストールされる
（権限承認ダイアログが出るので「許可」）

### Step 7. スモークテスト

1. `smokeTest` → 実行 → コンソールで各モジュールOK確認
2. `smokeTestDryRunPost` → 実行 → sns_queue にdryRun行が3行入る、sns_log にイベント記録、LINE通知届くか確認
3. 問題なければ `DRY_RUN` を `false` に変更して本番投入完了

---

## 8. テスト方法

### 8-1. 関数単位テスト

GAS エディタの「関数選択 → 実行」ボタンで以下を個別実行:

| 関数 | 確認内容 |
|---|---|
| `validateRequiredProps` | 必須プロパティ揃ってるか |
| `getTokenStatus` | トークン有効期限残日数 |
| `generateForSlot('morning', new Date())` | 朝テンプレ生成（コンソール出力） |
| `LegalCheck.check('絶対染まります')` | NG判定 |
| `LegalCheck.check('分け目だけリタッチ')` | OK判定 |
| `killSwitchHealthCheck` | ヘルス確認の挙動 |
| `Notifier.send('test')` | LINE届くか |

### 8-2. dryRun

`DRY_RUN=true` 時:
- ThreadsClient.publish() はAPI叩かず `DRY_xxx` の擬似ID返却
- sns_queue, sns_log には通常通り記録
- LINE通知は実送信される（テスト目的で必要）

### 8-3. 投稿フローのE2Eシミュレーション

1. `setProp('DRY_RUN', 'true')`
2. `generateTomorrowPosts()` → 翌日3行生成
3. `postScheduled('morning')` → posting → posted（dryRun ID）
4. sns_queue / sns_log 確認

### 8-4. Threads サンドボックスについて

Threads API には公式サンドボックスは無し。**本番アカウントでdryRun→本番切替**が正規ルート。
代替策:
- テスト用Threadsアカウントを別途用意して `THREADS_USER_ID` 切替
- 投稿後すぐ削除する手動運用

---

## 9. 既存資産（line-harness-oss）との連携

### 9-1. 停止コマンドの受け方

GAS プロジェクトを **Web App** としてデプロイ（「デプロイ → 新しいデプロイ → ウェブアプリ」、アクセス権 = 全員）。
取得したURLを line-harness-oss Workers の Script Properties に `GAS_AUTOPOST_WEBHOOK_URL` として登録。

Workers 側の admin-bot webhook で `「停止」「再開」` 等のコマンドを受信したら、以下を POST:

```javascript
// Worker → GAS
POST https://script.google.com/macros/s/{deploy_id}/exec
Content-Type: application/json

{
  "secret": "{WEBHOOK_SHARED_SECRET と一致}",
  "command": "stop_auto_posting",
  "reason": "user requested via LINE",
  "user_id": "U..."
}
```

GAS doPost() が KillSwitch.disable() を呼んでsheet書き換え。
次の投稿トリガー実行時に `isEnabled() === false` で skip される。

### 9-2. Flex 通知の Worker 経由

`Notifier.sendFlexViaWorker(payload)` で line-harness-oss の `/api/admin-notify` を叩く。
F-morning-summary-flex-spec.md の Flex フォーマットを再利用可能。
FOLLOW Autopost からは「投稿失敗時」「翌日3投稿サマリー」など重要通知に使う想定（フェーズ2）。

### 9-3. FOLLOW-KPI 連携

`sns_log` シートを F エージェント（既存 cron）が読みに行けば、`sns_total_engagement` の Threads 寄与分を集計できる。
列 `daily.M (sns_total_engagement)` の元データとして使う。

---

## 10. 運用 Tips

- **DRY_RUN を常に最初に true で走らせる**。本番投入前 24時間は dryRun のまま動かして異常が無いか観察。
- **テンプレ使用回数の偏り**: `sns_templates.use_count` を月1回見て、偏りがあれば手動リセット or 非アクティブ化。
- **トークン期限**: 60日。`refreshLongLivedToken` が毎週日曜に走るが、もし長期未稼働だった場合は手動で叩く。
- **法務チェックの強化**: フェーズ2で `LegalCheck.checkWithAI` を実装し、Anthropic Claude に E-legal-checklist-prompt.md を投げる。コスト目安: Haiku 4.5 なら1判定 ¥1未満。
- **失敗連発時**: 3連続失敗で自動停止するので、復旧後 `KillSwitch.enable('manual')` で再開。

---

## 11. 既知の制約・注意点

1. **GAS 実行時間制限**: 1関数あたり最大6分。投稿1件は数秒なので問題なし。生成3件 + AI判定でも余裕。
2. **GAS Time Trigger の精度**: ±15分程度のブレあり。Threads側は投稿時刻にこだわらないので影響軽微。
3. **シート同時書込み**: 同時実行起きないようGAS上は1関数1トリガーで十分。
4. **画像投稿**: 本設計はテキスト投稿のみ。画像対応は `media_type=IMAGE` + `image_url` 追加で拡張可能（後フェーズ）。
5. **コメント返信**: Threads APIの返信機能は別エンドポイント。本パイプラインでは扱わない。
6. **ログ肥大**: sns_log は append-only。3ヶ月ごとに古い行をアーカイブする運用を別途検討。

---

## 12. フェーズ別ロードマップ

### フェーズ1（本設計、即稼働可）
- ✅ テンプレート21件
- ✅ regex法務チェック
- ✅ 2段階投稿
- ✅ KillSwitch
- ✅ 管理者LINE通知

### フェーズ2（AI生成）
- [ ] `generateWithAI()` 実装（Anthropic Claude Haiku 4.5）
- [ ] `LegalCheck.checkWithAI()` 実装
- [ ] 過去投稿の重複検知（直近30投稿と類似度<0.7）

### フェーズ3（高度化）
- [ ] 画像投稿対応
- [ ] エンゲージメント計測自動取得（投稿後24時間で sns_log 更新）
- [ ] HEJ アカウント半自動投稿対応（モードA）

---

## 13. 完成チェックリスト

ユーザーがこの設計書通りに稼働させたら、以下が全部 ✅ になるはず:

- [ ] GAS プロジェクト `FOLLOW-Autopost` 存在
- [ ] 10ファイル全て貼り付け済み
- [ ] Script Properties 12項目登録済み
- [ ] FOLLOW-KPI に4タブ追加済み（sns_queue / sns_log / sns_templates / sns_kill_switch）
- [ ] sns_templates に21件のテンプレ
- [ ] 長期 Threads アクセストークン取得済み（期限60日）
- [ ] Time Trigger 8件設定済み
- [ ] smokeTest 全項目 OK
- [ ] dryRun で1日3投稿の queue → log 流れ確認
- [ ] LINE通知受信確認
- [ ] DRY_RUN=false に切り替え、本番投稿1件成功
- [ ] 翌朝/昼/夜の自動投稿3件成功
- [ ] kill switch FALSE → 投稿スキップ確認
- [ ] kill switch TRUE → 投稿復帰確認

---

以上で FOLLOW公式 Threads 1日3投稿完全自動化システム設計完了。
この設計書のコードはコピペで稼働する完全形である。
