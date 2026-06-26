# LP V2 デザイン仕様書（新規アセット採用版）

作成日: 2026-06-26
位置づけ: LP-V1-DESIGN-UNIFY.md の後継、新規アイコンセット採用版
状態: **CODEX投入可能**（追加素材到着次第）
前提: follow-lp リポジトリ、素HTML/CSS、Vite ビルド

---

## 1. このv2の狙い

V0改修（権威性追加・利用者の声）まで本番反映済。  
今回は**ビジュアル全面刷新**で「ダサい」「バラバラ」感を一掃する。

### 採用素材（プロデザイン）

```
✅ followlp-icon-grid.png   - 16アイコン（neumorphism + グリーン+オレンジ）
✅ line-consult-cta-grid.png - 6パターンCTAボタン
🔄 追加13アイコン            - FOLLOW専用テーマ（依頼中、同テイスト）
🔄 CTA 6パターン書き換え版   - テキスト「AI」除去（依頼中）
```

---

## 2. デザイントークン（CSS変数）

`css/style.css` の冒頭に追加：

```css
:root {
  /* ==========================================
   * V2 デザイントークン
   * ========================================== */
  
  /* ベースカラー */
  --color-bg-soft: #F5F0E8;          /* LP背景の淡ベージュ */
  --color-bg-white: #FFFFFF;
  
  /* アクセントカラー */
  --color-green: #22C55E;            /* メインアクセント（成長・自然） */
  --color-green-dark: #16A34A;
  --color-orange: #F59E0B;           /* CTA・重要アクセント */
  --color-orange-dark: #EA580C;
  --color-orange-light: #FED7AA;
  
  /* テキスト */
  --color-text-primary: #1F2937;
  --color-text-secondary: #6B7280;
  --color-text-muted: #9CA3AF;
  
  /* ブランド色（既存維持） */
  --color-brown: #7A5B41;            /* 川崎さんセクション等で残す */
  --color-line: #06C755;             /* LINEブランド緑、CTA以外で使わない */
  
  /* シャドウ（neumorphism風） */
  --shadow-soft: 
    8px 8px 16px rgba(0, 0, 0, 0.08),
    -8px -8px 16px rgba(255, 255, 255, 0.9);
  --shadow-soft-sm: 
    4px 4px 8px rgba(0, 0, 0, 0.06),
    -4px -4px 8px rgba(255, 255, 255, 0.9);
  --shadow-button:
    0 4px 12px rgba(245, 158, 11, 0.3);
  --shadow-button-hover:
    0 8px 20px rgba(245, 158, 11, 0.4);
  
  /* アイコンボタン（neumorphism） */
  --icon-button-size: 100px;
  --icon-button-size-sm: 72px;
  --icon-button-radius: 50%;
  
  /* CTA ボタン */
  --cta-radius: 999px;
  --cta-padding-y: 18px;
  --cta-padding-x: 32px;
}
```

---

## 3. アイコンアセット管理

### 3-1. ファイル格納

CODEX が以下のディレクトリ構造で配置：

```
public/
  assets/
    icons/
      v2/
        ai-shindan.png         - AI診断
        line-renkei.png        - LINE連携
        nyuryoku-form.png      - 入力フォーム
        yoyaku-kanri.png       - 予約管理
        kokyaku-kanri.png      - 顧客管理
        jidouka.png            - 自動化
        kaizen-bunseki.png     - 改善分析
        tsuuchi.png            - 通知
        anzen-kanri.png        - 安全管理
        sumaho-taiou.png       - スマホ対応
        cta-dousen.png         - CTA導線
        support.png            - サポート
        hair-color.png         - ヘアカラー
        face-frame.png         - 顔まわり
        time.png               - 時間
        cta.png                - CTA
        # 追加アイコン
        wakeme.png             - 分け目
        haegiwa.png            - 生え際
        musunda-kami.png       - 結んだ髪
        timing.png             - タイミング
        bottle.png             - 薬剤ボトル
        cart.png               - ショッピングカート
        clock.png              - 時計
        clipboard.png          - クリップボード
        leaf.png               - 葉っぱ（頭皮ケア）
        coin.png               - コイン
        check.png              - チェック
        cross.png              - バツ
        faq.png                - ?マーク

cta/
  cta-01-solid.png             - 王道塗りボタン
  cta-02-floating-label.png    - ラベル浮かせ
  cta-03-ribbon.png            - リボン付き
  cta-04-callout.png           - カラーリスト案内型
  cta-05-slide.png             - スライド型
  cta-06-text-link.png         - テキストリンク
```

