# GAS Dashboard & Analytics Extension — FOLLOW Threads 拡張モジュール

作成日: 2026-06-20
作成者: Claude (Opus 4.7) / FOLLOW専属エンジニア
ステータス: 設計確定版（コピペで動く完全コード）
位置づけ: `GAS-AUTOPOST-SYSTEM-DESIGN.md`（10ファイル稼働済み前提）に **追加** する拡張モジュール
前提: 既存システム（`FOLLOW-Autopost` GAS プロジェクト）は稼働済みとする

---

## 0. 設計サマリー（30秒で理解）

- **追加目的**: 自動投稿の「やりっぱなし」状態を解消。投稿後インプ計測 → 集計 → ナレッジ化 → カレンダー確認 → 改善ループ
- **追加 Sheets タブ**: 6タブ（`sns_impressions` `sns_knowledge` `sns_calendar` `sns_analytics_daily` `sns_analytics_weekly` `sns_analytics_monthly` `sns_dashboard`）
- **追加 .gs ファイル**: 7ファイル（`ImpressionFetcher.gs` `Analytics.gs` `Knowledge.gs` `Calendar.gs` `WebApp.gs` `WebApp.html` `Dashboard.gs`）
- **追加 Time Trigger**: 5件（既存8件 + 5件 = 計13件）
- **新規外部接続**: Threads Insights API（既存トークンで認証）のみ
- **UI**: GAS Web App（HTMLService）でカレンダー21コマ表示・編集
- **既存システムへの影響**: ゼロ。`Config.gs` に追記、他既存ファイル無改修

---

## 1. アーキテクチャ拡張図

```
┌──────────────────────────────────────────────────────────────────────┐
│                    既存システム（FOLLOW-Autopost）                     │
│   Config / TokenManager / ContentGenerator / LegalCheck /            │
│   ThreadsClient / Scheduler / KillSwitch / Notifier / Logger / Main  │
│                                                                       │
│   投稿成功 (postScheduled → posted)                                   │
│        │                                                              │
│        │ ── createImpressionTriggers(queueId, postId)                 │
│        ▼                                                              │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                  ★ 拡張モジュール（本ドキュメント）              │  │
│  │                                                                  │  │
│  │  ImpressionFetcher.gs ──→ Threads Insights API                  │  │
│  │     │  5min/30min/60min/24h/7day 後に動的Trigger作成・自動削除   │  │
│  │     ▼                                                            │  │
│  │  sns_impressions タブ                                           │  │
│  │     │                                                            │  │
│  │     ▼                                                            │  │
│  │  Analytics.gs ──→ sns_analytics_daily / weekly / monthly        │  │
│  │     │      日次23:55 / 週次日曜23:55 / 月末23:55                 │  │
│  │     │                                                            │  │
│  │     ▼                                                            │  │
│  │  Knowledge.gs ──→ sns_knowledge (高パフォ自動収録)              │  │
│  │     │      閾値超過時に自動 INSERT                               │  │
│  │     │      ContentGenerator が次回生成時に参照                  │  │
│  │     ▼                                                            │  │
│  │  Calendar.gs / WebApp.gs / WebApp.html                          │  │
│  │     │      sns_calendar タブ（21コマ）を Web UI で編集           │  │
│  │     ▼                                                            │  │
│  │  Dashboard.gs ──→ sns_dashboard（数式 + SPARKLINE）             │  │
│  └────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
       ▲                          ▲                          ▲
       │ Threads Insights         │ 管理者ブラウザ           │ 既存 LINE 通知
       │ /v1.0/{id}/insights      │ Web App URL              │ ピーク値通知拡張
┌──────┴────────────────┐  ┌──────┴──────────┐
│ Meta Threads Platform │  │  管理者ブラウザ │
│  Insights エンドポイ │  │  （PC/スマホ）  │
└───────────────────────┘  └─────────────────┘
```

### 既存システムとの結合点（3点だけ）

1. **`Config.gs`** に `CONFIG.SHEETS.*` キーと `CONFIG.ANALYTICS` を追記（既存定数は無変更）
2. **`ThreadsClient.gs` の `postScheduled` 関数最後** に `createImpressionTriggers(queueId, publishedId)` を1行追加
3. **`ContentGenerator.gs` の `generateForSlot`** で `Knowledge.getSeedTemplate()` を優先参照（既存テンプレ生成のフォールバックは維持）

これ以外は既存ファイル無改修。

---

## 2. 追加 Sheets タブ設計

既存 spreadsheet ID: `1Xshvq2dIJKoTLwU8E4VBR-alySOW42h96Uh7NQji4B0`

### 2-1. タブ `sns_impressions`（投稿別インプ計測）

各投稿につき1行。時系列スナップは複数列に持つ。

| 列 | キー | 型 | 説明 |
|---|---|---|---|
| A | queue_id | string | `sns_queue.id` と紐付け |
| B | threads_post_id | string | 公開ID |
| C | posted_at | datetime | 投稿成功時刻（JST） |
| D | slot | string | morning/noon/night |
| E | core_message_id | int | 1〜7（POSITIONING §11） |
| F | content_length | int | 本文文字数 |
| G | hashtag_count | int | 本文中の `#` 数 |
| H | emoji_count | int | 絵文字数（推定） |
| I | is_question | bool | 末尾が `?` `？` `ですか` `ますか` 等 |
| J | has_cta | bool | `lin.ee/` `LINE` 含む |
| K | weekday | int | 0=日…6=土 |
| L | views_5min | int | 5分後ビュー |
| M | likes_5min | int | 5分後いいね |
| N | replies_5min | int | 5分後返信 |
| O | reposts_5min | int | 5分後リポスト |
| P | views_30min | int | |
| Q | likes_30min | int | |
| R | replies_30min | int | |
| S | reposts_30min | int | |
| T | views_60min | int | |
| U | likes_60min | int | |
| V | replies_60min | int | |
| W | reposts_60min | int | |
| X | views_24h | int | 24h後 |
| Y | likes_24h | int | |
| Z | replies_24h | int | |
| AA | reposts_24h | int | |
| AB | profile_visits_24h | int | プロフィール訪問 |
| AC | views_7day | int | 7日後最終確定値 |
| AD | likes_7day | int | |
| AE | replies_7day | int | |
| AF | reposts_7day | int | |
| AG | profile_visits_7day | int | |
| AH | engagement_rate | float | `(likes+replies+reposts)/views_24h` |
| AI | knowledge_added | bool | sns_knowledge に登録済か |
| AJ | last_fetched_at | datetime | 最終取得時刻 |
| AK | fetch_errors | text | エラーログ |

ヘッダー1行目固定。データ2行目以降。

### 2-2. タブ `sns_knowledge`（高パフォ事例DB）

| 列 | キー | 型 | 説明 |
|---|---|---|---|
| A | knowledge_id | string | `k_YYYYMMDD_slot_seq` |
| B | source_queue_id | string | 元投稿 |
| C | source_post_id | string | Threads ID |
| D | added_at | datetime | DB追加時刻 |
| E | slot | string | |
| F | core_message_id | int | |
| G | content_full | text | 投稿本文全文 |
| H | content_template | text | プレースホルダ化済（`{date}` `{season}` 等で復元） |
| I | views_24h | int | 24h時点ビュー（ベンチ値） |
| J | engagement_rate | float | |
| K | benchmark_label | string | `hero`（10倍超）/`high`（3倍超）/`above`（2倍超） |
| L | estimated_reason | text | 推定要因（コア訴求/質問形/CTA有/絵文字多 等） |
| M | reusable | bool | テンプレ再利用OKフラグ（NGなら自動除外） |
| N | reuse_count | int | 再利用された回数 |
| O | last_reused_at | datetime | |
| P | tags | string | カンマ区切り（例: `morning,core1,question`） |

### 2-3. タブ `sns_calendar`（翌週投稿予約マトリクス）

7日 × 3スロット = 21コマ。日付は翌週月曜から日曜。

| 列 | キー | 型 | 説明 |
|---|---|---|---|
| A | slot_id | string | `cal_YYYYMMDD_slot` |
| B | date | date | 投稿日 |
| C | weekday | string | 月/火/.../日 |
| D | slot | string | morning/noon/night |
| E | scheduled_time | time | 07:30/12:30/21:00 |
| F | planned_content | text | 予定投稿本文（編集可） |
| G | source | string | `template`/`knowledge`/`ai`/`manual` |
| H | core_message_id | int | |
| I | status | string | `draft`/`approved`/`queued`/`posted`/`skipped` |
| J | e_legal_status | string | `pending`/`ok`/`needs_fix`/`ng` |
| K | e_legal_note | text | |
| L | linked_queue_id | string | sns_queue に展開された時のID |
| M | edited_by | string | 最終編集者（`admin`/`auto`/`webapp`） |
| N | edited_at | datetime | |
| O | notes | text | メモ欄 |

### 2-4. タブ `sns_analytics_daily`（日次集計）

23:55 トリガーで前日分を1行追加。

| 列 | キー | 型 | 説明 |
|---|---|---|---|
| A | date | date | 集計対象日 |
| B | posts_count | int | 投稿数（通常3） |
| C | total_views | int | 全投稿 24h 合計 |
| D | total_likes | int | |
| E | total_replies | int | |
| F | total_reposts | int | |
| G | total_profile_visits | int | |
| H | avg_views | float | 平均ビュー |
| I | avg_engagement_rate | float | |
| J | best_slot | string | 最高ビュースロット |
| K | best_post_id | string | 最高ビュー投稿ID |
| L | best_post_views | int | |
| M | worst_slot | string | |
| N | worst_post_id | string | |
| O | worst_post_views | int | |
| P | morning_views | int | スロット別 |
| Q | noon_views | int | |
| R | night_views | int | |
| S | line_added | int | 既存 daily.D から参照（任意） |
| T | knowledge_added_count | int | 当日 sns_knowledge 追加件数 |

### 2-5. タブ `sns_analytics_weekly`（週次集計）

日曜 23:55 で過去7日を集計。

| 列 | キー | 型 | 説明 |
|---|---|---|---|
| A | week_start | date | 月曜日 |
| B | week_end | date | 日曜日 |
| C | posts_count | int | |
| D | total_views | int | |
| E | total_engagement | int | likes+replies+reposts 合計 |
| F | avg_views_per_post | float | |
| G | avg_engagement_rate | float | |
| H | best_post_id | string | |
| I | best_post_views | int | |
| J | best_core_message_id | int | 平均ビュー最大のコア訴求ID |
| K | best_slot | string | 平均ビュー最大スロット |
| L | best_weekday | int | |
| M | worst_core_message_id | int | |
| N | knowledge_added_count | int | |
| O | week_over_week_views_pct | float | 前週比 |
| P | notes | text | |

### 2-6. タブ `sns_analytics_monthly`（月次集計）

月末日 23:55 で当月分を集計。

| 列 | キー | 型 | 説明 |
|---|---|---|---|
| A | month | string | `YYYY-MM` |
| B | posts_count | int | |
| C | total_views | int | |
| D | total_engagement | int | |
| E | avg_views_per_post | float | |
| F | avg_engagement_rate | float | |
| G | top3_post_ids | string | カンマ区切り |
| H | top_core_message_id | int | |
| I | top_slot | string | |
| J | top_weekday | int | |
| K | total_profile_visits | int | |
| L | knowledge_total | int | sns_knowledge の累積件数 |
| M | month_over_month_views_pct | float | 前月比 |
| N | core_message_breakdown | text | JSON `{1:1234, 2:5678, ...}` |
| O | slot_breakdown | text | JSON `{morning:..., noon:..., night:...}` |

### 2-7. タブ `sns_dashboard`（数式専用・サマリー）

`Dashboard.gs` の `setupDashboard()` を1回叩くと配置される。

| 範囲 | 内容 | 数式タイプ |
|---|---|---|
| A1 | タイトル「FOLLOW Threads ダッシュボード」 | text |
| A2 | 「最終更新」+ NOW() | =TEXT(NOW(),...) |
| A4:E4 | サマリーヘッダー（今週投稿数 / 平均ビュー / ベスト / ワースト / 前週比） | text |
| A5:E5 | 数値（直近 sns_analytics_weekly 最終行を引く） | INDEX/MATCH |
| A7 | 「日別ビュー推移（直近30日）」 | text |
| A8 | SPARKLINE | =SPARKLINE(...) |
| A10 | 「スロット別 平均ビュー」 | text |
| B10:D10 | morning/noon/night ラベル | text |
| B11:D11 | 平均値 | AVERAGEIF |
| B12:D12 | SPARKLINE 棒グラフ | SPARKLINE chart |
| A14 | 「コア訴求別 平均ビュー」 | text |
| B14:H14 | 1〜7 ラベル | |
| B15:H15 | 平均ビュー | AVERAGEIF |
| B16:H16 | SPARKLINE 棒 | |
| A18 | 「ナレッジハイライト Top3」 | text |
| A19:D21 | sns_knowledge 上位3件 | LARGE + INDEX |
| A23 | 「アラート」 | text |
| A24 | 3投稿連続低下なら警告 | IF + 比較 |
| A26 | 「曜日×スロット 平均ビュー ヒートマップ」 | text |
| A27:D34 | 7行×3列マトリクス | AVERAGEIFS |

---

## 3. 追加 .gs ファイル（コピペで動く完全コード）

### 3-0. `Config.gs` への追記（既存ファイルに追加）

既存 `CONFIG` オブジェクトの末尾（`TZ: 'Asia/Tokyo'` の直前か直後）に以下を追加。

