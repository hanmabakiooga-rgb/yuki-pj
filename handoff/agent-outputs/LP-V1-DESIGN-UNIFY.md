# LP V1：アイコン・イラスト全面統一仕様（方針B+全体色調統一）

実行: Claude（デザイン仕様）
作成日: 2026-06-18
対象: `hanmabakiooga-rgb/follow-lp`
状態: **CODEX投入可能**
前提: PR #1（V0改修）マージ後、次の改修として実施

---

## 1. 改修の狙い

現状LPの問題（ユーザー指摘）：
- アイコンスタイルが4種類混在（茶線画／色付きイラスト／ドット絵風／番号バッジ）
- 同じ意味のアイコンが場所ごとに別物（スマホ・LINE・時計）
- ハート♥など装飾目的だけのアイコンがある
- イラストの**色の濃さ**も不揃い

→ **「上品で統一された30-50代女性向けデザイン」**に作り直す。

---

## 2. 統一デザイン仕様（CSS変数で一元管理）

### 2-1. アイコンライブラリ

**採用：Phosphor Icons (Regular スタイル)**
- 公式: https://phosphoricons.com
- 理由：上品な線画、6スタイルから選択可、9,000+アイコン
- ライセンス：MIT
- 実装：SVG埋め込み（npm依存を増やさない）

### 2-2. デザイントークン（CSS変数）

`css/style.css` の冒頭に追加：

```css
:root {
  /* アイコン・イラスト統一カラー */
  --icon-color: #7A5B41;          /* メインのブラウン（既存トーンに合わせる）*/
  --icon-color-light: #B89A7E;    /* 薄いブラウン（影・補助）*/
  --icon-accent: #D4856C;         /* アクセント（CTA・重要箇所のみ）*/
  --icon-bg: #FAF6F0;             /* アイコン背景の薄ベージュ */
  
  /* アイコンサイズ（3段階のみ） */
  --icon-size-sm: 24px;           /* 小カード・FAQ用 */
  --icon-size-md: 32px;           /* 標準カード */
  --icon-size-lg: 48px;           /* ヒーロー・料金カード */
  
  /* アイコンストローク */
  --icon-stroke: 1.5;             /* SVG stroke-width */
  
  /* 番号バッジ */
  --badge-size: 28px;
  --badge-bg: #7A5B41;
  --badge-color: #FFFFFF;
}
```

### 2-3. アイコン共通スタイル

```css
.lp-icon {
  width: var(--icon-size-md);
  height: var(--icon-size-md);
  stroke: var(--icon-color);
  stroke-width: var(--icon-stroke);
  fill: none;
  flex-shrink: 0;
}
.lp-icon-sm { width: var(--icon-size-sm); height: var(--icon-size-sm); }
.lp-icon-lg { width: var(--icon-size-lg); height: var(--icon-size-lg); }

/* アイコンを丸い背景に入れる */
.lp-icon-circle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background-color: var(--icon-bg);
}

/* 番号バッジ */
.lp-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--badge-size);
  height: var(--badge-size);
  border-radius: 50%;
  background-color: var(--badge-bg);
  color: var(--badge-color);
  font-size: 14px;
  font-weight: 600;
  font-family: ui-monospace, "SF Mono", monospace;
}
```

---

## 3. セクション別の処理

### 3-1. 共感カード（分け目／顔周り／生え際／結んだ内側／タイミング／セルフカラーの不安）

**現状**：各カードに小さなハート♥や装飾アイコン

**処理**：
- 装飾アイコン全部削除
- **番号バッジ（01〜06）に置換**
- カードのレイアウトは変えない

```html
<!-- Before -->
<div class="empathy-card">
  <svg class="heart-icon">...</svg>
  <h3>セルフカラーの不安</h3>
</div>

<!-- After -->
<div class="empathy-card">
  <span class="lp-badge">06</span>
  <h3>セルフカラーの不安</h3>
</div>
```

### 3-2. 「LINEで完結／見える範囲だけ相談／染めない場所も確認」3カード

**現状**：
- LINEで完結 → スマホ+LINE緑アイコン（イラスト）
- 見える範囲だけ相談 → 女性横顔イラスト
- 染めない場所も確認 → 女性頭頂部イラスト

