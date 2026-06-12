# J実働：カラーリストダッシュボード D Issue 確定版

実行: エージェントJ（オペレーション）
作成日: 2026-06-12
状態: **CODEX投入可能**（J-colorist-dashboard.md を実装仕様に昇華）

---

## D Issue #7：カラーリスト稼働ダッシュボード MVP

### タイトル
`feat(admin): colorist workload dashboard MVP`

### 本文（CODEX に貼り付け用）

```markdown
## 目的
川崎さんの稼働状況をリアルタイムで見える化し、
過稼働の検知・顧客未接触アラート・解約リスク管理を自動化する。

## 実装範囲（MVP）
yuki-pj/handoff/agent-outputs/J-colorist-dashboard.md §2 のセクション①〜③のみ。
振り返りフォーム・月次レポートは v2 以降。

---

## 画面：apps/web/src/app/admin/colorist/page.tsx（新規）

### セクション①：今日の状況カード

\`\`\`tsx
<div className="grid grid-cols-2 gap-4">
  <StatCard label="本日の相談件数"   value={todayStats.consultations}  unit="件" />
  <StatCard label="平均応答時間"     value={todayStats.avgResponseMin}  unit="分" />
  <StatCard label="営業時間内処理率" value={todayStats.inHoursRate}     unit="%" />
  <StatCard label="連続稼働日数"     value={todayStats.consecutiveDays} unit="日" />
</div>
```

### セクション②：警告アラートカード

警告判定閾値：
- 連続稼働 6日以上 → 🟡 warning
- 日次件数 25件超 → 🟡 warning
- 平均応答時間 240分（4時間）超 → 🟡 warning
- 営業時間外着信 24時間で5件超 → 🔴 danger

### セクション③：顧客接触マップ（リスト形式）

| 列 | 内容 |
|---|---|
| 顧客名（匿名ID） | LINE表示名 |
| 最終接触日 | last_contact_at |
| 状態 | 14日/30日/カウンセリング未完了 |
| アクション | 「H に渡す」ボタン |

---

## API：apps/worker/src/routes/colorist-dashboard.ts（新規）

### GET /api/colorist/today

```ts
// D1 クエリ
SELECT
  COUNT(*) FILTER (WHERE direction='outbound' AND DATE(created_at) = DATE('now','localtime')) AS consultations,
  AVG((kawasaki_reply_at - customer_message_at)/60) AS avg_response_min,
  COUNT(*) FILTER (WHERE time_of_day BETWEEN '09:00' AND '19:00') * 100.0 / COUNT(*) AS in_hours_rate
FROM messages_log
WHERE DATE(created_at) >= DATE('now', '-7 days', 'localtime')
```

レスポンス形式：
```json
{
  "consultations": 14,
  "avgResponseMin": 110,
  "inHoursRate": 92,
  "consecutiveDays": 5
}
```

### GET /api/colorist/alerts

```ts
// アラート判定を Worker 側で実施
const alerts = []
if (consecutiveDays >= 6) alerts.push({ level: 'warning', message: '連続稼働6日：明日の休息を検討してください' })
if (todayConsultations >= 25) alerts.push({ level: 'warning', message: '本日の相談件数が25件を超えています' })
if (avgResponseMin >= 240) alerts.push({ level: 'danger', message: '平均応答時間が4時間を超えています' })
return { alerts }
```

### GET /api/colorist/at-risk-customers

```ts
// 未接触顧客リスト
SELECT customer_id, display_name, last_contact_at,
  CASE
    WHEN counseling_completed = FALSE THEN 'counseling_pending'
    WHEN last_contact_at < DATE('now', '-30 days') THEN '30d_no_contact'
    WHEN last_contact_at < DATE('now', '-14 days') THEN '14d_no_contact'
  END AS risk_level
FROM customers
WHERE status = 'paying'
  AND (
    counseling_completed = FALSE
    OR last_contact_at < DATE('now', '-14 days', 'localtime')
  )
ORDER BY last_contact_at ASC
```

---

## D1 Schema 追加（migration）

```sql
-- messages_log に応答時間カラムを追加
ALTER TABLE messages_log ADD COLUMN kawasaki_reply_at INTEGER;  -- Unix timestamp
ALTER TABLE messages_log ADD COLUMN customer_message_at INTEGER;

-- customers テーブルに接触管理カラムを追加
ALTER TABLE customers ADD COLUMN last_contact_at TEXT;
ALTER TABLE customers ADD COLUMN counseling_completed INTEGER DEFAULT 0;
ALTER TABLE customers ADD COLUMN consecutive_work_days INTEGER DEFAULT 0;
```

---

## 権限制御

- `colorist` ロールのユーザーにのみ `/admin/colorist` を表示
- 自分（川崎さん）の統計のみ表示（将来的に複数カラーリストに対応するため `colorist_id` でフィルタ）

---

## 完了条件

- [ ] typecheck PASS
- [ ] 既存の admin ページが壊れていない
- [ ] `colorist` ロールでログイン時に `/admin/colorist` が表示される
- [ ] `StatCard` 4枚、アラートカード、接触マップリストが表示される
- [ ] API 3本が 200 を返す（D1 が空でも 0 で返す）

## ラベル
code-task, agent-D, priority-medium
```

---

## スケール判断トリガー（CODEX実装後に自動化）

| サブスク数 | ダッシュボード表示 | アクション |
|---|---|---|
| 0〜100名 | 青（健全） | - |
| 100〜130名 | 黄（注意） | 「カラーリスト2人目の採用候補をリストアップ」バナー表示 |
| 130〜150名 | 橙（警告） | 「新規受付の一時停止を検討」バナー + ユーザーLINE通知 |
| 150名超 | 赤（危険） | 「川崎さんの上限に達しています」+ ユーザー即時通知 |

現在28名 → スケール判断は先の話だが、仕組みとして最初から入れておく。

---

## 実装優先度（D Issues 全体の中での位置づけ）

```
Issue #6 Flex Message（進行中）
  ↓
Issue #1 LP リライト（次）
  ↓
Issue #2 Bot 自動応答更新
  ↓
Issue #5 KPI cron
  ↓
Issue #7 カラーリストダッシュボード（この Issue）← ここ
  ↓
Issue #4 アフィリエイト管理画面
Issue #3 写真同意書テンプレ
```

---

## ユーザー承認事項

- [ ] API設計（/api/colorist/today, /alerts, /at-risk-customers）OK？
- [ ] D1 migration で messages_log に応答時間カラムを追加してOK？
- [ ] 川崎さんの上限を150名と仮定、ダッシュボードの表示に入れてOK？
- [ ] Issue #7 として CODEX に投入してOK？（Issue #6 完了後）
