import { links, sampleSet } from "@/content/kamito";
import s from "./sections.module.css";

export default function SampleSet() {
  return (
    <section className={s.section} id="sample" aria-labelledby="sample-title">
      <div className={s.column}>
        <p className={s.eyebrow}>Sample Set</p>
        <h2 id="sample-title" className={s.title}>
          サンプルセット
        </h2>
        <p className={s.body}>{sampleSet.lead}</p>

        <div className={s.sampleBox}>
          <p className={s.sampleLabel}>Sample set</p>
          <p className={s.samplePrice}>{sampleSet.price}</p>
          <p className={s.sampleMeta}>
            {sampleSet.contents}
            <span className={s.sampleRefund}>{sampleSet.refund}</span>
          </p>
          <ul className={s.dashList}>
            {sampleSet.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <a className={s.btn} href={links.sampleOrder}>
            {sampleSet.cta}
          </a>
        </div>
      </div>
    </section>
  );
}