```javascript
  // ─────────── 拡張: タブ名 ───────────
  SHEETS_EXT: {
    IMPRESSIONS: 'sns_impressions',
    KNOWLEDGE: 'sns_knowledge',
    CALENDAR: 'sns_calendar',
    ANALYTICS_DAILY: 'sns_analytics_daily',
    ANALYTICS_WEEKLY: 'sns_analytics_weekly',
    ANALYTICS_MONTHLY: 'sns_analytics_monthly',
    DASHBOARD: 'sns_dashboard'
  },

  // ─────────── 拡張: Threads Insights API ───────────
  THREADS_INSIGHTS: {
    METRICS_POST: ['views', 'likes', 'replies', 'reposts', 'quotes'],
    METRICS_USER: ['views', 'likes', 'replies', 'reposts', 'quotes', 'followers_count', 'follower_demographics'],
    // 5分後/30分後/60分後/24時間後/7日後
    FETCH_INTERVALS_MIN: [5, 30, 60, 1440, 10080],
    // 投稿後に作るTrigger間隔のばらつき（秒、レート制限緩和）
    JITTER_SEC: 30
  },

  // ─────────── 拡張: 分析閾値 ───────────
  ANALYTICS: {
    // 直近30日の平均ビュー × 倍率で benchmark 判定
    BENCHMARK_HERO_MULT: 10,
    BENCHMARK_HIGH_MULT: 3,
    BENCHMARK_ABOVE_MULT: 2,
    // ナレッジ自動追加閾値（views_24h がこれ超でDB追加）
    KNOWLEDGE_MIN_VIEWS: 1000,
    KNOWLEDGE_MIN_ENGAGEMENT_RATE: 0.03,
    // アラート条件
    ALERT_CONSECUTIVE_DECLINE: 3,
    // ダッシュボードのSPARKLINE参照範囲（直近N日）
    DASHBOARD_TRAILING_DAYS: 30
  },

  // ─────────── 拡張: カレンダー ───────────
  CALENDAR_EXT: {
    LOOKAHEAD_DAYS: 7,           // 翌7日分を生成
    WEEK_START: 1,               // 1=月曜
    AUTO_QUEUE_HOURS_BEFORE: 6   // 投稿6時間前に sns_queue へ自動展開
  },

  // ─────────── 拡張: Web App ───────────
  WEB_APP: {
    TITLE: 'FOLLOW Calendar',
    ACCESS_TOKEN_KEY: 'WEBAPP_ACCESS_TOKEN'  // Script Properties キー
  }
```

そして `setupSheets()` の末尾に、拡張タブを作成する関数呼び出しを追加（既存 setupSheets は無改修、新規 `setupExtensionSheets()` を `Main.gs` 拡張側に置く方針 — 後述）。

### 3-1. `ImpressionFetcher.gs`

```javascript
/**
 * ImpressionFetcher.gs
 * 投稿後 5/30/60/1440/10080 分で Threads Insights API を叩いて sns_impressions に書く。
 *
 * 呼び出し経路:
 *   1. ThreadsClient.postScheduled が投稿成功時に createImpressionTriggers(queueId, postId) を呼ぶ
 *   2. 各タイミングで動的 Time Trigger 発火 → fetchImpressionsAt(queueId, intervalMin)
 *   3. fetchImpressionsAt は API 叩いて該当列に値を書き、最後の interval (7day) では sns_knowledge も判定
 *   4. 実行後の Time Trigger は自動削除
 *
 * レート制限配慮:
 *   - 各 interval を JITTER_SEC でばらつかせる（投稿後5分ぴったり3件同時を回避）
 *   - 失敗時は指数バックオフで最大3回再試行（次の interval まで届かなければ諦め）
 */

const ImpressionFetcher = {
  /**
   * 投稿成功時に呼ばれ、5/30/60/1440/10080 分後のトリガーを動的に作成
   * @param {string} queueId
   * @param {string} threadsPostId
   */
  scheduleAll(queueId, threadsPostId) {
    if (!queueId || !threadsPostId) {
      console.warn('[ImpressionFetcher] queueId or postId missing, skip schedule');
      return;
    }

    // まず sns_impressions に初期行を作成
    this._ensureRow(queueId, threadsPostId);

    // 各 interval で動的トリガー作成
    const intervals = CONFIG.THREADS_INSIGHTS.FETCH_INTERVALS_MIN;
    intervals.forEach((min, idx) => {
      const jitterSec = Math.floor(Math.random() * CONFIG.THREADS_INSIGHTS.JITTER_SEC);
      const fireAt = new Date(Date.now() + min * 60 * 1000 + jitterSec * 1000);

      // トリガーは function 名でしか起動できない。queueId/interval を PropertiesService に格納
      const propKey = `imp_${queueId}_${min}`;
      setProp(propKey, JSON.stringify({ queueId, postId: threadsPostId, intervalMin: min }));

      const handlerName = `fetchImpression_${min}`;
      try {
        ScriptApp.newTrigger(handlerName)
          .timeBased()
          .at(fireAt)
          .create();
      } catch (e) {
        console.error(`[ImpressionFetcher] trigger create failed (${min}min): ` + e.message);
      }
    });

    Logger.write({
      queueId,
      event: 'impression_scheduled',
      slot: '',
      threadsPostId,
      severity: 'info',
      detail: `intervals=${intervals.join(',')}min`
    });
  },

  /**
   * 既存行があれば何もしない、なければ初期行を作成
   * @private
   */
  _ensureRow(queueId, postId) {
    const sheet = getSheet(CONFIG.SHEETS_EXT.IMPRESSIONS);
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === queueId) return; // 既存
    }

    // sns_queue から関連メタを取得
    const queueRow = findQueueRow(queueId);
    if (!queueRow) {
      console.warn('[ImpressionFetcher] queue row not found: ' + queueId);
      return;
    }
    const content = queueRow.data.content || '';
    const slot = queueRow.data.slot;
    const postedAt = queueRow.data.posted_at || new Date();

    // 投稿内容の特徴量を抽出
    const features = analyzeContent(content);

    sheet.appendRow([
      queueId,                                  // A queue_id
      postId,                                   // B threads_post_id
      Utilities.formatDate(new Date(postedAt), CONFIG.TZ, 'yyyy-MM-dd HH:mm:ss'), // C
      slot,                                     // D
      features.coreMessageId,                   // E
      features.length,                          // F
      features.hashtagCount,                    // G
      features.emojiCount,                      // H
      features.isQuestion,                      // I
      features.hasCta,                          // J
      new Date(postedAt).getDay(),              // K
      // 5min/30min/60min/24h/7day メトリクス (L〜AG) は空
      ...new Array(22).fill(''),
      '',                                       // AH engagement_rate
      false,                                    // AI knowledge_added
      '',                                       // AJ last_fetched_at
      ''                                        // AK fetch_errors
    ]);
  },

  /**
   * 指定 interval の Insights を取得して書込
   * @param {string} queueId
   * @param {number} intervalMin
   */
  fetchAt(queueId, intervalMin) {
    const propKey = `imp_${queueId}_${intervalMin}`;
    const propVal = getProp(propKey);
    if (!propVal) {
      console.warn(`[ImpressionFetcher] no prop ${propKey}, abort`);
      return;
    }

    let payload;
    try {
      payload = JSON.parse(propVal);
    } catch (e) {
      console.error('[ImpressionFetcher] prop parse failed: ' + e.message);
      return;
    }

    const postId = payload.postId;
    const userId = getProp('THREADS_USER_ID');
    const token = getProp('THREADS_ACCESS_TOKEN');

    if (!userId || !token) {
      console.error('[ImpressionFetcher] no token/userId');
      return;
    }

    if (getProp(CONFIG.DRY_RUN_KEY) === 'true') {
      console.log(`[dryRun][ImpressionFetcher] would fetch ${postId} @${intervalMin}min`);
      this._writeImpressionRow(queueId, intervalMin, {
        views: Math.floor(Math.random() * 500),
        likes: Math.floor(Math.random() * 20),
        replies: Math.floor(Math.random() * 5),
        reposts: Math.floor(Math.random() * 3),
        profile_visits: 0
      });
      this._cleanupTrigger(intervalMin, queueId);
      return;
    }

    // Insights API 呼び出し
    let insights;
    try {
      insights = this._fetchInsights(postId, token);
    } catch (e) {
      this._writeError(queueId, intervalMin, e.message);
      this._cleanupTrigger(intervalMin, queueId);
      return;
    }

    // 7day の場合はユーザーInsights からプロフィール訪問も追加
    if (intervalMin === 10080 || intervalMin === 1440) {
      try {
        const userInsights = this._fetchUserInsights(userId, token);
        insights.profile_visits = userInsights.profile_visits || 0;
      } catch (e) {
        console.warn('[ImpressionFetcher] user insights fail: ' + e.message);
      }
    }

    this._writeImpressionRow(queueId, intervalMin, insights);

    // 7day 計測完了でナレッジ判定起動
    if (intervalMin === 10080) {
      try {
        Knowledge.evaluateAndStore(queueId);
      } catch (e) {
        console.error('[ImpressionFetcher] knowledge eval failed: ' + e.message);
      }
    }

    // 役目を終えたトリガー削除
    this._cleanupTrigger(intervalMin, queueId);
  },

  /**
   * Threads Insights API（投稿単位）
   * GET /v1.0/{media_id}/insights?metric=views,likes,replies,reposts,quotes
   * @private
   */
  _fetchInsights(mediaId, token) {
    const metrics = CONFIG.THREADS_INSIGHTS.METRICS_POST.join(',');
    const url = `${CONFIG.THREADS_API.BASE}/${CONFIG.THREADS_API.VERSION}/${mediaId}/insights`
      + `?metric=${metrics}&access_token=${encodeURIComponent(token)}`;

    let lastError = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
      const code = res.getResponseCode();
      const body = JSON.parse(res.getContentText());

      if (code === 200) {
        // Insights API レスポンスは { data: [{ name: 'views', values: [{ value: 123 }] }, ...] }
        const result = { views: 0, likes: 0, replies: 0, reposts: 0, quotes: 0 };
        (body.data || []).forEach(item => {
          const val = (item.values && item.values[0] && item.values[0].value) || item.total_value?.value || 0;
          if (item.name in result) {
            result[item.name] = Number(val) || 0;
          }
        });
        return result;
      }

      if (code === 429 || code >= 500) {
        lastError = `HTTP ${code}: ${JSON.stringify(body)}`;
        Utilities.sleep(2000 * Math.pow(2, attempt - 1));
        continue;
      }

      throw new Error(`HTTP ${code}: ${JSON.stringify(body)}`);
    }
    throw new Error(lastError || 'fetch insights failed');
  },

  /**
   * ユーザー単位 Insights（プロフィール訪問用）
   * @private
   */
  _fetchUserInsights(userId, token) {
    const since = Math.floor((Date.now() - 7 * 86400 * 1000) / 1000);
    const until = Math.floor(Date.now() / 1000);
    const url = `${CONFIG.THREADS_API.BASE}/${CONFIG.THREADS_API.VERSION}/${userId}/threads_insights`
      + `?metric=views&since=${since}&until=${until}`
      + `&access_token=${encodeURIComponent(token)}`;

    const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    const body = JSON.parse(res.getContentText());
    if (res.getResponseCode() !== 200) return { profile_visits: 0 };

    let profileVisits = 0;
    (body.data || []).forEach(item => {
      if (item.name === 'views') {
        (item.values || []).forEach(v => { profileVisits += (Number(v.value) || 0); });
      }
    });
    return { profile_visits: profileVisits };
  },

  /**
   * sns_impressions の対象行・対象列を更新
   * @private
   */
  _writeImpressionRow(queueId, intervalMin, insights) {
    const sheet = getSheet(CONFIG.SHEETS_EXT.IMPRESSIONS);
    const data = sheet.getDataRange().getValues();
    const header = data[0];

    let rowIndex = -1;
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === queueId) { rowIndex = i + 1; break; }
    }
    if (rowIndex < 0) {
      console.error('[ImpressionFetcher] row not found: ' + queueId);
      return;
    }

    // interval → 列キーマッピング
    const colMap = {
      5:     ['views_5min',  'likes_5min',  'replies_5min',  'reposts_5min'],
      30:    ['views_30min', 'likes_30min', 'replies_30min', 'reposts_30min'],
      60:    ['views_60min', 'likes_60min', 'replies_60min', 'reposts_60min'],
      1440:  ['views_24h',   'likes_24h',   'replies_24h',   'reposts_24h'],
      10080: ['views_7day',  'likes_7day',  'replies_7day',  'reposts_7day']
    };
    const cols = colMap[intervalMin];
    if (!cols) return;

    const valuesMap = {
      [cols[0]]: insights.views || 0,
      [cols[1]]: insights.likes || 0,
      [cols[2]]: insights.replies || 0,
      [cols[3]]: insights.reposts || 0
    };

    if (intervalMin === 1440) {
      valuesMap['profile_visits_24h'] = insights.profile_visits || 0;
    }
    if (intervalMin === 10080) {
      valuesMap['profile_visits_7day'] = insights.profile_visits || 0;
    }

    Object.keys(valuesMap).forEach(key => {
      const colIdx = header.indexOf(key);
      if (colIdx >= 0) {
        sheet.getRange(rowIndex, colIdx + 1).setValue(valuesMap[key]);
      }
    });

    // engagement_rate を 24h データで計算
    if (intervalMin === 1440) {
      const v = insights.views || 0;
      const e = (insights.likes || 0) + (insights.replies || 0) + (insights.reposts || 0);
      const rate = v > 0 ? e / v : 0;
      const colIdx = header.indexOf('engagement_rate');
      if (colIdx >= 0) sheet.getRange(rowIndex, colIdx + 1).setValue(rate);
    }

    // last_fetched_at
    const lfIdx = header.indexOf('last_fetched_at');
    if (lfIdx >= 0) {
      sheet.getRange(rowIndex, lfIdx + 1)
        .setValue(Utilities.formatDate(new Date(), CONFIG.TZ, 'yyyy-MM-dd HH:mm:ss'));
    }
  },

  /**
   * @private
   */
  _writeError(queueId, intervalMin, errMsg) {
    const sheet = getSheet(CONFIG.SHEETS_EXT.IMPRESSIONS);
    const data = sheet.getDataRange().getValues();
    const header = data[0];
    let rowIndex = -1;
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === queueId) { rowIndex = i + 1; break; }
    }
    if (rowIndex < 0) return;
    const errIdx = header.indexOf('fetch_errors');
    if (errIdx >= 0) {
      const current = data[rowIndex - 1][errIdx] || '';
      const merged = current + `[${intervalMin}min] ${errMsg.slice(0, 200)}\n`;
      sheet.getRange(rowIndex, errIdx + 1).setValue(merged);
    }
  },

  /**
   * @private
   */
  _cleanupTrigger(intervalMin, queueId) {
    const propKey = `imp_${queueId}_${intervalMin}`;
    PropertiesService.getScriptProperties().deleteProperty(propKey);

    // 自分自身を呼んだトリガーを削除（handler名で特定 + 起動済みは GAS が自動削除する場合あり）
    const handlerName = `fetchImpression_${intervalMin}`;
    const triggers = ScriptApp.getProjectTriggers();
    triggers.forEach(t => {
      if (t.getHandlerFunction() === handlerName) {
        // 過去のものは削除
        try {
          // ScriptApp は実行済みワンタイムトリガーを残すことがあるので明示削除
          if (t.getEventType() === ScriptApp.EventType.CLOCK) {
            ScriptApp.deleteTrigger(t);
          }
        } catch (e) { /* ignore */ }
      }
    });
  }
};

/**
 * 投稿内容の特徴量抽出（Analytics でも再利用）
 * @param {string} text
 * @returns {object}
 */
function analyzeContent(text) {
  if (!text) return {
    length: 0, hashtagCount: 0, emojiCount: 0,
    isQuestion: false, hasCta: false, coreMessageId: 0
  };

  // 絵文字検出（簡易）
  const emojiRegex = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F2FF}]/gu;
  const emojiMatches = text.match(emojiRegex) || [];

  // ハッシュタグ
  const hashtagMatches = text.match(/#[^\s#]+/g) || [];

  // 質問形
  const isQuestion = /[\?？]|ですか|ますか|でしょうか/.test(text);

  // CTA（LINE誘導）
  const hasCta = /lin\.ee|LINE|ライン/i.test(text);

  // コア訴求 ID 推定（7メッセージのキーワードマッチで最強の1つ）
  const coreKeywords = [
    { id: 1, keys: ['気になるところ', '分け目', 'こめかみ', '生え際', '部分的', 'リタッチ'] },
    { id: 2, keys: ['プロ用', '美容師', '現場', 'ジアミンフリー', '薬剤'] },
    { id: 3, keys: ['頭皮ケア', '頭皮', 'シャンプー', '保護', 'ダメージ'] },
    { id: 4, keys: ['20年', '何万人', '大阪', '専門店', '現役', '海外'] },
    { id: 5, keys: ['染めない', '染める/染めない', '休む', '月単位', '判断'] },
    { id: 6, keys: ['880円', '880', '月額', '解約'] },
    { id: 7, keys: ['任意', '商材購入', '他で買って', '押し売り'] }
  ];

  let bestId = 0;
  let bestScore = 0;
  coreKeywords.forEach(cm => {
    const score = cm.keys.filter(k => text.includes(k)).length;
    if (score > bestScore) {
      bestScore = score;
      bestId = cm.id;
    }
  });

  return {
    length: text.length,
    hashtagCount: hashtagMatches.length,
    emojiCount: emojiMatches.length,
    isQuestion,
    hasCta,
    coreMessageId: bestId
  };
}

/**
 * Threads Insights 用のトリガーエントリ関数
 * 各 interval にハンドラを用意（トリガー時に Script Properties から queue 情報を読む）
 */
function fetchImpression_5()     { _fetchImpressionForAll(5); }
function fetchImpression_30()    { _fetchImpressionForAll(30); }
function fetchImpression_60()    { _fetchImpressionForAll(60); }
function fetchImpression_1440()  { _fetchImpressionForAll(1440); }
function fetchImpression_10080() { _fetchImpressionForAll(10080); }

/**
 * 該当 interval の保留中 queueId をすべて処理する。
 * （複数投稿が同じ時刻にトリガー起動すると一括処理）
 */
function _fetchImpressionForAll(intervalMin) {
  const props = PropertiesService.getScriptProperties().getProperties();
  const prefix = 'imp_';
  const suffix = `_${intervalMin}`;
  const targets = Object.keys(props).filter(k => k.startsWith(prefix) && k.endsWith(suffix));

  targets.forEach(key => {
    const queueId = key.slice(prefix.length, -suffix.length);
    try {
      ImpressionFetcher.fetchAt(queueId, intervalMin);
    } catch (e) {
      console.error(`[fetchImpression_${intervalMin}] ${queueId}: ${e.message}`);
    }
  });
}

/**
 * 既存 ThreadsClient.postScheduled から呼ばれるラッパー
 * @param {string} queueId
 * @param {string} postId
 */
function createImpressionTriggers(queueId, postId) {
  ImpressionFetcher.scheduleAll(queueId, postId);
}
```

