# D実働：Threads自動投稿パイプライン + sns_queue + 管理画面（CODEX投入仕様書）

実行: エージェントD（コード）
作成日: 2026-06-19
ステータス: **CODEX投入可能**（コピペで投入）
位置づけ: SNS-STRATEGY-FINAL.md §4「FOLLOW公式 Threads 1日3投稿 完全自動化」の実装仕様
対象リポジトリ:
- `apps/worker`（Cloudflare Workers / Hono / D1 / Cron）
- `apps/web`（Next.js App Router / 管理画面 `/admin/sns-queue`）
- LINE bot: 既存 `line-harness-oss`（緊急停止コマンド）

関連: SNS-STRATEGY-FINAL.md / POSITIONING-FINAL.md §11 / E-legal-checklist-prompt.md / F-morning-summary-flex-spec.md / D-issue6-flex-message-prompt.md

---

## 0. なぜこの2 Issue を一緒に出すか

D #8（パイプライン）と D #9（D1テーブル + 管理画面）は**同じ schema を共有する**ので、
スキーマ齟齬を防ぐために**1本の仕様書から2 PR を直列で出す**設計にしている。

```
D #9 を先に PR → main にマージ → D #8 が D #9 のテーブルを前提に作る
```

---

## 1. アーキテクチャ全体図

```
┌────────────────────────────────────────────────────────────────────┐
│                  毎日 23:00 JST = 14:00 UTC                        │
│   ┌──────────────────────────────────────────────────────────┐     │
│   │  cron-threads-generate.ts                                │     │
│   │  ─ A: 翌日3投稿分を生成（morning/noon/night）            │     │
│   │  ─ E: 各投稿に法務チェックをかける                       │     │
│   │  ─ OK の3件のみ sns_queue に status='scheduled' で保存   │     │
│   │  ─ NG/修正必要は sns_queue に status='legal_blocked'     │     │
│   │  ─ 管理者LINEに「明日の3投稿サマリー」Flex push          │     │
│   └──────────────────────────────────────────────────────────┘     │
└────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
            ┌─────────────────────────────────────┐
            │  D1: sns_queue テーブル              │
            │  ─ scheduled_at で投稿時刻管理       │
            │  ─ E判定結果(e_legal_verdict)を保持  │
            │  ─ 管理画面/API から手動編集可       │
            └─────────────────────────────────────┘
                                │
                                ▼
┌────────────────────────────────────────────────────────────────────┐
│        毎日 7:30 / 12:30 / 21:00 JST = 22:30 / 03:30 / 12:00 UTC  │
│   ┌──────────────────────────────────────────────────────────┐     │
│   │  cron-threads-publish.ts                                 │     │
│   │  1. 緊急停止フラグチェック → stop なら return             │     │
│   │  2. sns_queue から scheduled_at <= now AND status=       │     │
│   │     'scheduled' を1件取得                                │     │
│   │  3. Threads Graph API へ post                            │     │
│   │  4. 成功 → status='posted', threads_post_id 更新         │     │
│   │  5. 失敗 → retry_count++, 3回連続失敗で                  │     │
│   │     status='auto_stopped' + 全 scheduled も停止          │     │
│   │  6. sns_log に1行 INSERT                                 │     │
│   └──────────────────────────────────────────────────────────┘     │
└────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
            ┌─────────────────────────────────────┐
            │  F: 翌朝サマリーに前日Threads3投稿の │
            │     反応(views/likes/replies)を反映  │
            └─────────────────────────────────────┘

────────────────────────────────────────────────────────────────────
緊急停止経路：
  管理者LINE「stop_auto_posting」
       │
       ▼
  admin-bot/webhook.ts （既存）
       │
       ▼
  D1: system_flags(key='auto_posting_enabled', value='false', updated_at)
       │
       ▼
  cron-threads-publish.ts が毎回先頭でチェック → 5分以内に有効
────────────────────────────────────────────────────────────────────
```

---

## 2. Cron時刻換算表（厳守）

JSTとUTCの換算は1分単位で重要。Cloudflare Cron は **UTC** で書く。

| 用途              | JST     | UTC      | Cron式（UTC）      |
|-------------------|---------|----------|--------------------|
| 翌日3投稿の生成   | 23:00   | 14:00    | `0 14 * * *`       |
| 朝の投稿（教育）  | 07:30   | 22:30(前日) | `30 22 * * *`   |
| 昼の投稿（共感）  | 12:30   | 03:30    | `30 3 * * *`       |
| 夜の投稿（哲学）  | 21:00   | 12:00    | `0 12 * * *`       |

> ⚠ 朝7:30 JSTは前日UTCの22:30。Cloudflare Cron が「日付」を持たないので、UTC側で `30 22 * * *` を回せば JSTの翌07:30 になる。

### wrangler.toml `[triggers]` 追記

```toml
[triggers]
crons = [
  "30 22 * * *",  # 07:30 JST publish morning
  "30 3 * * *",   # 12:30 JST publish noon
  "0 12 * * *",   # 21:00 JST publish night
  "0 14 * * *",   # 23:00 JST generate next day x3
  # 既存の cron（朝サマリー07:15等）は維持
]
```

`apps/worker/src/index.ts` の `scheduled(event)` ハンドラで `event.cron` 文字列で分岐する。

---

# D Issue #9: sns_queue D1テーブル + 管理画面

**先にこちらをマージしてから D #8 を実装する。**

---

## 9-1. D1 テーブル設計

### 9-1-1. `sns_queue`（投稿キュー）

