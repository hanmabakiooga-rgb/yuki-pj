import { links, sampleSet } from "@/content/kamito";
import Price from "./Price";
import SectionHeader from "./SectionHeader";
import s from "./sections.module.css";

export default function SampleSet() {
  return (
    <section
      className={`${s.section} ${s.band}`}
      id="sample"
      aria-labelledby="sample-title"
    >
      <div className={`${s.container} ${s.grid}`}>
        <div className={s.sampleIntro}>
          <SectionHeader
            index="04"
            category="Sample Set"
            title="サンプルセット"
            id="sample-title"
          />
          <p className={`${s.body} reveal`}>{sampleSet.lead}</p>
          <p className={`${s.samplePrice} reveal`}>
            <Price value={sampleSet.price} />
          </p>
        </div>

        <div className={`${s.sampleDetail} reveal`}>
          <p className={s.specLine}>{sampleSet.contents}</p>
          <p className={s.refund}>{sampleSet.refund}</p>
          <ul className={s.dashList}>
            {sampleSet.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <a className={s.btn} href={links.sampleOrder}>
            {sampleSet.cta}
            <span className={s.arrow} aria-hidden="true">
              →
            </span>
          </a>
        </div>
      </div>
    </section>
  );
}