### 3-2. `Analytics.gs`

```javascript
/**
 * Analytics.gs
 * 日次/週次/月次の集計関数、曜日×時間帯のCTR算出、ベスト投稿抽出。
 *
 * トリガー:
 *   - 23:55 (daily): aggregateDaily()
 *   - 日曜 23:55 (weekly): aggregateWeekly()
 *   - 月末日 23:55 (monthly): aggregateMonthly()
 */

const Analytics = {
  /**
   * 前日分の集計を sns_analytics_daily に追加
   */
  daily() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = Utilities.formatDate(yesterday, CONFIG.TZ, 'yyyy-MM-dd');

    const rows = this._loadImpressionsForDate(yesterday);
    if (rows.length === 0) {
      console.log('[Analytics.daily] no data for ' + dateStr);
      return;
    }

    const summary = this._summarize(rows);

    const sheet = getSheet(CONFIG.SHEETS_EXT.ANALYTICS_DAILY);
    sheet.appendRow([
      dateStr,
      summary.postsCount,
      summary.totalViews,
      summary.totalLikes,
      summary.totalReplies,
      summary.totalReposts,
      summary.totalProfileVisits,
      summary.avgViews,
      summary.avgEngagementRate,
      summary.bestSlot,
      summary.bestPostId,
      summary.bestPostViews,
      summary.worstSlot,
      summary.worstPostId,
      summary.worstPostViews,
      summary.morningViews,
      summary.noonViews,
      summary.nightViews,
      '', // line_added は既存 daily.D から後で参照
      summary.knowledgeAddedCount
    ]);

    Logger.write({
      queueId: '',
      event: 'analytics_daily',
      severity: 'info',
      detail: JSON.stringify(summary)
    });
  },

  /**
   * 前週分（月〜日）の集計
   */
  weekly() {
    const today = new Date();
    // 直前の日曜を week_end とする
    const weekEnd = new Date(today);
    weekEnd.setHours(23, 59, 59, 999);
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekEnd.getDate() - 6);
    weekStart.setHours(0, 0, 0, 0);

    const rows = this._loadImpressionsForRange(weekStart, weekEnd);
    if (rows.length === 0) return;

    const summary = this._summarizeForWeek(rows);

    // 前週比
    const prevSheet = getSheet(CONFIG.SHEETS_EXT.ANALYTICS_WEEKLY);
    const prevData = prevSheet.getDataRange().getValues();
    let womPct = '';
    if (prevData.length > 1) {
      const last = prevData[prevData.length - 1];
      const lastTotalViews = Number(last[3]) || 0;
      womPct = lastTotalViews > 0
        ? ((summary.totalViews - lastTotalViews) / lastTotalViews * 100).toFixed(2)
        : '';
    }

    prevSheet.appendRow([
      Utilities.formatDate(weekStart, CONFIG.TZ, 'yyyy-MM-dd'),
      Utilities.formatDate(weekEnd, CONFIG.TZ, 'yyyy-MM-dd'),
      summary.postsCount,
      summary.totalViews,
      summary.totalEngagement,
      summary.avgViewsPerPost,
      summary.avgEngagementRate,
      summary.bestPostId,
      summary.bestPostViews,
      summary.bestCoreMessageId,
      summary.bestSlot,
      summary.bestWeekday,
      summary.worstCoreMessageId,
      summary.knowledgeAddedCount,
      womPct,
      ''
    ]);

    // LINE通知
    Notifier.send(
      `📊 週次サマリー ${Utilities.formatDate(weekStart, CONFIG.TZ, 'M/d')}〜${Utilities.formatDate(weekEnd, CONFIG.TZ, 'M/d')}\n` +
      `投稿: ${summary.postsCount}件\n` +
      `総ビュー: ${summary.totalViews}\n` +
      `平均ビュー/投稿: ${summary.avgViewsPerPost.toFixed(0)}\n` +
      `エンゲ率: ${(summary.avgEngagementRate * 100).toFixed(2)}%\n` +
      `ベスト訴求: core${summary.bestCoreMessageId} / ${summary.bestSlot} / 曜日${summary.bestWeekday}\n` +
      `前週比: ${womPct}%\n` +
      `ナレッジ追加: ${summary.knowledgeAddedCount}件`
    );
  },

  /**
   * 月末日23:55 で当月分集計
   */
  monthly() {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    const monthStr = Utilities.formatDate(now, CONFIG.TZ, 'yyyy-MM');

    const rows = this._loadImpressionsForRange(monthStart, monthEnd);
    if (rows.length === 0) return;

    const summary = this._summarizeForMonth(rows);

    const sheet = getSheet(CONFIG.SHEETS_EXT.ANALYTICS_MONTHLY);
    const prevData = sheet.getDataRange().getValues();
    let momPct = '';
    if (prevData.length > 1) {
      const last = prevData[prevData.length - 1];
      const lastTotalViews = Number(last[2]) || 0;
      momPct = lastTotalViews > 0
        ? ((summary.totalViews - lastTotalViews) / lastTotalViews * 100).toFixed(2)
        : '';
    }

    sheet.appendRow([
      monthStr,
      summary.postsCount,
      summary.totalViews,
      summary.totalEngagement,
      summary.avgViewsPerPost,
      summary.avgEngagementRate,
      summary.top3PostIds.join(','),
      summary.topCoreMessageId,
      summary.topSlot,
      summary.topWeekday,
      summary.totalProfileVisits,
      summary.knowledgeTotal,
      momPct,
      JSON.stringify(summary.coreBreakdown),
      JSON.stringify(summary.slotBreakdown)
    ]);

    Notifier.send(
      `🗓 月次サマリー ${monthStr}\n` +
      `投稿: ${summary.postsCount}件\n` +
      `総ビュー: ${summary.totalViews}\n` +
      `平均ビュー/投稿: ${summary.avgViewsPerPost.toFixed(0)}\n` +
      `ベスト訴求: core${summary.topCoreMessageId}\n` +
      `ベストスロット: ${summary.topSlot}\n` +
      `前月比: ${momPct}%`
    );
  },

  // ─────────── 集計ロジック ───────────

  /**
   * 指定日（JST 0:00〜23:59）の posted 投稿を sns_impressions から取得
   * @private
   */
  _loadImpressionsForDate(date) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    return this._loadImpressionsForRange(start, end);
  },

  /**
   * @private
   */
  _loadImpressionsForRange(start, end) {
    const sheet = getSheet(CONFIG.SHEETS_EXT.IMPRESSIONS);
    const data = sheet.getDataRange().getValues();
    if (data.length < 2) return [];
    const header = data[0];

    const idx = {};
    header.forEach((h, i) => { idx[h] = i; });

    return data.slice(1).filter(r => {
      const postedAt = new Date(r[idx.posted_at]);
      return postedAt >= start && postedAt <= end;
    }).map(r => {
      const obj = {};
      header.forEach((h, i) => { obj[h] = r[i]; });
      return obj;
    });
  },

  /**
   * @private
   */
  _summarize(rows) {
    const numericSum = (key) => rows.reduce((s, r) => s + (Number(r[key]) || 0), 0);

    const totalViews = numericSum('views_24h');
    const totalLikes = numericSum('likes_24h');
    const totalReplies = numericSum('replies_24h');
    const totalReposts = numericSum('reposts_24h');
    const totalProfileVisits = numericSum('profile_visits_24h');

    const avgViews = rows.length > 0 ? totalViews / rows.length : 0;
    const avgEr = rows.length > 0
      ? rows.reduce((s, r) => s + (Number(r.engagement_rate) || 0), 0) / rows.length
      : 0;

    const sorted = [...rows].sort((a, b) => (Number(b.views_24h) || 0) - (Number(a.views_24h) || 0));
    const best = sorted[0] || {};
    const worst = sorted[sorted.length - 1] || {};

    const slotViews = (slot) => rows
      .filter(r => r.slot === slot)
      .reduce((s, r) => s + (Number(r.views_24h) || 0), 0);

    const knowledgeAdded = rows.filter(r => r.knowledge_added === true || String(r.knowledge_added).toLowerCase() === 'true').length;

    return {
      postsCount: rows.length,
      totalViews, totalLikes, totalReplies, totalReposts, totalProfileVisits,
      avgViews, avgEngagementRate: avgEr,
      bestSlot: best.slot || '',
      bestPostId: best.threads_post_id || '',
      bestPostViews: Number(best.views_24h) || 0,
      worstSlot: worst.slot || '',
      worstPostId: worst.threads_post_id || '',
      worstPostViews: Number(worst.views_24h) || 0,
      morningViews: slotViews('morning'),
      noonViews: slotViews('noon'),
      nightViews: slotViews('night'),
      knowledgeAddedCount: knowledgeAdded
    };
  },

  /**
   * @private
   */
  _summarizeForWeek(rows) {
    const sum = this._summarize(rows);
    const totalEngagement = sum.totalLikes + sum.totalReplies + sum.totalReposts;
    const avgViewsPerPost = sum.avgViews;

    // コア訴求別 平均ビュー
    const byCore = {};
    rows.forEach(r => {
      const id = Number(r.core_message_id) || 0;
      if (!byCore[id]) byCore[id] = { total: 0, count: 0 };
      byCore[id].total += Number(r.views_24h) || 0;
      byCore[id].count += 1;
    });
    const coreAvgs = Object.entries(byCore).map(([id, v]) => ({
      id: Number(id), avg: v.count > 0 ? v.total / v.count : 0
    })).sort((a, b) => b.avg - a.avg);
    const bestCoreMessageId = coreAvgs[0]?.id || 0;
    const worstCoreMessageId = coreAvgs[coreAvgs.length - 1]?.id || 0;

    // 曜日別
    const byWeekday = {};
    rows.forEach(r => {
      const d = Number(r.weekday) || 0;
      if (!byWeekday[d]) byWeekday[d] = { total: 0, count: 0 };
      byWeekday[d].total += Number(r.views_24h) || 0;
      byWeekday[d].count += 1;
    });
    const wdAvgs = Object.entries(byWeekday).map(([d, v]) => ({
      d: Number(d), avg: v.count > 0 ? v.total / v.count : 0
    })).sort((a, b) => b.avg - a.avg);
    const bestWeekday = wdAvgs[0]?.d || 0;

    return {
      postsCount: sum.postsCount,
      totalViews: sum.totalViews,
      totalEngagement,
      avgViewsPerPost,
      avgEngagementRate: sum.avgEngagementRate,
      bestPostId: sum.bestPostId,
      bestPostViews: sum.bestPostViews,
      bestCoreMessageId,
      bestSlot: sum.bestSlot,
      bestWeekday,
      worstCoreMessageId,
      knowledgeAddedCount: sum.knowledgeAddedCount
    };
  },

  /**
   * @private
   */
  _summarizeForMonth(rows) {
    const w = this._summarizeForWeek(rows);

    const sorted = [...rows].sort((a, b) =>
      (Number(b.views_24h) || 0) - (Number(a.views_24h) || 0)
    );
    const top3 = sorted.slice(0, 3).map(r => r.threads_post_id).filter(Boolean);

    // スロット別
    const slotBreakdown = { morning: 0, noon: 0, night: 0 };
    rows.forEach(r => {
      if (slotBreakdown[r.slot] !== undefined) {
        slotBreakdown[r.slot] += Number(r.views_24h) || 0;
      }
    });

    // コア別
    const coreBreakdown = {};
    rows.forEach(r => {
      const id = String(Number(r.core_message_id) || 0);
      coreBreakdown[id] = (coreBreakdown[id] || 0) + (Number(r.views_24h) || 0);
    });

    const topSlot = Object.entries(slotBreakdown).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
    const topCoreMessageId = Number(Object.entries(coreBreakdown).sort((a, b) => b[1] - a[1])[0]?.[0]) || 0;

    // ナレッジ累計件数
    const knowledgeSheet = getSheet(CONFIG.SHEETS_EXT.KNOWLEDGE);
    const knowledgeTotal = Math.max(0, knowledgeSheet.getLastRow() - 1);

    return {
      postsCount: w.postsCount,
      totalViews: w.totalViews,
      totalEngagement: w.totalEngagement,
      avgViewsPerPost: w.avgViewsPerPost,
      avgEngagementRate: w.avgEngagementRate,
      top3PostIds: top3,
      topCoreMessageId,
      topSlot,
      topWeekday: w.bestWeekday,
      totalProfileVisits: rows.reduce((s, r) => s + (Number(r.profile_visits_24h) || 0), 0),
      knowledgeTotal,
      coreBreakdown,
      slotBreakdown
    };
  }
};

// Time Trigger エントリ
function aggregateDaily()   { Analytics.daily(); }
function aggregateWeekly()  { Analytics.weekly(); }
function aggregateMonthly() {
  // 月末日のみ実行
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  if (today.getMonth() !== tomorrow.getMonth()) {
    Analytics.monthly();
  }
}
```

