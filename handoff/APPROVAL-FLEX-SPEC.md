# 承認カード Flex Message 仕様書

作成日: 2026-06-10
対象: 管理者通知Bot（`apps/worker/src/routes/admin-notify.ts`）
目的: 6エージェントがGitHub Issueとして積んだ承認待ち案件を、LINE Flex Messageで届け、ワンタップで承認/却下/修正/保留を完結させる

---

## 1. 全体フロー

```
エージェントA〜D が GitHub Issue を作成（label: approval-queue）
  ↓
オーケストレーターが /api/admin-notify を呼ぶ
  ↓
管理者通知Bot が Flex Message を hanma.baki.ooga の LINE へ push
  ↓
ユーザーが「承認 / 却下 / 修正 / あとで」をタップ
  ↓
postback event が Bot webhook に届く
  ↓
GitHub Issue のラベル更新 + 該当アクション発動
  ↓
完了通知（テキストメッセージ）をユーザーLINEに返す
```

---

## 2. Flex Message JSON テンプレート

```json
{
  "type": "flex",
  "altText": "[A-SNS] X投稿案 #42 承認待ち",
  "contents": {
    "type": "bubble",
    "size": "mega",
    "header": {
      "type": "box",
      "layout": "vertical",
      "backgroundColor": "#1D76DB",
      "paddingAll": "12px",
      "contents": [
        {
          "type": "text",
          "text": "🔵 エージェントA｜SNS生成",
          "color": "#FFFFFF",
          "weight": "bold",
          "size": "sm"
        },
        {
          "type": "text",
          "text": "X投稿案 #42",
          "color": "#FFFFFF",
          "weight": "bold",
          "size": "lg",
          "margin": "xs"
        }
      ]
    },
    "body": {
      "type": "box",
      "layout": "vertical",
      "paddingAll": "16px",
      "spacing": "md",
      "contents": [
        {
          "type": "box",
          "layout": "vertical",
          "backgroundColor": "#F5F5F5",
          "cornerRadius": "8px",
          "paddingAll": "12px",
          "contents": [
            {
              "type": "text",
              "text": "📝 投稿本文プレビュー",
              "size": "xs",
              "color": "#666666",
              "weight": "bold"
            },
            {
              "type": "text",
              "text": "{BODY_PREVIEW_120CHAR}",
              "wrap": true,
              "size": "sm",
              "margin": "xs"
            }
          ]
        },
        {
          "type": "box",
          "layout": "horizontal",
          "spacing": "sm",
          "contents": [
            {
              "type": "text",
              "text": "🕐 公開予定",
              "size": "xs",
              "color": "#888888",
              "flex": 2
            },
            {
              "type": "text",
              "text": "{PUBLISH_AT}",
              "size": "xs",
              "color": "#333333",
              "flex": 3,
              "align": "end"
            }
          ]
        },
        {
          "type": "box",
          "layout": "horizontal",
          "spacing": "sm",
          "contents": [
            {
              "type": "text",
              "text": "⚖ 法務E",
              "size": "xs",
              "color": "#888888",
              "flex": 2
            },
            {
              "type": "text",
              "text": "{LEGAL_VERDICT}",
              "size": "xs",
              "color": "#0E8A16",
              "flex": 3,
              "align": "end",
              "weight": "bold"
            }
          ]
        }
      ]
    },
    "footer": {
      "type": "box",
      "layout": "vertical",
      "spacing": "sm",
      "paddingAll": "12px",
      "contents": [
        {
          "type": "box",
          "layout": "horizontal",
          "spacing": "sm",
          "contents": [
            {
              "type": "button",
              "style": "primary",
              "color": "#0E8A16",
              "height": "sm",
              "action": {
                "type": "postback",
                "label": "✅ 承認",
                "data": "act=approve&issue=42&agent=A",
                "displayText": "✅ 承認しました"
              },
              "flex": 1
            },
            {
              "type": "button",
              "style": "primary",
              "color": "#B60205",
              "height": "sm",
              "action": {
                "type": "postback",
                "label": "❌ 却下",
                "data": "act=reject&issue=42&agent=A",
                "displayText": "❌ 却下しました"
              },
              "flex": 1
            }
          ]
        },
        {
          "type": "box",
          "layout": "horizontal",
          "spacing": "sm",
          "contents": [
            {
              "type": "button",
              "style": "secondary",
              "height": "sm",
              "action": {
                "type": "postback",
                "label": "✏ 修正依頼",
                "data": "act=revise&issue=42&agent=A",
                "displayText": "✏ 修正を依頼します"
              },
              "flex": 1
            },
            {
              "type": "button",
              "style": "secondary",
              "height": "sm",
              "action": {
                "type": "postback",
                "label": "⏰ あとで",
                "data": "act=later&issue=42&agent=A",
                "displayText": "⏰ あとで判断"
              },
              "flex": 1
            }
          ]
        },
        {
          "type": "button",
          "style": "link",
          "height": "sm",
          "action": {
            "type": "uri",
            "label": "🔗 Issueを開く",
            "uri": "{ISSUE_URL}"
          }
        }
      ]
    }
  }
}
```