```sql
-- migrations/0011_create_sns_queue.sql
CREATE TABLE IF NOT EXISTS sns_queue (
  id              TEXT PRIMARY KEY,         -- UUID v4
  account         TEXT NOT NULL,            -- 'follow_official' | 'hej'（v1は follow_official のみ）
  channel         TEXT NOT NULL,            -- 'threads' | 'instagram'（v1は threads のみ）
  slot            TEXT NOT NULL,            -- 'morning' | 'noon' | 'night'
  scheduled_at    TEXT NOT NULL,            -- ISO8601 UTC, 例: '2026-06-20T22:30:00Z'
  status          TEXT NOT NULL,            -- 下記 §9-1-2 参照
  content         TEXT NOT NULL,            -- 投稿本文（Threads 500字以内）
  content_hash    TEXT NOT NULL,            -- 直近重複検知用（SHA256 hex）
  e_legal_verdict TEXT,                     -- 'OK' | 'NEEDS_FIX' | 'NG' | NULL（未判定）
  e_legal_reasons TEXT,                     -- JSON: [{location, reason, suggestion}]
  posted_at       TEXT,                     -- 実投稿時刻 ISO8601 UTC
  threads_post_id TEXT,                     -- Threads API の返り値 id
  retry_count     INTEGER NOT NULL DEFAULT 0,
  error_message   TEXT,                     -- 最後のエラーメッセージ（最新のみ）
  generated_by    TEXT NOT NULL DEFAULT 'agent-a',
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_sns_queue_scheduled ON sns_queue(scheduled_at, status);
CREATE INDEX idx_sns_queue_status ON sns_queue(status);
CREATE UNIQUE INDEX idx_sns_queue_slot_per_day
  ON sns_queue(account, channel, slot, substr(scheduled_at, 1, 10));
-- 同一アカウント・同一日・同一スロットは1件まで（再生成は UPDATE）
```

### 9-1-2. `status` 取りうる値

| status            | 意味                                            |
|-------------------|-------------------------------------------------|
| `pending`         | A生成直後、E判定待ち（瞬間状態）                |
| `legal_blocked`   | E判定で NG / NEEDS_FIX、自動投稿しない          |
| `scheduled`       | E判定 OK、cron が投稿時刻を待っている           |
| `posting`         | API 呼び出し中（再入防止）                      |
| `posted`          | 投稿成功、Threads ID 保持                       |
| `failed`          | 単発失敗（retry_count < 3 で再試行候補）        |
| `auto_stopped`    | 3回連続失敗で全停止された                       |
| `manually_cancelled` | 管理画面/LINEから手動キャンセル               |

### 9-1-3. `sns_log`（投稿ログ）

```sql
-- migrations/0012_create_sns_log.sql
CREATE TABLE IF NOT EXISTS sns_log (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  queue_id      TEXT NOT NULL,              -- sns_queue.id
  event         TEXT NOT NULL,              -- 'generated' | 'legal_checked' | 'posted' | 'failed' | 'cancelled' | 'auto_stopped'
  detail        TEXT,                       -- JSON 任意
  occurred_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_sns_log_queue ON sns_log(queue_id);
CREATE INDEX idx_sns_log_occurred ON sns_log(occurred_at);
```

### 9-1-4. `system_flags`（緊急停止用、汎用）

既存テーブルがあれば再利用、なければ新規。

```sql
-- migrations/0013_create_system_flags.sql
CREATE TABLE IF NOT EXISTS system_flags (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_by  TEXT,                         -- 'admin_line:<userId>' | 'system:auto_stop'
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT OR IGNORE INTO system_flags(key, value) VALUES('auto_posting_enabled', 'true');
```

---

## 9-2. 管理画面 `/admin/sns-queue`（apps/web）

### 9-2-1. 画面構成

```
┌─────────────────────────────────────────────────────────────┐
│ FOLLOW 管理 > SNS Queue          [緊急停止: 稼働中 🟢]      │
│                                  [全停止]ボタン             │
├─────────────────────────────────────────────────────────────┤
│ 📅 2026-06-19 今日                                          │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 07:30 朝（教育）   ✅ posted   👁 124 ❤ 8 💬 2          │ │
│ │ 「分け目の白髪、生え際だけ染めれば…」                  │ │
│ │ Threads ID: 178...      [Threadsで開く]                │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ 12:30 昼（共感）   ✅ posted   👁 89 ❤ 5  💬 0          │ │
│ │ ...                                                    │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ 21:00 夜（哲学）   ⏳ scheduled   E判定: OK             │ │
│ │ 「染めるか染めないか、迷うのが普通…」                  │ │
│ │ [編集][キャンセル][今すぐ投稿]                          │ │
│ └─────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│ 📅 2026-06-20 明日（生成済み）                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 07:30 ⏳ scheduled   E判定: OK                          │ │
│ │ 「市販の白髪染めが強すぎる…」                          │ │
│ │ [編集][キャンセル][再生成]                              │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ 12:30 ⚠ legal_blocked   E判定: NEEDS_FIX               │ │
│ │ 理由: 「絶対染まる」→断定的優良誤認                    │ │
│ │ [理由詳細][編集して再E判定][再生成]                     │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ 21:00 ⏳ scheduled   E判定: OK                          │ │
│ │ ...                                                    │ │
│ └─────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│ 📜 過去7日（アーカイブ）                          [もっと]  │
│  06-18 朝✅ 昼✅ 夜✅                                       │
│  06-17 朝✅ 昼✅ 夜❌(API失敗)                              │
│  ...                                                       │
└─────────────────────────────────────────────────────────────┘
```

### 9-2-2. UI 仕様（Next.js App Router）

ファイル: `apps/web/src/app/admin/sns-queue/page.tsx`（新規・Server Component）

```tsx
import { fetchUpcomingQueue, fetchArchive, fetchKillSwitch } from "@/lib/api/sns-queue";
import { QueueDayCard } from "@/components/sns-queue/QueueDayCard";
import { KillSwitchPanel } from "@/components/sns-queue/KillSwitchPanel";
import { ArchiveList } from "@/components/sns-queue/ArchiveList";

export const dynamic = "force-dynamic";

export default async function SnsQueuePage() {
  const [{ today, tomorrow }, killSwitch, archive] = await Promise.all([
    fetchUpcomingQueue(),
    fetchKillSwitch(),
    fetchArchive({ days: 7 }),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">SNS Queue</h1>
        <KillSwitchPanel enabled={killSwitch.enabled} updatedAt={killSwitch.updatedAt} />
      </header>
      <QueueDayCard date={today.date} items={today.items} label="今日" />
      <QueueDayCard date={tomorrow.date} items={tomorrow.items} label="明日（生成済み）" />
      <ArchiveList rows={archive} />
    </div>
  );
}
```

