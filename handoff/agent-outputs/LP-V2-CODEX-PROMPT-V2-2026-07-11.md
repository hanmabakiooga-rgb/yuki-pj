# LP V2 改修 CODEX 投入プロンプト v2（2026-07-11版）

作成日: 2026-07-11
旧版: `handoff/agent-outputs/LP-V2-CODEX-PROMPT.md`（削除せず保存。本書が最新）
根拠資料:
- `handoff/agent-outputs/LP-V2-DESIGN-WITH-ASSETS.md`（デザイントークン・配置マップ。**ただし「29個」前提の記述は「16個」に読み替える**。§0参照）
- `handoff/agent-outputs/LAUNCH-GO-NOGO-CHECK-2026-07-11.md`（今回追加スコープの出所）
- follow-lp main の実コード（2026-06-18時点最新のクローンで行番号・クラス名を実確認済み）

---

## §0 旧版との差分サマリ

| # | 項目 | 旧版（LP-V2-CODEX-PROMPT.md） | 本書 v2 |
|---|---|---|---|
| 1 | アイコン素材 | 29個（既存16＋追加13）を **ユーザーが手動配置済み** の前提 | **16個のみ実在**。保存先は follow-lp ではなくローカル別フォルダ `C:\Users\hanma\Documents\Codex\2026-06-19\followlp-ai-lp\assets\lp-responsive-icons\`。CODEX が自分でコピーする。追加13個は存在しないため、設計書の配置マップで該当する箇所は**スキップ**（推測生成禁止） |
| 2 | CTA画像6枚 | 差し替え対象として実装範囲に含む | **今回スコープから除外**。CTA画像は削除済みで後日作り直し確定。既存CTAボタン（HTML/CSS実装）はそのまま維持 |
| 3 | 計測まわり | 記載なし | **新規追加**: Metaピクセル設置（プレースホルダID方式）＋ UTMパラメータ処理（sessionStorage → Leadイベント） |
| 4 | 文言追加 | 記載なし | **新規追加**: ファーストビューに「商材の購入は任意」、FAQに営業時間（平日9:00〜19:00）の新Q&A |

そのほか継承事項:
- 川崎さん実写真は未受領のため **placeholder 維持**（旧版と同じくスコープ外。`KAWASAKI-PHOTO-INTEGRATION.md` 参照）
- 「触ってはいけない要素」リスト（旧版§3）は全項目そのまま継承
- 「素材が見つからない場合は作業中止してユーザーに報告。推測での生成禁止」の原則も継承

---

## §1 前提条件

**今回はユーザーの手作業はほぼ不要です。** 旧版のような「素材をfollow-lpに手動配置してpush」の工程はありません。素材は既にローカルにあり、CODEX が自分でコピーします。

必要なのは以下の2点だけです。

### 1.1 CODEX 起動時に2つのフォルダへのアクセスを許可する

CODEX（ローカル実行モード）起動時、以下2つのパスにアクセスできる状態にしてください。

1. **素材元フォルダ**:
   ```
   C:\Users\hanma\Documents\Codex\2026-06-19\followlp-ai-lp\
   ```
   （この下の `assets\lp-responsive-icons\` に mobile/ pc/ svg/ lp-feature-icons.css / manifest.json / contact-sheet.png が入っている）

2. **follow-lp ローカルリポジトリ**:
   過去記録では以下の2説があり、どちらが現行か未確定です。
   - `C:\Users\hanma\OneDrive\デスクトップ\follow-lp`
   - `C:\Users\hanma\OneDrive\ドキュメント\Playground\follow-lp`

   両方存在する場合もあるため、**§2 プロンプト冒頭で CODEX に `git remote -v` を実行させ、`hanmabakiooga-rgb/follow-lp` を指すリポジトリであることを確認してから作業させる**手順を組み込み済みです。ユーザーは正しい方のパスを CODEX に伝えるだけでOK（分からなければ両方伝えて CODEX に判定させる）。

### 1.2 follow-lp が最新 main であること

CODEX に `git fetch origin && git status` で確認させます（プロンプトに組み込み済み）。ローカルに未コミット変更がある場合、CODEX は作業を中止してユーザーに報告します。

---

## §2 CODEX に貼り付けるプロンプト本文

以下のブロックを**そのままコピペ**して CODEX に投入してください。

````markdown
あなたは follow-lp リポジトリ（GitHub: `hanmabakiooga-rgb/follow-lp`）でLP改修を実装するエンジニアです。以下の手順を上から順に実行し、ブランチを切り、PRを1本作成してください。

## 大原則

- **素材・ファイルが見つからない場合は、その場で作業を中止してユーザーに報告すること。推測でファイル名を生成したり、プレースホルダ画像を新規生成することは禁止。**
- 指示にない既存要素の削除・変更は禁止。
- 新規ビルドツール・npm依存の追加は禁止（既存は Vite のみ。`package.json` の scripts: dev/build/preview）。

## 手順0: 対象リポジトリの確認

follow-lp のローカルリポジトリは以下のいずれかにあります（両方ある可能性もある）:

- `C:\Users\hanma\OneDrive\デスクトップ\follow-lp`
- `C:\Users\hanma\OneDrive\ドキュメント\Playground\follow-lp`

候補ディレクトリで `git remote -v` を実行し、origin が `hanmabakiooga-rgb/follow-lp` を指すものを作業対象とする。両方が該当する場合は `git log -1 --format=%ci main` が新しい方を採用し、どちらを採用したかを最初に報告する。どちらも該当しない場合は作業中止・報告。

続けて `git fetch origin` → `git switch main` → `git pull origin main` で最新化。未コミットのローカル変更がある場合は作業中止・報告。

作業ブランチ: `git switch -c feat/lp-v2-visual-revamp`

## 手順1: 素材の実在確認と manifest.json の読み込み（推測禁止）

素材元フォルダ:

```
C:\Users\hanma\Documents\Codex\2026-06-19\followlp-ai-lp\assets\lp-responsive-icons\
```

期待される構成:

- `mobile/` — 160x160, 240x240 の PNG
- `pc/` — 224x224, 336x336 の PNG
- `svg/` — 共通SVG 16個
- `lp-feature-icons.css` — LP差し込み用CSS（スマホ80x80px / PC112x112px 表示想定）
- `manifest.json` — ファイル名一覧・サイズ・透過検証結果・HTML例
- `contact-sheet.png` — プレビュー（LPには使わない）

まず **`manifest.json` を読み、16アイコンの正確なファイル名一覧を取得すること**。ファイル名の推測は禁止。manifest.json が存在しない・読めない・16個揃っていない場合は作業中止・報告。

## 手順2: 素材コピー

`assets/lp-responsive-icons/` の中身を follow-lp の `public/assets/icons/v2/` へコピーする。`mobile/` `pc/` `svg/` のサブディレクトリ構造は維持。`contact-sheet.png` はコピー不要。

コピー後、manifest.json のファイル名一覧と照合し、全ファイルが揃っていることを確認してからコミット。

## 手順3: CSS 読み込み

`lp-feature-icons.css` を follow-lp の `css/` に配置し、`index.html` の既存の

```html
<link rel="stylesheet" href="css/style.css?v=20260517-legal-01">
```

（L11）の**直後**に `<link rel="stylesheet" href="css/lp-feature-icons.css">` を追加。既存 style.css の読み込みより前に置かないこと。

## 手順4: アイコン16個の配置

設計書のセクション別配置マップを参照する:

```
https://raw.githubusercontent.com/hanmabakiooga-rgb/yuki-pj/main/handoff/agent-outputs/LP-V2-DESIGN-WITH-ASSETS.md
```

（取得できない場合はユーザーにファイル本文の提供を依頼して中止・待機）

設計書 §4「アイコン配置マップ」は **29個（既存16＋追加13）前提**で書かれているが、実在するのは manifest.json 記載の16個のみ。したがって:

- manifest.json の16個と設計書マップの対応が取れるセクションのみアイコンを配置する
- 設計書マップが「追加13個」（wakeme / haegiwa / musunda-kami / timing / bottle / cart / clock / clipboard / leaf / coin / check / cross / faq 等、manifest.json に無い名前）を要求する箇所は**スキップし、既存表現を維持**する。代替の推測配置・画像生成は禁止
- CTA画像（cta-01〜06）に関する記述もすべてスキップ（今回スコープ外。既存CTAボタンは触らない）

配置方法: **manifest.json 内に HTML 例があればそれを最優先で使う**。無い場合は以下の `<picture>` + `srcset` パターン（表示サイズ: モバイル80px / PC112px）:

```html
<picture>
  <source media="(min-width: 769px)"
          srcset="public/assets/icons/v2/pc/【ファイル名】-224.png 2x,
                  public/assets/icons/v2/pc/【ファイル名】-336.png 3x">
  <img src="public/assets/icons/v2/mobile/【ファイル名】-160.png"
       srcset="public/assets/icons/v2/mobile/【ファイル名】-160.png 2x,
               public/assets/icons/v2/mobile/【ファイル名】-240.png 3x"
       width="80" height="80" alt="【設計書記載の日本語短文】" loading="lazy">
