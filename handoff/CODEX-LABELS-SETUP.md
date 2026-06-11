# CODEX 指示書｜GitHub Labels セットアップ（line-harness-oss）

作成日: 2026-06-10
対象リポジトリ: `hanmabakiooga-rgb/line-harness-oss`
目的: 6エージェント運用に必要なラベルを一括作成

---

## 1. やること

下記 11個のラベルを `hanmabakiooga-rgb/line-harness-oss` に作成する。
すでに同名ラベルがあれば**色と説明を上書き更新**、なければ新規作成。

| 名前 | 色 (#) | 説明 |
|---|---|---|
| `approval-queue` | `D93F0B` | 承認待ち。管理者LINEにカード送信され、承認/却下を待つ |
| `agent-A` | `1D76DB` | SNS生成エージェント |
| `agent-B` | `0E8A16` | LINE返信ドラフトエージェント |
| `agent-C` | `FBCA04` | 広告台本エージェント |
| `agent-D` | `5319E7` | コードエージェント |
| `agent-E` | `B60205` | 法務審査エージェント |
| `agent-F` | `0052CC` | 分析エージェント |
| `approved` | `0E8A16` | 承認済み。実行アクション発動対象 |
| `rejected` | `B60205` | 却下済み。アーカイブ用 |
| `code-task` | `5319E7` | コードエージェントが処理するバックログ |
| `proposed-by-F` | `BFD4F2` | 分析エージェントFからの改善提案 |

---

## 2. 推奨実装

### 2-1. gh CLI を使う場合（推奨）

`scripts/setup-labels.sh` を作成：

```bash
#!/usr/bin/env bash
set -euo pipefail

REPO="hanmabakiooga-rgb/line-harness-oss"

create_or_update_label() {
  local name="$1"
  local color="$2"
  local desc="$3"
  if gh label list -R "$REPO" --json name -q ".[].name" | grep -Fxq "$name"; then
    gh label edit "$name" -R "$REPO" --color "$color" --description "$desc"
  else
    gh label create "$name" -R "$REPO" --color "$color" --description "$desc"
  fi
}

create_or_update_label "approval-queue" "D93F0B" "承認待ち"
create_or_update_label "agent-A" "1D76DB" "SNS生成エージェント"
create_or_update_label "agent-B" "0E8A16" "LINE返信ドラフトエージェント"
create_or_update_label "agent-C" "FBCA04" "広告台本エージェント"
create_or_update_label "agent-D" "5319E7" "コードエージェント"
create_or_update_label "agent-E" "B60205" "法務審査エージェント"
create_or_update_label "agent-F" "0052CC" "分析エージェント"
create_or_update_label "approved" "0E8A16" "承認済み"
create_or_update_label "rejected" "B60205" "却下済み"
create_or_update_label "code-task" "5319E7" "コードバックログ"
create_or_update_label "proposed-by-F" "BFD4F2" "分析エージェントFからの改善提案"

echo "✅ Labels setup complete."
```

実行：
```bash
chmod +x scripts/setup-labels.sh
./scripts/setup-labels.sh
```

### 2-2. PowerShell 環境の場合

`scripts/setup-labels.ps1`：

```powershell
$REPO = "hanmabakiooga-rgb/line-harness-oss"

$labels = @(
  @{Name="approval-queue"; Color="D93F0B"; Desc="承認待ち"},
  @{Name="agent-A"; Color="1D76DB"; Desc="SNS生成エージェント"},
  @{Name="agent-B"; Color="0E8A16"; Desc="LINE返信ドラフトエージェント"},
  @{Name="agent-C"; Color="FBCA04"; Desc="広告台本エージェント"},
  @{Name="agent-D"; Color="5319E7"; Desc="コードエージェント"},
  @{Name="agent-E"; Color="B60205"; Desc="法務審査エージェント"},
  @{Name="agent-F"; Color="0052CC"; Desc="分析エージェント"},
  @{Name="approved"; Color="0E8A16"; Desc="承認済み"},
  @{Name="rejected"; Color="B60205"; Desc="却下済み"},
  @{Name="code-task"; Color="5319E7"; Desc="コードバックログ"},
  @{Name="proposed-by-F"; Color="BFD4F2"; Desc="分析エージェントFからの改善提案"}
)

$existing = gh label list -R $REPO --json name -q ".[].name"

foreach ($l in $labels) {
  if ($existing -contains $l.Name) {
    gh label edit $l.Name -R $REPO --color $l.Color --description $l.Desc
  } else {
    gh label create $l.Name -R $REPO --color $l.Color --description $l.Desc
  }
}

Write-Host "✅ Labels setup complete."
```

---

## 3. 完了確認

```bash
gh label list -R hanmabakiooga-rgb/line-harness-oss
```

11個のラベルがすべて表示されればOK。

---

## 4. ユーザーへの完了報告フォーマット

```
完了：
- リポジトリ: hanmabakiooga-rgb/line-harness-oss
- スクリプト: scripts/setup-labels.sh（または .ps1）
- 作成/更新したラベル: 11個
- 確認URL: https://github.com/hanmabakiooga-rgb/line-harness-oss/labels
```

---

## 5. 注意事項

- gh CLI 未認証ならまず `gh auth login` を案内
- スクリプトは PR にせず、リポジトリにコミット&push してOK（誰でも再実行できるよう残す）
- ラベル色は将来の運用で見やすさ調整可。今回は識別性優先で設定済み
