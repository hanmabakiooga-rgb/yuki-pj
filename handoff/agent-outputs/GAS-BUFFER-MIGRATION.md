# GAS BufferClient.gs 切替指示書（CODEX投入用）

作成日: 2026-06-21
位置づけ: ThreadsClient.gs → BufferClient.gs への置換
理由: Threads API 直接実装が認証で詰まったため、SaaS（Buffer）経由に切替

---

## 切替の背景

- Threads API 直接は Meta側のテスター招待・承諾フローが不安定
- Buffer は商用SaaS、認証管理を Buffer 側に委譲できる
- Buffer 月額$5 = ¥750/月（広告予算3万円の2.5%）
- 設計の9割（Sheets/Analytics/Calendar/Dashboard/Scheduler/A生成/E法務）はそのまま流用

---

## 影響範囲（変更すべきファイル）

### 完全に書き換え
- `ThreadsClient.gs` → 廃止
- `BufferClient.gs` → 新規作成（このドキュメントの§5に完全コード）

### 微修正
- `Main.gs`：`checkAndPost()` 内で `ThreadsClient.publish()` → `BufferClient.publish()`
- `ImpressionFetcher.gs`：Insights取得を Buffer API に変更
- `Config.gs`：Buffer用の定数追加、Threads用は残しても良い（コメントアウトでOK）
- `TokenManager.gs`：廃止（Bufferが管理）。setupAllTriggers で関連 trigger も削除

### 保持
- `ContentGenerator.gs`
- `LegalCheck.gs`
- `Scheduler.gs`（時刻ランダム化版そのまま）
- `KillSwitch.gs`
- `Notifier.gs`
- `Logger.gs`
- `Analytics.gs`
- `Knowledge.gs`
- `Calendar.gs`
- `WebApp.gs` / `WebAppHtml.html`
- `Dashboard.gs`

---

## 新しいScript Properties

| キー | 値 | 取得先 |
|---|---|---|
| `BUFFER_ACCESS_TOKEN` | Buffer Personal Access Token | https://buffer.com/developers/apps |
| `BUFFER_CHANNEL_ID_FOLLOW` | @kokodake2026 の Channel ID | Buffer dashboard URL から |

廃止する Script Properties（残しても害なし）：
- `THREADS_ACCESS_TOKEN`
- `THREADS_APP_SECRET`
- `THREADS_USER_ID`
- `META_APP_ID`

---

## Buffer API 仕様サマリ

### 認証
```
Authorization: Bearer {BUFFER_ACCESS_TOKEN}
```

### 主要エンドポイント（v1 / 安定版）

| 用途 | メソッド | URL |
|---|---|---|
| 投稿予約作成 | POST | `https://api.bufferapp.com/1/updates/create.json` |
| 投稿の取得 | GET | `https://api.bufferapp.com/1/updates/{update_id}.json` |
| 投稿のインサイト | GET | `https://api.bufferapp.com/1/updates/{update_id}/interactions.json` |
| プロファイル一覧 | GET | `https://api.bufferapp.com/1/profiles.json` |
| 予約キューの取得 | GET | `https://api.bufferapp.com/1/profiles/{profile_id}/updates/pending.json` |
| 投稿削除 | POST | `https://api.bufferapp.com/1/updates/{update_id}/destroy.json` |

### 投稿予約のリクエスト例

```
POST https://api.bufferapp.com/1/updates/create.json
Authorization: Bearer {token}
Content-Type: application/x-www-form-urlencoded

profile_ids[]={channel_id}
text=投稿本文
scheduled_at=1718956200  ← Unix timestamp(秒)
```

### 投稿予約のレスポンス例

```json
{
  "success": true,
  "buffer_count": 1,
  "buffer_percentage": 75,
  "updates": [{
    "_id": "60ab1234567890",
    "profile_id": "5fc1234567890",
    "status": "buffer",
    "scheduled_at": 1718956200,
    "text": "..."
  }]
}
```

注意: Buffer の `_id` は MongoDB ObjectId 形式。これを `threads_post_id` カラムに保存。

### インサイト取得

投稿後一定時間経つと、`/interactions.json` で以下が取れる：
- `views`（インプレッション相当）
- `likes`
- `replies`
- `reshares`

Threads の native インサイトAPIと項目が異なる可能性がある。CODEXが実装時に最新仕様確認すること。

---

## BufferClient.gs 完全コード（CODEXに書かせる骨格）

CODEXに以下プロンプトを投げる：

