# F実働：朝サマリー Flex Message 仕様書

実行: エージェントF（分析）
作成日: 2026-06-17
状態: 仕様確定版、D Issue 起票候補（line-harness-oss / yuki-pj/apps/worker 両方）
関連: PR #12（管理者LINE Flex通知）、F-kpi-sheet-spec.md §4、APPROVAL-FLEX-SPEC.md

---

## 1. 目的とスコープ

毎朝07:15 JSTに、前日 `daily` シートの最新行を読んで管理者LINE（hanma.baki.ooga）に1通 Flex Message を push する。

- 入力: Google Sheets `FOLLOW-KPI` の `daily` 最新行 + 前週同曜日行 + 直近7日平均
- 出力: LINE Messaging API `messages` payload（Flex v2）
- 呼び出し元: `apps/worker/src/cron.ts` の07:15ジョブ → `apps/worker/src/lib/flex-templates.ts::createMorningSummaryCard()` → `apps/worker/src/routes/admin-notify.ts::pushAdmin()`

エージェントカラー: `#0052CC`（濃青、F専用）  
アイコン: 🔷

---

## 2. createMorningSummaryCard() 関数シグネチャ

`apps/worker/src/lib/flex-templates.ts` に追加：

```ts
export type Severity = "ok" | "warn" | "critical";

export interface KpiDelta {
  /** 当日値 */
  value: number;
  /** 前日比（差分、null=計算不可） */
  dod: number | null;
  /** 前週同曜日比（%、null=計算不可） */
  wow_pct: number | null;
}

export interface KpiAnomaly {
  /** メトリック名（例: "ad_cpa_yen"） */
  metric: string;
  /** 表示用ラベル（例: "広告CPA"） */
  label: string;
  /** 実測値 */
  actual: number;
  /** 期待値（7日平均など） */
  expected: number;
  severity: Severity;
  /** 表示用本文（例: "CPA¥1,800 / 7日平均比+180%"） */
  message: string;
}

export interface KpiStats {
  /** 集計対象日 YYYY-MM-DD */
  date: string;
  /** 前日登録数（line_friends_added） */
  registrations: KpiDelta;
  /** サブスク累計（active_subscriptions） */
  active_subs: KpiDelta;
  /** 解約数（cancellations） */
  cancellations: KpiDelta;
  /** 広告消化額（ad_spend_yen） */
  ad_spend: KpiDelta;
  /** 広告CPA（ad_cpa_yen） */
  ad_cpa: KpiDelta;
  /** 累計サブスクの5000ゴール進捗 % */
  goal_progress_pct: number;
  /** 月内サブスクペース（30名/月目標に対する進捗 %） */
  month_pace_pct: number;
  /** 異常検知（最大3件、severity降順で渡す） */
  anomalies: KpiAnomaly[];
  /** 今日の優先論点（最大3件、F が monitoring + Issue ラベルから生成） */
  priorities: string[];
  /** KPIシート URL（環境変数 KPI_SHEET_URL を渡す） */
  sheetUrl: string;
}

export interface FlexMessage {
  type: "flex";
  altText: string;
  contents: Record<string, unknown>;
}

/**
 * 朝サマリーカードを生成する。
 * 全体の severity は anomalies の最大値で決定し、Header の背景色が変わる。
 */
export function createMorningSummaryCard(stats: KpiStats): FlexMessage;
```

---

## 3. 異常検知ルールと色分けロジック

### 3-1. severity 決定

```ts
function overallSeverity(anomalies: KpiAnomaly[]): Severity {
  if (anomalies.some((a) => a.severity === "critical")) return "critical";
  if (anomalies.some((a) => a.severity === "warn")) return "warn";
  return "ok";
}
```

### 3-2. Header背景色テーブル

| severity | 背景色      | アイコン | altText接頭辞       |
|----------|-------------|----------|---------------------|
| ok       | `#0052CC`   | 🔷       | `[F] 朝サマリー`     |
| warn     | `#FBCA04`   | ⚠       | `[F⚠] 朝サマリー`    |
| critical | `#B60205`   | 🚨       | `[F🚨] 朝サマリー`   |