- 認証: 既存 `apps/web` の admin Cookie / Bearer ガードに合わせる（`requireAdmin()` 呼び出し）。
- スタイル: 既存の Tailwind トークンに揃える（独自CSS追加しない）。
- 自動リロード: 30秒間隔で `router.refresh()`（クライアント側 `useEffect`）。

### 9-2-3. 各カードコンポーネント

ファイル:
- `apps/web/src/components/sns-queue/QueueDayCard.tsx`
- `apps/web/src/components/sns-queue/QueueItemRow.tsx`
- `apps/web/src/components/sns-queue/KillSwitchPanel.tsx`
- `apps/web/src/components/sns-queue/ArchiveList.tsx`
- `apps/web/src/components/sns-queue/EditDrawer.tsx`（編集モーダル）

`QueueItemRow` のアクション：

| status            | 表示ボタン                                          |
|-------------------|-----------------------------------------------------|
| `scheduled`       | 編集 / キャンセル / 今すぐ投稿                      |
| `legal_blocked`   | 理由詳細 / 編集して再E判定 / 再生成                 |
| `posted`          | Threadsで開く（uri）/ 反応数表示                    |
| `failed`          | 再試行 / 編集 / キャンセル                          |
| `manually_cancelled` / `auto_stopped` | 再生成のみ                       |

---

## 9-3. API設計（apps/worker）

ファイル: `apps/worker/src/routes/sns-queue.ts`（新規）

### 9-3-1. エンドポイント一覧

| Method | Path                                       | 用途                                    |
|--------|--------------------------------------------|-----------------------------------------|
| GET    | `/api/sns-queue/upcoming`                  | 今日・明日の queue 全件                 |
| GET    | `/api/sns-queue/archive?days=7`            | 過去N日分の posted/failed/cancelled     |
| GET    | `/api/sns-queue/:id`                       | 1件詳細（E判定理由含む）                |
| POST   | `/api/sns-queue/:id/cancel`                | status を `manually_cancelled` に更新   |
| POST   | `/api/sns-queue/:id/post-now`              | 即時投稿（cron を待たずに）             |
| PATCH  | `/api/sns-queue/:id`                       | content を編集 → E判定再実行            |
| POST   | `/api/sns-queue/:id/regenerate`            | A を再呼び出しして上書き                |
| GET    | `/api/sns-queue/kill-switch`               | 緊急停止フラグの状態                    |
| POST   | `/api/sns-queue/kill-switch`               | `{enabled: boolean}` で切替             |

すべて `Authorization: Bearer ADMIN_API_SHARED_SECRET` 必須（既存 admin-notify と同じ仕組み）。

### 9-3-2. レスポンス例（GET /api/sns-queue/upcoming）

```json
{
  "today": {
    "date": "2026-06-19",
    "items": [
      {
        "id": "9d3e...",
        "slot": "morning",
        "scheduledAt": "2026-06-18T22:30:00Z",
        "scheduledAtJst": "2026-06-19T07:30:00+09:00",
        "status": "posted",
        "content": "分け目の白髪、生え際だけ染めれば…",
        "eLegalVerdict": "OK",
        "eLegalReasons": [],
        "postedAt": "2026-06-18T22:30:14Z",
        "threadsPostId": "1789...",
        "retryCount": 0,
        "metrics": { "views": 124, "likes": 8, "replies": 2 }
      }
      // ... noon, night
    ]
  },
  "tomorrow": { "date": "2026-06-20", "items": [ /* ... */ ] }
}
```

> `metrics` は v1.1（F連携時）に追加。v1 は `null`。

### 9-3-3. 実装メモ

- D1 への直クエリは `apps/worker/src/db/sns-queue.ts`（新規）にカプセル化。
- 時刻表示: ストレージは UTC、レスポンスは UTC + JST 両方を返す（フロントの実装簡略化）。
- 削除はしない（履歴保持のため `cancel` で状態遷移）。

---

## 9-4. ファイル構成（D #9 新規/拡張）

### 新規
```
apps/worker/migrations/0011_create_sns_queue.sql
apps/worker/migrations/0012_create_sns_log.sql
apps/worker/migrations/0013_create_system_flags.sql
apps/worker/src/routes/sns-queue.ts
apps/worker/src/db/sns-queue.ts
apps/worker/src/db/system-flags.ts
apps/worker/src/__tests__/sns-queue.test.ts
apps/worker/src/__tests__/system-flags.test.ts

apps/web/src/app/admin/sns-queue/page.tsx
apps/web/src/components/sns-queue/QueueDayCard.tsx
apps/web/src/components/sns-queue/QueueItemRow.tsx
apps/web/src/components/sns-queue/KillSwitchPanel.tsx
apps/web/src/components/sns-queue/ArchiveList.tsx
apps/web/src/components/sns-queue/EditDrawer.tsx
apps/web/src/lib/api/sns-queue.ts
apps/web/src/app/admin/sns-queue/__tests__/page.test.tsx
```

### 拡張
```
apps/worker/src/index.ts       # /api/sns-queue/* のマウント
apps/worker/wrangler.toml      # D1 binding（既存）/ 環境変数追記なし
```

---

## 9-5. D Issue #9 CODEX 投入プロンプト（コピペ用）