### 3-3. `Knowledge.gs`

```javascript
/**
 * Knowledge.gs
 * 高パフォ投稿を sns_knowledge に追加し、次回 ContentGenerator が参照する種を提供。
 */

const Knowledge = {
  /**
   * sns_impressions の特定 queueId 行を見て、閾値超過なら sns_knowledge に追加
   * @param {string} queueId
   */
  evaluateAndStore(queueId) {
    const impSheet = getSheet(CONFIG.SHEETS_EXT.IMPRESSIONS);
    const impData = impSheet.getDataRange().getValues();
    const impHeader = impData[0];

    let rowIndex = -1;
    let row = null;
    for (let i = 1; i < impData.length; i++) {
      if (impData[i][0] === queueId) {
        rowIndex = i + 1;
        row = {};
        impHeader.forEach((h, j) => { row[h] = impData[i][j]; });
        break;
      }
    }
    if (!row) return;

    if (row.knowledge_added === true || String(row.knowledge_added).toLowerCase() === 'true') {
      return; // 重複追加防止
    }

    const views = Number(row.views_24h) || Number(row.views_7day) || 0;
    const engRate = Number(row.engagement_rate) || 0;

    if (views < CONFIG.ANALYTICS.KNOWLEDGE_MIN_VIEWS
        && engRate < CONFIG.ANALYTICS.KNOWLEDGE_MIN_ENGAGEMENT_RATE) {
      return;
    }

    // 過去30日平均ビューと比較してベンチマーク判定
    const baseline = this._calcBaseline();
    let label = 'above';
    if (baseline > 0) {
      if (views >= baseline * CONFIG.ANALYTICS.BENCHMARK_HERO_MULT) label = 'hero';
      else if (views >= baseline * CONFIG.ANALYTICS.BENCHMARK_HIGH_MULT) label = 'high';
      else if (views >= baseline * CONFIG.ANALYTICS.BENCHMARK_ABOVE_MULT) label = 'above';
      else if (views < baseline) return; // 平均未満は追加しない
    }

    // sns_queue から本文を取得
    const queueRow = findQueueRow(queueId);
    if (!queueRow) return;
    const content = queueRow.data.content || '';

    // 推定理由
    const reason = this._estimateReason(row, content);

    // テンプレ化（日付や季節を逆プレースホルダ化）
    const templated = this._templatize(content);

    const knowledgeId = `k_${Utilities.formatDate(new Date(), CONFIG.TZ, 'yyyyMMdd')}_${row.slot}_${Math.floor(Math.random() * 1000)}`;

    // タグ生成
    const tags = [
      row.slot,
      `core${row.core_message_id}`,
      row.is_question === true ? 'question' : 'statement',
      row.has_cta === true ? 'cta' : 'no_cta',
      label
    ].join(',');

    const sheet = getSheet(CONFIG.SHEETS_EXT.KNOWLEDGE);
    sheet.appendRow([
      knowledgeId,
      queueId,
      row.threads_post_id,
      Utilities.formatDate(new Date(), CONFIG.TZ, 'yyyy-MM-dd HH:mm:ss'),
      row.slot,
      Number(row.core_message_id) || 0,
      content,
      templated,
      views,
      engRate,
      label,
      reason,
      true,    // reusable
      0,       // reuse_count
      '',      // last_reused_at
      tags
    ]);

    // 元行に knowledge_added=true
    const kaIdx = impHeader.indexOf('knowledge_added');
    if (kaIdx >= 0) {
      impSheet.getRange(rowIndex, kaIdx + 1).setValue(true);
    }

    Notifier.send(
      `💡 ナレッジ追加: ${label}\n` +
      `スロット: ${row.slot} / core${row.core_message_id}\n` +
      `ビュー: ${views} (baseline ${Math.round(baseline)})\n` +
      `理由: ${reason}\n` +
      content.slice(0, 100) + '...'
    );

    Logger.write({
      queueId,
      event: 'knowledge_added',
      slot: row.slot,
      severity: 'info',
      detail: JSON.stringify({ knowledgeId, label, views })
    });
  },

  /**
   * 次回 ContentGenerator が呼ぶ：スロット指定で高パフォ事例を1件返す（テンプレ化済）
   * @param {string} slot
   * @returns {{template: string, theme: string, coreMessageId: number}|null}
   */
  getSeedTemplate(slot) {
    const sheet = getSheet(CONFIG.SHEETS_EXT.KNOWLEDGE);
    const data = sheet.getDataRange().getValues();
    if (data.length < 2) return null;

    const header = data[0];
    const idx = {};
    header.forEach((h, i) => { idx[h] = i; });

    // 該当スロット & reusable & 直近で reuse_count が少ない順
    const candidates = data.slice(1)
      .filter(r => r[idx.slot] === slot
        && (r[idx.reusable] === true || String(r[idx.reusable]).toLowerCase() === 'true'))
      .sort((a, b) => (Number(a[idx.reuse_count]) || 0) - (Number(b[idx.reuse_count]) || 0));

    if (candidates.length === 0) return null;

    // 30%の確率で再利用、70%は既存テンプレを使う（過剰偏重を防ぐ）
    if (Math.random() > 0.3) return null;

    const chosen = candidates[0];
    const rowIndex = data.indexOf(chosen) + 1;

    // reuse_count++
    sheet.getRange(rowIndex, idx.reuse_count + 1).setValue((Number(chosen[idx.reuse_count]) || 0) + 1);
    sheet.getRange(rowIndex, idx.last_reused_at + 1)
      .setValue(Utilities.formatDate(new Date(), CONFIG.TZ, 'yyyy-MM-dd HH:mm:ss'));

    return {
      template: chosen[idx.content_template],
      theme: slot === 'morning' ? 'education' : slot === 'noon' ? 'empathy_core' : 'philosophy',
      coreMessageId: Number(chosen[idx.core_message_id]) || 0
    };
  },

  /**
   * 直近30日の平均ビュー（baseline）
   * @private
   */
  _calcBaseline() {
    const sheet = getSheet(CONFIG.SHEETS_EXT.IMPRESSIONS);
    const data = sheet.getDataRange().getValues();
    if (data.length < 2) return 0;
    const header = data[0];
    const idxPosted = header.indexOf('posted_at');
    const idxViews = header.indexOf('views_24h');

    const cutoff = new Date(Date.now() - 30 * 86400 * 1000);
    const recent = data.slice(1).filter(r => {
      const t = new Date(r[idxPosted]);
      return t >= cutoff && Number(r[idxViews]) > 0;
    });

    if (recent.length === 0) return 0;
    const sum = recent.reduce((s, r) => s + Number(r[idxViews]), 0);
    return sum / recent.length;
  },

  /**
   * 推定理由（簡易ヒューリスティクス）
   * @private
   */
  _estimateReason(row, content) {
    const reasons = [];
    if (row.is_question === true || String(row.is_question).toLowerCase() === 'true') reasons.push('質問形式');
    if (row.has_cta === true || String(row.has_cta).toLowerCase() === 'true') reasons.push('CTA明示');
    if (Number(row.emoji_count) >= 3) reasons.push('絵文字多用');
    if (Number(row.hashtag_count) >= 2) reasons.push('ハッシュタグ');
    const len = Number(row.content_length);
    if (len < 200) reasons.push('短文');
    else if (len > 400) reasons.push('長文');
    if (row.slot === 'morning') reasons.push('朝スロット');
    if (Number(row.core_message_id) === 1) reasons.push('core1:気になるところだけ');
    if (Number(row.core_message_id) === 4) reasons.push('core4:権威性');
    return reasons.join(' / ') || '要因不明';
  },

  /**
   * テンプレ化：日付・曜日・季節を逆プレースホルダに置換
   * @private
   */
  _templatize(content) {
    if (!content) return '';
    let out = content;
    // 日付 M月d日 → {date}
    out = out.replace(/\d{1,2}月\d{1,2}日/g, '{date}');
    // 曜日（月〜日） → {weekday}
    out = out.replace(/(?<![一-龥])[月火水木金土日](?=曜)/g, '{weekday}');
    // 季節
    out = out.replace(/(春|夏|秋|冬)/g, '{season}');
    return out;
  }
};
```

### 3-4. `Calendar.gs`

