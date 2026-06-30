# 川崎さん権威性写真 差し込み実装手順書

> 対象リポジトリ: `hanmabakiooga-rgb/follow-lp` (main)
> 対象ファイル: `index.html` L369-391 内 `.kawasaki-photo` 要素
> 確認日: 2026-07-01

---

## 1. 写真の準備要件

### ファイル仕様

| 項目 | 推奨値 | 理由 |
| --- | --- | --- |
| ファイル名 | `kawasaki-profile.jpg` | `index.html` 内のコメントで `src="/kawasaki-profile.jpg"` と指定済み |
| アスペクト比 | 縦長 4:5 もしくは 3:4 | 表示枠は円形 (132px / mobile 112px) だが、被写体の顔位置調整のため縦長原稿が扱いやすい |
| 短辺解像度 | 最低 800px / 推奨 1200px 以上 | Retina (2x) 表示時の劣化防止。表示サイズ132pxの約9倍まで耐える |
| 長辺解像度 | 1500px 上限目安 | これ以上は容量肥大化のため不要 |
| 形式 | JPEG (品質 80-85) | 写真用途に最適。WebP併用は任意 (後述) |
| 容量上限 | **200KB 以下** | LCP (Core Web Vitals) 影響を回避。LP のメインビジュアル直後に位置するため軽量化必須 |
| カラープロファイル | sRGB | iOS/Android 双方で色再現が安定 |

### 構図ガイダンス

円形 (border-radius: 50%) でクロップされ、`object-fit: cover` で中央寄せ表示されることを前提に：

- **顔の位置**: フレーム上部から 1/3 ライン上に瞳が来る配置 (円形クロップで顔が切れない)
- **被写体範囲**: 肩から胸上部まで写る半身ショット
- **視線**: 正面 or やや斜め (信頼性を担保)
- **表情**: 微笑み程度。歯を強く出した笑顔よりプロフェッショナル寄り
- **照明**: 自然光 (窓際) または柔らかい白色光。直射蛍光灯による顔の影は避ける
- **背景**: カラー専門店の店内 (薬剤棚・施術椅子) が薄くボケて入るとブランド (大阪のカラー専門店経営) と一致。背景が無理なら無地の暖色系壁
- **服装**: 黒・ネイビー・白などの単色トップス。ブランドの「落ち着いた信頼感」と整合
- **避けるべき**: 自撮り感、SNOWアプリのフィルタ、強い加工、極端な逆光

### 任意: WebP 併用 (後日対応可)

`<picture>` 要素を使い、対応ブラウザでは WebP、フォールバック JPEG という構成も可能。今回は単体差し替えを優先。

---

## 2. 配置場所

### 第一候補 (推奨)

```
リポジトリルート/
├── index.html
├── kawasaki-profile.jpg   ← ここ
├── css/
└── ...
```

**理由**: `index.html` 内コメントで指定されている `src="/kawasaki-profile.jpg"` (絶対パス、ルート起点) と一致。Cloudflare Pages や GitHub Pages では静的サイトのルート = リポジトリルートのため、追加設定不要で配信される。

### 第二候補 (Vite/ビルドツール導入済みの場合のみ)

`public/kawasaki-profile.jpg` に置き、ビルド時にルートへコピーする構成。
ただし follow-lp は静的 HTML 直接配信構成のため、現時点ではこの選択肢は不要。`package.json` または `vite.config.*` の存在を確認してから判断する。

```bash
# 構成確認コマンド
gh api repos/hanmabakiooga-rgb/follow-lp/contents | jq '.[].name'
```

`vite.config.js` `vite.config.ts` `next.config.js` のいずれも無ければ第一候補で確定。

---

## 3. HTML 修正

### 差分 (`index.html` L373-377 付近)

#### 修正前

```html
<div class="kawasaki-photo" aria-label="川崎 プロフィール写真">
  <!-- TODO: 川崎さん写真を後日差し替え -->
  <!-- <img src="/kawasaki-profile.jpg" alt="川崎 プロフィール写真"> -->
  <span>写真</span>
</div>
```

#### 修正後 (完全版)

