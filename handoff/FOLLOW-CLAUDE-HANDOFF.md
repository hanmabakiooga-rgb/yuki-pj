# FOLLOW プロジェクト Claude引き継ぎドキュメント

作成日時: 2026-06-08
作成者: Claude (yuki-pjセッション)
引き継ぎ先: 新Claudeセッション（line-harness-ossスコープ）

このドキュメントは、新セッションを `hanmabakiooga-rgb/line-harness-oss` リポジトリで立ち上げた際、新しいClaudeインスタンスが即座に文脈を引き継いで動けるよう作成。

新Claudeへの一言：**まず本ドキュメントを最後まで読んで、次に「現状の進捗」と「次のタスク」を確認し、ユーザーに「引き継ぎ完了。次は◯◯から進めますか？」と返してください。**

---

## 1. プロジェクト概要

- サービス名：**FOLLOW｜気になるところだけカラー**
- 内容：分け目・顔まわり・生え際など「次の美容室まで気になるところだけ」を、現役カラーリストがLINEで個別に確認・処方するセルフカラー相談サービス
- 月額：880円（税込）
- 運営：個人事業／個人運営（屋号・代表は環境変数で管理）
- 競合：株式会社カラリス（coloris.shop）—— 全頭セルフカラーD2C、月3,940〜4,930円。FOLLOWは「部分染め＋LINE個別相談」で差別化

---

## 2. ゴール（数字）

| 期間 | 目標 |
|---|---|
| 1ヶ月 | LINE登録 27→100名 / サブスク 2→**30名（再設定）** |
| 1年 | サブスク **5,000名** |

達成のための制約：
- 広告予算：**月3万円（1日1,000円）から**
- カラーリストは**川崎さん1人**（限界まで人力、その後2人目検討）
- AIで自動化できる部分は最大限自動化（私=Claudeが経営代行）

---

## 3. 役割分担（合意済み）

| | 担当 | 内容 |
|---|---|---|
| 戦略・コピー・KPI・設計 | **Claude** | このまま私 |
| コード実装 | **Claude（PRベース）** | line-harness-ossリポにPR |
| 朝の承認・支払い・最終判断 | **ユーザー** | LINEで承認、支払いのみ手動 |
| 顧客への処方判断 | **川崎さん（人間カラーリスト）** | AI補助はOK、判断は人 |
| 簡易修正 | **Codex（補助）** | 必要に応じて |

**支払い上限**：月3万円（広告）。他の都度支払いは個別承認必須。

---

## 4. これまでの重要な意思決定

### 4-1. 同意書ポリシー
- **返金保証は設けない**（染まり判定が公平に作れないため）
- 代わりに **「いつでも解約・縛りなし」** を旗にする
- 同意書はv3で**法的強化**する：施術主体は本人、FOLLOWは情報提供サービス、免責は「故意・重過失を除く」を明示

### 4-2. 取得情報の方針
- 同意書では氏名・氏名カナ・メール・電話のみ
- **生年月日・住所は取得しない**
- 要配慮個人情報（病歴・アレルギー）は**カウンセリングフォーム側**で取得

### 4-3. 同意書のUX
- 個別チェックボックス14個 → **最終1個だけ**に変更
- スクロール最下部到達検知＋電子署名（手書きキャンバス＋氏名タイプ）で既読・同意を担保
- PDF生成→LINE本人交付＋管理者通知

### 4-4. 管理者通知
- 顧客向けLINE Botとは別の**管理者専用LINE Bot**を新設
- 既にローカル実装済（apps/worker/src/routes/admin-notify.ts ほか）
- 本番デプロイ未実施

### 4-5. オーケストレーター（自動運転）構想
- ユーザーが朝「おはよう」とClaudeに話しかける → Claudeが状態ストア（GitHubリポ＋Google Sheets）を読んで6 Agent並列発火 → 承認キューを管理者LINEへ
- 起動方式：C（手動「おはよう」） / コスト¥0
- 通知先：個人LINE（別Bot）

---

## 5. セキュリティ・禁止事項

### 絶対やってはいけない
- Secret値（API Token / Channel Secret / User ID）を**チャット履歴に貼らない／ログに出さない／コミットしない**
- `.env` `.dev.vars` のコミット
- 「動作確認のためトークン表示」の仮実装
- 本番デプロイ・本番D1 migration・実LINE送信を**ユーザー明示承認なしで実行**
- ユーザーアカウント（hanma.baki.ooga@gmail.com）以外への何らかの送信

### コピー・文言の禁止
- 「全額返金」「返金保証」「効果がなければ返金」
- 「絶対に失敗しない」「100%染まる」「プロ品質保証」
- 「美容室不要」「美容室に行かなくていい」
- 「誰でも安全」「ブリーチ毛でも安心」
- 効能効果の断定（薬機法／景表法対応）

---

## 6. 現状の進捗