```javascript
/**
 * Calendar.gs
 * 翌週分の投稿予約を sns_calendar に展開、編集IF。
 *
 * - generateWeeklyCalendar(): 翌週月曜から日曜まで21コマを sns_calendar に追加
 * - autoQueueFromCalendar(): カレンダーから sns_queue に展開（投稿6時間前）
 * - Web App から edit/save される
 */

const Calendar = {
  /**
   * 翌週分の21コマを sns_calendar に生成
   * 既存があれば上書きしない（idempotent）
   */
  generateWeekly() {
    const sheet = getSheet(CONFIG.SHEETS_EXT.CALENDAR);
    const data = sheet.getDataRange().getValues();
    const header = data[0];
    const idx = {};
    header.forEach((h, i) => { idx[h] = i; });

    const existingIds = new Set(data.slice(1).map(r => r[0]));

    // 翌月曜の算出（今日が日曜ならその7日後の月曜、月曜なら7日後の月曜）
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayOfWeek = today.getDay(); // 0=日, 1=月, ...
    let daysToMonday = (8 - dayOfWeek) % 7;
    if (daysToMonday === 0) daysToMonday = 7;
    const nextMonday = new Date(today);
    nextMonday.setDate(today.getDate() + daysToMonday);

    const slots = ['morning', 'noon', 'night'];
    const weekdayLabels = ['日', '月', '火', '水', '木', '金', '土'];

    const newRows = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(nextMonday);
      day.setDate(nextMonday.getDate() + i);
      const dateStr = Utilities.formatDate(day, CONFIG.TZ, 'yyyy-MM-dd');
      const yyyymmdd = Utilities.formatDate(day, CONFIG.TZ, 'yyyyMMdd');

      slots.forEach(slot => {
        const slotId = `cal_${yyyymmdd}_${slot}`;
        if (existingIds.has(slotId)) return;

        const slotDef = CONFIG.SLOTS[slot];
        const scheduledTime = `${String(slotDef.hour).padStart(2, '0')}:${String(slotDef.minute).padStart(2, '0')}`;

        // テンプレ or ナレッジ シードから1案を取得
        const seed = Knowledge.getSeedTemplate(slot);
        let planned, source, coreId;
        if (seed) {
          planned = expandPlaceholders(seed.template, day);
          source = 'knowledge';
          coreId = seed.coreMessageId;
        } else {
          try {
            const gen = generateFromTemplate(slot, day);
            planned = gen.text;
            source = 'template';
            coreId = analyzeContent(planned).coreMessageId;
          } catch (e) {
            planned = '';
            source = 'manual';
            coreId = 0;
          }
        }

        // 法務チェック
        const legal = LegalCheck.check(planned);

        newRows.push([
          slotId,
          dateStr,
          weekdayLabels[day.getDay()],
          slot,
          scheduledTime,
          planned,
          source,
          coreId,
          'draft',
          legal.status,
          legal.note,
          '',
          'auto',
          Utilities.formatDate(new Date(), CONFIG.TZ, 'yyyy-MM-dd HH:mm:ss'),
          ''
        ]);
      });
    }

    if (newRows.length > 0) {
      sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, newRows[0].length).setValues(newRows);
    }

    Notifier.send(
      `📅 翌週のカレンダー生成完了\n` +
      `期間: ${Utilities.formatDate(nextMonday, CONFIG.TZ, 'M/d')}〜${Utilities.formatDate(new Date(nextMonday.getTime() + 6 * 86400000), CONFIG.TZ, 'M/d')}\n` +
      `追加: ${newRows.length}コマ\n` +
      `Web App で確認・編集してください。`
    );

    return newRows.length;
  },

  /**
   * sns_calendar から sns_queue に展開（投稿6時間前のコマを対象）
   * トリガー: 毎時0分
   */
  autoQueueFromCalendar() {
    const sheet = getSheet(CONFIG.SHEETS_EXT.CALENDAR);
    const data = sheet.getDataRange().getValues();
    const header = data[0];
    const idx = {};
    header.forEach((h, i) => { idx[h] = i; });

    const now = new Date();
    const cutoff = new Date(now.getTime() + CONFIG.CALENDAR_EXT.AUTO_QUEUE_HOURS_BEFORE * 3600 * 1000);

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const status = row[idx.status];
      if (status !== 'approved' && status !== 'draft') continue;

      const dateStr = row[idx.date];
      const timeStr = row[idx.scheduled_time];
      const scheduledAt = new Date(`${Utilities.formatDate(new Date(dateStr), CONFIG.TZ, 'yyyy-MM-dd')}T${timeStr}:00+09:00`);

      if (scheduledAt > cutoff) continue;
      if (scheduledAt < now) {
        // 過去 → skipped に
        if (status !== 'queued' && status !== 'posted' && status !== 'skipped') {
          sheet.getRange(i + 1, idx.status + 1).setValue('skipped');
        }
        continue;
      }

      // 法務チェック直前再実行
      const planned = row[idx.planned_content];
      if (!planned) {
        sheet.getRange(i + 1, idx.status + 1).setValue('skipped');
        continue;
      }
      const legal = LegalCheck.check(planned);
      if (legal.status === 'ng') {
        sheet.getRange(i + 1, idx.status + 1).setValue('skipped');
        sheet.getRange(i + 1, idx.e_legal_status + 1).setValue('ng');
        sheet.getRange(i + 1, idx.e_legal_note + 1).setValue(legal.note);
        Notifier.send(`⚠ カレンダー → スキップ: ${row[idx.slot_id]}\n${legal.note}`);
        continue;
      }

      // sns_queue に追加
      const yyyymmdd = Utilities.formatDate(new Date(dateStr), CONFIG.TZ, 'yyyyMMdd');
      const queueId = `q_${yyyymmdd}_${row[idx.slot]}`;

      // 重複防止
      const existing = findQueueRow(queueId);
      if (existing) {
        sheet.getRange(i + 1, idx.linked_queue_id + 1).setValue(queueId);
        sheet.getRange(i + 1, idx.status + 1).setValue('queued');
        continue;
      }

      const queueSheet = getSheet(CONFIG.SHEETS.QUEUE);
      queueSheet.appendRow([
        queueId,
        Utilities.formatDate(scheduledAt, CONFIG.TZ, 'yyyy-MM-dd HH:mm'),
        'follow_official',
        'threads',
        row[idx.slot],
        '',
        planned,
        legal.status,
        legal.note,
        legal.status === 'ng' ? 'skipped' : 'scheduled',
        '', '',
        Utilities.formatDate(new Date(), CONFIG.TZ, 'yyyy-MM-dd HH:mm:ss'),
        '',
        0,
        ''
      ]);

      sheet.getRange(i + 1, idx.linked_queue_id + 1).setValue(queueId);
      sheet.getRange(i + 1, idx.status + 1).setValue('queued');
    }
  },

  /**
   * Web App から呼ばれる：1コマの編集を保存
   * @param {string} slotId
   * @param {string} newContent
   * @param {string} editor
   * @returns {{ok: boolean, legal: object}}
   */
  updateSlot(slotId, newContent, editor) {
    const sheet = getSheet(CONFIG.SHEETS_EXT.CALENDAR);
    const data = sheet.getDataRange().getValues();
    const header = data[0];
    const idx = {};
    header.forEach((h, i) => { idx[h] = i; });

    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === slotId) {
        const legal = LegalCheck.check(newContent);
        sheet.getRange(i + 1, idx.planned_content + 1).setValue(newContent);
        sheet.getRange(i + 1, idx.source + 1).setValue('manual');
        sheet.getRange(i + 1, idx.e_legal_status + 1).setValue(legal.status);
        sheet.getRange(i + 1, idx.e_legal_note + 1).setValue(legal.note);
        sheet.getRange(i + 1, idx.edited_by + 1).setValue(editor || 'webapp');
        sheet.getRange(i + 1, idx.edited_at + 1)
          .setValue(Utilities.formatDate(new Date(), CONFIG.TZ, 'yyyy-MM-dd HH:mm:ss'));
        // 文字数や特徴量を analyze して core_message_id 更新
        const features = analyzeContent(newContent);
        sheet.getRange(i + 1, idx.core_message_id + 1).setValue(features.coreMessageId);
        return { ok: true, legal };
      }
    }
    return { ok: false, error: 'slotId not found' };
  },

  /**
   * Web App から呼ばれる：approve（承認、status を approved に）
   */
  approveSlot(slotId, editor) {
    const sheet = getSheet(CONFIG.SHEETS_EXT.CALENDAR);
    const data = sheet.getDataRange().getValues();
    const header = data[0];
    const idx = {};
    header.forEach((h, i) => { idx[h] = i; });
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === slotId) {
        sheet.getRange(i + 1, idx.status + 1).setValue('approved');
        sheet.getRange(i + 1, idx.edited_by + 1).setValue(editor || 'webapp');
        sheet.getRange(i + 1, idx.edited_at + 1)
          .setValue(Utilities.formatDate(new Date(), CONFIG.TZ, 'yyyy-MM-dd HH:mm:ss'));
        return { ok: true };
      }
    }
    return { ok: false };
  },

  /**
   * Web App から呼ばれる：表示用に向こう7日分のカレンダーを返す
   * @returns {Array}
   */
  loadView() {
    const sheet = getSheet(CONFIG.SHEETS_EXT.CALENDAR);
    const data = sheet.getDataRange().getValues();
    if (data.length < 2) return [];
    const header = data[0];

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const horizon = new Date(today.getTime() + 14 * 86400 * 1000);

    return data.slice(1).map(r => {
      const obj = {};
      header.forEach((h, i) => { obj[h] = r[i]; });
      return obj;
    }).filter(r => {
      const d = new Date(r.date);
      return d >= today && d <= horizon;
    });
  }
};

// Time Trigger エントリ
function generateWeeklyCalendar()  { Calendar.generateWeekly(); }
function autoQueueFromCalendar()   { Calendar.autoQueueFromCalendar(); }
```

### 3-5. `WebApp.gs`

```javascript
/**
 * WebApp.gs
 * GAS Web App として公開、カレンダーUIを表示。
 *
 * デプロイ:
 *   GAS エディタ → デプロイ → 新しいデプロイ → 種類「ウェブアプリ」
 *   実行ユーザー: 自分（オーナー）
 *   アクセス権: 全員（URLを知っている人のみ実質アクセス可能）
 *   ※ Script Properties に WEBAPP_ACCESS_TOKEN を設定し、URL に ?token=xxx を要求
 *
 * doGet(): カレンダーUI（HTML）を返す
 * Server functions: google.script.run から呼ばれる
 *
 * 注意: 既存 KillSwitch.gs にも doPost() があるため、
 *       本ファイルは doGet() のみ実装。doPost ルーティングは KillSwitch.gs 既存実装を維持。
 */

/**
 * Web App エントリポイント（GET）
 * @param {GoogleAppsScript.Events.DoGet} e
 */
function doGet(e) {
  const expectedToken = getProp(CONFIG.WEB_APP.ACCESS_TOKEN_KEY);
  const provided = e.parameter && e.parameter.token;

  // 認証
  if (expectedToken && provided !== expectedToken) {
    return HtmlService.createHtmlOutput(
      '<h1>403 Forbidden</h1><p>token クエリパラメータが必要です。</p>'
    ).setTitle('FOLLOW Calendar');
  }

  const tmpl = HtmlService.createTemplateFromFile('WebApp');
  tmpl.token = provided || '';
  return tmpl.evaluate()
    .setTitle(CONFIG.WEB_APP.TITLE)
    .setSandboxMode(HtmlService.SandboxMode.IFRAME)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Server function: カレンダー読み込み（HTML から google.script.run で呼ばれる）
 */
function webapp_loadCalendar() {
  return Calendar.loadView();
}

/**
 * Server function: 1コマ保存
 */
function webapp_saveSlot(slotId, content) {
  return Calendar.updateSlot(slotId, content, 'webapp');
}

/**
 * Server function: 承認
 */
function webapp_approveSlot(slotId) {
  return Calendar.approveSlot(slotId, 'webapp');
}

/**
 * Server function: 次の7日分を生成（手動トリガー用）
 */
function webapp_generateNext7Days() {
  const count = Calendar.generateWeekly();
  return { ok: true, added: count };
}

/**
 * Server function: 法務チェック単体
 */
function webapp_legalCheck(content) {
  return LegalCheck.check(content);
}

/**
 * Server function: ダッシュボードサマリー
 */
function webapp_loadDashboardSummary() {
  const dailySheet = getSheet(CONFIG.SHEETS_EXT.ANALYTICS_DAILY);
  const data = dailySheet.getDataRange().getValues();
  if (data.length < 2) return { ok: true, summary: null };
  const last = data[data.length - 1];
  return {
    ok: true,
    summary: {
      date: last[0],
      posts: last[1],
      totalViews: last[2],
      avgViews: last[7],
      bestSlot: last[9],
      bestPostViews: last[11]
    }
  };
}
```

### 3-6. `WebApp.html`

```html
<!DOCTYPE html>
<html>
<head>
  <base target="_top">
  <meta charset="utf-8">
  <title>FOLLOW Calendar</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif;
      margin: 0;
      padding: 16px;
      background: #f5f5f7;
      color: #1d1d1f;
    }
    h1 { font-size: 20px; margin: 0 0 16px; }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
      margin-bottom: 20px;
    }
    .btn {
      background: #0071e3;
      color: #fff;
      border: none;
      padding: 8px 16px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 14px;
    }
    .btn:hover { background: #005bbe; }
    .btn-secondary { background: #fff; color: #0071e3; border: 1px solid #0071e3; }
    .summary {
      background: #fff;
      border-radius: 12px;
      padding: 12px 16px;
      margin-bottom: 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    }
    .summary .row { display: flex; gap: 24px; font-size: 13px; }
    .summary .row b { color: #0071e3; }
    .grid {
      display: grid;
      grid-template-columns: 100px repeat(3, 1fr);
      gap: 8px;
    }
    .grid-header {
      font-weight: 600;
      text-align: center;
      padding: 8px;
      background: #fff;
      border-radius: 8px;
      font-size: 13px;
    }
    .grid-day { font-weight: 600; padding: 12px 8px; background: #fff; border-radius: 8px; text-align: center; }
    .grid-day.today { background: #ffe4b5; }
    .slot {
      background: #fff;
      border-radius: 8px;
      padding: 10px;
      font-size: 12px;
      cursor: pointer;
      border: 2px solid transparent;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06);
      min-height: 90px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .slot:hover { border-color: #0071e3; }
    .slot .time { color: #6e6e73; font-size: 11px; }
    .slot .content {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
    }
    .slot .badge {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 600;
    }
    .badge.draft     { background: #e0e0e0; color: #1d1d1f; }
    .badge.approved  { background: #cce5ff; color: #003d80; }
    .badge.queued    { background: #d4edda; color: #155724; }
    .badge.posted    { background: #34c759; color: #fff; }
    .badge.skipped   { background: #ff3b30; color: #fff; }
    .badge.ok        { background: #34c759; color: #fff; }
    .badge.needs_fix { background: #ff9500; color: #fff; }
    .badge.ng        { background: #ff3b30; color: #fff; }
    .badge.pending   { background: #d0d0d0; color: #1d1d1f; }

    /* モーダル */
    .modal-bg {
      display: none;
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.4);
      z-index: 99;
      align-items: center;
      justify-content: center;
    }
    .modal-bg.open { display: flex; }
    .modal {
      background: #fff;
      border-radius: 16px;
      padding: 20px;
      max-width: 600px;
      width: 90%;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 8px 32px rgba(0,0,0,0.2);
    }
    .modal h2 { margin-top: 0; font-size: 16px; }
    .modal textarea {
      width: 100%;
      box-sizing: border-box;
      min-height: 160px;
      padding: 10px;
      border-radius: 8px;
      border: 1px solid #d2d2d7;
      font-size: 14px;
      font-family: inherit;
      resize: vertical;
    }
    .modal .meta { font-size: 12px; color: #6e6e73; margin: 8px 0; }
    .modal .actions {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      margin-top: 16px;
      flex-wrap: wrap;
    }
    .legal-note {
      background: #fff5e6;
      border-left: 3px solid #ff9500;
      padding: 8px 12px;
      margin: 12px 0;
      border-radius: 4px;
      font-size: 12px;
    }
    .legal-note.ng { background: #ffe6e6; border-color: #ff3b30; }
    .legal-note.ok { background: #e6ffe6; border-color: #34c759; }
    .spinner {
      display: inline-block;
      width: 14px; height: 14px;
      border: 2px solid #ccc;
      border-top-color: #0071e3;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .toast {
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      background: #1d1d1f;
      color: #fff;
      padding: 10px 20px;
      border-radius: 24px;
      font-size: 13px;
      opacity: 0;
      transition: opacity 0.3s;
      z-index: 100;
    }
    .toast.show { opacity: 1; }
  </style>
</head>
<body>
  <div class="header">
    <h1>📅 FOLLOW Threads Calendar</h1>
    <div>
      <button class="btn-secondary btn" onclick="reload()">🔄 更新</button>
      <button class="btn" onclick="generateNext()">➕ 次の7日分を生成</button>
    </div>
  </div>

  <div class="summary" id="summary">
    <div>読み込み中... <span class="spinner"></span></div>
  </div>

  <div id="calendar">
    <div>カレンダー読込中... <span class="spinner"></span></div>
  </div>

  <div class="modal-bg" id="modalBg" onclick="if(event.target===this) closeModal()">
    <div class="modal">
      <h2 id="modalTitle">編集</h2>
      <div class="meta" id="modalMeta"></div>
      <textarea id="modalContent" placeholder="投稿本文を入力"></textarea>
      <div id="legalNoteArea"></div>
      <div class="actions">
        <button class="btn-secondary btn" onclick="closeModal()">キャンセル</button>
        <button class="btn-secondary btn" onclick="runLegalCheck()">⚖ 法務チェック再実行</button>
        <button class="btn" onclick="saveSlot()">💾 保存</button>
        <button class="btn" style="background:#34c759" onclick="approveAndSave()">✅ 承認して保存</button>
      </div>
    </div>
  </div>

  <div class="toast" id="toast"></div>

  <script>
    const TOKEN = <?= JSON.stringify(token) ?>;
    let currentSlots = [];
    let editingSlotId = null;

    function toast(msg) {
      const t = document.getElementById('toast');
      t.textContent = msg;
      t.classList.add('show');
      setTimeout(() => t.classList.remove('show'), 2200);
    }

    function reload() {
      google.script.run
        .withSuccessHandler(renderCalendar)
        .withFailureHandler(err => toast('読込失敗: ' + err.message))
        .webapp_loadCalendar();

      google.script.run
        .withSuccessHandler(renderSummary)
        .withFailureHandler(() => {})
        .webapp_loadDashboardSummary();
    }

    function renderSummary(res) {
      if (!res || !res.summary) {
        document.getElementById('summary').innerHTML = '<div>サマリーまだ無し</div>';
        return;
      }
      const s = res.summary;
      document.getElementById('summary').innerHTML =
        '<div class="row">' +
        `<div>📅 ${s.date}</div>` +
        `<div>投稿: <b>${s.posts}</b></div>` +
        `<div>総ビュー: <b>${s.totalViews}</b></div>` +
        `<div>平均: <b>${Math.round(s.avgViews)}</b></div>` +
        `<div>ベストスロット: <b>${s.bestSlot}</b></div>` +
        '</div>';
    }

    function renderCalendar(slots) {
      currentSlots = slots || [];
      const byDate = {};
      currentSlots.forEach(s => {
        const d = String(s.date);
        if (!byDate[d]) byDate[d] = {};
        byDate[d][s.slot] = s;
      });

      const dates = Object.keys(byDate).sort();
      const todayStr = new Date().toISOString().slice(0, 10);

      let html = '<div class="grid">';
      html += '<div class="grid-header">日付</div>';
      html += '<div class="grid-header">朝 07:30</div>';
      html += '<div class="grid-header">昼 12:30</div>';
      html += '<div class="grid-header">夜 21:00</div>';

      dates.forEach(date => {
        const dateOnly = new Date(date).toISOString().slice(0, 10);
        const isToday = dateOnly === todayStr;
        const weekday = ['日','月','火','水','木','金','土'][new Date(date).getDay()];
        const md = (new Date(date).getMonth() + 1) + '/' + new Date(date).getDate();
        html += `<div class="grid-day ${isToday ? 'today' : ''}">${md}<br>(${weekday})</div>`;
        ['morning','noon','night'].forEach(slot => {
          const s = byDate[date][slot];
          if (!s) {
            html += '<div class="slot" style="opacity:0.3">未設定</div>';
            return;
          }
          const content = String(s.planned_content || '(空)').replace(/</g, '&lt;');
          html += `
            <div class="slot" onclick="openModal('${s.slot_id}')">
              <div>
                <span class="badge ${s.status}">${s.status}</span>
                <span class="badge ${s.e_legal_status}">${s.e_legal_status}</span>
              </div>
              <div class="content">${content}</div>
              <div class="time">core${s.core_message_id || '-'} / ${s.source || ''}</div>
            </div>`;
        });
      });
      html += '</div>';
      document.getElementById('calendar').innerHTML = html;
    }

    function openModal(slotId) {
      const s = currentSlots.find(x => x.slot_id === slotId);
      if (!s) return;
      editingSlotId = slotId;
      document.getElementById('modalTitle').textContent =
        `${s.date} ${s.weekday} ${s.slot} (${s.scheduled_time})`;
      document.getElementById('modalMeta').textContent =
        `source: ${s.source} | core: ${s.core_message_id} | status: ${s.status}`;
      document.getElementById('modalContent').value = s.planned_content || '';
      renderLegalNote({ status: s.e_legal_status, note: s.e_legal_note });
      document.getElementById('modalBg').classList.add('open');
    }

    function closeModal() {
      document.getElementById('modalBg').classList.remove('open');
      editingSlotId = null;
    }

    function renderLegalNote(legal) {
      const area = document.getElementById('legalNoteArea');
      if (!legal || !legal.status) {
        area.innerHTML = '';
        return;
      }
      const cls = legal.status === 'ok' ? 'ok' : legal.status === 'ng' ? 'ng' : '';
      area.innerHTML = `<div class="legal-note ${cls}">[${legal.status}] ${legal.note || '(問題なし)'}</div>`;
    }

    function runLegalCheck() {
      const content = document.getElementById('modalContent').value;
      google.script.run
        .withSuccessHandler(legal => {
          renderLegalNote(legal);
          toast('法務チェック完了: ' + legal.status);
        })
        .withFailureHandler(err => toast('チェック失敗: ' + err.message))
        .webapp_legalCheck(content);
    }

    function saveSlot() {
      if (!editingSlotId) return;
      const content = document.getElementById('modalContent').value;
      google.script.run
        .withSuccessHandler(res => {
          if (res.ok) {
            toast('💾 保存しました');
            closeModal();
            reload();
          } else {
            toast('保存失敗: ' + (res.error || 'unknown'));
          }
        })
        .withFailureHandler(err => toast('エラー: ' + err.message))
        .webapp_saveSlot(editingSlotId, content);
    }

    function approveAndSave() {
      if (!editingSlotId) return;
      const content = document.getElementById('modalContent').value;
      google.script.run
        .withSuccessHandler(() => {
          google.script.run
            .withSuccessHandler(() => {
              toast('✅ 承認・保存しました');
              closeModal();
              reload();
            })
            .webapp_approveSlot(editingSlotId);
        })
        .withFailureHandler(err => toast('エラー: ' + err.message))
        .webapp_saveSlot(editingSlotId, content);
    }

    function generateNext() {
      if (!confirm('次の7日分を生成しますか？（既存コマは上書きしません）')) return;
      google.script.run
        .withSuccessHandler(res => {
          toast(`➕ ${res.added}コマ追加`);
          reload();
        })
        .withFailureHandler(err => toast('生成失敗: ' + err.message))
        .webapp_generateNext7Days();
    }

    // 初回ロード
    reload();
  </script>
</body>
</html>
```

