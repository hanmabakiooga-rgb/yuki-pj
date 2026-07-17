# F実働：KPI Sheet 連動仕様（Google Sheets `FOLLOW-KPI`）

実行: エージェントF（分析）
作成日: 2026-06-10
状態: 仕様確定版、D Issue #5 と連動
入力: ユーザー提供のSheet URL https://docs.google.com/spreadsheets/d/1Xshvq2dIJKoTLwU8E4VBR-alySOW42h96Uh7NQji4B0/edit

---

## 1. シート構成

### 1-1. シート `daily`（日次）

| 列 | キー | 内容 | データ型 | 入力源 |
|---|---|---|---|---|
| A | date | 日付 YYYY-MM-DD | text | cron |
| B | lp_visits | LP訪問数 | int | Cloudflare Web Analytics |
| C | lp_uniques | LP UU | int | Cloudflare Web Analytics |
| D | line_friends_added | LINE友だち追加数 | int | LINE Webhook |
| E | counseling_completed | カウンセリング完了 | int | D1 counseling_submissions |
| F | first_payment | 初回課金数 | int | Stripe |
| G | active_subscriptions | サブスク累計（月末スナップ）| int | Stripe |
| H | cancellations | 解約数 | int | Stripe |
| I | ad_spend_yen | 広告消化額 | int | Meta API（手動 or 自動）|
| J | ad_impressions | 広告インプレッション | int | Meta API |
| K | ad_clicks | 広告クリック | int | Meta API |
| L | ad_cpa_yen | 広告CPA | int | 計算式 =I/F |
| M | sns_total_engagement | SNS総エンゲ | int | Meta Graph + note手動 |
| N | colorist_consultations | 川崎さん相談件数 | int | D1 messages_log |
| O | colorist_avg_response_min | 平均応答時間（分）| int | D1 から計算 |
| P | notes | 特記事項（手入力） | text | 手動 |

### 1-2. シート `weekly`

A〜O を週次集計（月曜起点）。  
Q列：週次目標達成率（%）  
R列：前週比（%）

### 1-3. シート `monthly`

A〜O を月次集計。  
Q列：月次目標達成率（%）  
R列：累計サブスク数 / 5,000ゴール進捗 %  
S列：CAC = `ad_spend_yen / first_payment`  
T列：LTV推定 = `880 × 平均継続月数（D1 から算出）`

### 1-4. シート `experiments`（A/Bテスト管理）

| 列 | 内容 |
|---|---|
| A | experiment_id |
| B | name |
| C | start_date |
| D | end_date |
| E | group_a_label |
| F | group_b_label |
| G | group_a_size |
| H | group_b_size |
| I | group_a_conversion |
| J | group_b_conversion |
| K | result（A勝/B勝/判定不能）|
| L | notes |

### 1-5. シート `monitoring`（異常検知）

| 列 | 内容 |
|---|---|
| A | timestamp |
| B | metric_name |
| C | actual_value |
| D | expected_value |
| E | severity (info/warn/critical) |
| F | alerted（管理者LINEに送ったか）|

---

## 2. 自動入力フロー

### 2-1. Workerからの cron Push（毎日 06:50 JST）

`apps/worker/src/cron.ts`:
```ts
- Cloudflare Web Analytics で LP訪問・UUを取得
- LINE Webhook log から友だち追加数を集計
- D1 から counseling_completed / colorist_consultations / colorist_avg_response_min を計算
- Stripe API で first_payment / active_subscriptions / cancellations を取得
- Sheets API で `daily` シートに1行 append
- Meta API（手動入力推奨、ad_spend_yen 等）は手入力欄を残す
- 週次/月次集計は Google Sheets の計算式で自動更新
```

### 2-2. F エージェントの読み込みフロー

Fは毎朝07:15に：
1. `daily` シートの最新行を読む
2. 前日比・前週比を計算
3. 異常検知ルールに当てはまれば `monitoring` に追加
4. 朝サマリーを管理者LINEへ送信

---

## 3. 異常検知ルール（v1）

| メトリック | 警告条件 | severity |
|---|---|---|
| ad_cpa_yen | 直近7日平均の **150%** 超 | warn |
| ad_cpa_yen | 直近7日平均の **200%** 超 | critical |
| line_friends_added | 直近7日平均の **50%** 未満 | warn |
| cancellations | 1日 **3件以上** | warn |
| cancellations | 1日 **5件以上** | critical |
| colorist_avg_response_min | **240分（4時間）** 超 | warn |
| counseling_completed | 7日連続 **0件** | warn |

severity = critical の場合は静音モード（22:00-07:00）でも管理者LINEへ通知。

---

## 4. 朝サマリーのテンプレ（管理者LINEへ）

```
🔷 F日次サマリー 2026-06-MM

📈 前日数値
登録: +2（累計 31 / 30名目標）
サブスク: +1（累計 3 / 30名目標 ← 月内ペース要加速）
解約: 0
広告消化: ¥800 / CPA ¥800

📊 前週比
登録 +33% / カウンセリング +20% / 課金 横ばい

⚠ 注意
今週のカウンセリング→課金CVRが20%下降
→ I-Funnel でテスト中の初月無料施策の結果待ち

🎯 今日の優先論点
- 既存28名の解約防止カード3件、未承認
- A の Week 2 Reels D9 撮影分の編集着手
```

---

## 5. ダッシュボード（手動・Sheets上）

シート `dashboard` を追加：

- グラフ1：直近30日のサブスク数推移（折れ線）
- グラフ2：直近30日のCPA推移（折れ線）
- グラフ3：ファネル4ステップのCVR現状値（棒）
- ボード：5,000名ゴールまでの進捗バー
- ボード：月予算3万円の消化バー

これらは Sheets の `=SPARKLINE()` や条件付き書式で実装可能。

---

## 6. ユーザー承認事項

- [ ] 列構成OK？追加したい指標ある？
- [ ] 自動入力 vs 手入力の切り分け、Stripe・Meta APIまで連携してOK？
- [ ] 異常検知のしきい値、現状でOK？（運用しながら調整）
- [ ] D Issue #5 を CODEX に投げる順番（Issue #6 の後で）

---

## 7. このSheet完成後にできること

- F が毎朝、前日数値を自動で読みに行ける
- 異常を即検知して管理者LINEへ
- 月末締めの目標進捗を自動可視化
- A/Bテストの結果も同じ場所で管理
- 全エージェントが「同じ数字」を参照できる（真実の単一情報源）
