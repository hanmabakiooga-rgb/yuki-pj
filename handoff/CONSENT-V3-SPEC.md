# 同意書v3 実装仕様書（line-harness-oss）

作成日時: 2026-06-08
対象リポジトリ: hanmabakiooga-rgb/line-harness-oss
担当: 新Claude（line-harness-ossセッション）
前提: 本ドキュメント単独で実装可能。v1/v2への参照は不要。

---

## 0. 背景と設計の柱

FOLLOWは「気になるところだけ」のセルフカラー相談サービス（月額880円）。
現在の同意書（v1：広報文寄り）を全面的に書き直し、**法的強度を保ったままUXを最適化**する。

### 設計の柱

1. **施術主体は利用者本人**。FOLLOWは情報提供・助言サービスであり、染色行為そのものは行わない
2. **チェックボックスは最終1個のみ**。個別チェックは離脱要因のため不採用
3. **既読証跡はスクロール最下部到達で取得**（法的に「内容を確認できる状態」を担保）
4. **電子署名（手書きキャンバス＋氏名タイプ）でなりすまし防止**
5. **要配慮個人情報の取得は同意書ページから切り離し、次のカウンセリングフォームで取得**
6. **生年月日・住所は取得しない**（必要最小限の原則）
7. 免責は「故意または重大な過失を除く」を本文に明記（消費者契約法8条対応）

---

## 1. 影響範囲

### 1-1. 改修・新設するファイル（line-harness-oss）

| ファイル | 種別 |
|---|---|
| `apps/worker/src/routes/consent.ts` | 改修（既存v1を全面書き換え） |
| `apps/worker/src/routes/consent-withdraw.ts` | 新設（同意撤回フロー） |
| `apps/worker/src/lib/consent-pdf.ts` | 新設（PDF生成） |
| `apps/worker/src/lib/consent-validate.ts` | 新設（バリデーション・既読検証） |
| `apps/worker/src/middleware/auth.ts` | 改修（/api/consent をパブリックパスに） |
| `apps/worker/src/index.ts` | 改修（新ルート登録） |
| `apps/worker/wrangler.toml` | 改修（環境変数・R2バインディング追加） |
| `packages/db/schema.sql` | 改修（consent_logs/consent_withdrawals追加・拡張） |
| `scripts/consent-v3-2026-06-08.sql` | 新設（D1 migration） |
| `apps/web/src/app/consent/page.tsx` | 改修（v3UI） |
| `apps/web/src/app/consent/components/SignatureCanvas.tsx` | 新設 |
| `apps/web/src/app/consent/components/ScrollSentinel.tsx` | 新設 |
| `apps/web/src/app/consent-withdraw/page.tsx` | 新設 |
| `apps/web/src/app/admin/customers/[uid]/consent.tsx` | 新設（同意状態表示） |
| `apps/web/src/lib/api.ts` | 改修（consent v3 API追加） |

### 1-2. 触らないもの

- LINE Botのwebhookハンドラ本体
- 顧客テーブル `customers` の基幹カラム
- `messages_log` テーブル
- 既存の認証・UID解決ロジック（パブリックパスに追加するだけ）
- 管理者通知Bot（`admin-notify`）— 連携先として使うのみ

---

## 2. 環境変数（追加）

`wrangler.toml` の `[vars]` および Secrets に追加。

```
# vars（公開可）
CONSENT_VERSION = "2026-06-08-v3"
CONSENT_RETENTION_YEARS = "5"

# vars（運営者情報・公開可）
OPERATOR_LEGAL_NAME = "（屋号 or 法人名）"
OPERATOR_REPRESENTATIVE = "（代表者氏名）"
OPERATOR_ADDRESS = "（所在地）"
OPERATOR_CONTACT_EMAIL = "（連絡先メール）"
OPERATOR_CONTACT_PHONE = ""  # 任意
OPERATOR_PRIVACY_OFFICER = "（個人情報保護管理者氏名）"
JURISDICTION_COURT = "東京簡易裁判所及び東京地方裁判所"

# Secrets（wrangler secret put）
IP_HASH_SALT  # IPハッシュ化用ソルト（openssl rand -hex 32 で生成）
```

