# LP V0 修正テキスト確定版（CODEX 実装用）

実行: Claude（LP修正 + E法務照合済）
作成日: 2026-06-12
前提: LP-REVIEW-2026-06-10.md の優先1〜6を反映、川崎さん写真はplaceholderで即入稿可能
状態: **CODEX投入可能**

---

## 変更サマリー（6点）

| # | 内容 | ファイル変更 | 依存物 |
|---|---|---|---|
| 1 | 川崎さん権威性セクション追加 | page.tsx に新セクション挿入 | 写真（placeholder OK） |
| 2 | 利用者の声セクション追加（2件） | page.tsx に新セクション挿入 | 声のコピーのみ（同意取得後に実名/属性を更新） |
| 3 | 「LINEで届く内容」に頭皮ケアカード追加 | 既存セクションのカード数 +1 | なし（即可能） |
| 4 | プロ用商材の明記 | 既存セクションの文言修正 | なし（即可能） |
| 5 | ファーストビューに月額・解約の補足 | FV のCTA下に1行追加 | なし（即可能） |
| 6 | FAQ「解約方法」の具体化 | FAQ の答えを更新 | なし（即可能） |

---

## 変更1：川崎さん権威性セクション

**挿入位置**：「写真から確認すること（6カード）」セクションの直後

```tsx
// =====================
// Section: 川崎権威性
// =====================
<section className="py-16 px-6 bg-stone-50">
  <div className="max-w-md mx-auto text-center">
    <p className="text-sm text-stone-400 mb-6 tracking-widest uppercase">
      あなたの写真を見るのは
    </p>
    <h2 className="text-2xl font-bold text-stone-800 mb-6 leading-relaxed">
      この道20年の<br />カラーリストです。
    </h2>

    {/* 写真placeholder — 川崎さんの写真が届き次第差し替え */}
    <div className="w-32 h-32 rounded-full mx-auto mb-6 overflow-hidden bg-stone-200 flex items-center justify-center">
      {/* <img src="/kawasaki-profile.jpg" alt="川崎 プロフィール写真" className="w-full h-full object-cover" /> */}
      <span className="text-stone-400 text-xs">写真</span>
    </div>

    <ul className="text-left space-y-2 text-stone-700 text-sm mb-6 inline-block">
      <li className="flex items-start gap-2">
        <span className="text-amber-600 mt-0.5">▸</span>
        現役カラーリスト 20年
      </li>
      <li className="flex items-start gap-2">
        <span className="text-amber-600 mt-0.5">▸</span>
        大阪でカラー専門店を10年以上経営
      </li>
      <li className="flex items-start gap-2">
        <span className="text-amber-600 mt-0.5">▸</span>
        海外でのカラーリスト経験
      </li>
      <li className="flex items-start gap-2">
        <span className="text-amber-600 mt-0.5">▸</span>
        これまで数万人の白髪相談に対応
      </li>
    </ul>

    <blockquote className="border-l-4 border-amber-400 pl-4 text-left text-stone-600 text-sm italic">
      毎日サロンの現場に立ちながら、<br />
      LINEでの相談に答えています。<br />
      <br />
      「染めるか、染めないか」から一緒に考える。<br />
      それが私のスタンスです。
    </blockquote>
    <p className="text-right text-stone-500 text-sm mt-2">― 川崎</p>
  </div>
</section>
```

---

## 変更2：利用者の声セクション

**挿入位置**：FAQセクションの直前

```tsx
// =====================
// Section: 利用者の声
// =====================
<section className="py-16 px-6 bg-white">
  <div className="max-w-md mx-auto">
    <p className="text-center text-sm text-stone-400 mb-8 tracking-widest uppercase">
      ご利用中の方の声
    </p>

    <div className="space-y-6">
      <div className="bg-stone-50 rounded-2xl p-5 border border-stone-100">
        <p className="text-stone-700 text-sm leading-relaxed mb-3">
          「分け目だけでいい、と言われて気が楽になりました。
          全部染めなきゃと思い込んでいたので。」
        </p>
        <p className="text-stone-400 text-xs text-right">
          40代・会社員
          {/* 同意取得後: （田中さん・40代・会社員） に更新 */}
        </p>
      </div>

      <div className="bg-stone-50 rounded-2xl p-5 border border-stone-100">
        <p className="text-stone-700 text-sm leading-relaxed mb-3">
          「写真を送ると "今回は染めなくて大丈夫" と
          返ってくることもあって、信頼できます。」
        </p>
        <p className="text-stone-400 text-xs text-right">
          50代・主婦
        </p>
      </div>
    </div>

    {/* 利用者数（28名→増加次第更新） */}
    <p className="text-center text-stone-400 text-xs mt-6">
      ※個人の感想です。現在 28名の方が継続中。
    </p>
  </div>
</section>
```

