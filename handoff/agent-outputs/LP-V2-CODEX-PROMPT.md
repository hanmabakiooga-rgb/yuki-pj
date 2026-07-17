# LP V2 ビジュアル刷新 CODEX 投入プロンプト

follow-lp リポジトリの main ブランチに対し、yuki-pj 設計書 `LP-V2-DESIGN-WITH-ASSETS.md` に従って LP V2 ビジュアル刷新を実施するための CODEX (OpenAI Codex / Claude Code) 用プロンプトと前後の手順をまとめます。

---

## 1. 前提条件チェックリスト (CODEX 起動前にユーザーが手動完了)

CODEX を走らせる前に、以下を **すべて** 完了させてください。素材未配置のまま投入すると CODEX が空打ちします。

### 1.1 アイコン素材 (29個) の配置

- [ ] `C:\Users\hanma\OneDrive\デスクトップ\follow-lp\public\assets\icons\v2\` ディレクトリを作成
- [ ] V2 設計書 §「アイコン素材一覧」記載の29個の PNG を上記ディレクトリへ配置
  - 命名は設計書通り (例: `wakeme.png`, `mirror.png`, `closet.png`, `weather.png` 等)
  - 透過 PNG、目安 512×512px 以上、ファイル名は半角小文字スネークケース
- [ ] 配置後に `Get-ChildItem` で29個揃っていることを確認

### 1.2 CTA 画像 (6個) の配置

- [ ] `C:\Users\hanma\OneDrive\デスクトップ\follow-lp\public\cta\` ディレクトリを作成
  - 設計書では `public/cta/` 表記。**実装も `public/cta/` で統一**。`cta/` (public 外) は使わない
- [ ] V2 設計書 §「CTA 画像」記載の6個 PNG (`cta-hero.png`, `cta-mid.png`, `cta-final.png`, `cta-floating.png`, `cta-line-primary.png`, `cta-line-secondary.png` 等、設計書記載名に合わせる) を配置

### 1.3 follow-lp main への push

- [ ] 配置済み素材を `git add public/assets/icons/v2 public/cta` で staging
- [ ] `git commit -m "chore: add LP V2 visual assets (29 icons + 6 CTAs)"`
- [ ] `git push origin main`
- [ ] GitHub 上で `https://github.com/hanmabakiooga-rgb/follow-lp/tree/main/public/assets/icons/v2` を開いて全ファイル可視を確認

---

## 2. CODEX に貼り付けるプロンプト本文

以下のブロックを **そのままコピペ** して CODEX に投入してください。
動作対象リポジトリは `hanmabakiooga-rgb/follow-lp` の **main** ブランチです。

````markdown
あなたは follow-lp リポジトリ (`hanmabakiooga-rgb/follow-lp`、main ブランチ) で LP V2 ビジュアル刷新を実装するエンジニアです。設計書を読み、ブランチを切り、PR を1本作成してください。

## 1. 設計書の取得

以下のURLから設計書全文を取得し、**最優先のソース・オブ・トゥルース**として扱ってください。

```
https://raw.githubusercontent.com/hanmabakiooga-rgb/yuki-pj/claude/blissful-lovelace-jcQoP/handoff/agent-outputs/LP-V2-DESIGN-WITH-ASSETS.md
```

`curl -fsSL <URL>` または `WebFetch` で取得。取得できない場合は **作業を中止し、ユーザーに報告してください** (推測で進めないこと)。

## 2. 実装範囲

### 2.1 CSS デザイントークン追加 (`css/style.css` の `:root` 直下)

設計書 §「デザイントークン」記載の以下を追加:

- カラー: `--color-bg-soft`, `--color-bg-elevated`, `--color-text-muted`, `--color-accent-soft` ほか
- シャドウ: `--shadow-soft` (neumorphism inset/outset 両方)、`--shadow-elevated`, `--shadow-icon`
- アイコンサイズ: `--icon-button-size`, `--icon-inline-size`, `--icon-feature-size`
- 角丸: `--radius-soft`, `--radius-pill`