```
yuki-pj/handoff/agent-outputs/D-issue8-9-threads-autopost.md の
§9 全体（D Issue #9）を実装してください。

リポジトリ: <FOLLOW モノレポ>
ブランチ: feat/sns-queue-d1-and-admin
依存: なし（D #8 はこの PR がマージされた後に着手）

実装範囲:
1. D1 マイグレーション 3本
   - 0011_create_sns_queue.sql
   - 0012_create_sns_log.sql
   - 0013_create_system_flags.sql
   仕様書 §9-1 のスキーマをそのまま起こす。

2. apps/worker/src/db/sns-queue.ts（新規）
   - listUpcoming(env) → 今日・明日の rows
   - listArchive(env, days)
   - getById(env, id)
   - updateContent(env, id, content, contentHash)
   - updateStatus(env, id, status, extra?)
   - insert(env, row)
   - 全関数で updated_at を更新

3. apps/worker/src/db/system-flags.ts（新規）
   - getFlag(env, key) → string | null
   - setFlag(env, key, value, updatedBy)
   - isAutoPostingEnabled(env) → boolean（ヘルパ）
   - setAutoPosting(env, enabled, updatedBy)

4. apps/worker/src/routes/sns-queue.ts（新規）
   仕様書 §9-3-1 の9エンドポイントを実装。
   - 認証: Bearer ADMIN_API_SHARED_SECRET（既存パターン踏襲）
   - レスポンスは §9-3-2 の形式
   - PATCH /:id は E判定の再実行が必要だが、D #8 で実装する e-legal-check.ts が
     まだないので、本PRでは「E判定リセット（verdict=NULL, status='pending'）」だけ行い、
     // TODO(D#8): re-run E legal check ここでコメントを残す

5. apps/worker/src/index.ts に sns-queue ルートをマウント

6. apps/web/src/app/admin/sns-queue/page.tsx + コンポーネント群
   仕様書 §9-2 の通り Tailwind で実装。
   - 既存 requireAdmin() のパターンに合わせて認証
   - 30秒ごとに router.refresh() するクライアントコンポーネント片を含む
   - 編集ドロワー(EditDrawer)は textarea + 保存ボタンのみ（プレビューは v1.1）

7. テスト
   - apps/worker/src/__tests__/sns-queue.test.ts
     - GET /upcoming が today/tomorrow を返す
     - POST /:id/cancel が status を manually_cancelled にする
     - POST /kill-switch が system_flags を更新する
     - 認証なしは 401
   - apps/worker/src/__tests__/system-flags.test.ts
     - setFlag → getFlag が同じ値を返す
     - isAutoPostingEnabled が初期値 true を返す
   - apps/web/src/app/admin/sns-queue/__tests__/page.test.tsx
     - 3スロット表示の DOM 確認（Testing Library）

必須:
- pnpm typecheck PASS（worker + web の両方）
- pnpm test PASS（既存テスト全部 + 新規）
- pnpm lint PASS
- secret/環境変数は wrangler.toml の [vars] / .dev.vars 例にだけ記載、実値は含めない
- PR 本文に
  - マイグレーション適用コマンド（wrangler d1 migrations apply）
  - ローカル動作確認手順（curl 例 3本）
  を必ず記載

非ゴール（このPRに含めない）:
- Threads API 連携 → D #8 で実装
- A による自動生成 → D #8 で実装
- E判定の自動再実行 → D #8 で実装
- F の朝サマリーへの Threads 反応反映 → 別Issue

期待動作（PR レビュー用）:
1. wrangler d1 migrations apply <db>
2. curl で POST /api/sns-queue を3件 INSERT（手動でテストデータ）
3. /admin/sns-queue を開いて3スロット表示される
4. 「キャンセル」ボタン → status='manually_cancelled' に更新
5. 「全停止」ボタン → system_flags.auto_posting_enabled='false'
```

---

# D Issue #8: Threads自動投稿パイプライン

**D #9 マージ後に着手。**

---

## 8-1. Threads Graph API 認証

### 8-1-1. アカウント

- Threads ハンドル: `@kokodake2026`
- 接続: Threads は Instagram と紐づいたメタアカウント、Threads Graph API (v1.0+) を使用
- ドキュメント: `https://developers.facebook.com/docs/threads`

### 8-1-2. 必要な認証情報

| 名前                          | 用途                                  | 取得元                       |
|-------------------------------|---------------------------------------|------------------------------|
| `THREADS_ACCESS_TOKEN`        | 投稿API呼び出し（長期トークン）       | Meta for Developers          |
| `THREADS_USER_ID`             | API path 用ユーザーID（数値）         | 同上                         |
| `THREADS_APP_ID`              | 長期トークン更新時                    | 同上                         |
| `THREADS_APP_SECRET`          | 長期トークン更新時                    | 同上                         |

すべて **`wrangler secret put`** で投入し、wrangler.toml には `[vars]` に**書かない**。
（コード/PRに値を含めない）。

```bash
cd apps/worker
wrangler secret put THREADS_ACCESS_TOKEN
wrangler secret put THREADS_USER_ID
wrangler secret put THREADS_APP_ID
wrangler secret put THREADS_APP_SECRET
```

`apps/worker/src/types/env.d.ts` の `Env` 型に追記：

```ts
export interface Env {
  // ... 既存
  THREADS_ACCESS_TOKEN: string;
  THREADS_USER_ID: string;
  THREADS_APP_ID: string;
  THREADS_APP_SECRET: string;
}
```

### 8-1-3. 長期トークンの自動延長

Threads トークンは60日有効。
週1（日曜04:00 JST = 19:00 UTC 土曜）に refresh エンドポイントを叩く cron を追加：

```
cron: '0 19 * * 6'  # 土19:00 UTC = 日04:00 JST
GET https://graph.threads.net/refresh_access_token
  ?grant_type=th_refresh_token&access_token={current}
→ 新トークンを wrangler KV `kv_runtime` に保持 + system_flags に有効期限ログ
```

> KV bind 名: `KV_RUNTIME`。なければ wrangler.toml に追加。

---

## 8-2. Threads API 呼び出しフロー

Threads API は**2段階投稿**:

1. **メディアコンテナ作成** `POST /{user-id}/threads`
2. **publish** `POST /{user-id}/threads_publish?creation_id={id}`

### 8-2-1. ラッパ関数

ファイル: `apps/worker/src/services/threads-api.ts`（新規）

