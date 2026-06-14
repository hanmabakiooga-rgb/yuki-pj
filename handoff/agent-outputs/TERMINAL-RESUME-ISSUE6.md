# ターミナルClaude 再開指示書（Issue #6 Flex Message実装）

作成日: 2026-06-14
状態: ターミナルClaudeが認証復旧後、途中で止まっているため再開用
リポジトリ: `hanmabakiooga-rgb/line-harness-oss`

---

## まずやってほしいこと（順番厳守）

### Step 0：現状確認

ターミナルClaudeに以下をそのまま貼り付けてください：

```
今の作業ディレクトリと git の状態を確認してから、Issue #6 を再開してほしい。

実行してほしいコマンド：
1. pwd
2. git branch --show-current
3. git status --short
4. git log --oneline -5

実行結果を見せてから、次のステップに進んでください。
```

**期待される状態：**
- pwd: `C:\FOLLOW\line-harness-oss`（または similar Linux path）
- branch: `main` または `feat/approval-flex-mvp`
- status: clean か、途中のファイル変更が残っている

---

## Step 1：再開判断

### パターンA：作業ブランチが残っていて、変更が途中

ターミナルClaude へ：

```
feat/approval-flex-mvp ブランチに途中の変更があります。
変更内容を確認してから、続きを実装してください。

実行してほしいコマンド：
1. git diff --stat
2. git diff（変更が小さければ）

その上で、以下の実装範囲のうち、何が完了済みで何が残っているかを判断し、
残タスクから再開してください。

実装範囲（再掲）：
- apps/worker/src/lib/flex-templates.ts（新規）
- apps/worker/src/services/github-issue.ts（新規）
- apps/worker/src/routes/admin-notify.ts（拡張）
- apps/worker/src/routes/admin-bot/webhook.ts（拡張）
- 既存テスト62/62を壊さない
- typecheck PASS
- 新規テスト追加
```

### パターンB：ブランチも変更も消えている（クリーン状態）

ターミナルClaude へ：

```
Issue #6 を最初から実装し直してください。
仕様は GitHub の以下のファイルにあります：

https://github.com/hanmabakiooga-rgb/yuki-pj/blob/claude/blissful-lovelace-jcQoP/handoff/APPROVAL-FLEX-SPEC.md
https://github.com/hanmabakiooga-rgb/yuki-pj/blob/claude/blissful-lovelace-jcQoP/handoff/agent-outputs/D-issue6-flex-message-prompt.md

ファイル取得コマンド：
gh api repos/hanmabakiooga-rgb/yuki-pj/contents/handoff/APPROVAL-FLEX-SPEC.md?ref=claude/blissful-lovelace-jcQoP --jq '.content' | base64 -d > /tmp/APPROVAL-FLEX-SPEC.md

gh api repos/hanmabakiooga-rgb/yuki-pj/contents/handoff/agent-outputs/D-issue6-flex-message-prompt.md?ref=claude/blissful-lovelace-jcQoP --jq '.content' | base64 -d > /tmp/D-issue6.md

その後：
1. git checkout main && git pull
2. git checkout -b feat/approval-flex-mvp
3. /tmp/D-issue6.md の指示に従って実装
4. 完了したらPR作成
```

---

## Step 2：実装の必須条件（仕様再掲）

### MVP範囲（approve/rejectのみ）

| ファイル | 状態 | 役割 |
|---|---|---|
| `apps/worker/src/lib/flex-templates.ts` | 新規 | `createApprovalCard()` 関数 |
| `apps/worker/src/services/github-issue.ts` | 新規 | `updateIssueLabel()` 関数 |
| `apps/worker/src/routes/admin-notify.ts` | 拡張 | `POST /api/admin-notify/flex` 追加 |
| `apps/worker/src/routes/admin-bot/webhook.ts` | 拡張 | postback handler 追加 |

### 動作仕様

1. `POST /api/admin-notify/flex` body: `{ issueNumber: number, agent: string }`
2. 認証: `Authorization: Bearer ADMIN_NOTIFY_SHARED_SECRET`
3. 管理者LINEに Flex 承認カードが届く
4. ✅承認 タップ → GitHub Issue ラベル `approval-queue` → `approved`
5. ❌却下 タップ → GitHub Issue ラベル `approval-queue` → `rejected`
6. LINE に完了テキスト返信

### Secret 一覧（wrangler.toml で参照、コミット禁止）

- `GITHUB_PERSONAL_ACCESS_TOKEN`（scope: `repo`）
- `ADMIN_NOTIFY_SHARED_SECRET`（任意のランダム文字列）
- `LINE_CHANNEL_ACCESS_TOKEN`（既存）
- `LINE_ADMIN_USER_ID`（既存）

### 完了条件

- [ ] typecheck PASS
- [ ] 既存テスト62/62 PASS
- [ ] 新規テスト：`createApprovalCard`、`updateIssueLabel`、postback handler の最低3テスト
- [ ] PR本文に動作確認手順を書く

---

## Step 3：PR作成

```
完了したら以下のコマンドでPRを作成してください：

gh pr create --base main --title "feat(admin-notify): approval card Flex Message MVP" --body "$(cat <<'EOF'
## 概要
管理者通知Bot に Flex Message 承認カードを実装。MVP として approve/reject の2ボタンのみ。

## 実装内容
- createApprovalCard(): エージェント別カラーの Flex JSON を生成
- updateIssueLabel(): GitHub Issue のラベルを replace
- POST /api/admin-notify/flex: 承認カード送信エンドポイント
- postback handler: ボタンタップで Issue ラベル更新 + LINE 返信

## 動作確認手順
1. \`wrangler secret put GITHUB_PERSONAL_ACCESS_TOKEN\`
2. \`wrangler secret put ADMIN_NOTIFY_SHARED_SECRET\`
3. \`wrangler deploy\`
4. curl で POST → 管理者LINEに Flex カードが届くことを確認
5. ボタンタップ → GitHub Issue のラベル変化を確認

## テスト
- typecheck: PASS
- 既存テスト: 62/62 PASS
- 新規テスト: 3 件追加

ref: yuki-pj/handoff/APPROVAL-FLEX-SPEC.md
EOF
)"
```

---

## Step 4：完了報告

PRが作成できたら、ターミナルClaude に以下を返してもらう：

```
- PR URL
- typecheck / test 結果
- マージ後にユーザーがやるべき操作（secret 登録、デプロイ、curl テスト）
```

---

## ユーザーへの参考情報

- 進捗が分からなくなったら、いつでも `git status` と `git log --oneline -5` をターミナルに打たせれば現状把握できます
- ターミナルClaude が同じエラーで繰り返し止まる場合は、その内容をコピペしてこのセッションに貼り付けてください
- PRが出たら本部（このセッション）側で内容レビューします

---

## 補足：APPROVAL-FLEX-SPEC.md の要点（ターミナル側で fetch する内容の概要）

仕様の核心は：

1. **Flex の構造**：bubble 形式、header にエージェント名・カラー、body に issue 概要、footer にボタン
2. **エージェント別カラー**：
   - A（SNS）: `#FF6B9D` ピンク
   - B（LINE）: `#06C755` 緑
   - C（広告）: `#FF6B35` オレンジ
   - その他: グレー
3. **postback data 形式**：`act=approve&issue=42` の形
4. **GitHub API**：`PATCH /repos/{owner}/{repo}/issues/{issue_number}` でラベルを replace

ターミナル側で APPROVAL-FLEX-SPEC.md を取得できなかった場合、上記4点だけで実装可能。