warn のとき Header 文字色は `#000000`、ok/critical は `#FFFFFF`。

### 3-3. 数値セルの色（前週比に応じて）

`wow_pct` から個別行の色を決定（`subTextColor()`）：

| 指標カテゴリ | 良い方向 | 悪い方向しきい値                   |
|--------------|----------|------------------------------------|
| registrations / active_subs | 増   | `wow_pct < -20` → `#B60205`、`< 0` → `#D29922`、それ以外 → `#0E8A16` |
| cancellations             | 減   | `wow_pct > +50` → `#B60205`、`> 0` → `#D29922`、それ以外 → `#0E8A16` |
| ad_cpa                    | 減   | `wow_pct > +50` → `#B60205`、`> +20` → `#D29922`、それ以外 → `#0E8A16` |
| ad_spend                  | 中立 | 常に `#333333` |

### 3-4. 異常検知ルール（F-kpi-sheet-spec.md §3 から継承）

| メトリック                 | warn                              | critical                          |
|----------------------------|-----------------------------------|-----------------------------------|
| `ad_cpa_yen`              | 7日平均の150%超                  | 7日平均の200%超                  |
| `line_friends_added`      | 7日平均の50%未満                 | -                                 |
| `cancellations`           | 1日3件以上                        | 1日5件以上                        |
| `colorist_avg_response_min` | 240分超                         | -                                 |
| `counseling_completed`    | 7日連続0件                        | -                                 |

critical があれば静音モード（22:00-07:00）でも送信。07:15の通常送信時は無視。

---

## 4. Flex JSON テンプレ（プレースホルダ付き）

`{...}` がランタイム埋め込み箇所。`createMorningSummaryCard()` が `KpiStats` から組み立てる。