**運営者情報の実値はユーザーが `wrangler secret put` または `wrangler.toml` の `[env.production.vars]` に設定。新Claudeには値を見せない。**

### R2バインディング

```toml
[[r2_buckets]]
binding = "CONSENT_PDFS"
bucket_name = "follow-consent-pdfs"
preview_bucket_name = "follow-consent-pdfs-preview"
```

ユーザー手動：`wrangler r2 bucket create follow-consent-pdfs` を本番／プレビューで実行。

---

## 3. データモデル

### 3-1. `consent_logs` テーブル（拡張）

既存v1の `consent_logs` がある場合は `ALTER TABLE` で追加。なければ CREATE。

```sql
-- migrations/consent-v3-2026-06-08.sql

-- 既存テーブルがある場合
ALTER TABLE consent_logs ADD COLUMN full_name TEXT;
ALTER TABLE consent_logs ADD COLUMN full_name_kana TEXT;
ALTER TABLE consent_logs ADD COLUMN email TEXT;
ALTER TABLE consent_logs ADD COLUMN phone TEXT;
ALTER TABLE consent_logs ADD COLUMN agreed_adult_and_terms INTEGER NOT NULL DEFAULT 0;
ALTER TABLE consent_logs ADD COLUMN scrolled_to_bottom_at INTEGER;
ALTER TABLE consent_logs ADD COLUMN signature_url TEXT;
ALTER TABLE consent_logs ADD COLUMN pdf_url TEXT;
ALTER TABLE consent_logs ADD COLUMN jst_agreed_at TEXT;
ALTER TABLE consent_logs ADD COLUMN scheduled_purge_at INTEGER;

-- 新規の場合
CREATE TABLE IF NOT EXISTS consent_logs (
  id TEXT PRIMARY KEY,
  uid TEXT NOT NULL,
  consent_version TEXT NOT NULL,
  full_name TEXT,
  full_name_kana TEXT,
  email TEXT,
  phone TEXT,
  agreed_adult_and_terms INTEGER NOT NULL DEFAULT 0,
  scrolled_to_bottom_at INTEGER,
  signature_url TEXT,
  pdf_url TEXT,
  user_agent TEXT,
  ip_hash TEXT,
  agreed_at INTEGER NOT NULL,
  jst_agreed_at TEXT,
  scheduled_purge_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS idx_consent_uid ON consent_logs(uid);
CREATE INDEX IF NOT EXISTS idx_consent_version ON consent_logs(consent_version);
CREATE INDEX IF NOT EXISTS idx_consent_purge ON consent_logs(scheduled_purge_at);
```

### 3-2. `consent_withdrawals` テーブル（新規）

```sql
CREATE TABLE IF NOT EXISTS consent_withdrawals (
  id TEXT PRIMARY KEY,
  uid TEXT NOT NULL,
  consent_log_id TEXT,
  reason TEXT,
  request_data_deletion INTEGER NOT NULL DEFAULT 0,
  withdrawn_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS idx_withdrawal_uid ON consent_withdrawals(uid);
```

### 3-3. `customers` 拡張

```sql
ALTER TABLE customers ADD COLUMN latest_consent_version TEXT;
ALTER TABLE customers ADD COLUMN latest_consent_at INTEGER;
```

同意完了時に上書き。

---

## 4. ページ仕様

### 4-1. URLパラメータ

- `?page=consent&uid={uid}`
- `uid` 未指定・不正なら専用エラーページ：「リンクが無効です。LINEから再度アクセスしてください」

### 4-2. タイトル

`FOLLOW｜ご利用前のご確認とご同意`

### 4-3. レイアウト

- スマホファースト（375px〜）
- 同意書本文は**全文展開**（折りたたみ・タブ・モーダル禁止）
- セクションごとに `<section>` で区切り、`h2` 見出し
- フォントは system-ui、ベース白／文字濃いグレー／アクセント1色
- 入力欄のタップ領域 44px 以上
- 同意セクション（後述）は**スクロール最下部到達まで非表示**

### 4-4. 既読証跡（スクロール検知）

同意書本文末尾に `<div id="scroll-sentinel" />` を配置。

