/* =========================================================
   KAMITO LP — all copy, prices and image paths in one place.
   Edit this file to change wording or numbers; the section
   components only handle layout.
   ========================================================= */

/** A run of text; `strong` segments are emphasised. */
export type RichText = (string | { strong: string })[];

export type LineImage = {
  src: string;
  alt: string;
  /** Finish / paper label shown under the photo. */
  label: string;
  width: number;
  height: number;
};

export type ProductLine = {
  id: string;
  name: string;
  /** Short process summary, also used in the pricing table. */
  process: string;
  copy: string;
  price: string;
  /** Minimum lot or quote note shown next to the price. */
  note: string;
  images: LineImage[];
};

// TODO: replace with the real order form / checkout / contact URLs.
export const links = {
  sampleOrder: "#order",
  consult: "#contact",
};

export const story: {
  title: string;
  /** `pivot: true` sets that paragraph large, as the turn of the story. */
  paragraphs: { text: RichText; pivot?: boolean }[];
  closing: string;
} = {
  title: "なぜ私たちが紙にこだわるのか",
  paragraphs: [
    { text: ["すべてが、", { strong: "画面の上で完結する" }, "時代になった。"] },
    {
      text: [
        "出会いも、やり取りも、記憶でさえも——スクロールされて、タップされて、いつの間にか流れていく。",
      ],
    },
    { text: ["それでもまだ、", { strong: "紙を選ぶ人がいる。" }], pivot: true },
    {
      text: [
        "自分のブランドを、指先で伝えたい人が。デジタルでは絶対に再現できない「物の温度」を、誰かの記憶に刻もうとしている人が。",
      ],
    },
  ],
  closing: "KAMITOは、その人たちのために作った。",
};

export const productLines: ProductLine[] = [
  {
    id: "haku",
    name: "haku",
    process: "活版印刷・空押し",
    copy: "やわらかい紙と形で、あなたらしさをそっと包む。",
    price: "¥38,000〜",
    note: "100枚〜",
    images: [
      { src: "/images/lines/haku-1.webp", alt: "活版印刷、プレインホワイトの名刺", label: "活版印刷 / プレインホワイト", width: 402, height: 236 },
      { src: "/images/lines/haku-2.webp", alt: "空押し、グレージュの名刺", label: "空押し / グレージュ", width: 779, height: 492 },
      { src: "/images/lines/haku-3.webp", alt: "活版とストライプエンボスの名刺", label: "活版 / ストライプエンボス", width: 908, height: 566 },
    ],
  },
  {
    id: "en",
    name: "en",
    process: "ダイカット・デジタル印刷",
    copy: "深く刻まれた凹凸が、渡した瞬間に語りかける。",
    price: "¥50,000〜",
    note: "100枚〜",
    images: [
      { src: "/images/lines/en-3.webp", alt: "楕円ダイカットのカード", label: "楕円ダイカット", width: 912, height: 626 },
      { src: "/images/lines/en-1.webp", alt: "角丸正方形のカード", label: "角丸正方形", width: 1156, height: 654 },
      // NOTE: this photo shows round coasters; the "アーチ型" label came from the design file.
      { src: "/images/lines/en-2.webp", alt: "アーチ型のカード", label: "アーチ型", width: 588, height: 356 },
    ],
  },
  {
    id: "kiza",
    name: "kiza",
    process: "箔押し・濃色ボード",
    copy: "光を吸い込む箔が、静かにブランドの格を証明する。",
    price: "¥44,000〜",
    note: "要見積もり対応",
    images: [
      { src: "/images/lines/kiza-1.webp", alt: "ゴールド箔押しのカード", label: "ゴールド箔押し", width: 700, height: 400 },
      { src: "/images/lines/kiza-2.webp", alt: "シルバー箔押しのカード", label: "シルバー箔押し", width: 700, height: 400 },
      { src: "/images/lines/kiza-3.webp", alt: "ピンクゴールド箔のカード", label: "ピンクゴールド箔", width: 700, height: 400 },
    ],
  },
];

export const pricingNotes = [
  "全ライン100枚〜小ロット対応。",
  "価格はすべて税抜き表示です。",
  "kizaは仕様により変動・要見積もり。",
];

export const sampleSet = {
  lead: "紙の質感は、画面では伝わらない。",
  price: "¥1,500",
  contents: "en×1 / kiza×2 / haku×1 — 計4枚",
  refund: "30日以内の本発注でサンプル代全額還元",
  items: [
    "ブランドストーリーカード",
    "ラインカード（一言コピー）",
    "価格表・発注方法カード",
    "和紙で丁寧に包んでお届け",
  ],
  cta: "サンプルを注文する",
};

export const orderFlow = {
  steps: [
    {
      title: "サンプルセットを注文する",
      body: "まず¥1,500のサンプルセット（4枚）で紙の質感を確かめてください。30日以内の本発注でサンプル代は全額還元されます。",
      tags: [] as string[],
    },
    {
      title: "ラインと仕様を選ぶ",
      body: "haku / en / kiza の3ラインから、紙素材・加工・形状をお選びください。ご要望に応じてご相談も承ります。",
      tags: ["haku — 活版印刷", "en — ダイカット", "kiza — 箔押し"],
    },
    {
      title: "デザインデータを入稿",
      body: "完成したデザインデータをお送りください。データチェック後、納期をご連絡します。データ作成が難しい場合はご相談ください。",
      tags: [],
    },
    {
      title: "製造・お届け",
      body: "羽車（大阪・堺）にて丁寧に製造。完成後、直接お届けします。100枚〜小ロット対応です。",
      tags: [],
    },
  ],
  cta: "まずサンプルを試す — ¥1,500",
};

export const closing = {
  headline: ["あなたのブランドを、", "指先で語らせる。"],
  sub: ["サンプルで確かめてから、本発注へ。", "相談だけでも、気軽にどうぞ。"],
  primary: "サンプルを注文する — ¥1,500",
  secondary: "本発注を相談する",
};

export const footer = {
  tagline: "紙と、——",
};
