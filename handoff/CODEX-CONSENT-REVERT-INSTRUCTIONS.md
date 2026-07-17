# CODEX 指示書｜同意書を v1 に戻す

作成日: 2026-06-10
依頼者: ユーザー（hanma.baki.ooga）
対象リポジトリ: `hanmabakiooga-rgb/line-harness-oss`
作業ブランチ: `revert/consent-v1-2026-06-10`

---

## 1. ゴール（一言）

同意書を **v3（署名キャンバス・スクロール検知・氏名カナ/メール/電話・PDF生成）以前の v1（シンプルなチェックボックス＋同意ボタン）** に戻す。

理由：v3 は法的強化を狙ったが、UX を複雑にしすぎてサブスク獲得の足を引っ張るため。本質はサブスク獲得であり、同意書に工数をかけるべきではない、という意思決定。

---

## 2. やること

### 2-1. 該当ファイルを v3 マージ前の状態に戻す

以下のファイルを、**consent v3 が入る前のコミット**に戻す：

- `apps/worker/src/routes/consent.ts`
- `apps/worker/src/client/consent-form.ts`
- `apps/worker/src/lib/consent-pdf.ts`（v3 で新規追加されたなら削除）
- `apps/worker/src/client/main.ts`（consent 関連の追加分のみ revert）
- `packages/db/schema.sql`（v3 で追加された `consent_logs` 拡張列・`consent_withdrawals` テーブルは残してOK。使われないだけ）
- `scripts/consent-v3-2026-06-08.sql`（残してOK、本番には適用しない）
- `scripts/consent-legal-v3-2026-06-08.sql`（残してOK）

### 2-2. 復旧手順（推奨）

```bash
# 1. consent v3 が入る前のコミットSHAを特定
git log --oneline apps/worker/src/routes/consent.ts

# 2. v1 時点のコミット（v3 マージ直前）のSHAを把握したら：
git checkout <v1時点のSHA> -- apps/worker/src/routes/consent.ts
git checkout <v1時点のSHA> -- apps/worker/src/client/consent-form.ts

# 3. v3 で新規追加されたファイルを削除
rm apps/worker/src/lib/consent-pdf.ts  # 存在すれば

# 4. ビルド・テストが通ることを確認
pnpm install
pnpm -F worker typecheck
pnpm -F worker test
pnpm -F web typecheck

# 5. PR作成
git checkout -b revert/consent-v1-2026-06-10
git add -A
git commit -m "revert(consent): restore v1 simple checkbox flow, drop v3 signature/PDF flow"
git push -u origin revert/consent-v1-2026-06-10
```

### 2-3. 残す部分（消さないこと）

以下は **v3 とは独立した別系統** なので絶対に消さない：

- `apps/worker/src/routes/admin-notify.ts`（管理者通知Bot本体）
- `apps/worker/src/middleware/auth.ts` の admin-notify 認証スキップ
- `apps/worker/wrangler.toml` の `ADMIN_NOTIFY_DAILY_LIMIT`
- `packages/db/schema.sql` の `admin_notify_logs` テーブル
- `scripts/admin-notify-2026-06-07.sql`
- `apps/web/src/app/admin-notify/page.tsx`
- `apps/web/src/components/layout/sidebar.tsx` の admin-notify メニュー
- `apps/web/src/lib/api.ts` の admin-notify API client
- PR #7（funnel: waiting_counseling）、PR #8（admin counseling tab）の変更

### 2-4. データベース

本番 D1 で **`consent-v3-2026-06-08.sql` は実行しない**。
（v1 同意書は既存スキーマでそのまま動くため、migration 不要）

すでに本番に適用済みなら **追加列は無視して放置**。実害なし。

---

## 3. 動作確認

PR作成後、ユーザーがLINEから同意書URLを開いて：

1. v1 のチェックボックス UI が表示されること
2. チェックを入れて「同意する」ボタンを押せること
3. 同意完了後、通常フロー（カウンセリングや LINE への戻り）に進めること

---

## 4. PR タイトル・本文テンプレ

**タイトル**:
```
revert(consent): restore v1 simple checkbox flow
```

**本文**:
```
## 概要
同意書を v1（チェックボックス＋同意ボタン）に戻す。

## 背景
v3 で署名キャンバス・スクロール検知・PDF生成を導入したが、サブスク獲得という本質ゴールに対して工数過剰と判断。v1 で運用継続する。

## 変更
- apps/worker/src/routes/consent.ts を v1 に restore
- apps/worker/src/client/consent-form.ts を v1 に restore
- v3 用の lib/consent-pdf.ts を削除（存在すれば）

## 影響しない範囲（残すもの）
- 管理者通知Bot（admin-notify.ts ほか）
- PR #7（funnel waiting_counseling）
- PR #8（admin counseling tab）
- DBスキーマの v3 用拡張列は残置（無害）

## テスト
- worker typecheck/test PASS
- web typecheck PASS
- 実機LINEから同意書URL→チェック→送信のフロー確認は merge 後にユーザーが実施
```

---

## 5. 完了報告フォーマット

PR を作ったら、以下をユーザーに報告：

```
完了：
- ブランチ: revert/consent-v1-2026-06-10
- PR: https://github.com/hanmabakiooga-rgb/line-harness-oss/pull/<番号>
- typecheck/test: PASS
- 残作業: ユーザーがマージボタンを押す → 本番 Worker 再デプロイ → 実機LINE確認
```