### 完了
- **同意書v1**：デプロイ済（広報文寄り、法的に弱い、v3で全面差し替え予定）
- **管理者通知Bot**：ローカル実装完了（typecheck/build/local D1 migration済）
  - `apps/worker/src/routes/admin-notify.ts` 新規
  - `apps/worker/src/index.ts` ルート追加
  - `apps/worker/src/middleware/auth.ts` 認証スキップ設定
  - `apps/worker/wrangler.toml` に `ADMIN_NOTIFY_DAILY_LIMIT = "10"` 追加
  - `packages/db/schema.sql` に `admin_notify_logs` 追加
  - `scripts/admin-notify-2026-06-07.sql` migration SQL
  - `apps/web/src/app/admin-notify/page.tsx` 管理画面
  - `apps/web/src/components/layout/sidebar.tsx` メニュー追加
  - `apps/web/src/lib/api.ts` API client追加

### 未実施
- 管理者通知Bot：Secret設定（ユーザー手動：`wrangler secret put`）
- 管理者通知Bot：本番D1 migration / Cloudflare deploy / 実LINE送信
- **同意書v3の実装**（仕様書は完成、Codexまたは新Claudeに実装させる）
- 既存28名向け再同意LINE文の作成・送信
- カウンセリングフォーム（要配慮情報の取得）の仕様書・実装
- `prompts/orchestrator.md` の作成
- Google Sheets KPIダッシュボード
- LPレビュー
- SNS投稿バックログ（3週間分）

### 未コミット差分
- C:\FOLLOW\line-harness-oss にはユーザー手元で**複数の未コミット差分が混在**
- そのうち管理者通知Bot関連は上記のとおり
- それ以外の差分も含まれているので、PR切る前に必ず `git status` で確認

---

## 7. 次のタスク（優先順）

### Step 1：管理者通知Botの本番デプロイ
- ユーザー手動：Secret設定（4本）
  - ADMIN_BOT_CHANNEL_SECRET
  - ADMIN_BOT_ACCESS_TOKEN
  - ADMIN_LINE_USER_ID
  - ADMIN_NOTIFY_SHARED_SECRET（`openssl rand -hex 32` で生成）
- ユーザー手動：LINE Developers Consoleで新Botのチャンネル作成・友だち追加
- 本番D1 migration（`scripts/admin-notify-2026-06-07.sql` を `--remote` で）
- Worker / Pages デプロイ
- ユーザーのLINEでテスト通知（info / payment_request の2種）
- 連続2回送信で2回目スキップ確認、11回送信で日次上限拒否確認

### Step 2：同意書v3の実装
- 仕様書：本ドキュメント末尾に添付（または別ファイル）
- 実装対象：`apps/worker/src/routes/consent.ts` ほか
- DB拡張：`consent_logs` に氏名・氏名カナ・メール・電話・既読時刻・署名URL・PDF URLなど追加
- PDF生成：pdf-lib＋Noto Sans JP
- LINE添付送信＋管理者通知Bot連携
- 既存v1から旧文言の削除（「返金」「保証」「全頭セルフ推奨」等）
- consent_version を上げて既存ユーザーに再同意フローを発動

### Step 3：既存28名向け再同意LINE文の送信
- 文面案：本ドキュメントの「9. テンプレ」を参照
- 一斉送信は LINE Botのpush API経由（既存 messages_log で送信履歴管理）

### Step 4：カウンセリングフォーム強化
- 要配慮個人情報の取得（PIPA準拠）
- ヘアカラー履歴・頭皮の状態・妊娠/授乳の有無等
- 別途指示書を作成（私が書く予定だった）

### Step 5：オーケストレーター運用開始
- `prompts/orchestrator.md` を作成
- 「おはよう」起動でClaude→Sheets/D1→6Agent並列発火→管理者通知Bot push
- 初週は人力で承認、徐々に信頼を上げる

---

## 8. 関連ファイルマップ（line-harness-oss）

| パス | 役割 |
|---|---|
| `apps/worker/src/index.ts` | Workerエントリポイント、route登録 |
| `apps/worker/src/routes/admin-notify.ts` | 管理者通知Bot（新規・実装済） |
| `apps/worker/src/routes/consent.ts` | 同意書（v1実装あり、v3で書き換え予定） |
| `apps/worker/src/routes/counseling.ts` | カウンセリング（要強化） |
| `apps/worker/src/middleware/auth.ts` | 認証 |
| `apps/worker/wrangler.toml` | Worker設定（環境変数追加先） |
| `apps/web/src/app/admin-notify/page.tsx` | 管理画面の通知テスト |
| `apps/web/src/app/consent/*` | 同意書のフロント |
| `apps/web/src/components/layout/sidebar.tsx` | 管理画面サイドバー |
| `apps/web/src/lib/api.ts` | フロントAPI client |
| `packages/db/schema.sql` | DBスキーマ |
| `scripts/*.sql` | D1 migration |

---

## 9. 既存28名向け再同意LINE文（テンプレ）