ユーザー作業：個別PNG（または書き出し用グリッド）を follow-lp の上記ディレクトリに格納してコミット。

### 3-2. 共通CSS

```css
/* アイコンボタン（neumorphism風の白い丸） */
.lp-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--icon-button-size);
  height: var(--icon-button-size);
  background-color: var(--color-bg-white);
  border-radius: var(--icon-button-radius);
  box-shadow: var(--shadow-soft);
  margin-bottom: 12px;
}

.lp-icon-btn img {
  width: 55%;
  height: 55%;
  object-fit: contain;
}

/* スモールサイズ（カード内） */
.lp-icon-btn--sm {
  width: var(--icon-button-size-sm);
  height: var(--icon-button-size-sm);
}

/* アイコン下のラベル（日本語） */
.lp-icon-label {
  font-size: 14px;
  font-weight: 700;
  color: var(--color-text-primary);
  text-align: center;
  margin-bottom: 2px;
}

/* アイコン下のサブラベル（英語） */
.lp-icon-sublabel {
  font-size: 11px;
  color: var(--color-text-muted);
  text-align: center;
  text-transform: lowercase;
  letter-spacing: 0.05em;
}

/* アイコンユニット（縦並び） */
.lp-icon-unit {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}
```

---

## 4. アイコン配置マップ（LP全セクション）

### 4-1. ファーストビュー (FV)
- 既存ビジュアル維持
- CTAボタンを **cta-01-solid.png** に差し替え（テキスト: 「分け目だけ、LINEから相談」）
- CTA直下に「月880円 / いつでも解約OK / 写真を送るだけ」（V0改修済み）

### 4-2. 共感セクション 6パターン
| カード | アイコン |
|---|---|
| 分け目 | `wakeme.png` |
| 生え際 | `haegiwa.png` |
| 顔まわり | `face-frame.png` |
| 結んだ髪の内側 | `musunda-kami.png` |
| 美容室のタイミング | `timing.png` |
| セルフカラーの不安 | `hair-color.png` (or `cta.png`) |

→ ハート♥は全削除、上記アイコンに置換

### 4-3. 美容室 vs 自宅 時間比較
- 美容室4ステップ: `yoyaku-kanri.png` / `time.png` / `hair-color.png` / `support.png`
- 自宅4ステップ: `line-renkei.png` / `bottle.png` / `clock.png` / `check.png`

→ ピクセル風削除、neumorphism アイコン群に置換

### 4-4. 「全部染めなくていい」3カード
- カード1: 美容室で整える → `support.png`
- カード2: FOLLOWで確認する → `line-renkei.png`
- カード3: 自宅でここだけ整える → `hair-color.png`

### 4-5. LINEで写真を送るだけセクション
- メインアイコン: `nyuryoku-form.png`
- 補助: `sumaho-taiou.png` / `line-renkei.png`

### 4-6. 写真から確認する6カード
| カード | アイコン |
|---|---|
| 髪の状態 | `hair-color.png` |
| 顔まわりの様子 | `face-frame.png` |
| ハイライト残り | `kokyaku-kanri.png` |
| アレルギー履歴 | `anzen-kanri.png` |
| 過去のカラー | `kaizen-bunseki.png` |
| 実施前にもう一度LINE確認 | `tsuuchi.png` |