```
hanmabakiooga-rgb/yuki-pj の以下指示書に従って、
gas-autopost リポジトリの ThreadsClient.gs を BufferClient.gs に置換してください：

https://raw.githubusercontent.com/hanmabakiooga-rgb/yuki-pj/claude/blissful-lovelace-jcQoP/handoff/agent-outputs/GAS-BUFFER-MIGRATION.md

タスク:
1. BufferClient.gs を新規作成（§以下の関数を実装）：
   - publish(content, scheduledAt) → Buffer に投稿予約、updateId を返す
   - getInsights(updateId) → views/likes/replies/reshares を返す
   - cancelUpdate(updateId) → 予約キャンセル
   - getChannelHealth() → Channel が接続中か確認
   - すべて Bearer Token 認証

2. Main.gs の checkAndPost() を修正：
   - ThreadsClient.publish() → BufferClient.publish() に置換
   - 戻り値の updateId を sns_queue の threads_post_id 列に保存
     （列名は threads_post_id のまま、内部値は Buffer の _id）

3. ImpressionFetcher.gs を修正：
   - Threads Insights API → Buffer interactions.json に置換
   - 列マッピング: views→views, likes→likes, replies→replies, reshares→reshares

4. Config.gs を修正：
   - Buffer 用の定数追加（API URL、ChannelID キー名）
   - Threads 用定数は #archived としてコメント保持

5. TokenManager.gs：
   - 中身を空にして「Buffer 切替により無効化」とコメント
   - 関連する Trigger（トークン延長 Sunday 02:00）を Scheduler.gs から削除

6. README_SETUP.md を更新：
   - Buffer の Script Properties 投入手順を追記
   - Threads 用手順は ## アーカイブ セクションへ移動

実装上の注意:
- Buffer API v1 を使う（安定版、廃止予定なし）
- リトライ: 5xx と429（レート制限）で指数バックオフ3回
- HTTPステータス4xx は再試行せず、ログに残して管理者通知
- すべての API呼び出しに try/catch、Logger.log() でレスポンス記録
- レート制限: Buffer Free=10/day, Essentials=100/day, Team=2000/day
  → 3投稿/日 × 1アカウントなら Essentials で十分

検証:
- node --check で構文確認
- リポジトリ直push、ブランチ feat/buffer-migration、Draft PR 作成

ブランチ: feat/buffer-migration
PR タイトル: feat(client): migrate from Threads API direct to Buffer
PR 本文: 変更ファイル一覧、新規Script Properties、レート制限の留意点
```

---

## ユーザー作業手順（Bufferアカウント側）

### 1. @kokodake2026 を Buffer に接続
1. https://publish.buffer.com/ ログイン
2. 「Channels」→「Connect Channel」→「Threads」
3. @kokodake2026 でログイン → 権限付与

### 2. Channel ID を控える
- Buffer ダッシュボードで @kokodake2026 のページURLから取得
- 形式: `https://publish.buffer.com/channels/【ここ】/queue`

### 3. Buffer API Personal Access Token を取得
- https://buffer.com/developers/apps
- 「Create an App」または既存アプリ
- Access Token を発行・コピー

### 4. GAS Script Properties に投入
- `BUFFER_ACCESS_TOKEN`
- `BUFFER_CHANNEL_ID_FOLLOW`

### 5. CODEX のPRをマージ後、GASに貼り直し
- BufferClient.gs を新規作成（CODEX出力をペースト）
- Main.gs / ImpressionFetcher.gs / Config.gs / TokenManager.gs を更新

### 6. テスト投稿
GASで `testBufferConnection()` 関数を実行 → 接続確認
GASで `testDryRun()` で投稿フロー確認

---

## レート制限の考慮

| Bufferプラン | 月額 | 投稿予約上限/日 | FOLLOW 必要数（3/日）|
|---|---|---|---|
| Free | $0 | 10 | OK 余裕 |
| Essentials | $5 | 100 | OK 圧倒的余裕 |
| Team | $10 | 2,000 | OK 不要 |

**推奨: Essentials（$5/月）。** Free でも始められるが、テスト＋本番で20投稿/日くらいいくのでEssentialsが安全。

---

## 想定される質問

### Q. Buffer 経由だとリアルタイム性は？
A. Buffer は予約を **scheduled_at の指定秒で実行**。±1分以内の精度。実用上問題なし。

### Q. インサイトのリアルタイム性は？
A. Buffer は Threads から定期的にメトリクスを取得して保持。Threads のリアルタイム数値からは数分〜数十分遅れる可能性がある。日次集計には影響なし。

### Q. Threadsから直接の自動投稿バッジ「Threads」ではなく「Buffer」と表示される？
A. 表示は変わらない可能性が高い（Buffer は API 経由でユーザーの権限で投稿するため）。気になる場合は Buffer の Twitter Manager Settings を確認。

### Q. Threads 公式に「Buffer 経由は禁止」と書かれてない？
A. 書かれていない。Threads は公式APIを通じた第三者ツール経由の投稿を明示的に許可している。Buffer は公式パートナーリストに記載あり。

### Q. 後でThreads API直接に戻したい場合は？
A. このドキュメントの逆順を辿ればOK。ThreadsClient.gs は Config.gs にコメントアウトで保持しておく方針。

---

## 完了確認

- [ ] Buffer 契約済（あなた、完了済）
- [ ] @kokodake2026 を Buffer に接続
- [ ] Channel ID 控えた
- [ ] Buffer Access Token 取得
- [ ] GAS Script Properties に投入
- [ ] CODEX で BufferClient.gs PR作成
- [ ] PR レビュー & マージ
- [ ] GASエディタにコード反映
- [ ] testBufferConnection() OK
- [ ] testDryRun() OK
- [ ] 翌日朝7:30過ぎに「✅ 朝の投稿完了」LINE通知が届く

完了したら **完全自動化稼働中** となります。