```
FOLLOWをご利用いただきありがとうございます。

このたび、同意書の内容を法的に整備し直しました。
引き続き安心してご利用いただくため、新しい同意書へのご署名をお願いいたします。

▼ 同意書はこちら
{consentUrl}

ご署名後、これまでと同じようにご利用いただけます。
ご不明な点があればお気軽にご返信ください。

― FOLLOW運営事務局
```

---

## 10. 同意書v3 仕様（要点のみ・詳細は別途）

### 取得情報
- 氏名（漢字フルネーム）
- 氏名フリガナ
- メールアドレス
- 電話番号
- **生年月日・住所は取得しない**

### UI
- スマホファースト
- 同意書本文は全文展開（折りたたみNG）
- IntersectionObserverでスクロール最下部到達検知
- 到達まで署名欄非表示
- 最終チェック1個：「私は満18歳以上であり、上記すべての内容を読み、自由な意思で同意します」
- 電子署名キャンバス（手書き）＋氏名タイプ（自動転記）
- 送信ボタンはすべて揃ったときのみ活性化

### サーバー検証
- CSRF
- 全必須項目あり
- `scrolled_to_bottom_at` が `agreed_at` より60秒以上前
- 署名画像の描画ピクセル数チェック
- レートリミット1uid/min 10回
- IPはSHA256+saltでハッシュ化保存

### 送信後
- 署名画像をR2/オブジェクトストレージ保存
- PDF生成（A4縦、Noto Sans JP、同意書全文＋利用者情報＋署名＋日時＋文書ID）
- LINE本人へPDF添付送信
- 管理者通知Botへ「同意完了」通知
- `consent_logs` に記録
- `?page=counseling&uid={uid}` へリダイレクト

### 同意書本文（章立て）
- Section A：運営者情報（特商法表記）
- Section B：サービス内容と契約の性質（施術主体は本人を明示）
- Section C：本人情報入力欄
- Section D：個人情報・写真の取扱い（PIPA準拠）
- Section E：料金と解約
- Section F：禁止事項・反社条項
- Section G：免責・自己責任（**「故意または重大な過失を除く」を必ず明記**）
- Section H：準拠法および管轄
- Section I：単一同意＋電子署名

### 環境変数（既存に追加）
- OPERATOR_LEGAL_NAME
- OPERATOR_REPRESENTATIVE
- OPERATOR_ADDRESS
- OPERATOR_CONTACT_EMAIL
- OPERATOR_CONTACT_PHONE
- OPERATOR_PRIVACY_OFFICER
- CONSENT_VERSION
- CONSENT_RETENTION_YEARS
- JURISDICTION_COURT

詳細仕様は前セッションで作成済（このドキュメントの末尾に貼り付けるか、別ファイルで提供可能）。

---

## 11. 競合（coloris.shop）の差別化スキマ（戦略のコアメッセージ）

FOLLOWが攻めるべき7つのスキマ：

1. **「リタッチ専用」カテゴリの空白** — カラリスは毎回全頭セット
2. **LINEで個別相談** — カラリスは選択式11問のみ
3. **月880円という価格帯** — カラリス最安2,178円〜4,930円
4. **「染めない判断もする」誠実訴求** — カラリスは止められない
5. **即応性** — 受注生産・郵送のカラリスにはできない
6. **ジアミンアレルギー・複雑髪履歴の受け皿**
7. **美容室通いの継続を前提にした「次の美容室までの繋ぎ」**

---

## 12. 新Claudeへの最初の指示

新セッションを `hanmabakiooga-rgb/line-harness-oss` で立ち上げたら、新Claudeは：

1. **本ドキュメントを最後まで読む**
2. リポジトリのルート構造を `mcp__github__get_file_contents` で確認
3. `apps/worker/src/routes/admin-notify.ts` を読んで実装内容を把握
4. `packages/db/schema.sql` を読んで DB現状を把握
5. ユーザーに以下を返す：

```
引き継ぎ完了しました。
現状：管理者通知Botがローカル実装完了、本番デプロイ待ち。
次のタスク：
  A. 管理者通知Botの本番デプロイ（Secret設定＋migration＋deploy）
  B. 同意書v3の実装（仕様書あり）
  C. 既存28名向け再同意LINE文の確定
どれから進めますか？
```

---

## 13. ユーザーへの確認事項（新セッション起動時に必ず聞く）

- 引き継ぎドキュメントの内容に追加・変更はないか
- 本番デプロイの実施可否（事前承認なしには実施しない）
- Secret設定の完了状況
- 未コミット差分の状況（`git status` の結果を共有してもらう）

---

## 14. 制約まとめ（再掲・重要）

- 私（Claude）の権限：**読み取り＋ブランチ作成＋PR作成まで**。本番反映はユーザー承認後
- Secret値は**チャットに貼らない・ログに出さない・コミットしない**
- 未コミット差分は他作業と混在しているので、PR切る前に必ず差分確認
- 月3万円を超える支払いは個別承認必須

---

以上。本ドキュメントを新セッションの最初のメッセージとして貼り付けてください。