### 4-7. 川崎さん権威性セクション（V0で追加済み）
- 写真placeholder維持（実写到着次第差し替え）
- 枠の角に小さく `support.png` を装飾

### 4-8. LINEで届く内容 5カード
| カード | アイコン |
|---|---|
| 薬剤候補 | `bottle.png` |
| 購入リンク | `cart.png` |
| 混ぜ方・放置時間 | `clock.png` |
| 染める前の確認 | `clipboard.png` |
| 染めた後の頭皮ケア（V0追加） | `leaf.png` |

下部のプロ用商材注記（V0追加）はそのまま。

### 4-9. 年間費用比較
- メインアイコン: `coin.png` + `time.png`
- 67,250円差の数字を大きく

### 4-10. 美容室の価格動向
- アイコン: `kaizen-bunseki.png`

### 4-11. 「できること / できないこと」
- できることカード（緑系）: `check.png`
- できないことカード（グレー系）: `cross.png`
- ブリーチ等の安全配慮: `anzen-kanri.png`

### 4-12. 料金セクション
- メインアイコン: `coin.png`
- 880円を大きく
- CTA: **cta-02-floating-label.png** 「初月無料 LINEから相談」（A/Bテスト次第）

### 4-13. LINE登録後の流れ
- ステップアイコン: `jidouka.png` / `nyuryoku-form.png` / `line-renkei.png` / `support.png`

### 4-14. 利用者の声（V0で追加済み）
- 装飾なしのままでも可、または小さく `kokyaku-kanri.png`

### 4-15. FAQ
- セクション見出し横: `faq.png`

### 4-16. 中間CTA（FAQ手前）
- **cta-03-ribbon.png** 「写真1枚で30秒 LINEから相談」

### 4-17. フッターCTA
- **cta-06-text-link.png** 「LINEから相談」（控えめ）

---

## 5. CTAパターン採用一覧

| 配置場所 | パターン | テキスト |
|---|---|---|
| ファーストビュー | 01 王道塗り | **分け目だけ、LINEから相談** |
| 中盤（年間費用比較後）| 04 カラーリスト案内型 | **カラーリストが案内 LINEから相談** |
| 中盤（料金後）| 02 ラベル浮かせ | **初月無料 LINEから相談** |
| FAQ手前 | 03 リボン付き | **写真1枚で30秒 LINEから相談** |
| FAQ内・補助CTA | 05 スライド型 | **相談1分 LINEから相談** |
| フッター | 06 テキストリンク | **LINEから相談** |

→ 全パターン使用、配置場所で差別化

---

## 6. アイコンの細部仕様（追加13個依頼用、再掲）

スタイル統一：

```
背景:    白い丸ボタン（直径 100-120px）
影:      ソフトな drop-shadow（neumorphism風）
線画色:  グリーン #22C55E 系
アクセント: オレンジ #F59E0B 系（部分的に）
線の太さ: 2-2.5px
角丸:    線端は rounded
ラベル:  日本語上、英語サブテキスト下
```

英語サブテキスト：

| アイコン | 日本語 | 英語 |
|---|---|---|
| 1 | 分け目 | parting line |
| 2 | 生え際 | hairline |
| 3 | 結んだ髪 | tied hair |
| 4 | タイミング | timing |
| 5 | 薬剤ボトル | color tube |
| 6 | カート | shop link |
| 7 | 時計 | processing time |
| 8 | クリップボード | pre-check |
| 9 | 葉っぱ | scalp care |
| 10 | コイン | pricing |
| 11 | チェック | can do |
| 12 | バツ | can not |
| 13 | ? マーク | faq |

---

## 7. レスポンシブ調整

