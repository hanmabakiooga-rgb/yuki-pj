# CODEX投入用｜Issue #6 単体プロンプト

## 何のためのファイル
D Issue #6（管理者通知Bot Flex Message実装）を **CODEX に最優先で1本だけ投げる**ためのコピペ用プロンプト。

これが完成すると、「ユーザーはLINEのボタンタップだけで運用」が動き出す。

---

## CODEX への投げ方

CODEX を `hanmabakiooga-rgb/line-harness-oss` で起動して、以下を貼り付ける：

---

### コピペ用プロンプト

```
yuki-pj/handoff/APPROVAL-FLEX-SPEC.md を読み込み、その仕様に沿って
管理者通知Bot の Flex Message承認カード機能を実装してください。

リポジトリ: hanmabakiooga-rgb/line-harness-oss
ブランチ: feat/approval-flex-mvp

実装範囲（MVP）:
- approve / reject の2ボタンのみ（revise/later は次イテレーション）
- GitHub Issue API でラベル付け replace（approval-queue → approved or rejected）
- 完了テキストを管理者LINEへ返信

実装ファイル:
1. apps/worker/src/lib/flex-templates.ts（新規）
   - createApprovalCard(agent, issueNumber, title, bodyPreview, publishAt, legalVerdict) を実装
   - agent 別カラーテーマ（APPROVAL-FLEX-SPEC.md §3 参照）

2. apps/worker/src/services/github-issue.ts（新規）
   - updateIssueLabel(issueNumber, addLabels, removeLabels) を実装
   - secret は GITHUB_PERSONAL_ACCESS_TOKEN を使用

3. apps/worker/src/routes/admin-notify.ts（拡張）
   - POST /api/admin-notify/flex エンドポイント追加
   - body: { issueNumber: number, agent: string }
   - 認証: Bearer ADMIN_NOTIFY_SHARED_SECRET

4. apps/worker/src/routes/admin-bot/webhook.ts（拡張）
   - postback event ハンドラ追加
   - act=approve → GitHub Issue label 更新 → 「✅ #N 承認しました」テキスト返信
   - act=reject → 同じく label 更新 → 「❌ #N 却下しました」テキスト返信

必須:
- typecheck PASS
- worker test PASS (新規テスト追加)
- 既存のテスト62/62を壊さない
- secret はコミットしない、wrangler.toml に追加のみ
- PR 本文に動作確認手順を記載

期待動作:
1. /api/admin-notify/flex に issueNumber=42, agent=A を POST
2. 管理者LINEに「[A-SNS] 投稿案 #42」の Flex カードが届く
3. 「✅ 承認」ボタンをタップ → GitHub Issue #42 のラベルが approval-queue → approved に変わる
4. LINE に「✅ #42 承認しました」テキストが届く

完了報告:
- PR URL
- typecheck / test の結果
- マージ後の操作手順（GitHub Token 設定、シークレットの確認 等）
```

---

## ユーザー側で事前にやること

CODEX に投げる前に、以下を準備：

1. **GitHub Personal Access Token** 発行
   - スコープ：`repo`（読み書き）
   - `wrangler secret put GITHUB_PERSONAL_ACCESS_TOKEN`（apps/worker フォルダで）

2. **GitHub ラベル作成**（前に作った CODEX-LABELS-SETUP.md で）
   - `approval-queue`, `approved`, `rejected`, `agent-A`〜`agent-J`

これが揃った状態で CODEX に投げると、PR が3〜10分で出てくる想定。

---

## マージ後の動作確認

```
# PR マージ後
cd C:\FOLLOW\line-harness-oss\apps\worker
npx wrangler deploy

# テスト POST
curl.exe -X POST https://line-harness.<sub>.workers.dev/api/admin-notify/flex `
  -H "Authorization: Bearer <SHARED_SECRET>" `
  -H "Content-Type: application/json" `
  -d '{"issueNumber":1,"agent":"A"}'
```

→ 管理者LINEに Flex カードが届けば成功。
→ ボタンをタップして GitHub Issue のラベルが変わるか確認。

---

## このIssue完成後にできるようになること

- 6エージェントの出力 → GitHub Issue化 → 管理者LINEに Flex カード → ユーザーがタップ → 自動実行
- 「おはよう」起動の運用フローの**最後の繋ぎ目**が動く
- ユーザーは1日30分以内で承認運用が回せる