```ts
export interface ThreadsPublishResult {
  ok: true;
  postId: string;
  publishedAt: string;
}
export interface ThreadsPublishFailure {
  ok: false;
  status: number;
  errorCode?: string;
  errorMessage: string;
  raw?: unknown;
}

export async function publishThreadsTextPost(
  env: Env,
  text: string,
): Promise<ThreadsPublishResult | ThreadsPublishFailure> {
  // 1. create container
  const createRes = await fetch(
    `https://graph.threads.net/v1.0/${env.THREADS_USER_ID}/threads`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        media_type: "TEXT",
        text,
        access_token: env.THREADS_ACCESS_TOKEN,
      }),
    },
  );
  if (!createRes.ok) {
    return mapError(createRes);
  }
  const { id: creationId } = await createRes.json<{ id: string }>();

  // 2. publish（推奨: 30秒待ってから publish、ただし TEXT のみなら不要）
  const pubRes = await fetch(
    `https://graph.threads.net/v1.0/${env.THREADS_USER_ID}/threads_publish`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        creation_id: creationId,
        access_token: env.THREADS_ACCESS_TOKEN,
      }),
    },
  );
  if (!pubRes.ok) {
    return mapError(pubRes);
  }
  const { id: postId } = await pubRes.json<{ id: string }>();
  return { ok: true, postId, publishedAt: new Date().toISOString() };
}
```

エラー時は `error.code` を読んで「再試行可能か」を判定（rate limit / 5xx → 可、4xx → 不可）。

---

## 8-3. 23:00 JST の生成ジョブ

ファイル: `apps/worker/src/cron/threads-generate.ts`（新規）

### 8-3-1. 処理フロー

```
1. 翌日(JST)の日付を計算
2. 既に sns_queue にその日付の3件が status IN ('scheduled','posted','posting')
   で全部入っているなら skip（再実行安全）
3. Aエージェントへ3投稿分のテーマで依頼
   - morning: 教育・実践（薬剤・頭皮・季節）
   - noon: 共感・コア訴求（気になるところだけ／月880円）
   - night: 哲学・利用者の声・呼びかけ
4. 各投稿に対してE判定（services/e-legal-check.ts）
5. status を決定:
   - OK → 'scheduled'
   - NEEDS_FIX / NG → 'legal_blocked'（自動投稿しない、画面で見える）
6. sns_queue に upsert（UNIQUE 索引でぶつかったら UPDATE）
7. 管理者LINEに「明日の3投稿サマリー」Flex（§8-5）push
```

### 8-3-2. A生成の入口

ファイル: `apps/worker/src/services/sns-generator.ts`（新規）

```ts
export type SnsSlot = "morning" | "noon" | "night";
export interface SnsDraft { slot: SnsSlot; content: string; }

export async function generateThreadsDayDrafts(
  env: Env,
  forDateJst: string,           // 'YYYY-MM-DD'
): Promise<SnsDraft[]> {
  // 内部実装: Anthropic / OpenAI 等 LLM 呼び出し
  // モデル選定はパラメータ化（env.LLM_MODEL）
  // システムプロンプトは POSITIONING-FINAL.md §11 と
  //   SNS-STRATEGY-FINAL.md §4-3 の slot 別配分を埋め込む
}
```

LLM の API キーは `wrangler secret put LLM_API_KEY`。
**※具体的な LLM 選定（Claude/GPT/Gemini）は別Issueで決定。本Issueでは関数のインターフェースだけ確定、
中身は `// TODO(A-llm-binding): replace with real LLM call` でモック実装し、
モック値で全パイプラインのテストが通るようにする。**

### 8-3-3. E判定の入口

ファイル: `apps/worker/src/services/e-legal-check.ts`（新規）

```ts
export type LegalVerdict = "OK" | "NEEDS_FIX" | "NG";
export interface LegalCheckResult {
  verdict: LegalVerdict;
  reasons: Array<{
    location: string;       // 行番号や該当語
    rule: string;           // チェックリスト項目
    severity: "warn" | "block";
    suggestion?: string;
  }>;
}

export async function checkLegal(
  env: Env,
  content: string,
  context: { slot: SnsSlot; channel: "threads" },
): Promise<LegalCheckResult>;
```

実装:
1. **ルールベース1段目**（正規表現） `apps/worker/src/services/legal-rules.ts`
   - E-legal-checklist-prompt.md §2-3 の NG→OK 表、§2-1 薬機法ワード、§2-2 断定表現
   - これでヒットしたら即 `NG` または `NEEDS_FIX`
2. **LLM 2段目**（1段目が pass の場合のみ）
   - E-legal-checklist-prompt.md §1 のテンプレを system prompt にして判定
   - 返り値 JSON を `LegalCheckResult` にパース

→ 1段目で確実な違反を除去 → LLM コスト削減 + 検知品質安定。

---

## 8-4. 投稿 cron（07:30 / 12:30 / 21:00 JST）

ファイル: `apps/worker/src/cron/threads-publish.ts`（新規）

### 8-4-1. 共通ハンドラ

```ts
export async function runPublishSlot(env: Env, slot: SnsSlot): Promise<void> {
  // 1. 緊急停止フラグチェック
  if (!(await isAutoPostingEnabled(env))) {
    await logSns(env, { event: "skipped_kill_switch", detail: { slot } });
    return;
  }

  // 2. 今日の該当 slot を取得
  const todayJst = formatJstDate(new Date());
  const row = await findSlotRow(env, { dateJst: todayJst, slot });
  if (!row || row.status !== "scheduled") {
    await logSns(env, { event: "skipped_no_row", detail: { slot, status: row?.status } });
    return;
  }

  // 3. 二重投稿防止: status を 'posting' に CAS
  const claimed = await casStatus(env, row.id, "scheduled", "posting");
  if (!claimed) return;

  // 4. 投稿
  const result = await publishThreadsTextPost(env, row.content);
  if (result.ok) {
    await updateStatus(env, row.id, "posted", {
      posted_at: result.publishedAt,
      threads_post_id: result.postId,
      error_message: null,
    });
    await logSns(env, { event: "posted", queue_id: row.id });
    return;
  }

  // 5. 失敗処理
  const newRetry = row.retry_count + 1;
  const isRetryable = result.status >= 500 || result.errorCode === "RATE_LIMIT";
  await updateStatus(env, row.id, isRetryable && newRetry < 3 ? "scheduled" : "failed", {
    retry_count: newRetry,
    error_message: result.errorMessage,
  });
  await logSns(env, { event: "failed", queue_id: row.id, detail: result });

  // 6. 3回連続失敗 → 全停止
  if (await consecutiveFailuresGte(env, 3)) {
    await setAutoPosting(env, false, "system:auto_stop_3_failures");
    await updateAllScheduledTo(env, "auto_stopped");
    await pushAdminEmergencyLine(env, "🚨 Threads投稿が3回連続失敗のため自動停止しました。");
  }
}
```