---

## 3. エージェント別カラーテーマ

| エージェント | header背景色 | アイコン |
|---|---|---|
| A-SNS | `#1D76DB`（青） | 🔵 |
| B-LINE返信 | `#0E8A16`（緑） | 🟢 |
| C-広告 | `#FBCA04`（黄）+ 文字`#000000` | 🟡 |
| D-コード | `#5319E7`（紫） | 🟣 |
| E-法務（緊急時のみ） | `#B60205`（赤） | 🔴 |
| F-分析（日次サマリー） | `#0052CC`（濃青） | 🔷 |

---

## 4. postback data 仕様

クエリ文字列形式：

```
act={approve|reject|revise|later}&issue={番号}&agent={A|B|C|D|E|F}
```

| パラメータ | 意味 |
|---|---|
| `act` | 操作種別 |
| `issue` | GitHub Issue番号 |
| `agent` | どのエージェント由来か |

---

## 5. postback ハンドラの動作

`apps/worker/src/routes/admin-bot/webhook.ts`（既存ファイル）に追加：

| act | 動作 |
|---|---|
| `approve` | Issue に label `approved` を追加 / `approval-queue` を外す → 実行アクション発動（後述） |
| `reject` | Issue に label `rejected` を追加 / `approval-queue` を外す → Issue close |
| `revise` | Issue にコメント「修正依頼受領」を追加 / `approval-queue` のまま / 担当エージェントにIssue内コメント通知 |
| `later` | Issue に label `pending-later` を追加（24時間後に再カード送信） |

### 5-1. 承認後の実行アクション（agent別）

| agent | approve 後の動き |
|---|---|
| A-SNS | （初期は手動）「投稿準備完了。下記をコピペしてX/Instagramへ」テキストをユーザーLINEに返す |
| B-LINE返信 | 川崎さんLINEへ案文を転送 OR Botから顧客に直接push（Issue内の指定による） |
| C-広告 | 「広告マネージャに以下を入稿」設定指示書をユーザーLINEに返す |
| D-コード | GitHub PR を作成（Codex/Claudeに自動委譲）／既存PRなら自動マージ |

---

## 6. ユーザーへの完了通知（テキストメッセージ）

承認/却下/修正/保留の各操作直後、ユーザーLINEに短い確認テキストを返す：

| 操作 | 返信テキスト |
|---|---|
| approve | `✅ #42 承認しました。実行アクションを発動します。` |
| reject | `❌ #42 却下しました。アーカイブします。` |
| revise | `✏ #42 修正依頼を受領。エージェントAに再生成を依頼しました。` |
| later | `⏰ #42 24時間後に再度カードを送ります。` |

---

## 7. 静音モード（23:00〜7:00 JST）

夜間は push を行わず、サーバ側のキューに溜める。
翌朝7:00に「夜間溜まり ◯件」サマリーカードを1通だけ送る。

実装：admin-notify 送信時に現時刻判定 → 夜間は D1 `admin_notify_pending` テーブルに退避 → cron で 7:00 にまとめて送信。

---

## 8. 実装の置き場所

| ファイル | 役割 |
|---|---|
| `apps/worker/src/lib/flex-templates.ts`（新規） | Flex JSON テンプレート関数群 |
| `apps/worker/src/routes/admin-bot/webhook.ts` | postback handler |
| `apps/worker/src/routes/admin-notify.ts` | Flex 送信ロジック（agent別テンプレ選択） |
| `apps/worker/src/services/github-issue.ts`（新規） | Issue ラベル操作・PR作成 |
| `packages/db/schema.sql` | `admin_notify_pending` テーブル追加 |

---

## 9. CODEX/Claude への実装依頼時の優先順位

1. **MVP**：approve/reject の2ボタンだけ、GitHub Issue ラベル更新まで
2. **第2弾**：revise/later の2ボタン追加
3. **第3弾**：静音モード（夜間キュー）
4. **第4弾**：承認後の実行アクション（agent別の発動先）

第1弾だけで運用は開始できる。