</picture>
```

※実際のファイル名・サフィックス形式は manifest.json に従うこと（上記の `-160` 等は例）。
※全 `<img>` に width/height を明示（CLS防止）。装飾目的のものは `alt=""` + `aria-hidden="true"`。

## 手順5: neumorphism デザイントークン追加

設計書 §2 のデザイントークン（`--color-bg-soft`, `--color-green`, `--color-orange`, `--shadow-soft`, `--shadow-soft-sm`, `--icon-button-size` 等）を `css/style.css` の既存 `:root`（L1-15、`--follow-*` プレフィックスのトークン群）の**直後に別ブロックとして追記**する。

- 既存トークン（`--follow-color-ink` 〜 `--follow-font-sans`）の**上書き・変更は禁止**。追記のみ
- 設計書 §3-2 のアイコン共通スタイル、§7 のレスポンシブ調整も追記
- ただし `lp-feature-icons.css` と重複・競合するルールは `lp-feature-icons.css` を優先し、二重定義しない
- hover/focus アニメーションは `transform` と `box-shadow` のみで実装

## 手順6: Metaピクセル設置（プレースホルダID方式）

Pixel ID は未発行のため、プレースホルダ文字列 `META_PIXEL_ID_HERE` で設置する。`index.html` の `</head>`（L12）直前に以下を追加:

```html
<!-- Meta Pixel Code (ID未発行: META_PIXEL_ID_HERE を実IDに一括置換すること) -->
<script>
  window.META_PIXEL_ID = 'META_PIXEL_ID_HERE';
  !function(f,b,e,v,n,t,s)
  {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
  n.callMethod.apply(n,arguments):n.queue.push(arguments)};
  if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
  n.queue=[];t=b.createElement(e);t.async=!0;
  t.src=v;s=b.getElementsByTagName(e)[0];
  s.parentNode.insertBefore(t,s)}(window, document,'script',
  'https://connect.facebook.net/en_US/fbevents.js');
  if (window.META_PIXEL_ID !== 'META_PIXEL_ID_HERE') {
    fbq('init', window.META_PIXEL_ID);
    fbq('track', 'PageView');
  }