---

## 変更3：「LINEで届く内容」に頭皮ケアカード追加

**対象セクション**：「LINEに届くセルフカラー案内」または「写真から確認すること」の6カード群

**現状カード**（想定）：
1. 染める範囲の提案
2. 薬剤候補
3. 購入リンク
4. 混ぜ方・放置時間
5. 染める前の確認
6. 失敗したときの対処

**追加カード（7枚目）**：

```tsx
<div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
  <div className="text-amber-600 text-lg mb-2">🌿</div>
  <h3 className="font-semibold text-stone-800 text-sm mb-1">
    染めた後の頭皮ケア
  </h3>
  <p className="text-stone-500 text-xs leading-relaxed">
    染めた後の頭皮と髪の状態に合わせて、アフターケアを個別にお伝えします。
    頭皮の健康を月単位で一緒に管理します。
  </p>
</div>
```

---

## 変更4：プロ用商材の明記

**対象箇所**：「薬剤単価 約300円」「ネットで買えるリンクを送信」が書かれているセクション

**現状（推定）**：
```
「今の髪に合う薬剤をご提案。ネットで購入できるリンクをお送りします」
```

**修正後**：
```tsx
<p className="text-stone-600 text-sm">
  ご提案する薬剤は、美容師が現場で使う
  <strong className="text-stone-800">プロ用商材を中心</strong>に、
  あなたの髪と頭皮の状態に合わせて選びます。
  ネットで購入できるリンクをLINEでお送りします。
  <span className="text-stone-400">（購入は完全任意です）</span>
</p>
```

---

## 変更5：ファーストビューに月額・解約補足

**対象箇所**：ファーストビューのCTAボタン直下

**現状（推定）**：
```
[ LINEで気になるところを相談する ]
```

**修正後**：
```tsx
<div className="text-center">
  <a href={LINE_URL} className="block w-full bg-[#06C755] text-white py-4 px-6 rounded-xl font-bold text-base">
    LINEで気になるところを相談する
  </a>
  <p className="text-stone-400 text-xs mt-2">
    月880円 / いつでも解約OK / 写真を送るだけ
  </p>
</div>
```

---

## 変更6：FAQ「解約方法」の具体化

**対象箇所**：FAQ の「解約はいつできますか？」の答え

**現状（推定）**：
```
「いつでも解約できます」
```

**修正後**：
```tsx
{
  q: "解約はいつでもできますか？",
  a: "はい、いつでも解約できます。LINEで「解約したい」とひと言送っていただくだけで手続きします。違約金・引き止め・理由の確認強制はありません。データ（相談履歴・写真）は希望があれば削除します。"
}
```

---

## E法務最終チェック

- ✅ 権威性：「20年」「数万人」「大阪専門店」「海外経験」→ 事実ベース、問題なし
- ✅ プロ用商材：「を中心に選びます」の表現、断定なし
- ✅ 利用者の声：「個人の感想です」注記あり
- ✅ 解約方法：「LINEでひと言」→ 1アクションで解約できる明示、特商法強化
- ✅ 「絶対」「100%」「保証」表現なし

---

## CODEX 投入プロンプト

```
yuki-pj/handoff/agent-outputs/LP-V0-COPY-REVISION.md を読んで、
line-harness-oss の apps/web/src/app/(public)/page.tsx に
記載された6点の変更を実装してください。

変更1（川崎権威性）: 6カードセクションの直後に挿入
変更2（利用者の声）: FAQセクションの直前に挿入
変更3（頭皮ケアカード）: 既存のカード群に1枚追加
変更4（プロ用商材の明記）: 薬剤提案の文言を修正
変更5（FV月額補足）: CTAボタン下に1行追加
変更6（FAQ解約具体化）: 解約のFAQ答えを更新

川崎さんの写真は placeholder（コメントアウト）のままでOKです。
実装後に PR を作成してください。ラベル: code-task, agent-D, priority-high
```

---

## ユーザー承認事項

- [ ] 利用者の声2件のコピー、このトーンでOK？
- [ ] 「現在28名が継続中」の人数表示、OK？（増えたら更新）
- [ ] 川崎さんの写真、placeholder でとりあえず入稿してよい？
- [ ] CODEX に投げてよい？