### 8-4-2. `scheduled` ハンドラ分岐

`apps/worker/src/index.ts` の `scheduled(event)`:

```ts
export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil((async () => {
      switch (event.cron) {
        case "30 22 * * *": return runPublishSlot(env, "morning");
        case "30 3 * * *":  return runPublishSlot(env, "noon");
        case "0 12 * * *":  return runPublishSlot(env, "night");
        case "0 14 * * *":  return runGenerateNextDay(env);
        case "0 19 * * 6":  return refreshThreadsToken(env);
        // ... 既存 cron は維持
      }
    })());
  },
};
```

---

## 8-5. 管理者LINE：「明日の3投稿サマリー」Flex

ファイル: `apps/worker/src/lib/flex-templates.ts` に `createTomorrowThreadsSummaryCard()` を追加。

スタイル: F-morning-summary-flex-spec.md と同じ Bubble (mega) 設計、エージェントカラーは **A の `#0E8A16`**（緑）。

中身:
- ヘッダ: `[A] 明日のThreads自動投稿サマリー 2026-06-20`
- ボディ: 3スロット each
  - 時刻 / slot / E判定（OK/NEEDS_FIX/NG）
  - 本文プレビュー(最大80字)
- フッタボタン:
  - 「管理画面で見る」 uri → `/admin/sns-queue`
  - 「全部停止」 postback `act=stop_auto_posting`
  - 「OK そのまま」 postback `act=approve_tomorrow`

NEEDS_FIX / NG があるときは Header 背景を `#FBCA04`（warn）に切替。3件中2件以上 NG なら `#B60205`（critical）。

push は既存 `pushAdmin()` を使用。

---

## 8-6. 緊急停止フラグ（管理者LINEコマンド）

ファイル: `apps/worker/src/routes/admin-bot/webhook.ts`（拡張）

text message ハンドラに以下を追加：

```ts
const text = message.text.trim();

if (text === "stop_auto_posting") {
  await setAutoPosting(env, false, `admin_line:${userId}`);
  await updateAllScheduledTo(env, "manually_cancelled");
  return replyText(replyToken, "🛑 SNS自動投稿を全停止しました。scheduled は全て取消。");
}
if (text === "resume_auto_posting") {
  await setAutoPosting(env, true, `admin_line:${userId}`);
  return replyText(replyToken, "▶ SNS自動投稿を再開しました。次回 23:00 の生成から動きます。");
}
if (text === "status_auto_posting") {
  const enabled = await isAutoPostingEnabled(env);
  return replyText(replyToken, enabled ? "🟢 稼働中" : "🛑 停止中");
}
```

「5分以内に有効化」要件 → cron 起動時に毎回 `isAutoPostingEnabled()` を読むので、
最悪でも次の cron 実行（最短：12:30 JST など）で停止が反映される。
**より厳密には、`stop_auto_posting` を受けた瞬間に `posting` 状態の行があれば、
KV 経由のソフトキャンセル**は v1.1 で対応（v1 は cron 単位の停止で OK）。

postback `act=stop_auto_posting` も同じハンドラを呼ぶ。

---

## 8-7. リトライ・エラーハンドリング詳細

### 8-7-1. 1リクエスト内のリトライ

Threads API 5xx / rate limit → そのジョブ内では**リトライしない**（次の cron で拾う）。
これによりタイムアウト・課金リスクを抑える。

### 8-7-2. 連続失敗での自動停止

`sns_log` から「直近3件の event='failed' が連続している」かをクエリで判定：

```sql
SELECT COUNT(*) AS cnt FROM (
  SELECT event FROM sns_log
  WHERE event IN ('posted','failed')
  ORDER BY occurred_at DESC LIMIT 3
) WHERE event = 'failed';
-- → 3 なら自動停止
```

### 8-7-3. E判定失敗のフォールバック

LLM がエラーで返ってきたら `verdict='NEEDS_FIX'` 扱い（安全側に倒す）→ 自動投稿しない。
管理者LINEのサマリーには「⚠ E判定エラー、本文確認後手動投稿してください」と表示。

### 8-7-4. レート制限への配慮

Threads API: 1日 250 投稿（公式）。
FOLLOWは 1日3投稿なので99%余裕。ただし将来 HEJ を追加した時のため、
publish 呼び出し前に **同一 `THREADS_USER_ID` での当日 posted 件数 < 200** を guard。

---

## 8-8. ファイル構成（D #8 新規/拡張）

### 新規
```
apps/worker/src/cron/threads-generate.ts
apps/worker/src/cron/threads-publish.ts
apps/worker/src/cron/threads-refresh-token.ts
apps/worker/src/services/threads-api.ts
apps/worker/src/services/sns-generator.ts
apps/worker/src/services/e-legal-check.ts
apps/worker/src/services/legal-rules.ts
apps/worker/src/services/admin-line-push.ts  # pushAdminEmergencyLine() の薄ラッパ（既存があれば再利用）
apps/worker/src/lib/jst.ts                    # JST 日付・slot 計算ユーティリティ
apps/worker/src/__tests__/threads-publish.test.ts
apps/worker/src/__tests__/threads-generate.test.ts
apps/worker/src/__tests__/legal-rules.test.ts
apps/worker/src/__tests__/e-legal-check.test.ts
apps/worker/src/__tests__/jst.test.ts
```

### 拡張
```
apps/worker/src/index.ts                # scheduled() に cron 分岐追加
apps/worker/src/lib/flex-templates.ts    # createTomorrowThreadsSummaryCard() 追加
apps/worker/src/routes/admin-bot/webhook.ts  # 3コマンド + 2 postback 追加
apps/worker/src/routes/sns-queue.ts      # PATCH /:id の // TODO(D#8) を解消（E再判定実装）
apps/worker/src/types/env.d.ts           # THREADS_* / LLM_* / KV_RUNTIME 追記
apps/worker/wrangler.toml                # crons / KV binding 追記（secret は別投入）
```

---

## 8-9. テスト方針

### 8-9-1. ユニットテスト