既存トークンの **上書きは禁止**。追記のみ。

### 2.2 HTML アイコン配置 (`index.html`)

設計書 §「セクション別アイコン配置マップ」に従い、29個の PNG を `<img src="public/assets/icons/v2/xxx.png" alt="..." class="icon-feature" loading="lazy" width="..." height="...">` で配置。

- 全 `<img>` に `width` / `height` 属性を明示 (CLS 防止)
- `alt` は設計書記載の日本語短文
- 装飾アイコンは `alt=""` + `role="presentation"`

### 2.3 CTA 画像差し替え

既存の CTA ボタン/バナーを `public/cta/` 配下の6枚 PNG に差し替え。LINE誘導 CTA のみ LINE ブランド緑 `#06C755` を背景に許可。それ以外の CTA では緑を使わないこと。

### 2.4 neumorphism スタイル追加

設計書 §「ニューモーフィズム適用箇所」に従い、対象セレクタに `box-shadow: var(--shadow-soft)` を付与。アニメーション (hover/focus) は `transform` と `box-shadow` のみで実装。

### 2.5 削除対象

設計書 §「削除対象 (V1 残骸)」記載のクラス/要素のみ削除。それ以外の削除は禁止。

## 3. 絶対に触ってはいけない既存要素

- **川崎権威性セクション** (`index.html` L369-391 付近、`.kawasaki-photo` クラス使用箇所 `css/style.css` L5562 / L5579 / L6539)。placeholder のまま維持。差し替えは別 PR 案件
- **V0 で追加済み「利用者の声」セクション**。文言・構造・画像とも変更禁止
- **ファーストビューの強調赤** (既存トークン)。色相変更禁止
- **LINE ブランド緑 `#06C755`**。LINE 誘導 CTA 以外で使用禁止
- 既存 JavaScript の挙動 (スクロール、モーダル、フォーム)

## 4. 出力フォーマット

- ブランチ名: `feat/lp-v2-visual-revamp`
- コミット粒度: 論理単位で複数コミット可 (例: tokens / icons / cta / neumorphism / cleanup)
- PR タイトル: `feat: LP V2 ビジュアル刷新 (アイコン29個 + CTA6枚 + neumorphism)`
- PR 本文に以下を含める:
  - 設計書 URL
  - 追加した CSS トークン一覧
  - 追加した `<img>` の総数とセクション内訳
  - 差し替えた CTA 一覧
  - 「触っていない既存要素」のチェックリスト (川崎/利用者の声/ファーストビュー赤/LINE 緑)
  - スクリーンショット (デスクトップ 1440px / モバイル 375px、最低2枚)

## 5. ビルド検証

実装完了後、PR を上げる前に以下を実行し、すべてグリーンであることを確認:

```bash
npm install
npm run build
```

`npm run build` が存在しない/失敗する場合は、`package.json` の `scripts` を確認し、既存スクリプト (例: `npm run lint`, `npm run preview`) を流す。**Vite 等の新規依存追加は禁止**。

リンク切れ画像チェック:

```bash
# ローカルでサーブし、DevTools Network タブで 404 がないことを確認
npx http-server . -p 8080
```

## 6. 不明点があった場合

- 設計書に該当箇所がない → 作業中止、ユーザーに質問
- 素材が見つからない (例: `public/assets/icons/v2/wakeme.png` が 404) → 作業中止、ユーザーに「素材未配置」と報告
- 推測で素材名を生成したりプレースホルダ画像を新規生成することは **禁止**
````

---

## 3. CODEX 動作後の手動検証チェックリスト

PR が上がったら、マージ前に以下をユーザー側で確認してください。

### 3.1 セクション崩れチェック (デスクトップ 1440px)