```json
{
  "type": "flex",
  "altText": "{ALT_TEXT_PREFIX} {DATE} 登録+{REG_VAL} / サブスク{SUBS_VAL} / 解約{CANC_VAL}",
  "contents": {
    "type": "bubble",
    "size": "mega",
    "header": {
      "type": "box",
      "layout": "vertical",
      "backgroundColor": "{HEADER_BG}",
      "paddingAll": "12px",
      "contents": [
        {
          "type": "text",
          "text": "{HEADER_ICON} F日次サマリー",
          "color": "{HEADER_FG}",
          "weight": "bold",
          "size": "sm"
        },
        {
          "type": "text",
          "text": "{DATE}（前日数値）",
          "color": "{HEADER_FG}",
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
          "spacing": "sm",
          "contents": [
            {
              "type": "text",
              "text": "📈 前日数値",
              "size": "xs",
              "color": "#666666",
              "weight": "bold"
            },
            {
              "type": "box",
              "layout": "horizontal",
              "contents": [
                { "type": "text", "text": "登録", "size": "sm", "color": "#666666", "flex": 2 },
                { "type": "text", "text": "+{REG_VAL}", "size": "sm", "weight": "bold", "color": "{REG_COLOR}", "flex": 2, "align": "end" },
                { "type": "text", "text": "前週比 {REG_WOW}", "size": "xs", "color": "#888888", "flex": 3, "align": "end" }
              ]
            },
            {
              "type": "box",
              "layout": "horizontal",
              "contents": [
                { "type": "text", "text": "サブスク累計", "size": "sm", "color": "#666666", "flex": 2 },
                { "type": "text", "text": "{SUBS_VAL}", "size": "sm", "weight": "bold", "color": "{SUBS_COLOR}", "flex": 2, "align": "end" },
                { "type": "text", "text": "5000中 {GOAL_PCT}%", "size": "xs", "color": "#888888", "flex": 3, "align": "end" }
              ]
            },
            {
              "type": "box",
              "layout": "horizontal",
              "contents": [
                { "type": "text", "text": "解約", "size": "sm", "color": "#666666", "flex": 2 },
                { "type": "text", "text": "{CANC_VAL}", "size": "sm", "weight": "bold", "color": "{CANC_COLOR}", "flex": 2, "align": "end" },
                { "type": "text", "text": "前週比 {CANC_WOW}", "size": "xs", "color": "#888888", "flex": 3, "align": "end" }
              ]
            },
            {
              "type": "box",
              "layout": "horizontal",
              "contents": [
                { "type": "text", "text": "広告消化", "size": "sm", "color": "#666666", "flex": 2 },
                { "type": "text", "text": "¥{AD_SPEND}", "size": "sm", "weight": "bold", "color": "#333333", "flex": 2, "align": "end" },
                { "type": "text", "text": "CPA ¥{AD_CPA}", "size": "xs", "color": "{CPA_COLOR}", "flex": 3, "align": "end" }
              ]
            },
            {
              "type": "box",
              "layout": "horizontal",
              "contents": [
                { "type": "text", "text": "月内ペース", "size": "sm", "color": "#666666", "flex": 2 },
                { "type": "text", "text": "{MONTH_PACE}%", "size": "sm", "weight": "bold", "color": "{PACE_COLOR}", "flex": 2, "align": "end" },
                { "type": "text", "text": "30名/月目標", "size": "xs", "color": "#888888", "flex": 3, "align": "end" }
              ]
            }
          ]
        },
        {
          "type": "separator",
          "margin": "md"
        },
        {
          "type": "box",
          "layout": "vertical",
          "spacing": "xs",
          "contents": [
            {
              "type": "text",
              "text": "⚠ 注意 ({ANOMALY_COUNT})",
              "size": "xs",
              "color": "#666666",
              "weight": "bold"
            },
            {
              "type": "text",
              "text": "・{ANOMALY_1}",
              "size": "sm",
              "color": "{ANOMALY_1_COLOR}",
              "wrap": true
            },
            {
              "type": "text",
              "text": "・{ANOMALY_2}",
              "size": "sm",
              "color": "{ANOMALY_2_COLOR}",
              "wrap": true
            },
            {
              "type": "text",
              "text": "・{ANOMALY_3}",
              "size": "sm",
              "color": "{ANOMALY_3_COLOR}",
              "wrap": true
            }
          ]
        },
        {
          "type": "separator",
          "margin": "md"
        },
        {
          "type": "box",
          "layout": "vertical",
          "spacing": "xs",
          "contents": [
            {
              "type": "text",
              "text": "🎯 今日の優先論点",
              "size": "xs",
              "color": "#666666",
              "weight": "bold"
            },
            { "type": "text", "text": "・{PRIORITY_1}", "size": "sm", "color": "#333333", "wrap": true },
            { "type": "text", "text": "・{PRIORITY_2}", "size": "sm", "color": "#333333", "wrap": true },
            { "type": "text", "text": "・{PRIORITY_3}", "size": "sm", "color": "#333333", "wrap": true }
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
          "type": "button",
          "style": "primary",
          "color": "#0052CC",
          "height": "sm",
          "action": {
            "type": "uri",
            "label": "📊 KPIシートを開く",
            "uri": "{SHEET_URL}"
          }
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
                "label": "🔇 今日はミュート",
                "data": "act=mute&agent=F&date={DATE}",
                "displayText": "🔇 今日のFは静かに"
              },
              "flex": 1
            },
            {
              "type": "button",
              "style": "secondary",
              "height": "sm",
              "action": {
                "type": "postback",
                "label": "🔁 再集計",
                "data": "act=refetch&agent=F&date={DATE}",
                "displayText": "🔁 再集計します"
              },
              "flex": 1
            }
          ]
        }
      ]
    }
  }
}
```

### 4-1. プレースホルダ仕様一覧