| ファイル                              | 対象                                                              |
|---------------------------------------|-------------------------------------------------------------------|
| `jst.test.ts`                         | UTC ↔ JST 変換、slot 判定、Cron 文字列との対応                    |
| `legal-rules.test.ts`                 | 「絶対染まる」「白髪が消える」「全額返金」等 NG 表現が `NG` 判定 |
| `e-legal-check.test.ts`               | LLM モック差し込みで OK/NEEDS_FIX/NG の3 verdict が返ることを確認 |
| `threads-publish.test.ts`             | fetch モックで 200 → posted、500 → failed+retry、3連続 → auto_stop |
| `threads-generate.test.ts`            | 同日に3件入ってたら skip、E判定 NG なら status='legal_blocked'    |

### 8-9-2. 統合テスト（Miniflare）

`apps/worker/src/__tests__/integration/threads-pipeline.test.ts`（新規）：

1. D1 in-memory に 0011〜0013 マイグレーション apply
2. `runGenerateNextDay()` を呼び、sns_queue に3件入ることを確認
3. `runPublishSlot(env, "morning")` を呼び、fetch をモックして posted になることを確認
4. 緊急停止フラグを false にして `runPublishSlot` を呼ぶと skip されることを確認

### 8-9-3. 既存テストへの非干渉

- 既存 `apps/worker/src/__tests__/*` を破壊しないこと
- 特に既存の cron ハンドラ（朝サマリー 07:15 等）が壊れていないこと

### 8-9-4. 手動E2E（PRレビュー時）

- `wrangler dev` 起動 + ローカル D1
- `curl localhost:8787/__debug/threads/generate?date=2026-06-20`（debug ルートを足す）
- `/admin/sns-queue` で3件確認
- `curl localhost:8787/__debug/threads/publish?slot=morning` → posted 表示
- 管理者LINEに Flex 届く（dev環境用にダミー LINE Channel）

---

## 8-10. D Issue #8 CODEX 投入プロンプト（コピペ用）

```
yuki-pj/handoff/agent-outputs/D-issue8-9-threads-autopost.md の §8 全体
(D Issue #8) を実装してください。

リポジトリ: <FOLLOW モノレポ>
ブランチ: feat/threads-autopost-pipeline
前提: D Issue #9 (feat/sns-queue-d1-and-admin) が main にマージ済みであること

実装範囲:
1. 環境変数追加（wrangler.toml の [vars] には書かず、secret put で投入する旨を README に追記）
   - THREADS_ACCESS_TOKEN
   - THREADS_USER_ID
   - THREADS_APP_ID
   - THREADS_APP_SECRET
   - LLM_API_KEY
   - LLM_MODEL（[vars] に書いて可）
   apps/worker/src/types/env.d.ts に追加。

2. apps/worker/src/lib/jst.ts（新規）
   - toJstDate(d: Date): string  // 'YYYY-MM-DD'
   - jstSlotFromCron(cron: string): SnsSlot | null
   - scheduledAtForSlot(dateJst: string, slot: SnsSlot): string  // ISO UTC
   - tomorrowJst(now: Date): string
   テストで 23:59 JST のエッジ含めて検証。

3. apps/worker/src/services/threads-api.ts（新規）
   仕様書 §8-2-1 の publishThreadsTextPost を実装。
   - 2段階POST（create container → publish）
   - エラーは ThreadsPublishFailure で返す（throw しない）
   - リトライ判定: status >= 500 or errorCode in ['RATE_LIMIT','TEMPORARY_FAILURE']
   別ファイルで refreshThreadsAccessToken も実装（KV に保存）。

4. apps/worker/src/services/legal-rules.ts（新規）
   E-legal-checklist-prompt.md §2-1, §2-3 から正規表現ベースの
   1段目ルールを実装。NG/NEEDS_FIX の reasons を返す。

5. apps/worker/src/services/e-legal-check.ts（新規）
   - checkLegal(env, content, context)
   - 1段目 legal-rules.ts → 何か当たれば即 NG/NEEDS_FIX
   - 2段目 LLM 呼び出し（E-legal-checklist-prompt.md §1 のテンプレを
     systemプロンプトに埋め込み、判定対象を user メッセージで渡す）
   - LLM 失敗時は verdict='NEEDS_FIX', reasons=[{rule:'llm_error',...}]

6. apps/worker/src/services/sns-generator.ts（新規）
   - generateThreadsDayDrafts(env, forDateJst) → [morning, noon, night]
   - 中身は LLM 呼び出し（SNS-STRATEGY-FINAL.md §4-3 + POSITIONING-FINAL.md §11 を
     systemに埋め込む）
   - 本PRではモック実装でOK、ただし LLM呼び出しの I/F は確定させる
   - // TODO(A-llm-binding): replace mock with real LLM call コメントを残す

7. apps/worker/src/cron/threads-generate.ts（新規）
   仕様書 §8-3-1 のフローを実装。
   - 既に3件入っていたら skip
   - 各 draft に対し checkLegal を実行
   - sns_queue に upsert
   - 全件 status 決定後、createTomorrowThreadsSummaryCard を作って pushAdmin

8. apps/worker/src/cron/threads-publish.ts（新規）
   仕様書 §8-4-1 の runPublishSlot を実装。
   - 緊急停止フラグチェック
   - CAS (compare-and-set) で status を 'scheduled' → 'posting'
   - publishThreadsTextPost
   - 失敗 + retry_count >= 3 or 非リトライ可 → 'failed'
   - 直近3件連続 failed → 全停止 + 管理者LINE通知

9. apps/worker/src/cron/threads-refresh-token.ts（新規）
   - 週次でThreadsトークン延長
   - 新トークンは KV_RUNTIME に保存、env.THREADS_ACCESS_TOKEN は wrangler secret から
     優先度: KV > env（KV にあれば KV を採用）

10. apps/worker/src/index.ts の scheduled() に分岐追加（既存 cron は壊さない）

11. apps/worker/src/lib/flex-templates.ts に
    createTomorrowThreadsSummaryCard(stats: TomorrowThreadsSummary): FlexMessage を追加。
    F-morning-summary-flex-spec.md の構造に揃え、エージェントカラーは A の #0E8A16。

12. apps/worker/src/routes/admin-bot/webhook.ts 拡張
    - text: 'stop_auto_posting' / 'resume_auto_posting' / 'status_auto_posting'
    - postback: act=stop_auto_posting / act=approve_tomorrow

13. apps/worker/src/routes/sns-queue.ts の PATCH /:id を
    「content 更新 → checkLegal 再実行 → status 決定」に置き換える
    （D #9 の // TODO(D#8) を解消）

14. wrangler.toml の [triggers].crons に4本追加（既存維持）
    "30 22 * * *", "30 3 * * *", "0 12 * * *", "0 14 * * *", "0 19 * * 6"

15. テスト
    仕様書 §8-9 のユニット + 統合テスト全部。
    既存テストを壊さないこと。fetch / D1 / KV は Miniflare のモックで。

必須:
- pnpm typecheck PASS
- pnpm test PASS
- pnpm lint PASS
- secret は wrangler secret put で投入する手順を README.md か PR本文に明記、
  実値はコミットしない。.dev.vars.example だけ追加してOK
- PR 本文に「マイグレーション/Secret 投入/Cron 確認」の3本柱の手順を必ず記載

非ゴール:
- A の LLM 実装は別Issue（本PRはモック）
- 画像/動画投稿（v1はTEXTのみ）
- Threads 反応(views/likes)取得 → 別Issue
- Instagram / HEJ アカウントの追加 → 別Issue

期待動作:
1. wrangler deploy 後、UTC 14:00 に sns_queue に翌日3件が入る
2. 管理者LINEに「明日の3投稿サマリー」Flex が届く
3. UTC 22:30 / 03:30 / 12:00 に Threads へ自動投稿される
4. 投稿失敗（fetch を 500 で返すモック）で retry_count が増える
5. 3連続失敗で自動停止 + 管理者LINEに通知
6. 管理者LINEで「stop_auto_posting」と打つと即停止
7. /admin/sns-queue が posted/scheduled/legal_blocked を正しく表示

PR テンプレ（本文に含める）:
## Setup（マージ後の運用手順）
1. wrangler secret put THREADS_ACCESS_TOKEN（他3つも）
2. wrangler secret put LLM_API_KEY
3. wrangler d1 migrations apply <db>（D#9 でやっていれば不要）
4. wrangler deploy
5. 初回手動トリガ: curl POST /__debug/threads/generate?date=YYYY-MM-DD
6. /admin/sns-queue で3件確認 → 管理者LINEで「status_auto_posting」→ 🟢
```