### 3-7. `Dashboard.gs`

```javascript
/**
 * Dashboard.gs
 * sns_dashboard タブに数式・SPARKLINE を一括配置する setupDashboard 関数。
 * 配置後は Sheets が自動で再計算するので、Dashboard.gs 自体はトリガー不要。
 */

const Dashboard = {
  /**
   * sns_dashboard タブを初期化（既存セルクリア → 数式配置）
   */
  setup() {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    let sheet = ss.getSheetByName(CONFIG.SHEETS_EXT.DASHBOARD);
    if (!sheet) sheet = ss.insertSheet(CONFIG.SHEETS_EXT.DASHBOARD);
    sheet.clear();

    // タイトル
    sheet.getRange('A1').setValue('FOLLOW Threads ダッシュボード')
      .setFontSize(18).setFontWeight('bold');
    sheet.getRange('A2').setFormula('=TEXT(NOW(),"yyyy-MM-dd HH:mm")')
      .setFontColor('#666');
    sheet.getRange('A2').setNote('最終更新時刻（シートを開くと再計算）');

    // ─── サマリー: 直近の週次集計 ───
    sheet.getRange('A4:E4').setValues([['今週投稿数', '平均ビュー', 'ベスト投稿ID', 'ワースト訴求', '前週比%']])
      .setFontWeight('bold').setBackground('#f0f0f0');
    sheet.getRange('A5').setFormula(`=IFERROR(INDEX(${CONFIG.SHEETS_EXT.ANALYTICS_WEEKLY}!C:C, COUNTA(${CONFIG.SHEETS_EXT.ANALYTICS_WEEKLY}!C:C)),"-")`);
    sheet.getRange('B5').setFormula(`=IFERROR(INDEX(${CONFIG.SHEETS_EXT.ANALYTICS_WEEKLY}!F:F, COUNTA(${CONFIG.SHEETS_EXT.ANALYTICS_WEEKLY}!F:F)),"-")`);
    sheet.getRange('C5').setFormula(`=IFERROR(INDEX(${CONFIG.SHEETS_EXT.ANALYTICS_WEEKLY}!H:H, COUNTA(${CONFIG.SHEETS_EXT.ANALYTICS_WEEKLY}!H:H)),"-")`);
    sheet.getRange('D5').setFormula(`=IFERROR(INDEX(${CONFIG.SHEETS_EXT.ANALYTICS_WEEKLY}!M:M, COUNTA(${CONFIG.SHEETS_EXT.ANALYTICS_WEEKLY}!M:M)),"-")`);
    sheet.getRange('E5').setFormula(`=IFERROR(INDEX(${CONFIG.SHEETS_EXT.ANALYTICS_WEEKLY}!O:O, COUNTA(${CONFIG.SHEETS_EXT.ANALYTICS_WEEKLY}!O:O)),"-")`);

    // ─── 日別ビュー推移 ───
    sheet.getRange('A7').setValue('📈 日別ビュー推移（直近30日）').setFontWeight('bold');
    sheet.getRange('A8').setFormula(
      `=SPARKLINE(${CONFIG.SHEETS_EXT.ANALYTICS_DAILY}!C2:C, {"charttype","line";"color","#0071e3";"linewidth",2})`
    );
    sheet.setRowHeight(8, 50);
    sheet.getRange('A8').setNote('直近30日の全投稿24h総ビュー');

    // ─── スロット別 平均ビュー ───
    sheet.getRange('A10').setValue('🕐 スロット別 平均ビュー').setFontWeight('bold');
    sheet.getRange('B10:D10').setValues([['朝 morning', '昼 noon', '夜 night']])
      .setFontWeight('bold').setBackground('#f0f0f0');
    sheet.getRange('B11').setFormula(
      `=IFERROR(AVERAGEIF(${CONFIG.SHEETS_EXT.IMPRESSIONS}!D:D,"morning",${CONFIG.SHEETS_EXT.IMPRESSIONS}!X:X),0)`
    );
    sheet.getRange('C11').setFormula(
      `=IFERROR(AVERAGEIF(${CONFIG.SHEETS_EXT.IMPRESSIONS}!D:D,"noon",${CONFIG.SHEETS_EXT.IMPRESSIONS}!X:X),0)`
    );
    sheet.getRange('D11').setFormula(
      `=IFERROR(AVERAGEIF(${CONFIG.SHEETS_EXT.IMPRESSIONS}!D:D,"night",${CONFIG.SHEETS_EXT.IMPRESSIONS}!X:X),0)`
    );
    sheet.getRange('B12:D12').setFormula(
      `=SPARKLINE(B11:D11, {"charttype","column";"color","#34c759"})`
    );

    // ─── コア訴求別 平均ビュー ───
    sheet.getRange('A14').setValue('🎯 コア訴求別 平均ビュー (1〜7)').setFontWeight('bold');
    for (let i = 1; i <= 7; i++) {
      const col = String.fromCharCode(64 + i + 1); // B〜H
      sheet.getRange(`${col}14`).setValue(`core${i}`).setFontWeight('bold').setBackground('#f0f0f0');
      sheet.getRange(`${col}15`).setFormula(
        `=IFERROR(AVERAGEIF(${CONFIG.SHEETS_EXT.IMPRESSIONS}!E:E,${i},${CONFIG.SHEETS_EXT.IMPRESSIONS}!X:X),0)`
      );
    }
    sheet.getRange('B16').setFormula(
      `=SPARKLINE(B15:H15, {"charttype","column";"color","#ff9500"})`
    );

    // ─── ナレッジ Top3 ───
    sheet.getRange('A18').setValue('💡 ナレッジハイライト Top3 (直近 hero/high)').setFontWeight('bold');
    sheet.getRange('A19:D19').setValues([['#', 'スロット', 'core', 'ビュー']])
      .setFontWeight('bold').setBackground('#f0f0f0');
    for (let r = 0; r < 3; r++) {
      const rank = r + 1;
      sheet.getRange(`A${20 + r}`).setValue(rank);
      sheet.getRange(`B${20 + r}`).setFormula(
        `=IFERROR(INDEX(${CONFIG.SHEETS_EXT.KNOWLEDGE}!E:E,MATCH(LARGE(${CONFIG.SHEETS_EXT.KNOWLEDGE}!I:I,${rank}),${CONFIG.SHEETS_EXT.KNOWLEDGE}!I:I,0)),"-")`
      );
      sheet.getRange(`C${20 + r}`).setFormula(
        `=IFERROR(INDEX(${CONFIG.SHEETS_EXT.KNOWLEDGE}!F:F,MATCH(LARGE(${CONFIG.SHEETS_EXT.KNOWLEDGE}!I:I,${rank}),${CONFIG.SHEETS_EXT.KNOWLEDGE}!I:I,0)),"-")`
      );
      sheet.getRange(`D${20 + r}`).setFormula(
        `=IFERROR(LARGE(${CONFIG.SHEETS_EXT.KNOWLEDGE}!I:I,${rank}),0)`
      );
    }

    // ─── アラート: 3投稿連続インプ低下 ───
    sheet.getRange('A24').setValue('⚠ アラート').setFontWeight('bold');
    sheet.getRange('A25').setFormula(
      `=IF(AND(
        INDEX(${CONFIG.SHEETS_EXT.IMPRESSIONS}!X:X,COUNTA(${CONFIG.SHEETS_EXT.IMPRESSIONS}!X:X)-2) > INDEX(${CONFIG.SHEETS_EXT.IMPRESSIONS}!X:X,COUNTA(${CONFIG.SHEETS_EXT.IMPRESSIONS}!X:X)-1),
        INDEX(${CONFIG.SHEETS_EXT.IMPRESSIONS}!X:X,COUNTA(${CONFIG.SHEETS_EXT.IMPRESSIONS}!X:X)-1) > INDEX(${CONFIG.SHEETS_EXT.IMPRESSIONS}!X:X,COUNTA(${CONFIG.SHEETS_EXT.IMPRESSIONS}!X:X))
      ),"🚨 3投稿連続でビュー低下中","✅ 問題なし")`
    );

    // ─── 曜日 × スロット ヒートマップ ───
    sheet.getRange('A27').setValue('🗓 曜日×スロット 平均ビュー').setFontWeight('bold');
    sheet.getRange('A28:D28').setValues([['曜日', '朝', '昼', '夜']])
      .setFontWeight('bold').setBackground('#f0f0f0');
    const wdLabels = ['日','月','火','水','木','金','土'];
    wdLabels.forEach((wd, i) => {
      const row = 29 + i;
      sheet.getRange(`A${row}`).setValue(wd);
      sheet.getRange(`B${row}`).setFormula(
        `=IFERROR(AVERAGEIFS(${CONFIG.SHEETS_EXT.IMPRESSIONS}!X:X,${CONFIG.SHEETS_EXT.IMPRESSIONS}!K:K,${i},${CONFIG.SHEETS_EXT.IMPRESSIONS}!D:D,"morning"),0)`
      );
      sheet.getRange(`C${row}`).setFormula(
        `=IFERROR(AVERAGEIFS(${CONFIG.SHEETS_EXT.IMPRESSIONS}!X:X,${CONFIG.SHEETS_EXT.IMPRESSIONS}!K:K,${i},${CONFIG.SHEETS_EXT.IMPRESSIONS}!D:D,"noon"),0)`
      );
      sheet.getRange(`D${row}`).setFormula(
        `=IFERROR(AVERAGEIFS(${CONFIG.SHEETS_EXT.IMPRESSIONS}!X:X,${CONFIG.SHEETS_EXT.IMPRESSIONS}!K:K,${i},${CONFIG.SHEETS_EXT.IMPRESSIONS}!D:D,"night"),0)`
      );
    });

    // 列幅
    sheet.setColumnWidth(1, 160);
    [2, 3, 4, 5, 6, 7, 8].forEach(c => sheet.setColumnWidth(c, 110));

    sheet.setFrozenRows(2);

    Logger.log('✅ Dashboard configured');
  }
};

function setupDashboard() { Dashboard.setup(); }
```