</script>
<noscript><img height="1" width="1" style="display:none"
  src="https://www.facebook.com/tr?id=META_PIXEL_ID_HERE&ev=PageView&noscript=1"
></noscript>
<!-- End Meta Pixel Code -->
```

ポイント:
- ID未設定の間は init/PageView を発火させないガード付き（プレースホルダのまま本番に出ても壊れない）
- ID受領後は `META_PIXEL_ID_HERE` の文字列を**一括置換1回**で有効化できる（script内1箇所＋noscript内1箇所、同一文字列）

## 手順7: UTMパラメータ処理（js/utm-tracking.js 新規作成）

現状 `index.html` には `<script>` タグが1つも無い（`js/main.js` はリポジトリに存在するが読み込まれていない）。**`js/main.js` を読み込み始めることはせず**、新規ファイル `js/utm-tracking.js` のみ追加する。

`index.html` の `</body>` 直前に:

```html
<script src="js/utm-tracking.js" defer></script>
```

`js/utm-tracking.js` の仕様:

1. **UTM保存**: ページ読み込み時、`URLSearchParams` で `utm_source` / `utm_medium` / `utm_campaign` / `utm_content` / `utm_term` を取得し、値が1つでもあれば sessionStorage にキー `follow_utm`（JSON文字列）で保存。UTMなしで着地した場合は既存の保存値を消さない
2. **Lead発火**: `document.querySelectorAll('a[href^="https://lin.ee/"]')` で LINE ボタンを全取得し、click リスナーを付与。クリック時に sessionStorage の UTM を読み、`fbq('track', 'Lead', {content_name: <utm_content値 or 'direct'>, utm_source: ..., utm_medium: ..., utm_campaign: ...})` を発火
3. **ガード**: `typeof fbq === 'function'` の場合のみ fbq を呼ぶ。fbq 未定義・sessionStorage 不可（プライベートモード等）でも **例外を投げず遷移を妨げない**こと（try/catch）。`preventDefault` 禁止、`href` の書き換え禁止（LINE URL は `https://lin.ee/pXAlGgw` 固定のまま）