```css
@media (max-width: 768px) {
  :root {
    --icon-button-size: 84px;
    --icon-button-size-sm: 60px;
    --cta-padding-y: 16px;
    --cta-padding-x: 24px;
  }
  
  .lp-icon-label {
    font-size: 13px;
  }
  
  .lp-icon-sublabel {
    font-size: 10px;
  }
}
```

---

## 8. CODEX 投入プロンプト

ユーザーが追加素材を follow-lp に格納後、CODEX に以下を投げる：

```
hanmabakiooga-rgb/yuki-pj の以下指示書に従って、
follow-lp のLP全面ビジュアル刷新を実施してください：

https://raw.githubusercontent.com/hanmabakiooga-rgb/yuki-pj/claude/blissful-lovelace-jcQoP/handoff/agent-outputs/LP-V2-DESIGN-WITH-ASSETS.md

実装範囲:
1. css/style.css に §2 のデザイントークン（CSS変数）を追加
2. css/style.css に §3-2 のアイコン共通スタイルを追加
3. css/style.css に §7 のレスポンシブを追加
4. index.html の各セクション（§4-1 〜 §4-17）に
   public/assets/icons/v2/ の対応するアイコンを配置
5. CTAボタンを §5 の通り6箇所に配置（テキスト書き換え版）
6. 既存のハート♥・ピクセル風アイコン・装飾的SVGを削除
7. 既存の <img> イラストはCSS filter で色トーン統一

ファイル配置:
- public/assets/icons/v2/*.png（29個、既存16+追加13）
- public/cta/cta-*.png（6種類）
※ これらは事前にコミット済みである前提

実装上の注意:
- npm run build が成功すること
- 既存のレスポンシブが崩れないこと
- LINEブランド緑 #06C755 は CTA以外で使わない
- ファーストビューの強調赤は残す
- 川崎さん権威性セクション（V0で追加済み）と利用者の声セクション（V0で追加済み）は保持

ブランチ: feat/lp-v2-visual-revamp
PR タイトル: feat(lp): v2 visual revamp with new icon assets
PR 本文: 改修した17セクションのチェックリスト + before/after screenshot 案内
```

---

## 9. 完成までの段取り

### Phase 1: 追加素材作成（あなた）
- 追加アイコン13個（仕様 §6 通り）
- CTA 6パターンのテキスト書き換え版（仕様 §5 通り）

### Phase 2: follow-lp に格納（あなた）
- `public/assets/icons/v2/` に29アイコン
- `public/cta/` に6パターン
- git commit & push

### Phase 3: CODEX投入（あなた）
- §8 のプロンプトをCODEXに

### Phase 4: PR レビュー & マージ（私 + あなた）
- 私: diff レビュー
- あなた: preview 確認 → 本番反映

### Phase 5: 川崎さん写真到着次第差し替え（あなた）
- 権威性セクションの placeholder を実写に

---

## 10. 期待される効果

### Before（現状）
- アイコン4種混在（茶線画/色付き/ドット絵/番号）
- 色がバラバラ（茶/赤/緑/青）
- 装飾的なハート♥が散在
- イラストの濃さ不揃い

### After（V2 反映）
- 統一テイスト（neumorphism + グリーン+オレンジ）
- 色トーン3色に集約（白+グリーン+オレンジ、ブラウンは限定箇所）
- 意味のあるアイコンだけ配置
- プロのデザイナー仕事の見た目

### CVR 予測

| 状態 | LP→LINE登録CVR |
|---|---|
| V0改修反映済（現状）| 30-38% |
| V2 反映後（予測）| **38-48%** |

権威性 + 社会的証明 + 視覚刷新の3重効果。

---

## 11. 補足：将来のさらなる改善

V2 以降の選択肢：

- **A. 動画埋め込み**：川崎さん挨拶15秒動画をFVに
- **B. Lottie アニメーション**：静止画→軽量アニメに置換
- **C. ダークモード**：夜利用者向け（優先度低）
- **D. 多言語**：英語版（インバウンド対応、優先度低）

これらは V3 以降で検討。