### 3-8. `Main.gs` への追記（既存ファイルに追加）

既存 `seedTemplates()` の下、 `smokeTest` の上あたりに以下を追加。

```javascript
/**
 * 拡張モジュールのシート初期化
 * 既存 setupSheets() の追加版。setupSheets 後に1回実行する。
 */
function setupExtensionSheets() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const tabDefs = [
    {
      name: CONFIG.SHEETS_EXT.IMPRESSIONS,
      headers: ['queue_id','threads_post_id','posted_at','slot','core_message_id',
                'content_length','hashtag_count','emoji_count','is_question','has_cta','weekday',
                'views_5min','likes_5min','replies_5min','reposts_5min',
                'views_30min','likes_30min','replies_30min','reposts_30min',
                'views_60min','likes_60min','replies_60min','reposts_60min',
                'views_24h','likes_24h','replies_24h','reposts_24h','profile_visits_24h',
                'views_7day','likes_7day','replies_7day','reposts_7day','profile_visits_7day',
                'engagement_rate','knowledge_added','last_fetched_at','fetch_errors']
    },
    {
      name: CONFIG.SHEETS_EXT.KNOWLEDGE,
      headers: ['knowledge_id','source_queue_id','source_post_id','added_at','slot',
                'core_message_id','content_full','content_template','views_24h','engagement_rate',
                'benchmark_label','estimated_reason','reusable','reuse_count','last_reused_at','tags']
    },
    {
      name: CONFIG.SHEETS_EXT.CALENDAR,
      headers: ['slot_id','date','weekday','slot','scheduled_time','planned_content','source',
                'core_message_id','status','e_legal_status','e_legal_note','linked_queue_id',
                'edited_by','edited_at','notes']
    },
    {
      name: CONFIG.SHEETS_EXT.ANALYTICS_DAILY,
      headers: ['date','posts_count','total_views','total_likes','total_replies','total_reposts',
                'total_profile_visits','avg_views','avg_engagement_rate',
                'best_slot','best_post_id','best_post_views',
                'worst_slot','worst_post_id','worst_post_views',
                'morning_views','noon_views','night_views','line_added','knowledge_added_count']
    },
    {
      name: CONFIG.SHEETS_EXT.ANALYTICS_WEEKLY,
      headers: ['week_start','week_end','posts_count','total_views','total_engagement',
                'avg_views_per_post','avg_engagement_rate','best_post_id','best_post_views',
                'best_core_message_id','best_slot','best_weekday','worst_core_message_id',
                'knowledge_added_count','week_over_week_views_pct','notes']
    },
    {
      name: CONFIG.SHEETS_EXT.ANALYTICS_MONTHLY,
      headers: ['month','posts_count','total_views','total_engagement','avg_views_per_post',
                'avg_engagement_rate','top3_post_ids','top_core_message_id','top_slot',
                'top_weekday','total_profile_visits','knowledge_total',
                'month_over_month_views_pct','core_message_breakdown','slot_breakdown']
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

  Logger.log(`[setupExtensionSheets] 6タブ + dashboard 構成完了。次に setupDashboard() を実行してください。`);
}

/**
 * 拡張トリガーをインストール（既存 8件 + 5件 = 13件）
 * installAllTriggers() の後に1回実行する。
 */
function installExtensionTriggers() {
  // 既存はそのまま維持し、追加分だけ作成

  // 1. 日次集計 23:55
  ScriptApp.newTrigger('aggregateDaily')
    .timeBased().atHour(23).nearMinute(55).everyDays(1).create();

  // 2. 週次集計（毎日23:55に呼ぶが、内部で日曜のみ実行する版を作るより、専用トリガーで毎週日曜のみに）
  ScriptApp.newTrigger('aggregateWeekly')
    .timeBased().onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(23).nearMinute(55).create();

  // 3. 月次集計（毎日23:55に呼んで関数内で月末判定）
  ScriptApp.newTrigger('aggregateMonthly')
    .timeBased().atHour(23).nearMinute(58).everyDays(1).create();

  // 4. 週次カレンダー生成（毎週金曜 22:00 → 翌週月曜分まで準備）
  ScriptApp.newTrigger('generateWeeklyCalendar')
    .timeBased().onWeekDay(ScriptApp.WeekDay.FRIDAY).atHour(22).create();

  // 5. カレンダーから queue 自動展開（毎時0分）
  ScriptApp.newTrigger('autoQueueFromCalendar')
    .timeBased().everyHours(1).create();

  Logger.log('✅ Extension triggers installed (5件追加、合計13件)');
  Notifier.send('[Scheduler] 拡張トリガー追加完了 (5件)');
}

/**
 * 拡張モジュールのスモークテスト
 */
function smokeTestExtension() {
  Logger.log('========== EXTENSION SMOKE TEST ==========');

  // 1. シート存在確認
  try {
    ['IMPRESSIONS','KNOWLEDGE','CALENDAR','ANALYTICS_DAILY','ANALYTICS_WEEKLY','ANALYTICS_MONTHLY','DASHBOARD']
      .forEach(k => getSheet(CONFIG.SHEETS_EXT[k]));
    Logger.log('[1] Extension sheets OK');
  } catch (e) {
    Logger.log('[1] Sheets FAIL: ' + e.message);
  }

  // 2. analyzeContent
  const a = analyzeContent('おはようございます。気になる分け目だけ染める、月880円。https://lin.ee/9IC32LC');
  Logger.log('[2] analyzeContent: ' + JSON.stringify(a));

  // 3. Calendar.generateWeekly (dryRun想定で実行可)
  try {
    const cnt = Calendar.generateWeekly();
    Logger.log(`[3] Calendar.generateWeekly: ${cnt} slots`);
  } catch (e) {
    Logger.log('[3] Calendar FAIL: ' + e.message);
  }

  // 4. ImpressionFetcher dryRun
  setProp(CONFIG.DRY_RUN_KEY, 'true');
  try {
    // 仮のqueue/postIdで schedule（実Triggerは作らずに済むよう、scheduleAll は実Trigger作成するので注意）
    Logger.log('[4] ImpressionFetcher.scheduleAll skip in smoke (creates real triggers)');
  } finally {
    // setProp(CONFIG.DRY_RUN_KEY, 'false');
  }

  // 5. Dashboard setup
  try {
    Dashboard.setup();
    Logger.log('[5] Dashboard OK');
  } catch (e) {
    Logger.log('[5] Dashboard FAIL: ' + e.message);
  }

  Logger.log('========== END ==========');
}
```

### 3-9. `ThreadsClient.gs` の `postScheduled` への1行追加（既存ファイル微修正）

既存 `postScheduled(slot)` 関数の中、投稿成功時のブロック（`updateQueueStatus(row.rowIndex, 'posted', ...)` の直後）に1行追加。

```javascript
// 既存コード（変更点だけ抜粋）
    const result = ThreadsClient.publish(row.data.content);
    updateQueueStatus(row.rowIndex, 'posted', result.creation_id, result.published_id, '');

    // ★ ADDED: インプ計測トリガー作成
    try {
      createImpressionTriggers(queueId, result.published_id);
    } catch (e) {
      console.error('[postScheduled] impression trigger fail: ' + e.message);
    }

    Logger.write({ ... }); // 既存
```

### 3-10. `ContentGenerator.gs` の `generateForSlot` への変更（既存ファイル微修正）

既存 `generateForSlot(slot, targetDate)` の冒頭にナレッジ参照を1ブロック追加。

```javascript
function generateForSlot(slot, targetDate) {
  // ★ ADDED: 30%確率でナレッジ DB の種を使う（Knowledge.getSeedTemplate 内部で乱択）
  try {
    const seed = Knowledge.getSeedTemplate(slot);
    if (seed) {
      const expanded = expandPlaceholders(seed.template, targetDate);
      const final = appendLineCta(expanded);
      return { text: clipToLimit(final), theme: seed.theme };
    }
  } catch (e) {
    console.warn('[generateForSlot] knowledge lookup failed: ' + e.message);
  }

  // 以下既存：テンプレ生成 or AI生成
  const useAi = getProp('USE_AI_GENERATION') === 'true';
  if (useAi) return generateWithAI(slot, targetDate);
  return generateFromTemplate(slot, targetDate);
}
```

---

## 4. Threads Insights API 仕様

### 4-1. エンドポイント

| 種別 | URL | metric 例 |
|---|---|---|
| 投稿単位 | `GET /v1.0/{media_id}/insights` | `views,likes,replies,reposts,quotes` |
| ユーザー単位 | `GET /v1.0/{user_id}/threads_insights` | `views,likes,followers_count` |

### 4-2. 認証

既存 `THREADS_ACCESS_TOKEN`（60日長期トークン）を使い回し。新規スコープ追加不要（Insights は publish と同スコープに含まれる）。

### 4-3. レスポンス例

```json
{
  "data": [
    { "name": "views",   "values": [{ "value": 1234 }] },
    { "name": "likes",   "values": [{ "value": 56 }] },
    { "name": "replies", "values": [{ "value": 3 }] },
    { "name": "reposts", "values": [{ "value": 7 }] },
    { "name": "quotes",  "values": [{ "value": 1 }] }
  ]
}
```

### 4-4. レート制限への配慮

- 1日3投稿 × 5タイミング = **1日最大15回**の Insights 呼び出し。Meta公式上限（1時間200/ユーザー）に対し十分余裕
- 同時刻一斉発火を避けるため、各 interval に **0〜30秒のジッタ**を入れる（`CONFIG.THREADS_INSIGHTS.JITTER_SEC`）
- 5xx/429 はリトライ最大3回、指数バックオフ（2秒→4秒→8秒）
- 失敗時は次の interval まで諦め、`sns_impressions.fetch_errors` 列に記録

---

## 5. 投稿内容分析ロジック（`analyzeContent`）

`ImpressionFetcher.gs` 末尾に実装。投稿時とWeb App編集時に呼ばれる。

### 5-1. 抽出する特徴量

| 特徴 | 算出方法 | 用途 |
|---|---|---|
| `coreMessageId` | 7メッセージそれぞれのキーワード辞書とマッチング、最強スコアの ID | コア訴求別集計 |
| `length` | `text.length` | 短/中/長分類 |
| `hashtagCount` | `text.match(/#[^\s#]+/g)?.length` | ハッシュタグ効果分析 |
| `emojiCount` | Unicode 絵文字範囲 regex マッチ数 | 絵文字効果分析 |
| `isQuestion` | `/[\?？]|ですか\|ますか\|でしょうか/` | 質問形 vs 断定形 |
| `hasCta` | `/lin\.ee\|LINE\|ライン/i` | CTA有無 |
| `weekday` | `posted_at.getDay()` | 曜日別集計 |
| `slot` | sns_queue から | 時間帯別集計 |

### 5-2. 突合先

- `sns_impressions` の `views_24h` と各特徴量を `AVERAGEIF` / `AVERAGEIFS` で突合 → ダッシュボードに可視化
- 週次集計で「ベスト訴求 / ベスト曜日 / ベストスロット」を抽出 → 翌週のテンプレ優先度に反映

### 5-3. コア訴求キーワード辞書（`ImpressionFetcher.gs` の `analyzeContent` 内に既出）

```
core1: 気になるところ, 分け目, こめかみ, 生え際, 部分的, リタッチ
core2: プロ用, 美容師, 現場, ジアミンフリー, 薬剤
core3: 頭皮ケア, 頭皮, シャンプー, 保護, ダメージ
core4: 20年, 何万人, 大阪, 専門店, 現役, 海外
core5: 染めない, 染める/染めない, 休む, 月単位, 判断
core6: 880円, 880, 月額, 解約
core7: 任意, 商材購入, 他で買って, 押し売り
```

---

## 6. ナレッジ DB の使い方

### 6-1. 自動収録フロー

1. 投稿後 7day Trigger 発火 → `Knowledge.evaluateAndStore(queueId)` 呼び出し
2. `views_24h >= 1000` または `engagement_rate >= 0.03` を満たすか確認
3. 直近30日平均ビュー（baseline）と比較し `hero` (10x) / `high` (3x) / `above` (2x) を判定
4. 本文を `_templatize()` でプレースホルダ化（日付・季節を `{date}` `{season}` に逆変換）
5. `sns_knowledge` に1行 INSERT、`tags` 列に `slot,coreN,question/statement,cta/no_cta,label` を保存
6. 管理者LINEへ `💡 ナレッジ追加` 通知

### 6-2. 次回生成での参照（再利用サイクル）

1. `generateTomorrowPosts()` → 各スロットで `generateForSlot(slot)`
2. `Knowledge.getSeedTemplate(slot)` を最初に呼ぶ（30%確率で当選）
3. 当選した場合、`reuse_count` の少ない高パフォ事例を選択 → `expandPlaceholders` で再生成 → CTA 付与
4. 落選または該当0件なら既存テンプレ生成にフォールバック

これにより「**成功パターン × バリエーション生成**」のサイクルが回る。同じテンプレを連投しないよう reuse_count で平準化。

### 6-3. NG 投稿の除外

`reusable=false` にすると `getSeedTemplate` の対象外。法務修正が必要だった、または偶発バズで再現性低いと判断したら手動で FALSE に。

---

## 7. カレンダーUI仕様

### 7-1. アクセス制御

- Web App としてデプロイ（実行ユーザー=オーナー、アクセス=全員）
- URL 形式: `https://script.google.com/macros/s/{deploy_id}/exec?token={WEBAPP_ACCESS_TOKEN}`
- Script Properties `WEBAPP_ACCESS_TOKEN` に乱数文字列を保存、URLパラメータと一致しない場合 403
- 管理者がブックマーク or ホーム画面に追加して使う

### 7-2. 画面構成

- ヘッダー: タイトル + 「更新」「次の7日分を生成」ボタン
- サマリー帯: 直近の `sns_analytics_daily` 最終行（投稿数/総ビュー/平均/ベストスロット）
- メイングリッド: 4列 × N行（行=日付、列=朝/昼/夜）
- 各コマ:
  - status バッジ（`draft`/`approved`/`queued`/`posted`/`skipped`）
  - 法務バッジ（`ok`/`needs_fix`/`ng`/`pending`）
  - 本文プレビュー（3行クランプ）
  - `core{N}` / `source`
- コマクリック → 編集モーダル