対象の LINE ボタンは main の `index.html` に **7箇所**ある（href はすべて `https://lin.ee/pXAlGgw`）:

| 行 | クラス | 場所 |
|---|---|---|
| L30 | `.follow-header__button` | ヘッダー |
| L75 | `.follow-cta.follow-cta--medium` | ヒーロー中段CTA |
| L127 | `.follow-cta` | ヒーローCTAカード |
| L706 | `.follow-compare-cta__button` | 比較セクション後CTA |
| L767 | `.follow-compare-cta__button` | 比較セクション後CTA |
| L938 | `.follow-compare-cta__button`（`.follow-lp10__cta`内） | lp10 CTA |
| L1144 | `.follow-compare-cta__button`（`.follow-lp11__cta`内） | FAQ後・最終CTA |

クラス名の列挙で拾うのではなく、上記の `a[href^="https://lin.ee/"]` セレクタで7箇所すべてを一括で拾うこと（アイコン配置で行番号がずれても壊れないため）。実装後、DevTools コンソールで対象要素数が7であることを確認する。

## 手順8: ファーストビューに「商材の購入は任意」を追加

`index.html` L132（ヒーローCTAカード内）の現状:

```html
<p class="fv-meta">月880円 / いつでも解約OK / 写真を送るだけ</p>
```

これを以下に変更:

```html
<p class="fv-meta">月880円 / いつでも解約OK / 写真を送るだけ / 商材の購入は任意</p>
```

- 直下の `.follow-cta-notes`（L134-136「専用アプリ不要／写真を送るだけ／無理に全体を染めません」）は変更しない
- モバイル幅（320px/375px）で `.fv-meta` が不自然な折り返しにならないか確認し、崩れる場合のみ `.fv-meta` に限定した折り返し調整CSS（例: 区切りごとの `white-space` 調整）を追加してよい。文言の削除・省略は禁止

## 手順9: FAQ に営業時間の新Q&Aを1件追加

`index.html` の FAQ セクション（`.follow-faq`、L1033開始）の最後のQ&A「写真はSNSや広告に使われますか？」（L1130-1138）の `</details>` の**直後**に、既存とまったく同じ構造で1件追加:

```html
<details class="follow-faq__item">
  <summary>
    <span>Q.</span>
    返信はいつ届きますか？
  </summary>
  <div class="follow-faq__answer">
    <p>LINE相談の返信対応は平日 9:00〜19:00 です。時間外や土日祝にいただいたご相談には、翌営業日に順番に返信します。</p>
  </div>
</details>
```

既存FAQ項目の文言・順序は一切変更しない。

## 手順10: 絶対に触ってはいけない既存要素