```tsx
// components/ScrollSentinel.tsx
const sentinelRef = useRef<HTMLDivElement>(null);
const [reachedAt, setReachedAt] = useState<number | null>(null);

useEffect(() => {
  if (!sentinelRef.current) return;
  const obs = new IntersectionObserver((entries) => {
    const e = entries[0];
    if (e.isIntersecting && reachedAt === null) {
      setReachedAt(Date.now());
    }
  }, { threshold: 0.5 });
  obs.observe(sentinelRef.current);
  return () => obs.disconnect();
}, [reachedAt]);
```

- センチネル到達まで同意セクション全体を `display: none`
- 到達時刻を hidden input `scrolled_to_bottom_at` にセット

### 4-5. 本人情報入力欄（同意書本文の前）

| 項目 | 形式 | 必須 |
|---|---|---|
| 氏名（漢字フルネーム） | text | ✓ |
| 氏名フリガナ | text | ✓ |
| メールアドレス | email | ✓ |
| 電話番号 | tel | ✓ |

**取得しない**：生年月日、住所

クライアント側バリデーション：
- 氏名2文字以上
- メール正規表現
- 電話：国内番号（ハイフン有無両対応）

---

## 5. 同意書本文（Section A〜H）

以下をそのままページに表示。文言変更不可（環境変数の差し込みのみ）。

### Section A：運営者情報（特定商取引法に基づく表記）

```
【運営者情報】

販売事業者：{OPERATOR_LEGAL_NAME}
責任者：{OPERATOR_REPRESENTATIVE}
所在地：{OPERATOR_ADDRESS}
連絡先メール：{OPERATOR_CONTACT_EMAIL}
連絡先電話：{OPERATOR_CONTACT_PHONE}（空なら本行を非表示）
個人情報保護管理者：{OPERATOR_PRIVACY_OFFICER}

販売価格：月額880円（税込）
お支払い方法：クレジットカード等のサブスクリプション課金
役務の提供時期：ご登録後、カラーリストの確認完了次第提供開始
解約方法：LINEで「解約希望」とお送りいただく
```

### Section B：サービス内容と契約の性質

```
1. 本サービス「FOLLOW｜気になるところだけカラー」は、ヘアカラーに関する情報提供および助言を行うサービスです。

2. 本サービスは、ヘアカラーに関する情報提供および助言を行うものであり、当社が利用者の頭髪に染色を行うものではありません。

3. 染色行為は利用者ご本人が、自身の判断と責任において行うものとします。

4. 本サービスは美容師法に基づく美容業ではなく、医療行為でもありません。

5. 本サービスは、分け目・顔まわり・生え際など、次の美容室までに気になる「ここだけ」を、カラーリストがLINEで確認しながらご案内するサービスです。全頭セルフカラーを推奨するものではありません。

6. カラーリストの判断により、セルフカラーをおすすめせず、美容室での施術をご案内する場合があります。

7. 本契約は通信販売（特定商取引法第26条第1項第1号）に該当し、クーリングオフの対象外です。
```

### Section C：本人情報（入力欄の説明）

```
ご本人確認のため、以下をご入力ください。
・氏名（漢字フルネーム）
・氏名フリガナ
・メールアドレス
・電話番号

※ご登録は満18歳以上の方に限ります。
※生年月日・ご住所はお伺いしません。
```

入力欄を本セクション直下に配置。

### Section D：個人情報・写真の取扱い

```
1. 取得情報
   ・氏名、氏名フリガナ、メールアドレス、電話番号
   ・LINE上のメッセージ・送付された頭部の写真
   ・カウンセリングでご回答いただく髪・頭皮の状態に関する情報

2. 利用目的
   ・ヘアカラーに関する助言・カウンセリング
   ・本人特定および本人連絡
   ・サービス品質改善（個別が特定されない統計化された形式に限る）

3. 保管期間
   ・解約から{CONSENT_RETENTION_YEARS}年間。期間経過後は自動的に削除します。

4. 第三者提供
   ・法令に基づく場合を除き、第三者には提供しません。

5. 利用者の権利
   ・利用者は、いつでも自己の個人情報の開示・訂正・利用停止・削除を請求できます。
   ・請求は {OPERATOR_CONTACT_EMAIL} までご連絡ください。

6. 写真の取扱い
   ・LINEで送付いただいた頭部の写真は、社内の処方判断と同一カラーリスト間の引き継ぎ目的のみに使用します。
   ・SNS等への無断掲載は一切行いません。
   ・退会時、ご希望があればお写真とカルテを削除いたします。
```

