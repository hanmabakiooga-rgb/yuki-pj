# D実働：コードタスクIssue原案（バッチ1）

実行: エージェントD（コード）
作成日: 2026-06-10
状態: line-harness-oss へ起票する Issue 原案（CODEX に投げる）

POSITIONING-FINAL.md 確定を受けて、リポジトリ実装の優先度を再整理。

---

## Issue #1：LP のメッセージ全面リライト

### タイトル
`feat(lp): rewrite LP to align with POSITIONING-FINAL.md (partial coloring + pro products + scalp care + 20yr authority)`

### 本文
```markdown
## 目的
POSITIONING-FINAL.md（yuki-pj/handoff/POSITIONING-FINAL.md 参照）の確定版に合わせて、LPの全コピーをリライト。

## 必須要素
1. ファーストビュー：「気になるところだけ」を主訴求に
2. 川崎さん権威性セクション（20年/何万人/大阪専門店/海外経験/現役/ハイデザイン）
3. プロ用商材セクション（市販品との違い）
4. 頭皮ケア継続伴走セクション
5. 「染めない美容師との違い」セクション
6. 月880円・解約自由・商材任意 を明示
7. 川崎さん紹介を信頼指標として上部に配置

## 削除すべき要素
- 「染まります」「100%」「保証」「安心」「安全」の断定
- 「美容室不要」表現
- 既存の v1 文言で薬機法スレスレのもの

## 関連
- 既存LP：apps/web/src/app/(public)/page.tsx
- 参照：yuki-pj/handoff/POSITIONING-FINAL.md
- ラベル：code-task, agent-D, priority-high
```

---

## Issue #2：顧客LINE Bot 自動応答1通目を権威性付きに更新

### タイトル
`feat(bot): update first auto-reply to include kawasaki credentials`

### 本文
```markdown
## 目的
LINE登録直後の自動応答1通目に、川崎さんの権威性（20年/大阪専門店）を冒頭に入れて信頼形成を早める。

## 変更
- 既存：「FOLLOWご登録ありがとうございます。このアカウントは現役カラーリストの川崎が...」
- 新：「FOLLOWへようこそ。現役カラーリスト20年、大阪のカラー専門店経営の川崎です。」
- 以降は既存の流れ（カウンセリングフォームへ誘導）

## ファイル
- apps/worker/src/services/follow-handler.ts（カウンセリング応答ロジック）

## ラベル：code-task, agent-D, priority-high
```

---

## Issue #3：ビフォーアフター画像 同意書テンプレ追加

### タイトル
`feat(consent): add before-after photo consent template for ad/SNS use`

### 本文
```markdown
## 目的
広告台本3本（C-ad-scripts-batch1-v2.md）および SNS の Reels/note でビフォーアフター画像を使う際、本人同意を電子取得するテンプレを実装。

## 必須項目
- 撮影目的の説明（広告/SNS/note 個別 or 包括）
- 利用範囲・期間
- 削除請求の連絡先
- 改変禁止条項
- 同意撤回手順

## ファイル
- apps/worker/src/routes/photo-consent.ts（新規）
- apps/worker/src/client/photo-consent-form.ts（新規）
- 既存の同意書v1とは別ルートで運用

## ラベル：code-task, agent-D, priority-medium
```

---

## Issue #4：管理画面に「アフィリエイト商材リンク」管理ページ

### タイトル
`feat(admin): affiliate product link manager page`

### 本文
```markdown
## 目的
川崎さんがアフィリエイト先商材のURL・コミッション情報を管理し、LP/Bot/SNSから動線生成する管理画面ページ。

## 機能
- 商材登録（名前・URL・カテゴリ・コミッション率）
- 顧客LINEで自動生成される推奨リンクのプレビュー
- クリック計測（UTMパラメータ自動付与）
- 月次レポート（クリック数・推定収益）

## ファイル
- apps/web/src/app/admin/products/page.tsx（新規）
- packages/db/schema.sql に affiliate_products テーブル

## ラベル：code-task, agent-D, priority-medium
```

---

## Issue #5：F分析用 KPI集計 cron

### タイトル
`feat(cron): daily KPI aggregation to Google Sheets`

### 本文
```markdown
## 目的
F（分析）が朝7時に前日数値を読みに行けるよう、D1から Google Sheets `FOLLOW-KPI` に日次集計を Push。

## 集計内容
- 前日のLP訪問数（Cloudflare Web Analytics API）
- 前日のLINE登録数
- 前日のカウンセリング完了数
- 前日の初回課金数
- 前月末時点のサブスク累計
- 解約数

## ファイル
- apps/worker/src/cron.ts（新規）
- apps/worker/src/services/sheets-sync.ts（新規）
- wrangler.toml に cron triggers 追加（毎日6:50 JST）

## ラベル：code-task, agent-D, priority-medium
```

---

## Issue #6：管理者通知Bot Flex Message実装

### タイトル
`feat(admin-notify): implement approval card Flex Message sender + postback handler`

### 本文
```markdown
## 目的
APPROVAL-FLEX-SPEC.md（yuki-pj/handoff/）の仕様で、管理者LINEに承認カードを送信し、ボタン操作からGitHub Issueのラベル更新まで自動化。

## 実装範囲（MVPはapprove/rejectのみ）
- Flex JSON テンプレ関数（agent別カラー）
- /api/admin-notify/flex エンドポイント（Issue番号を渡すと該当エージェント分のFlex送信）
- /api/admin-bot/webhook に postback handler 追加
- GitHub Issue API でラベル付け replace
- 完了テキストを管理者LINEへ返信

## ファイル
- apps/worker/src/lib/flex-templates.ts（新規）
- apps/worker/src/services/github-issue.ts（新規）
- apps/worker/src/routes/admin-bot/webhook.ts（拡張）
- apps/worker/src/routes/admin-notify.ts（Flex送信ロジック追加）

## ラベル：code-task, agent-D, priority-high
```

---

## CODEX への投げ方

すべての Issue は `hanmabakiooga-rgb/line-harness-oss` に起票。
1つずつでもバッチでも可。

```
「yuki-pj/handoff/agent-outputs/D-code-tasks-batch1.md を読んで、
そこに列挙された Issue 6本を line-harness-oss に起票して。
本文は markdown のまま貼り付け。ラベルも記載通り付ける。」
```

---

## 優先順位

1. **#6 管理者通知Bot Flex Message**（承認運用の土台）
2. **#1 LPリライト**（CV直結）
3. **#2 Bot自動応答更新**（信頼形成、軽い変更）
4. **#5 KPI cron**（Fの稼働に必須）
5. **#4 アフィリエイト管理画面**
6. **#3 写真同意書テンプレ**（撮影日が決まったら）

---

## ユーザー承認事項

- [ ] 6 Issue すべて起票OK？
- [ ] 優先順位、変更ある？
- [ ] CODEXに投げる前に修正したい箇所ある？