- **川崎権威性セクション**（`index.html` L369-392 の `section.kawasaki-authority`、および `.kawasaki-photo` — `css/style.css` L5562 / L5579 / L6539）。写真は placeholder（`<span>写真</span>`）のまま維持。差し替えは別PR案件
- **「利用者の声」セクション**（`index.html` L1019-1031 の `section.testimonials`）。文言・構造・順序とも変更禁止
- **ファーストビューの強調赤**（既存トークン・既存スタイル）。色相変更禁止
- **LINEブランド緑 `#06C755`**（既存トークン `--follow-color-line`）。LINE誘導CTA以外での使用禁止
- **既存CTAボタンのHTML/CSS実装**（CTA画像差し替えは今回スコープ外）
- 既存 `js/main.js`（現在 index.html から未読込。読み込み追加も改変も禁止）
- 既存 `:root` トークン（`--follow-*`）の値

## 手順11: コミット・PR

- ブランチ: `feat/lp-v2-visual-revamp`
- コミット粒度: 論理単位で複数コミット可（例: assets / css-link / tokens / icons / pixel / utm / copy / faq）
- PRタイトル: `feat: LP V2改修（機能アイコン16個 + Metaピクセル/UTM + FV文言 + 営業時間FAQ）`
- PR本文に含めるもの:
  - 参照した設計書・指示書のURL
  - manifest.json から取得した16アイコンのファイル名一覧と、配置したセクションの対応表
  - 設計書マップのうち**スキップした箇所**（追加13アイコン該当・CTA画像該当）の一覧
  - 追加したCSSトークン一覧
  - 「触っていない既存要素」チェックリスト（川崎 / 利用者の声 / FV強調赤 / LINE緑 / 既存CTA / main.js / 既存トークン）
  - **ピクセル/UTMのテスト手順**: (1) `?utm_source=meta&utm_medium=paid&utm_campaign=acq202607&utm_content=ad1` を付けてアクセス → DevTools Application タブで sessionStorage `follow_utm` に保存確認 (2) LINEボタンクリック → コンソールにエラーが出ないこと（fbq未初期化のためLead送信はスキップされるのが正常） (3) `META_PIXEL_ID_HERE` を仮IDに置換した状態で Lead が fbq に渡ることの確認方法
  - スクリーンショット（デスクトップ1440px / モバイル375px、最低2枚。FVの新文言と新FAQが写っているもの）

## 手順12: ビルド・検証（PR前に必須）

```bash
npm install
npm run build
```

両方グリーンであること。その後ローカルサーブ（`npm run preview`、またはリポジトリ既存の `serve_local.py` / `start-local-server.ps1`）で:

1. DevTools Network タブで **404 がゼロ**（特に `public/assets/icons/v2/` 配下と `css/lp-feature-icons.css`）
2. コンソールにJSエラーがゼロ
3. `?utm_source=meta&utm_medium=paid&utm_campaign=acq202607&utm_content=ad1` 付きURLで着地 → sessionStorage `follow_utm` に保存されること
4. LINEボタン（7箇所）クリックで例外が出ないこと（fbq ガードの動作確認）
5. 320px / 768px / 1440px でレイアウト崩れ・横スクロールなし

## 不明点があった場合

- 設計書・manifest.json に該当情報がない → 作業中止、ユーザーに質問
- 素材が見つからない → 作業中止、「素材未配置」と報告
- 推測でのファイル名生成・プレースホルダ画像の新規生成は禁止
````

---

## §3 CODEX 完了後の手動検証チェックリスト

PRが上がったら、マージ前にユーザー側で確認してください。

### 3.1 セクション崩れチェック（デスクトップ 1440px）

- [ ] ファーストビュー — 強調赤が変色していない、CTAがはみ出していない
- [ ] **FV文言 — `.fv-meta` に「商材の購入は任意」が追加されている**（「月880円 / いつでも解約OK / 写真を送るだけ / 商材の購入は任意」）
- [ ] アイコン配置セクション — 16アイコンが manifest.json 対応セクションに収まっている（スキップ箇所は既存表現のまま）
- [ ] 川崎権威性セクション — placeholder が維持されている（削除も差し替えもされていない）
- [ ] 「利用者の声」セクション — 文言・順序が改変されていない
- [ ] LINE誘導CTA — 緑 `#06C755` が維持され、他所に緑が混入していない
- [ ] **営業時間FAQ — 「返信はいつ届きますか？」が最後のQ&Aとして追加され、平日9:00〜19:00・翌営業日の記載がある**

