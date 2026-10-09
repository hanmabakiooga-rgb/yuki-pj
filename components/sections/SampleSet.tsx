import { links, sampleSet } from "@/content/kamito";
import s from "./sections.module.css";

export default function SampleSet() {
  return (
    <section className={s.section} id="sample" aria-labelledby="sample-title">
      <div className={s.column}>
        <p className={`${s.eyebrow} reveal`}>Sample Set</p>
        <h2 id="sample-title" className={`${s.title} reveal`}>
          サンプルセット
        </h2>
        <p className={`${s.body} reveal`}>{sampleSet.lead}</p>

        <div className={`${s.sampleBox} reveal`}>
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