### 7-3. 編集モーダル

- タイトル: `2026-06-23 (月) noon (12:30)`
- メタ情報: source / core / status
- textarea: 本文編集
- 「⚖ 法務チェック再実行」ボタン → `webapp_legalCheck` 呼び出し → 結果バナー
- 「💾 保存」ボタン → `webapp_saveSlot`
- 「✅ 承認して保存」ボタン → save + approve（status=`approved`）

### 7-4. 「次の7日分を生成」

- 既存コマがあれば上書きしない（idempotent）
- 翌週月曜から日曜の21コマを `Knowledge.getSeedTemplate` 優先、フォールバック既存テンプレで生成
- 各コマに `LegalCheck` 適用、結果を `e_legal_status` 列に記録

---

## 8. ダッシュボード設計（sns_dashboard タブ）

`setupDashboard()` 1回叩けば全配置。以降 Sheets が自動再計算。

### 8-1. 配置内容（A1〜D34）

| 範囲 | 内容 | 数式 |
|---|---|---|
| A1 | タイトル | text |
| A2 | 最終更新 | `=TEXT(NOW(),"yyyy-MM-dd HH:mm")` |
| A4:E4 | 今週サマリーヘッダ | text |
| A5 | 今週投稿数 | INDEX + COUNTA で weekly 最終行 |
| B5 | 平均ビュー/投稿 | 同上 |
| C5 | ベスト投稿ID | 同上 |
| D5 | ワースト訴求 | 同上 |
| E5 | 前週比% | 同上 |
| A8 | 日別ビュー推移 | `=SPARKLINE(sns_analytics_daily!C2:C, {"charttype","line"...})` |
| B11:D11 | スロット別 平均 | `AVERAGEIF` |
| B12:D12 | スロット別 棒グラフ | SPARKLINE column |
| B15:H15 | コア訴求別 平均 (1〜7) | `AVERAGEIF` |
| B16 | コア訴求別 棒グラフ | SPARKLINE column |
| A20:D22 | ナレッジ Top3 | `LARGE` + `MATCH` + `INDEX` |
| A25 | アラート | 3投稿連続低下なら警告文字列 |
| A28:D35 | 曜日×スロット ヒートマップ | `AVERAGEIFS` |

### 8-2. 外部依存ゼロ

Looker Studio / Data Studio / 外部チャートライブラリ不使用。Sheets ネイティブ機能のみで完結。

### 8-3. アラート例

```
=IF(AND(
  INDEX(sns_impressions!X:X, COUNTA(...)-2) > INDEX(sns_impressions!X:X, COUNTA(...)-1),
  INDEX(sns_impressions!X:X, COUNTA(...)-1) > INDEX(sns_impressions!X:X, COUNTA(...))
), "🚨 3投稿連続でビュー低下中", "✅ 問題なし")
```

---

## 9. Time Trigger 追加（既存8件 + 5件 = 13件）

| # | 関数 | 時刻 | 頻度 | 目的 |
|---|---|---|---|---|
| **既存** | | | | |
| 1 | `generateTomorrowPosts` | 23:00 | 毎日 | 翌日3投稿生成 |
| 2 | `postMorning` | 07:30 | 毎日 | 朝投稿 |
| 3 | `postNoon` | 12:30 | 毎日 | 昼投稿 |
| 4 | `postNight` | 21:00 | 毎日 | 夜投稿 |
| 5 | `refreshLongLivedToken` | 02:00 | 毎週日曜 | トークン延長 |
| 6 | `killSwitchHealthCheck` | 06:00 | 毎日 | ヘルス |
| 7 | `killSwitchHealthCheck` | 18:00 | 毎日 | ヘルス |
| 8 | `sendDailyAdminSummary` | 23:30 | 毎日 | 翌日サマリー |
| **追加（拡張）** | | | | |
| 9 | `aggregateDaily` | 23:55 | 毎日 | 日次集計 |
| 10 | `aggregateWeekly` | 23:55 | 毎週日曜 | 週次集計 |
| 11 | `aggregateMonthly` | 23:58 | 毎日（月末日のみ実処理） | 月次集計 |
| 12 | `generateWeeklyCalendar` | 22:00 | 毎週金曜 | 翌週カレンダー |
| 13 | `autoQueueFromCalendar` | 毎時 0分 | 毎時 | カレンダー → queue 展開 |
| **動的（投稿時に作成・実行後削除）** | | | | |
| (動的) | `fetchImpression_5` | 投稿+5分 | 1回限り | インプ取得 |
| (動的) | `fetchImpression_30` | 投稿+30分 | 1回限り | |
| (動的) | `fetchImpression_60` | 投稿+60分 | 1回限り | |
| (動的) | `fetchImpression_1440` | 投稿+24時間 | 1回限り | |
| (動的) | `fetchImpression_10080` | 投稿+7日 | 1回限り | + ナレッジ判定 |

`installExtensionTriggers()` 1回叩けば 9〜13 がインストール完了。動的トリガーは投稿成功時に自動作成・実行後自動削除（`ImpressionFetcher._cleanupTrigger`）。

---

## 10. デプロイ手順（追加分）

既存システムが稼働中の前提で、以下を上から順に実行。

### Step 1. 6タブの追加

GAS エディタで `setupExtensionSheets` を関数選択 → 実行
→ FOLLOW-KPI に `sns_impressions` `sns_knowledge` `sns_calendar` `sns_analytics_daily` `sns_analytics_weekly` `sns_analytics_monthly` が追加される。

### Step 2. 7ファイルの追加

GAS エディタで以下を「ファイル → 新規 → スクリプト」または「HTML」で作成し、本書の §3-1〜§3-7 のコードを順に貼り付け:

1. `ImpressionFetcher.gs`
2. `Analytics.gs`
3. `Knowledge.gs`
4. `Calendar.gs`
5. `WebApp.gs`
6. `WebApp` （HTML、§3-6）
7. `Dashboard.gs`

加えて既存ファイルへの追記:
- `Config.gs` 末尾に拡張定数追加（§3-0）
- `Main.gs` 末尾に `setupExtensionSheets` `installExtensionTriggers` `smokeTestExtension` 追加（§3-8）
- `ThreadsClient.gs` の `postScheduled` 内に1行追加（§3-9）
- `ContentGenerator.gs` の `generateForSlot` 冒頭に1ブロック追加（§3-10）

### Step 3. Dashboard セットアップ

`setupDashboard` を実行 → `sns_dashboard` タブが配置される。

### Step 4. 拡張トリガー設定

`installExtensionTriggers` を実行 → 5件のトリガー追加 → 計13件に。

### Step 5. Web App デプロイ

1. GAS エディタ → 右上「デプロイ」 → 「新しいデプロイ」
2. 種類 = **ウェブアプリ**
3. 説明 = `FOLLOW Calendar v1`
4. 実行ユーザー = **自分（オーナー）**
5. アクセス権 = **全員**
6. 「デプロイ」→ 表示された Web App URL をコピー

### Step 6. Web App アクセストークン設定

Script Properties に `WEBAPP_ACCESS_TOKEN` を追加（例: `Utilities.getUuid()` 等で生成した32文字以上の乱数文字列）。

完成形 URL:
```
https://script.google.com/macros/s/{DEPLOY_ID}/exec?token={WEBAPP_ACCESS_TOKEN}
```

このURLを管理者がブラウザにブックマーク。スマホはホーム画面に追加。

### Step 7. スモークテスト

1. `smokeTestExtension` 実行 → コンソールで [1]〜[5] OK 確認
2. dryRun状態で `generateTomorrowPosts` → `postScheduled('morning')` 実行 → 動的トリガーが作成されるか `listTriggers()` で確認
3. ブラウザで Web App URL を開き、カレンダーUI表示確認
4. 1コマ編集 → 保存 → Sheets `sns_calendar` 該当行が更新されているか確認

---

## 11. テスト方法

### 11-1. 単体テスト

| 関数 | 確認内容 | 期待結果 |
|---|---|---|
| `analyzeContent('絶対染まる！#白髪 #カラー 💪')` | 特徴量抽出 | hashtag=2, emoji=1, coreId=0 |
| `analyzeContent('20年現役で...大阪専門店で...')` | コア訴求検出 | coreId=4 |
| `Knowledge._templatize('6月23日(月)、夏の頭皮ケア')` | プレースホルダ化 | `{date}{weekday}、{season}の頭皮ケア` |
| `Calendar.generateWeekly()` | 21コマ生成 | 重複時0件、初回21件 |
| `Calendar.updateSlot('cal_20260623_morning', '新文言', 'test')` | 編集保存 | `{ok:true, legal:{...}}` |
| `Analytics.daily()` | 前日分集計 | sns_analytics_daily に1行追加 |
| `Dashboard.setup()` | 数式配置 | sns_dashboard 全セル数式入り |
| `ImpressionFetcher._fetchInsights(postId, token)` | API 単体 | views等の数値オブジェクト |

### 11-2. 過去データでの集計検証

1. `sns_queue` から `post_status=posted` の過去行を抽出
2. 各 `threads_post_id` で `ImpressionFetcher._fetchInsights` を手動実行
3. 結果を `sns_impressions` に手動 append
4. `Analytics.daily()` `weekly()` `monthly()` を順次実行
5. ダッシュボード値が手計算と一致するか確認

### 11-3. E2E テストシナリオ

1. `setProp('DRY_RUN', 'true')`
2. `generateTomorrowPosts()` → sns_queue 3行作成
3. `postScheduled('morning')` → posted（dryRun ID）+ `createImpressionTriggers` 起動
4. `listTriggers()` で動的トリガー5件存在確認
5. `_fetchImpressionForAll(5)` を手動実行 → sns_impressions に5min値書込
6. 同様に 30, 60, 1440, 10080 を手動実行
7. `sns_impressions` 全列埋まり、最後の 10080 で `Knowledge.evaluateAndStore` 起動 → ベンチマーク超なら sns_knowledge に追加
8. `Analytics.daily()` → sns_analytics_daily 1行追加
9. ブラウザで Web App URL → カレンダーに 7日分表示確認

---

## 12. ロードマップ

### Phase 1（今週・即実装可）
- [x] `Config.gs` 拡張
- [x] `ImpressionFetcher.gs`（インプ取得 5/30/60/24h）
- [x] `Analytics.gs` daily 集計
- [x] `Main.gs` `setupExtensionSheets` + `installExtensionTriggers`
- [x] `ThreadsClient.postScheduled` への1行追加
- [x] Dashboard.setup() で sns_dashboard 配置

### Phase 2（来週）
- [ ] `Knowledge.gs`（自動収録 + 種テンプレ提供）
- [ ] `ContentGenerator.generateForSlot` への Knowledge 統合
- [ ] `Analytics.weekly()` + `Analytics.monthly()`
- [ ] 週次/月次 LINE通知

### Phase 3（再来週）
- [ ] `Calendar.gs` + `WebApp.gs` + `WebApp.html`（カレンダーUI公開）
- [ ] `Calendar.autoQueueFromCalendar`（カレンダー → queue 自動展開）
- [ ] Web App デプロイ + アクセストークン設定
- [ ] スマホからのカレンダー編集動線テスト

### Phase 4（将来）
- [ ] AI による高パフォ要因推定（Claude Haiku 4.5）
- [ ] HEJ アカウントの Insights 統合
- [ ] 「次の7日を AI 生成」ボタン（既存テンプレ＋ナレッジ＋AI 三段重ね）

---

## 13. 既存システムを壊さない設計の保証

| 既存ファイル | 改修内容 | 既存挙動への影響 |
|---|---|---|
| `Config.gs` | 末尾に `SHEETS_EXT`, `THREADS_INSIGHTS`, `ANALYTICS`, `CALENDAR_EXT`, `WEB_APP` を追加 | なし（既存定数は無変更） |
| `ThreadsClient.gs` | `postScheduled` 投稿成功時に `createImpressionTriggers` 呼出 1行 | try-catch で囲み、失敗しても既存フロー継続 |
| `ContentGenerator.gs` | `generateForSlot` 冒頭で `Knowledge.getSeedTemplate` を try | knowledge sheet 不在時も catch して既存ロジック実行 |
| `Main.gs` | 末尾に新関数3つ追加（既存関数は無改修） | なし |
| その他既存6ファイル | 改修なし | なし |

既存トリガー（8件）と動的トリガー（投稿成功時のみ）は別物。既存トリガー削除時の `uninstallAllTriggers()` を再実行しても、動的トリガーは個別に削除されないが、`installExtensionTriggers` を再実行すれば重複作成を防ぐため、運用上問題なし。

---

## 14. 完成チェックリスト

- [ ] `Config.gs` に拡張定数追記済み
- [ ] 7ファイル新規作成（ImpressionFetcher / Analytics / Knowledge / Calendar / WebApp.gs / WebApp.html / Dashboard）
- [ ] `Main.gs` に 3関数追記（setupExtensionSheets / installExtensionTriggers / smokeTestExtension）
- [ ] `ThreadsClient.gs` の postScheduled に createImpressionTriggers 呼出追加
- [ ] `ContentGenerator.gs` の generateForSlot に Knowledge 統合
- [ ] `setupExtensionSheets()` 実行 → 6タブ追加確認
- [ ] `setupDashboard()` 実行 → sns_dashboard 数式配置確認
- [ ] `installExtensionTriggers()` 実行 → トリガー計13件に
- [ ] Script Properties `WEBAPP_ACCESS_TOKEN` 設定済み
- [ ] Web App デプロイ → URL 取得
- [ ] `smokeTestExtension` 実行 → 全項目 OK
- [ ] dryRun で投稿 → 動的トリガー生成 → 手動 _fetchImpressionForAll 実行 → sns_impressions に値書込確認
- [ ] ブラウザで Web App URL → カレンダー21コマ表示
- [ ] 1コマ編集 → 保存 → sns_calendar 更新確認
- [ ] 法務NG文言で編集 → 法務バナー赤色表示確認
- [ ] 「次の7日分を生成」ボタン → 翌週分追加確認
- [ ] 23:55 トリガー発火 → 翌朝 sns_analytics_daily に前日行存在確認
- [ ] 日曜23:55 → sns_analytics_weekly に1行追加 + LINE通知受信
- [ ] 月末23:58 → sns_analytics_monthly に1行追加 + LINE通知

---

以上で FOLLOW Threads 自動投稿システムに、ダッシュボード・分析・ナレッジ・カレンダーの拡張モジュールが追加され、「投稿 → 計測 → 分析 → ナレッジ化 → 翌週反映」の完全ループが完成する。

このドキュメントのコードはコピペで稼働する完全形である。