### Section E：料金と解約

```
・料金：月額880円（税込）
・課金日：登録日から月単位
・解約方法：LINEで「解約希望」とお送りください。次回課金日の前日24時までに受信したものを有効とします。
・解約の確定：運営事務局からの「解約完了のご連絡」をもって確定とします。
・既課金分の返金はいたしません。
・回数縛り・違約金はありません。いつでも解約可能です。
・返金保証は設けておりません（染まり具合の客観的な判定基準を公平に設けることが難しいためです）。
・薬剤・道具は楽天等の通販サイトでご購入いただきます。商品代金は当社に支払われるものではありません。
```

### Section F：禁止事項・反社会的勢力排除

```
1. 利用者は、本サービスを違法・反社会的・公序良俗に反する目的で利用しません。

2. 利用者は、第三者の権利を侵害する形で本サービスを利用しません。

3. 利用者は、自らが反社会的勢力（暴力団・暴力団員・準構成員ほか）に該当しないこと、関係を持たないことを表明し保証します。

4. 上記に違反した場合、当社は通知なく本サービスの提供を停止することができます。
```

### Section G：免責・自己責任

**「故意または重大な過失を除く」は絶対に削らない。** 削ると消費者契約法8条で全免責が無効になる。

```
1. 本サービスのご利用に関して、当社の故意または重大な過失による場合を除き、当社は利用者に生じた損害について責任を負いません。

2. 本免責は、消費者契約法その他の強行法規により無効とされる範囲では適用されません。

3. 染色は利用者ご本人が行うものであり、案内された範囲・薬剤・放置時間以外で染色されたことによるトラブルは、自己責任となります。

4. 薬剤・道具は楽天等の第三者サイトでご購入いただきます。これらの取引に当社は関与しません。

5. 薬剤の品質・成分・効果はメーカー責任の範囲であり、当社の責任範囲外です。

6. 染まり具合・発色には個人差があり、特定の結果が保証されるものではありません。

7. 過去にヘアカラー剤でアレルギー症状が出た方は、必ず使用前にパッチテストを行ってください。

8. 染める前・染めた後に体調変化がある場合は、直ちに使用を中止し、医療機関を受診してください。当社は医療的な診断や治療は行いません。

9. 以下に該当する方は、カラーリストの判断によりご利用をお断りする場合があります。
   ・ブリーチ履歴がある髪
   ・黒染め履歴がある髪
   ・縮毛矯正・髪質改善・パーマ履歴がある髪
   ・頭皮にかゆみ・湿疹・傷・炎症がある方
   ・妊娠中・授乳中の方
   ・過去にヘアカラーで体調不良を起こしたことがある方
```

### Section H：準拠法および管轄

```
本契約は日本法に準拠します。
本契約に関する一切の紛争は、{JURISDICTION_COURT}を第一審の専属的合意管轄裁判所とします。
```

---

## 6. Section I：単一同意＋電子署名（スクロール後に出現）

ページ最下部。**スクロールセンチネル到達まで非表示**。

### 表示順

1. 見出し：`ご確認いただきありがとうございます。`

2. **単一チェック**：
   ```
   □ 私は満18歳以上であり、上記のすべての内容を読み、自由な意思で同意します。
   ```

3. **氏名確認欄**：
   - Section Cで入力された氏名を自動表示
   - 「上記氏名で署名します」のラベル
   - 編集不可（編集は上に戻る）

4. **電子署名キャンバス**：
   - HTML Canvas（タッチ・マウス両対応）
   - ラベル：「ご自身でご署名ください」
   - 「クリア」ボタン
   - 最低描画ストローク数（連続点≥50）でバリデーション
   - 出力：PNG base64

5. **送信ボタン**：`同意して送信する`
   - チェック・氏名タイプ・署名描画すべて揃ったら活性化
   - 1つでも欠ければ disabled
   - 押下後は二重送信防止のため即 disabled に変更

### Hidden inputs