**処理（2案、どちらかCODEX判断）**：

**案A（推奨・即実装可）**：既存イラストの色トーンをCSS filterで揃える
```css
.empathy-illust {
  filter: sepia(0.3) saturate(0.7) brightness(0.95);
}
```
→ 既存画像を差し替えずに、見た目を「同じ薄茶色トーン」に統一

**案B（理想・将来）**：全部 Phosphor SVG に置換
- LINEで完結 → `ChatCircleText` Regular
- 見える範囲だけ相談 → `MagnifyingGlass` Regular  
- 染めない場所も確認 → `Eye` Regular

今回は **案A** で実装。

### 3-3. 美容室 vs 自宅 の時間比較（ピクセル風4ステップ）

**現状**：カレンダー・車・ハサミ・家／LINE・刷毛・時計・シャワーのドット絵風

**処理**：全削除 → Phosphor SVG に置換

| 美容室 | Phosphor |
|---|---|
| 予約 | `Calendar` |
| 移動 | `Car` |
| 施術 | `Scissors` |
| 帰宅 | `House` |

| 自宅 | Phosphor |
|---|---|
| LINE確認 | `ChatCircleText` |
| 必要なところだけ塗る | `PaintBrush` |
| 放置 | `Clock` |
| 流す | `Drop` |

サイズ：`--icon-size-md`（32px）、色 `--icon-color`、丸背景なし。

### 3-4. 4ステップカード（全部を家で染める必要はありません）

**現状**：番号バッジ（赤丸）+ 各種小アイコン

**処理**：
- 番号バッジを `lp-badge` で統一（赤→ブラウン）
- 中のアイコンは Phosphor SVG に置換

| ステップ | Phosphor |
|---|---|
| ① 美容室で整える | `Scissors` |
| ② FOLLOWで確認する | `ChatCircleText` |
| ③ 自宅でここだけ整える | `House` |
| ④ 全部を家で染める必要はありません | アイコンなし（テキストのみ） |

### 3-5. 「LINEで届く内容」4カード

**現状**：薬剤候補・購入リンク・混ぜ方/放置時間・染める前の確認の線画ブラウン

**処理**：Phosphor SVG に置換、`lp-icon-circle` で囲む

| カード | Phosphor |
|---|---|
| 薬剤候補 | `Drop` Regular |
| 購入リンク | `ShoppingCart` Regular |
| 混ぜ方・放置時間 | `Clock` Regular |
| 染める前の確認 | `ClipboardText` Regular |
| **染めた後の頭皮ケア（新規追加済）** | `Leaf` Regular |

サイズ：`--icon-size-md`、丸背景あり。

### 3-6. 料金カード（薬剤単価・基本ツールセット・FOLLOW相談・追加ツール）

**現状**：色付き優しい線画イラスト（チューブ・ボウル・スマホ・ケープ）

**処理（2案）**：

**案A（即実装）**：CSS filter で色トーン統一
```css
.price-card-illust {
  filter: sepia(0.4) saturate(0.6) brightness(0.95);
}
```

**案B（将来）**：Phosphor SVG に置換
| カード | Phosphor |
|---|---|
| 薬剤単価 | `Drop` Bold |
| 基本ツールセット | `PaintBrushBroad` Bold |
| FOLLOW相談 | `ChatCircleText` Bold |
| 追加ツール | `TShirt` Bold |

今回は **案A** で実装。

### 3-7. ハート♥（セルフカラーの不安等の装飾）

**処理**：全削除

---

## 4. 全体の色濃さ統一ルール

### 4-1. 既存写真・イラストへのCSS filter

```css
/* グローバルに既存イラストの濃さを統一 */
.lp-soft-illust {
  filter: sepia(0.3) saturate(0.7) brightness(0.95) contrast(0.95);
}

/* 強めの統一が必要な箇所（料金カード等） */
.lp-strong-unify {
  filter: sepia(0.4) saturate(0.6) brightness(0.95);
}
```

既存の `<img>` タグに `class="lp-soft-illust"` を付ける（CODEX が一括追加）。

### 4-2. 緑色（LINE緑）の扱い

LINEブランド緑 `#06C755` は**ボタンとロゴのみ**残す。  
他の場所で出てくる緑色（小さなアイコン等）は `--icon-color`（ブラウン）に変更。