| プレースホルダ                                | 由来                              | 例                                    |
|-----------------------------------------------|-----------------------------------|---------------------------------------|
| `{ALT_TEXT_PREFIX}`                           | `[F]` / `[F⚠]` / `[F🚨]`         | `[F⚠] 朝サマリー`                     |
| `{DATE}`                                      | `stats.date`                      | `2026-06-16`                          |
| `{HEADER_BG}` / `{HEADER_FG}` / `{HEADER_ICON}` | severity から決定               | `#0052CC` / `#FFFFFF` / `🔷`          |
| `{REG_VAL}` / `{REG_WOW}` / `{REG_COLOR}`     | `stats.registrations`             | `2` / `+33%` / `#0E8A16`              |
| `{SUBS_VAL}` / `{SUBS_COLOR}` / `{GOAL_PCT}`  | `stats.active_subs` + `goal_progress_pct` | `31` / `#0E8A16` / `0.6` |
| `{CANC_VAL}` / `{CANC_WOW}` / `{CANC_COLOR}`  | `stats.cancellations`             | `0` / `±0` / `#0E8A16`                |
| `{AD_SPEND}` / `{AD_CPA}` / `{CPA_COLOR}`     | `stats.ad_spend` / `stats.ad_cpa` | `800` / `800` / `#0E8A16`             |
| `{MONTH_PACE}` / `{PACE_COLOR}`               | `stats.month_pace_pct`            | `10` / `#D29922`                      |
| `{ANOMALY_COUNT}` / `{ANOMALY_N}` / `{ANOMALY_N_COLOR}` | `stats.anomalies[0..2]` | `2` / `CPA¥1,800 / 7日平均比+180%` / `#B60205` |
| `{PRIORITY_N}`                                | `stats.priorities[0..2]`          | `既存28名の解約防止カード3件、未承認` |
| `{SHEET_URL}`                                 | 環境変数 `KPI_SHEET_URL`          | `https://docs.google.com/spreadsheets/d/.../edit` |

### 4-2. 空配列のときの省略ルール

- `anomalies.length === 0` のとき「⚠ 注意」ブロックは「✅ 異常なし」1行に置換。
- `priorities.length === 0` のとき「🎯 今日の優先論点」ブロックは「・特になし（直近の Issue キュー空）」1行に置換。
- `N` 番目が存在しなければそのテキスト要素を contents 配列から除外（空文字列は LINE API がエラーにする）。

---

## 5. postback ハンドラ追加分

`apps/worker/src/routes/admin-bot/webhook.ts` に2件追加：

| act       | 動作                                                                 |
|-----------|----------------------------------------------------------------------|
| `mute`    | D1 `admin_notify_mute` に `(agent='F', date=YYYY-MM-DD)` を1日分INSERT。翌日リセット。 |
| `refetch` | `cron.ts::collectDailyStats()` を即時再実行 → 新カードを push。       |

postback data 形式は APPROVAL-FLEX-SPEC.md §4 と同じクエリ文字列。

---

## 6. D Issue化用のCODEXプロンプト（line-harness-oss向け）

リポジトリ: `https://github.com/<owner>/line-harness-oss`  
ベース: `main`  
ラベル: `feat`, `agent-F`, `flex-template`