```
uid
consent_version
scrolled_to_bottom_at
csrf_token
```

---

## 7. サーバー側エンドポイント

### 7-1. `GET /?page=consent&uid={uid}`

`apps/worker/src/routes/consent.ts` で実装。

- uid検証 → 無効なら専用エラー画面
- 最新 consent_version で同意済みなら：
  ```
  「すでに最新の同意書にご署名いただいています。カウンセリングへ進みますか？」
  ```
  ＋カウンセリングへのボタン
- 旧バージョンで同意済み or 未同意なら：v3同意書を表示
- ページ最上部に注記（旧バージョン同意済みの場合のみ）：
  ```
  同意書の内容を法的に整備し直しました。引き続きご利用いただくため、改めてご署名をお願いします。
  ```

### 7-2. `POST /api/consent`

`Content-Type: multipart/form-data`

#### 受け入れる項目

```
uid
consent_version
full_name
full_name_kana
email
phone
agreed_adult_and_terms (true)
scrolled_to_bottom_at (UNIXミリ秒)
signature_image (base64 PNG または Blob)
csrf_token
```

#### サーバー側検証（NGなら400）

- CSRFトークン検証
- `uid` が有効
- `consent_version === env.CONSENT_VERSION`
- 必須入力欄すべてあり、形式が正しい
- `agreed_adult_and_terms === true`
- `scrolled_to_bottom_at` が現在時刻より60秒以上前（不自然な即押下を弾く）
- `signature_image` の描画ピクセル数が一定以上

#### 検証成功時の処理

1. 署名画像を R2 (`CONSENT_PDFS` バインディング) に保存
   - パス: `signatures/{uid}/{consent_version}/{timestamp}.png`
2. PDF生成（後述）→ R2に保存
   - パス: `pdfs/consent_{uid}_{version}_{timestamp}.pdf`
3. `consent_logs` に INSERT
4. `customers.latest_consent_version` / `latest_consent_at` を UPDATE
5. **LINE Botで本人にPDFリンクを送信**（既存LINE送信ロジックを使う）
6. **管理者通知Botに通知**（`/api/admin-notify` を内部から叩く）
   ```json
   {
     "type": "info",
     "title": "新規同意完了",
     "body": "氏名：{full_name}\nメール：{email}\nuid：{uid}",
     "actions": [{"label": "PDFを開く", "url": "{pdf_url}"}],
     "priority": "normal"
   }
   ```
7. レスポンス：`302 redirect to /?page=counseling&uid={uid}`

### 7-3. `GET /api/consent/status?uid={uid}`

- 最新の同意状態を返す（管理画面用）
- 認証必須（管理者）

### 7-4. `POST /api/consent/withdraw`

- 同意撤回エンドポイント
- ボディ：uid, reason (任意), request_data_deletion (boolean)
- `consent_withdrawals` に INSERT
- 管理者通知Botに通知（priority: high）
- request_data_deletion=trueなら、関連データの削除ジョブをキュー（実装は次フェーズでOK、ログだけ残す）

---

## 8. PDF生成

### 8-1. ライブラリ

- `pdf-lib`（Cloudflare Workers互換）
- 日本語フォント：Noto Sans JP（Worker内に同梱、サイズ縮小のためサブセット化推奨）

### 8-2. 仕様

- A4縦
- ヘッダー：`FOLLOW｜ご利用同意書`（運営者ロゴは任意）
- 内容：
  1. 運営者情報（Section A）
  2. 同意書本文（Section A〜H 全文、本ドキュメントの文言と同一）
  3. 利用者情報（氏名・氏名カナ・メール・電話）
  4. 同意の証跡
     - 同意日時（JST）
     - スクロール最下部到達時刻（JST）
     - 文書ID（consent_logs.id）
     - consent_version
  5. 署名画像（埋め込み）
- フッター：運営者連絡先＋ページ番号

### 8-3. 保存

- R2バケット `follow-consent-pdfs` の `pdfs/` 配下
- `consent_logs.pdf_url` に署名付きURLを記録（有効期限24時間、再発行はAPI経由）

### 8-4. 管理画面ダウンロード

- `GET /api/consent/pdf?id={consent_log_id}` で署名付きURLを再発行
- 認証必須