```html
<div class="kawasaki-photo" aria-label="川崎 プロフィール写真">
  <img src="/kawasaki-profile.jpg" alt="川崎 プロフィール写真" width="132" height="132" loading="lazy" decoding="async">
</div>
```

### 編集ポイント

1. **L374** の `<!-- TODO: 川崎さん写真を後日差し替え -->` コメント行を削除
2. **L375** の `<!-- <img src="/kawasaki-profile.jpg" alt="川崎 プロフィール写真"> -->` コメントマーカー (`<!--` と `-->`) を外す
3. **L376** の `<span>写真</span>` プレースホルダ行を削除
4. `<img>` タグに以下の属性を追加 (オリジナルコメントには無いが推奨)
   - `width="132" height="132"`: CLS (Cumulative Layout Shift) 防止
   - `loading="lazy"`: 該当セクションはファーストビュー外。LCP に影響しない位置のため遅延読込で OK
   - `decoding="async"`: メインスレッドのデコードブロック回避

### 補足: `aria-label` の扱い

親 `<div>` に `aria-label="川崎 プロフィール写真"` が既にあるため、`<img>` の `alt` と二重読み上げのリスクがある。スクリーンリーダー検証で重複が気になる場合は、親 `<div>` から `aria-label` を外し `<img alt>` に一本化する選択肢もある。今回は既存マークアップを尊重して両方残す。

---

## 4. CSS 検証結果

`https://raw.githubusercontent.com/hanmabakiooga-rgb/follow-lp/main/css/style.css` を取得し、関連ブロックを確認した。

### `.kawasaki-photo` 親要素 (L5562-5577)

```css
.kawasaki-photo {
  display: grid;
  place-items: center;
  width: 132px;
  height: 132px;
  margin: 22px auto 20px;
  overflow: hidden;            /* 円形クロップを保証 */
  border: 1px solid rgba(234, 215, 199, 0.95);
  border-radius: 50%;          /* 円形マスク */
  background: linear-gradient(145deg, #f5eee6, #fffdf9);
  color: #9f8d80;              /* プレースホルダ文字色 (画像差し込み後は不要) */
  font-size: 0.82rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  box-shadow: 0 12px 28px rgba(90, 54, 35, 0.08);
}
```

### `.kawasaki-photo img` (L5579-5583)

```css
.kawasaki-photo img {
  width: 100%;
  height: 100%;
  object-fit: cover;           /* 縦長原稿でも中央クロップで円形に収まる */
}
```

### モバイル幅 (max-width: 430px) (L6539-6543)

```css
.kawasaki-photo {
  width: 112px;
  height: 112px;
  margin-top: 18px;
}
```

### 結論: 追加 CSS は **不要**

以下が全て揃っているため、`<img>` を差し込むだけで円形・カバー・レスポンシブが完成する：

- 親要素の `overflow: hidden` + `border-radius: 50%` → 円形マスク
- `<img>` への `width:100%; height:100%; object-fit: cover` → 中央クロップ
- モバイル幅でのサイズ縮小も親側で対応済み

### (任意) 微調整したい場合

被写体の顔が円形枠の上寄りで切れる場合のみ、以下を追記検討：

```css
.kawasaki-photo img {
  object-position: center 30%;  /* 顔を上寄りに寄せる */
}
```

ただし**原則として原稿側 (写真側) で構図調整するべき**で、CSS は最後の手段。

---

## 5. コミット手順

### 単一コミットで実施

```bash
# 1. 写真ファイルをリポジトリルートに配置
cp /path/to/kawasaki-profile.jpg ./kawasaki-profile.jpg

# 2. index.html を編集 (前述の差分)

# 3. 動作確認 (ローカル)
#    Python 内蔵サーバで開いて確認するのが最も手軽
python -m http.server 8080
# → http://localhost:8080/ をブラウザで開き、該当セクションを目視確認

# 4. (もし npm スクリプトがあれば)
npm run build
# package.json が存在しない場合はスキップ

# 5. ステージング & コミット
git add kawasaki-profile.jpg index.html
git commit -m "feat(lp): swap kawasaki authority photo placeholder for real image"

# 6. プッシュ
git push origin main
```