```
タイトル: feat(flex-templates): add createMorningSummaryCard() for F morning digest

概要:
yuki-pj/handoff/agent-outputs/F-morning-summary-flex-spec.md の §2〜§4 を
apps/worker/src/lib/flex-templates.ts に実装する。
07:15 JST cron から呼ばれ、管理者LINEに前日KPIを Flex Bubble (mega) で push する。

実装範囲:
1. 型定義: KpiDelta / KpiAnomaly / KpiStats / Severity / FlexMessage を export
2. 関数: createMorningSummaryCard(stats: KpiStats): FlexMessage
   - severity を anomalies から決定（critical > warn > ok）
   - severity に応じて header の backgroundColor / color / icon を切替
     - ok:       #0052CC / #FFFFFF / 🔷
     - warn:     #FBCA04 / #000000 / ⚠
     - critical: #B60205 / #FFFFFF / 🚨
   - body の数値セルは前週比 wow_pct から色を決定
     - registrations / active_subs: <-20→赤, <0→黄, else→緑
     - cancellations / ad_cpa:      >+50→赤, >0→黄, else→緑
     - ad_spend は常に #333333
   - anomalies / priorities が空のときの省略ルールを実装（§4-2）
   - altText は §3-2 の接頭辞 + 主要3指標を1行で連結
   - sheetUrl は stats.sheetUrl をそのまま footer URI ボタンに渡す（env は呼び出し側で注入）

3. 単体テスト: apps/worker/src/lib/__tests__/flex-templates.test.ts
   - ok / warn / critical 各severityでheader背景色が変わることをassert
   - anomalies が空のとき「✅ 異常なし」になることをassert
   - priorities が3件のとき3行表示されることをassert
   - altText に日付が含まれることをassert
   - 既存の createApprovalCard テストを壊さない

4. cron 連携: apps/worker/src/cron.ts の 07:15 ハンドラから
   collectDailyStats() → createMorningSummaryCard(stats) → pushAdmin(flex) の順に呼ぶ。
   env.KPI_SHEET_URL を stats.sheetUrl に注入する。

5. 環境変数追加: wrangler.toml の [vars] に KPI_SHEET_URL を追記
   （実値は .dev.vars と Cloudflare secret に別途登録、本PRには含めない）

完了条件:
- pnpm typecheck PASS
- pnpm test PASS（既存 + 新規）
- pnpm lint PASS
- ローカルで `wrangler dev` 起動後、`curl -X POST localhost:8787/__debug/morning-summary` で
  本番フォーマットの Flex JSON が stdout に出力される（debug ルートも追加して可）
- LINE Flex Simulator (https://developers.line.biz/flex-simulator/) に貼って3パターン
  （ok / warn / critical）の表示崩れがないこと（スクショ不要、テストでOK）

参考:
- 既存 createApprovalCard 実装 → apps/worker/src/lib/flex-templates.ts
- KPI 列定義 → yuki-pj/handoff/agent-outputs/F-kpi-sheet-spec.md §1
- 異常検知ルール → yuki-pj/handoff/agent-outputs/F-kpi-sheet-spec.md §3
- 朝サマリーの日本語テキスト原型 → 同 §4

注意:
- LINE Flex JSON の text コンポーネントに空文字を入れるとエラーになる。
  値がないときは配列から除外する。
- altText は LINE 仕様で最大400文字、本PRでは120文字以内に収める。
- mega bubble は body+footer 合計で2500x4000px 制限、本テンプレは余裕で収まる。
```

---

## 7. 静音モードとの整合

APPROVAL-FLEX-SPEC.md §7 と同じく22:00-07:00は push 抑制。  
ただし F の朝サマリーは 07:15 送信なので常に静音解除後に届く。  
critical anomaly が前夜22:00以降に発生していた場合は朝サマリーの最上段で「🚨 夜間異常 N件」サブヘッダを追加（v1.1で実装、本PRスコープ外）。

---

## 8. ユーザー承認事項

- [ ] severity 3段階の色（緑/黄/赤）の組み合わせOK？
- [ ] 「🔇 今日はミュート」「🔁 再集計」ボタンの2つでOK？追加する？
- [ ] altText のフォーマット（`[F⚠] 朝サマリー 2026-06-16 登録+2 / サブスク31 / 解約0`）OK？
- [ ] line-harness-oss 側に置く理由：再利用前提のFlex関数群はそちらに集約という整理でOK？

---

## 9. v1.1 で検討する拡張

- 夜間異常サブヘッダ（§7）
- グラフ画像添付（Sheets `dashboard` の SPARKLINE を画像化して hero に貼る）
- 週次サマリー（月曜のみ前週まとめを追加 Bubble として Carousel 化）
- 月次サマリーは別仕様（J-colorist-dashboard.md §7 と統合検討）