---

## 9. セキュリティ

- POST `/api/consent` のみで受ける（GET不可）
- CSRFトークン（hidden input + Cookie）
- レートリミット：1uidあたり1分10回
- IPは生保存禁止：`SHA256(IP + env.IP_HASH_SALT)` でハッシュ化
- 署名画像のサイズ上限：500KB
- multipart/form-data の容量制限：1MB
- 不正uidは403
- `localStorage` に個人情報を保存しない
- CSP：`script-src 'self'`（必要な場合のみ nonce許可）
- すべてのレスポンスに `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`

---

## 10. 既存ユーザーへの再同意

- v1で同意済みの28名は consent_version が `2026-06-08-v3` ではないため、`?page=consent&uid=...` 再アクセスで新v3フローが出る
- 上部に「同意書を整備し直しました」の注記
- 完了で `consent_logs` に新行追加（旧行は残す）

### 一斉送信文（運営者が手動でLINE送信）

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

## 11. 管理画面

### 顧客詳細に「同意状態」セクション追加

- 最新同意のバージョン・日時（JST）
- スクロール最下部到達時刻
- PDFダウンロードリンク
- 署名画像プレビュー
- 「同意履歴を見る」ボタン → `consent_logs` 全件テーブル
- 撤回履歴があれば赤表示

### 一覧画面のフィルタ

- 「最新バージョン未同意」
- 「撤回済」

実装ファイル：`apps/web/src/app/admin/customers/[uid]/consent.tsx`

---

## 12. 文言レベルの禁止事項

以下は**絶対に入れない**（既存v1にあれば全削除）：

- 「全額返金」「返金保証」「効果がなければ返金」
- 「絶対に失敗しない」「100%染まる」「プロ品質保証」
- 「美容室不要」「美容室に行かなくていい」
- 「誰でも安全」「ブリーチ毛でも安心」
- 「故意・重過失も含めて免責」と読める文言
- 効能効果の断定（薬機法）
- 誇大表現（景表法）

---

## 13. 受け入れ基準

実装完了の判定条件：

- [ ] `?page=consent&uid={有効uid}` で同意書本文・入力欄が表示される
- [ ] 生年月日・住所の入力欄が存在しない
- [ ] スクロール最下部に到達するまで、同意セクション全体が非表示
- [ ] 到達後、同意セクションが表示される
- [ ] 単一チェック＋氏名タイプ（自動転記）＋手書き署名がすべて揃わないと送信ボタンが押せない
- [ ] サーバー側で `agreed_adult_and_terms`・`scrolled_to_bottom_at`・署名描画を再検証
- [ ] PDF が生成され、R2 に保存され、LINEで本人にリンク送信される
- [ ] 管理者通知Botに「同意完了」通知が届く
- [ ] `consent_logs` に拡張カラムを含めて記録される
- [ ] IPは生で保存されず、ハッシュのみ
- [ ] 既存ユーザー（v1同意済み）が `?page=consent` 再アクセス時に新v3フローが出る
- [ ] 同意撤回フローが動作する
- [ ] 管理画面でPDFがダウンロードできる
- [ ] スマホ375pxで署名キャンバスが操作可能
- [ ] 旧文言（「返金」「保証」「全頭セルフ推奨」など）がページ全体・DB全体から完全に消えている
- [ ] 不正uidで403または専用エラーページが返る

---

## 14. テスト観点

1. `uid` 未指定 → エラーページ
2. `uid` 形式不正 → エラーページ
3. 同意セクション未スクロールで送信試行 → 同意セクション自体が出ないので送信不可
4. JSで強制チェック・送信 → サーバー側400
5. 署名キャンバス未描画で送信 → 400
6. 同意完了 → 302リダイレクト → カウンセリングフォームへ
7. 同一uidで2回同意（同バージョン） → 冪等（既存があれば200、新規ならINSERT）
8. consent_version を上げて再アクセス → 新同意フローが出る
9. iOS Safari 15 / Android Chrome での署名キャンバス動作
10. JS無効時：同意セクションが出ない＝誤同意発生せず
11. PDFが正常生成、A4で日本語が文字化けしない
12. LINE添付送信成功（既存LINE Bot経由）
13. 管理者通知Bot到達
14. R2にPDFが正しく保存される
15. 署名付きURLが期限切れで失効する