### 4-3. 赤色の扱い

ファーストビューの「気になる」等の強調赤は残す（既存ブランドの一部）。  
番号バッジの赤丸 → ブラウンに変更（統一感のため）。

---

## 5. Phosphor SVG の実装方法

CODEX が以下から取得：

```
https://github.com/phosphor-icons/core/tree/main/raw/regular
```

例：`drop.svg`（薬剤候補用）

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" class="lp-icon">
  <path d="M174,47.75a254.19,254.19,0,0,0-41.45-38.3,8,8,0,0,0-9.18,0A254.19,254.19,0,0,0,82,47.75C54.51,79.32,40,112.6,40,144a88,88,0,0,0,176,0C216,112.6,201.49,79.32,174,47.75Z" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/>
</svg>
```

ポイント：
- `class="lp-icon"` で統一スタイル適用
- `stroke="currentColor"` で色をCSS変数から継承
- `fill="none"` で塗りつぶしなし

---

## 6. CODEX 投入プロンプト

```
hanmabakiooga-rgb/follow-lp で起動済み前提。

yuki-pj リポジトリの以下の指示書に従って、LP のアイコン・イラスト全面統一を実施してください。

参照:
https://raw.githubusercontent.com/hanmabakiooga-rgb/yuki-pj/claude/blissful-lovelace-jcQoP/handoff/agent-outputs/LP-V1-DESIGN-UNIFY.md

実装範囲:
1. css/style.css に §2-2 のデザイントークン（CSS変数）を追加
2. css/style.css に §2-3 のアイコン共通スタイル + §4-1 のCSS filter を追加
3. index.html の各セクションを §3 に従って改修：
   - 3-1 共感カードのハート♥を番号バッジに置換
   - 3-2 イラスト3枚に class="lp-soft-illust" を付与
   - 3-3 ピクセル風4ステップを Phosphor SVG に置換（calendar/car/scissors/house/chat/paint-brush/clock/drop）
   - 3-4 4ステップカードの赤丸番号をブラウン番号バッジに、内部アイコンを Phosphor SVG に
   - 3-5 「LINEで届く内容」4+1カードを Phosphor SVG に置換
   - 3-6 料金カードのイラストに class="lp-strong-unify" を付与
   - 3-7 装飾的なハート♥を全削除
4. § 4-2 緑色を LINE ボタン以外で使っていれば --icon-color に置換
5. § 4-3 赤色の番号バッジをブラウンに置換

Phosphor SVG は以下から regular スタイルを取得して埋め込み：
https://github.com/phosphor-icons/core/blob/main/raw/regular/

実装上の注意:
- 既存の <img> イラストは削除せず、CSS filterで統一する（案A優先）
- LINEブランド緑 #06C755 はボタン・ロゴのみ残す
- ファーストビューの強調赤は残す
- npm run build が成功すること
- 既存のレスポンシブが崩れないこと

ブランチ: feat/lp-icon-quality-unify
PR タイトル: feat(lp): icon and illustration design unification (Phosphor + tone unify)
PR 本文: 改修した7セクションのチェックリスト
```

---

## 7. 期待される効果

| Before | After |
|---|---|
| アイコンスタイル4種混在 | Phosphor Regular 1種に統一 |
| 色がブラウン・赤・緑・茶バラバラ | ブラウン1色 + 限定アクセント |
| 装飾的ハートが散在 | 番号バッジで整理 |
| ピクセル風が浮く | 全体トーンに馴染む |
| イラストの濃さバラバラ | CSS filter で統一 |

ユーザー体験：
- 「上品」「信頼できる」「30代-50代女性向けに最適化」の印象を強化
- 視覚的ノイズが減り、コピー（テキスト）が読みやすくなる
- CVR への寄与：信頼指標 + 滞在時間延長

---

## 8. ユーザー承認事項

- [ ] Phosphor Icons (Regular) で進めてOK？（候補：Heroicons / Lucide / Iconoir）
- [ ] CSS filter で既存イラストの色統一する（案A）方針OK？
- [ ] 装飾ハート全削除でOK？
- [ ] ブラウン1色統一（LINEボタン+強調赤のみ例外）でOK？
- [ ] CODEX 投入してOK？