### 3.2 レスポンシブ確認

- [ ] 320px（iPhone SE想定）— 横スクロールなし、アイコン潰れなし、FV新文言の折り返しが不自然でない
- [ ] 768px（タブレット縦）— アイコンが mobile→pc 画像に切り替わる境界で破綻していない
- [ ] 1440px — neumorphismシャドウが視認でき、白背景に溶けていない

### 3.3 Metaピクセル確認

- [ ] `index.html` の `<head>` にピクセルコードがあり、プレースホルダ `META_PIXEL_ID_HERE` が script 内と noscript 内の2箇所（同一文字列）にある
- [ ] プレースホルダのままの状態で、ページ表示時に facebook.com への PageView リクエストが**飛ばない**（ガードが効いている）
- [ ] （Pixel ID受領後）`META_PIXEL_ID_HERE` を実IDに一括置換 → Chrome拡張 **Meta Pixel Helper** で PageView が検出される
- [ ] （Pixel ID受領後）LINEボタンクリックで Meta Pixel Helper に **Lead** イベントが表示され、パラメータに utm_content 値が入っている

### 3.4 UTM計測確認

- [ ] `https://<LP URL>/?utm_source=meta&utm_medium=paid&utm_campaign=acq202607&utm_content=ad1` でアクセス → DevTools > Application > Session Storage に `follow_utm` が保存される
- [ ] UTMなしで再読み込みしても `follow_utm` が消えない
- [ ] LINEボタン7箇所（ヘッダー / ヒーロー2 / 比較CTA2 / lp10 / 最終）すべてでクリック時にコンソールエラーが出ず、`https://lin.ee/pXAlGgw` へ正常に遷移する
- [ ] LINEボタンの `href` にUTMが**付与されていない**こと（lin.ee URLは固定のままが正しい）

### 3.5 パフォーマンス（Lighthouse モバイル）

- [ ] LCP < 2.5s（改修前と比較して悪化していない）
- [ ] CLS < 0.1（新規 `<img>` すべてに width/height があるか）
- [ ] Performance スコア 80 以上維持

### 3.6 リンク切れ・PRメタ

- [ ] DevTools Network タブで 404 ゼロ（特に `public/assets/icons/v2/*` と `css/lp-feature-icons.css`）
- [ ] PR本文にスクリーンショット（デスクトップ＋モバイル）、スキップ箇所一覧、「触っていない既存要素」チェックリストが揃っている
- [ ] `npm run build` がグリーン

---

## §4 残タスク（今回スコープ外）一覧

| タスク | 状態 | 次アクション |
|---|---|---|
| CTA画像6枚の作り直し | 旧素材は削除済み、作り直し確定 | 新CTA画像の受領後、`public/cta/` に配置して差し込みPRを別途作成（旧版指示書 §2.3 / 設計書 §5 のパターン表を再利用） |
| 川崎さん実写真 | 未受領。placeholder維持中 | 受領後 `KAWASAKI-PHOTO-INTEGRATION.md`（7/1付手順書）に従って差し替え |
| Meta Pixel ID 発行 | 未発行。プレースホルダで設置済み（本改修後） | Metaイベントマネージャでピクセルを作成しIDを取得 → `index.html` 内の `META_PIXEL_ID_HERE` を実IDに**一括置換1回**（script内＋noscript内の同一文字列2箇所）→ Meta Pixel Helper で PageView/Lead 検出確認（§3.3） |
| LINEボタンのモバイル実機テスト | GO/NOGO B-1 で未実施 | 本改修マージ後、実機（iOS/Android各1台）でLINE遷移＋UTM保存を確認しログを残す |