### コミットメッセージ (確定)

```
feat(lp): swap kawasaki authority photo placeholder for real image
```

ボディは不要 (差分が自己説明的)。

### 動作確認チェック (ローカル)

- [ ] `http://localhost:8080/kawasaki-profile.jpg` で画像単体が表示できる
- [ ] LP の権威性セクションで円形に表示される
- [ ] DevTools の Network タブで画像サイズが 200KB 以下
- [ ] DevTools Console にエラーが出ていない
- [ ] DevTools のレスポンシブモードで 320px 幅にしても崩れない

---

## 6. デプロイ後の確認

### 6.1. プレビュー URL

follow-lp は Cloudflare Pages または GitHub Pages 配信と推測される。実 URL は以下のいずれか：

- `https://follow-lp.pages.dev/` (Cloudflare Pages デフォルト)
- `https://hanmabakiooga-rgb.github.io/follow-lp/` (GitHub Pages)
- 独自ドメイン (要 hosting 設定確認)

**URL 確定コマンド**:

```bash
gh api repos/hanmabakiooga-rgb/follow-lp/pages 2>/dev/null
gh api repos/hanmabakiooga-rgb/follow-lp --jq '.homepage'
```

### 6.2. 確認項目

#### 表示確認

- [ ] 「あなたの写真を見るのは」「この道20年のカラーリストです。」見出しの直下に円形写真が表示
- [ ] 写真の下に資格リスト 4 項目が表示
- [ ] 写真の輪郭がぼやけたり、JPEG ブロックノイズが見えたりしないか (容量と解像度のバランス)

#### モバイル幅確認 (重要)

Chrome DevTools → Responsive Mode で以下を確認：

- [ ] **320px (iPhone SE 1st)**: 写真が崩れず、左右の余白が一定
- [ ] **375px (iPhone SE 2nd/3rd)**: 写真直径 112px で表示、はみ出し無し
- [ ] **430px ぎりぎり境界**: 132px → 112px のブレークポイントが滑らかに切り替わる

#### アクセシビリティ確認

- [ ] **スクリーンリーダー**: macOS VoiceOver (Cmd+F5) または NVDA で当該要素にフォーカスし、「川崎 プロフィール写真」と読み上げられる
- [ ] **キーボード**: Tab キーで画像にフォーカスされない (リンクではないので正常)
- [ ] **画像読込失敗時**: DevTools Network で画像を Block し、`alt` テキストがフォールバック表示される

#### パフォーマンス確認

- [ ] **Lighthouse モバイル スコア** (Performance): 差し込み前後で大きく低下していない (-5pt 以内が目安)
- [ ] **LCP**: 該当画像は Below-the-fold のため LCP 要素にはならない想定。Lighthouse で LCP 要素が変わっていないか確認
- [ ] **CLS**: `width`/`height` 属性付与により 0 を維持

---

## 7. ロールバック手順 (万一の場合)

```bash
# コミット単位で戻す
git revert <commit-hash>
git push origin main
```

または、差し込み前の placeholder 状態に戻したい場合は前述の HTML を逆順で復元。

---

## 8. チェックリスト (実施者用サマリ)

事前準備:

- [ ] 川崎さんの写真原稿を受領 (構図ガイダンス満たすこと)
- [ ] 写真を JPEG 品質 80-85 / 200KB 以下に最適化
- [ ] ファイル名を `kawasaki-profile.jpg` に変更
- [ ] sRGB カラープロファイルを確認

実装:

- [ ] リポジトリルートに `kawasaki-profile.jpg` を配置
- [ ] `index.html` L373-377 を差分通りに修正
- [ ] ローカルサーバで表示確認
- [ ] `feat(lp): swap kawasaki authority photo placeholder for real image` でコミット
- [ ] `git push origin main`

検証:

- [ ] デプロイ URL でセクション表示
- [ ] 320px / 375px / 430px / desktop で表示崩れ無し
- [ ] スクリーンリーダー読み上げ確認
- [ ] Lighthouse Performance スコア確認

完了条件: 上記全項目が ✅ になったらリリース完了。
