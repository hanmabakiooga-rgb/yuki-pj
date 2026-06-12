# F実働：FOLLOW-KPI Google Sheets セットアップ手順書

実行: エージェントF（分析）
作成日: 2026-06-12
状態: **今すぐ実行可能**（所要30分）
前提: シートURL https://docs.google.com/spreadsheets/d/1Xshvq2dIJKoTLwU8E4VBR-alySOW42h96Uh7NQji4B0/edit

---

## Step 1：シートタブを5つ作成する（5分）

1. 上記URLを開く
2. 画面下のタブ「+」を4回クリック
3. タブ名を以下に変更（タブをダブルクリック → 名前を変更）：
   - `daily`
   - `weekly`
   - `monthly`
   - `experiments`
   - `monitoring`
   - `dashboard`（計6タブ）

---

## Step 2：`daily` シートのヘッダー行（10分）

`daily` タブを開き、**A1からP1** に以下を入力：

| セル | 入力値 |
|---|---|
| A1 | date |
| B1 | lp_visits |
| C1 | lp_uniques |
| D1 | line_friends_added |
| E1 | counseling_completed |
| F1 | first_payment |
| G1 | active_subscriptions |
| H1 | cancellations |
| I1 | ad_spend_yen |
| J1 | ad_impressions |
| K1 | ad_clicks |
| L1 | ad_cpa_yen |
| M1 | sns_total_engagement |
| N1 | colorist_consultations |
| O1 | colorist_avg_response_min |
| P1 | notes |

**L列（ad_cpa_yen）の計算式** を2行目以降に設定：

- L2セルをクリック
- 数式バーに入力：`=IF(F2>0, I2/F2, "")`
- L2を右クリック → 「コピー」→ L3:L1000 を選択 → 「貼り付け」

**1行目のスタイル設定（見やすく）：**

- A1:P1 を選択 → 背景色を濃いグレー（#424242）→ 文字色を白 → 太字

---

## Step 3：`weekly` シートのヘッダー行（5分）

`weekly` タブを開き、**A1からR1** に以下を入力：

| セル | 入力値 |
|---|---|
| A1 | week_start |
| B1 〜 O1 | daily と同じ（B〜O のキー名をそのままコピー） |
| P1 | goal_achievement_rate |
| Q1 | wow_change_rate |

---

## Step 4：`monthly` シートのヘッダー行（5分）

`monthly` タブを開き、**A1からT1** に以下を入力：

| セル | 入力値 |
|---|---|
| A1 | month |
| B1 〜 O1 | daily と同じ（B〜O のキー名） |
| P1 | goal_achievement_rate |
| Q1 | progress_to_5000 |
| R1 | cac |
| S1 | ltv_estimate |
| T1 | notes |

**R列（CAC）の計算式** を2行目以降に設定：

- R2：`=IF(F2>0, I2/F2, "")`

**S列（LTV推定）** は手動入力（平均継続月数が出たら）：

- S2：`=880 * 平均継続月数`（月ごとに手入力）

---

## Step 5：`experiments` シートのヘッダー行（3分）

`experiments` タブを開き、A1:L1 に以下を入力：

| セル | 入力値 |
|---|---|
| A1 | experiment_id |
| B1 | name |
| C1 | start_date |
| D1 | end_date |
| E1 | group_a_label |
| F1 | group_b_label |
| G1 | group_a_size |
| H1 | group_b_size |
| I1 | group_a_conversion |
| J1 | group_b_conversion |
| K1 | result |
| L1 | notes |

---

## Step 6：`monitoring` シートのヘッダー行（3分）

`monitoring` タブを開き、A1:F1 に以下を入力：

| セル | 入力値 |
|---|---|
| A1 | timestamp |
| B1 | metric_name |
| C1 | actual_value |
| D1 | expected_value |
| E1 | severity |
| F1 | alerted |

---

## Step 7：`dashboard` シートにグラフを設定（5分）

1. `daily` シートのデータが2行以上入力されたら設定可能
2. 現時点では見出しだけ入力しておく：

| セル | 入力値 |
|---|---|
| A1 | FOLLOW KPI ダッシュボード |
| A3 | サブスク数推移（直近30日）|
| A10 | CPA推移（直近30日）|
| A17 | ファネルCVR |
| A24 | 5,000名ゴール進捗 |

グラフはデータが蓄積されてから挿入（「挿入 → グラフ」）。

---

## Step 8：初日の手動入力（今日すぐやる）

`daily` シートのA2に今日の日付を入力してテスト：

| セル | 入力値 |
|---|---|
| A2 | 2026-06-12 |
| B2 | 0 （LP訪問数、まだ計測前なら0） |
| D2 | 0 （LINE友達追加数） |
| G2 | 28 （現在のサブスク数） |
| P2 | 初期値投入 |

---

## Step 9：サービスアカウントのアクセス権付与（CODEX実装前に準備）

D Issue #5（KPI cron）が実装されたとき、Worker が Sheets を書き込めるようにする：

1. Google Cloud Console で `FOLLOW` プロジェクトを確認（なければ作成）
2. 「IAM と管理 > サービスアカウント」→ 「サービスアカウントを作成」
3. 名前：`follow-worker-sheets`
4. キー作成：JSON キーをダウンロード
5. Sheets 共有設定：シートを開く → 共有 → `follow-worker-sheets@{project}.iam.gserviceaccount.com` を「編集者」で追加
6. JSON キーの内容を wrangler secrets に登録（`SHEETS_SERVICE_ACCOUNT_JSON`）

※ Step 9 は CODEX が実装着手するまでに準備しておくだけでOK。

---

## 完了チェックリスト

- [ ] 6タブ作成（daily / weekly / monthly / experiments / monitoring / dashboard）
- [ ] daily ヘッダー行（A1:P1）入力
- [ ] L列の計算式（ad_cpa_yen）設定
- [ ] weekly / monthly / experiments / monitoring ヘッダー行入力
- [ ] daily に初日の手動値（A2:G2）を入力
- [ ] （CODEX前に）Google Cloud サービスアカウント作成

---

## 完了後にできること

✅ F が毎朝07:15 に前日値を読んで、管理者LINEに自動サマリーを送れる  
✅ 異常（CPA高騰・解約急増）を自動検知してアラートを送れる  
✅ 川崎さんが今日の状況をスマホで確認できる  
✅ 全エージェントが同じKPI数字を参照できる（真実の単一情報源）