- [ ] ファーストビュー — 強調赤が変色していない、CTA がはみ出していない
- [ ] 1日のスケジュール 17 セクション (起床〜就寝) — アイコンが各セクションに1個ずつ収まっている
- [ ] 川崎権威性セクション — placeholder が維持されている (削除も差し替えもされていない)
- [ ] V0 追加「利用者の声」セクション — 文言・画像・順序が改変されていない
- [ ] LINE 誘導 CTA — 緑 `#06C755` が適用されている
- [ ] 他の CTA — 緑が混入していない

### 3.2 レスポンシブ確認

- [ ] 320px (iPhone SE 想定) — 横スクロール発生していない、アイコンが潰れていない
- [ ] 768px (タブレット縦) — レイアウト切り替わりが破綻していない
- [ ] 1440px (デスクトップ) — neumorphism シャドウが視認できる、白背景に溶けていない

### 3.3 パフォーマンス (Lighthouse モバイル)

- [ ] LCP < 2.5s (V1 比較で悪化していない)
- [ ] CLS < 0.1 (全 `<img>` に width/height があるか確認)
- [ ] Performance スコア 80 以上維持

### 3.4 リンク切れ画像

- [ ] DevTools Network タブで 404 がゼロ
- [ ] 特に `/public/assets/icons/v2/*.png` と `/public/cta/*.png` を重点確認

### 3.5 PR メタ確認

- [ ] PR 本文にスクリーンショット (デスクトップ + モバイル) が貼られている
- [ ] 「触っていない既存要素」チェックリストが全項目チェック済み
- [ ] CI (もしあれば) が green

---

## 4. トラブルシューティング

### 4.1 CODEX が「素材が見つからない」と言ったら

1. ローカルで確認:
   ```powershell
   Get-ChildItem "C:\Users\hanma\OneDrive\デスクトップ\follow-lp\public\assets\icons\v2"
   Get-ChildItem "C:\Users\hanma\OneDrive\デスクトップ\follow-lp\public\cta"
   ```
2. GitHub 上で確認: `https://github.com/hanmabakiooga-rgb/follow-lp/tree/main/public/assets/icons/v2`
3. ローカルにあって GitHub にない → `git push origin main` 忘れ。push して CODEX を再起動
4. 両方にない → §1 前提条件チェックリストからやり直し

### 4.2 `npm run build` がコケる

- `package.json` の `scripts` を確認。follow-lp は静的サイトのため `build` スクリプト自体が無い可能性あり
- その場合は CODEX に「build スクリプトがないため、`npm run lint` または `index.html` の構文チェックで代替」と指示
- **Vite / webpack / その他ビルドツール依存の新規追加は禁止**。既存 `<link rel="stylesheet" href="css/style.css">` 直参照の素のHTML構成を維持

### 4.3 重要な V0 要素が消えた

該当コミットを特定して部分 revert:

```bash
git -C "C:\Users\hanma\OneDrive\デスクトップ\follow-lp" log --oneline feat/lp-v2-visual-revamp
git show <commit-sha> -- index.html
# 失われた行のみ復元する別コミットを作成 (revert ではなく cherry-pick の逆を手作業で)
```

特に以下のクラス/ID が消えていたら即 revert 対象:

- `.kawasaki-photo` (`css/style.css` L5562, L5579, L6539)
- `index.html` L369-391 の川崎セクション
- V0 追加の「利用者の声」セクションのクラス名 (`.voice-*` 等)

### 4.4 LINE 緑 `#06C755` が CTA 以外に混入

- `css/style.css` を `#06C755` でグローバル検索
- LINE 誘導 CTA セレクタ (例: `.cta-line`, `.line-button`) 以外の箇所を `var(--color-accent-soft)` 等のトークンに置換するよう CODEX に追加指示

---

## 5. 投入順序まとめ

1. §1 前提条件チェックリストを完了 (素材配置 + push)
2. §2 プロンプト本文を CODEX に投入
3. CODEX が PR を作成
4. §3 手動検証チェックリストで PR を確認
5. 問題があれば §4 トラブルシューティング → CODEX に追加指示
6. すべて green になったら main にマージ