---

## 15. デプロイ手順

### 15-1. プレビュー環境

1. `wrangler r2 bucket create follow-consent-pdfs-preview`
2. `wrangler secret put IP_HASH_SALT --env preview`
3. `wrangler secret put OPERATOR_*`（運営者情報を `[env.preview.vars]` で設定 or 開発時はダミー値）
4. ローカルでD1 migration: `wrangler d1 execute follow-color --local --file=scripts/consent-v3-2026-06-08.sql`
5. `pnpm --filter worker build && pnpm --filter worker dev`
6. `pnpm --filter web build && pnpm --filter web dev`
7. ローカルでフロー通し（uid=test）
8. プレビューデプロイ：`wrangler deploy --env preview`

### 15-2. 本番

1. `wrangler r2 bucket create follow-consent-pdfs`
2. `wrangler secret put IP_HASH_SALT --env production`
3. 運営者情報を本番環境変数に設定
4. D1 migration: `wrangler d1 execute follow-color --remote --file=scripts/consent-v3-2026-06-08.sql`
5. `wrangler deploy --env production`
6. Pages: `pnpm --filter web build && wrangler pages deploy`
7. 既存ユーザー1名でフロー通しテスト
8. 既存28名にLINE一斉送信で再同意案内

---

## 16. 作業優先度

| 優先度 | タスク |
|---|---|
| P0 | DB migration（consent_logs拡張、consent_withdrawals新設、customers拡張） |
| P0 | `consent.ts` ルート実装（GET/POST） |
| P0 | フロント同意書ページ（v3 UI、スクロール検知、署名キャンバス、単一チェック） |
| P0 | PDF生成＋R2保存 |
| P0 | LINE本人交付＋管理者通知Bot連携 |
| P1 | 同意撤回フロー |
| P1 | 管理画面の同意状態表示・PDFダウンロード |
| P1 | バージョン管理＋再同意フロー |
| P2 | レートリミット強化 |
| P2 | 自動削除バッチ（解約後N年） |

---

## 17. セキュリティ上の留意（実装者向け）

- `env` のSecret値を `console.log` / logger に出力しない
- エラーメッセージにトークン値・個人情報を含めない
- READMEやコメントに実値の例を書かない
- `.env` `.dev.vars` をコミットしない（`.gitignore` 確認）
- テストコードに実値をハードコードしない
- 「動作確認用にトークンを表示」の仮実装も禁止

---

## 18. 法的注意（実装者向け）

- 免責の「故意・重過失を除く」は**絶対に削らない**（消費者契約法8条）
- 「クーリングオフ対象外」の明記は通信販売の必須要件（特商法）
- 写真は要配慮個人情報の一部に該当しうる。利用目的・保管期間・削除権を必ず明記
- 同意ログは改ざんできない形で保存：PDF・スクロール時刻・電子署名の3点で証跡
- 本番リリース前に**消費者法に強い弁護士に1回チェック**を推奨

---

## 19. 完了報告フォーマット

実装完了時、新Claudeはユーザーに以下を返す：

```
同意書v3の実装が完了しました。

ブランチ：feat/consent-v3
PR：（URL）

実装内容：
- DB migration: scripts/consent-v3-2026-06-08.sql
- ルート: apps/worker/src/routes/consent.ts ほか
- フロント: apps/web/src/app/consent/page.tsx ほか
- PDF生成: apps/worker/src/lib/consent-pdf.ts

ローカル検証：
- pnpm typecheck: OK
- pnpm build: OK
- D1 migration (local): OK
- ローカルでuid=testで全フロー通し: OK

未実施（要ユーザー承認）：
- 本番D1 migration
- 本番R2バケット作成
- 本番Secret設定（運営者情報・IP_HASH_SALT）
- Cloudflare deploy
- 既存28名へのLINE一斉送信

次のステップ：
PRレビュー → 本番デプロイ承認 → 既存ユーザーへの再同意案内
```

---

以上。本ドキュメントだけで実装可能なように記述しています。
新Claudeはこれを読み、ブランチ `feat/consent-v3` を切って実装を進めてください。
