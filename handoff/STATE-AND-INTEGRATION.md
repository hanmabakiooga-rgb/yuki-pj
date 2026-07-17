# 状態管理・統合設計

作成日: 2026-06-10
役割: エージェント間の**情報の流れ**と**共通の真実の置き場所**

---

## 1. 状態の置き場所（4つ）

| ストア | 用途 | 書き手 | 読み手 |
|---|---|---|---|
| **GitHub Issues** | 承認キュー、タスク、提案 | 全エージェント | 全エージェント＋ユーザー |
| **D1 `line-harness`** | 顧客・送信ログ・カウンセリング | B/H/J/Worker | 全エージェント |
| **Google Sheets `FOLLOW-KPI`** | 数値KPI（日次） | F | F/I/C |
| **R2 `follow-assets`** | 画像/動画/PDF | A/C/D | 全エージェント |

---

## 2. データフロー図

```
[広告 配信]                  [SNS 投稿]                [LINE 顧客]
    ↓                            ↓                         ↓
 Meta API                  各プラットフォーム            LINE Webhook
    ↓                            ↓                         ↓
 ┌───────────────────────────────────────────────────────────┐
 │              D1 + Sheets + R2（一次蓄積）                  │
 └───────────────────────────────────────────────────────────┘
    ↓                ↓               ↓              ↓
   F             I（ファネル）     H（CS）        J（オペ）
   ↓                ↓               ↓              ↓
 朝サマリー        改善提案        ケア提案       稼働調整
   ↓                ↓               ↓              ↓
 ┌───────────────────────────────────────────────────────────┐
 │            GitHub Issues（承認キュー）                      │
 └───────────────────────────────────────────────────────────┘
                            ↓
                 管理者通知Bot（Flex Message）
                            ↓
                  ユーザー（hanma.baki.ooga）
                            ↓
                    承認 / 却下 / 修正
                            ↓
                  各エージェント（実行）
```

---

## 3. GitHub Issue のラベル運用

| ラベル | 用途 |
|---|---|
| `approval-queue` | 承認待ち |
| `approved` | 承認済み、実行発動済み |
| `rejected` | 却下 |
| `pending-later` | 24時間後再カード |
| `code-task` | コードエージェントD用バックログ |
| `proposed-by-F`〜`proposed-by-J` | 各エージェント由来の提案 |
| `agent-A`〜`agent-J` | 起票エージェント識別 |
| `urgent` | 緊急（時間外でも通知） |
| `customer-issue` | 顧客起因の問題 |
| `ad-issue` | 広告関連 |
| `legal-review-needed` | E再チェック必要 |

---

## 4. D1 拡張テーブル（必要なもの）

既存スキーマに加えて以下を追加：

```sql
-- 承認キュー（GitHub Issueのキャッシュ・高速参照用）
CREATE TABLE approval_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  github_issue_number INTEGER,
  agent TEXT NOT NULL,
  category TEXT,
  status TEXT NOT NULL CHECK (status IN ('queued','approved','rejected','revised','later')),
  created_at INTEGER,
  resolved_at INTEGER
);

-- 顧客ごとのCS状態
CREATE TABLE customer_cs (
  uid TEXT PRIMARY KEY,
  risk_score INTEGER,
  last_intervention_at INTEGER,
  intervention_count INTEGER DEFAULT 0,
  notes TEXT,
  updated_at INTEGER
);

-- 川崎さん稼働ログ
CREATE TABLE colorist_workload (
  date TEXT PRIMARY KEY,
  consultation_count INTEGER,
  avg_response_minutes INTEGER,
  total_char_count INTEGER,
  consecutive_days INTEGER
);

-- 広告KPI（Sheetsと併用、即時参照用）
CREATE TABLE ad_kpi_daily (
  date TEXT PRIMARY KEY,
  spend_yen INTEGER,
  impressions INTEGER,
  clicks INTEGER,
  registrations INTEGER,
  subscriptions INTEGER,
  cpa_yen INTEGER
);

-- SNS投稿実績
CREATE TABLE sns_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  platform TEXT CHECK (platform IN ('instagram','threads','note')),
  external_id TEXT,
  posted_at INTEGER,
  engagement_likes INTEGER,
  engagement_comments INTEGER,
  engagement_shares INTEGER,
  cv_attributable INTEGER DEFAULT 0
);
```

---

## 5. Google Sheets `FOLLOW-KPI` の列構成

シート名 `daily`：

| 列 | 内容 |
|---|---|
| A | 日付（YYYY-MM-DD） |
| B | LP訪問数 |
| C | LINE登録数 |
| D | カウンセリング完了数 |
| E | 初回課金数 |
| F | サブスク数（月末スナップショット） |
| G | 解約数 |
| H | 広告消化額 |
| I | 広告CPA |
| J | SNS総エンゲ（IG+Threads+note） |
| K | 川崎さん相談件数 |
| L | 平均応答時間（分） |
| M | メモ（特記事項） |

シート `weekly`：A〜M を週次集計  
シート `monthly`：A〜M を月次集計＋目標進捗  
シート `experiments`：A/Bテストのログ

---

## 6. R2 バケット構成

```
follow-assets/
├── sns-images/{YYYY-MM}/{agent}-{n}.png
├── sns-videos/{YYYY-MM}/reels-{n}.mp4
├── ad-creatives/{YYYY-MM}/c-{n}.{ext}
├── consent-pdfs/{uid}/{timestamp}.pdf  ← v1運用なら使わない
└── customer-photos/{uid}/{ts}.jpg       ← カウンセリング時の写真
```

---

## 7. API 連携・外部サービス

| サービス | 用途 | エージェント |
|---|---|---|
| LINE Messaging API（顧客Bot） | 顧客対応 | B |
| LINE Messaging API（管理者Bot） | 承認カード送信 | オーケストレーター |
| Meta Graph API（Instagram/Threads） | SNS投稿、KPI取得 | A/F |
| Stripe | 課金管理 | I/F/H |
| Cloudflare（Workers/D1/R2/Pages） | インフラ | D |
| Google Sheets API | KPI記録 | F |
| GitHub API | Issue/PR | 全エージェント |
| Anthropic API（Claude） | エージェント本体 | オーケストレーター |

---

## 8. 認証情報の置き場所

すべて Cloudflare Workers の `wrangler secret put` で管理：

```
LINE_CHANNEL_SECRET（顧客Bot）
LINE_CHANNEL_ACCESS_TOKEN（顧客Bot）
ADMIN_BOT_CHANNEL_SECRET（管理者Bot）
ADMIN_BOT_ACCESS_TOKEN（管理者Bot）
ADMIN_LINE_USER_ID
ADMIN_NOTIFY_SHARED_SECRET
META_APP_ID
META_APP_SECRET
META_PAGE_ACCESS_TOKEN
INSTAGRAM_BUSINESS_ACCOUNT_ID
THREADS_USER_ACCESS_TOKEN
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
GITHUB_PERSONAL_ACCESS_TOKEN
GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON
ANTHROPIC_API_KEY
```

---

## 9. データ更新の同期戦略

- **書き込み元が1つ**になるよう設計（複数エージェントが同じレコードに同時書き込みするのを避ける）
- 承認キューは GitHub Issue が真。D1はキャッシュ。
- KPIは Sheets が真。D1は当日参照のキャッシュ。
- 顧客情報は D1 が真。Sheetsへは集計値のみ。

---

## 10. バックアップ

- D1：Cloudflare 自動バックアップ + 週1で SQL ダンプを R2 へ
- Sheets：版管理（Google側機能）
- GitHub：そのもの分散保存
- R2：複数リージョンレプリケーション