---

## 9. 安全策まとめ（必須遵守）

1. **E法務NG/NEEDS_FIX の投稿は絶対に Threads へ送らない**
   - パイプライン側で `status='scheduled'` でない行は publish 関数を呼ばない
   - publish 関数の冒頭で「これは E OK か」を1回再 assert
2. **23:00 生成後、毎晩管理者LINEに翌日3投稿サマリー push**
   - 8時間以上の事前確認時間 → 管理画面で内容を見て、ヤバければキャンセル可能
3. **緊急停止は5分以内に有効化**
   - 全 cron 関数の冒頭で `isAutoPostingEnabled()` を読み、false なら return
   - LINE 「stop_auto_posting」で即停止 + scheduled の行を一括 cancel
4. **Meta API レート制限への配慮**
   - 1日3投稿 << 250投稿、ただし HEJ 拡張時のため当日 posted カウンタで guard
5. **secret は wrangler secret only**
   - PR / コミット / wrangler.toml に値を書かない
   - `.dev.vars.example` だけ追加（dummy値）
6. **既存テスト破壊禁止**
   - 既存 cron（07:15 朝サマリー）の cron 文字列はそのまま、追加だけ
7. **重複投稿防止**
   - sns_queue に UNIQUE (account, channel, slot, date)
   - publish 前に CAS で `scheduled→posting` 遷移、失敗したら何もしない

---

## 10. v1.1 以降の拡張候補

- Threads 反応(views/likes/replies) 取得 cron（朝7:00 JST）→ sns_queue.metrics 更新 → F の朝サマリーへ
- Instagram Feed 自動投稿（同じ schema を流用、channel='instagram'）
- HEJ アカウントの追加（account='hej'、generator のシステムプロンプトを切替）
- 画像生成（カラー知識図解）→ media_type='IMAGE' で投稿
- 「失敗時の代替投稿」プール（過去の posted の中から再投稿）
- ABテスト（同じテーマで2案生成、エンゲージメント上位を翌週採用）

---

## 11. ユーザー承認事項

- [ ] Cron 時刻 07:30/12:30/21:00 JST でOK？
- [ ] 生成時刻 23:00 JST でOK？（事前確認のため早朝より夜が良いはず）
- [ ] LINE コマンド `stop_auto_posting` / `resume_auto_posting` / `status_auto_posting` の3つでOK？
- [ ] E判定で `NEEDS_FIX` も自動投稿しない方針でOK？（厳しすぎなければ）
- [ ] LLM 選定（Claude / GPT / Gemini）は別Issueで決めるが、本Issueはモックで進めて良い？
- [ ] Threads トークン60日延長を週次 cron で自動化する方針でOK？
- [ ] D #9 を先に PR → マージ → D #8 の順で進めて良い？

---

## 12. CODEX 投入順序（運用）

```
Day 1 朝   ─ D #9 を起票 + CODEX投入（プロンプト §9-5）
Day 1 夜   ─ D #9 PR レビュー + マージ
Day 2 朝   ─ D #8 を起票 + CODEX投入（プロンプト §8-10）
Day 2 夜   ─ D #8 PR レビュー
Day 3      ─ secret 投入 + 本番 deploy + 初回手動生成テスト
Day 4      ─ 自動運用開始（23:00 生成 → 翌07:30 から投稿）
```

---

## 13. 関連ドキュメント

- SNS-STRATEGY-FINAL.md §4（自動化仕様の根拠）
- POSITIONING-FINAL.md §11（7コアメッセージ、生成系の判定基準）
- E-legal-checklist-prompt.md（E判定の中身）
- D-issue6-flex-message-prompt.md（Flex Message実装スタイル）
- F-morning-summary-flex-spec.md（Flex / cron 設計参考）
- D-code-tasks-batch1.md（D Issue 一覧、本ファイルで #8/#9 を上書き）
