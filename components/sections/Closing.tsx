import { closing, links } from "@/content/kamito";
import s from "./sections.module.css";

export default function Closing() {
  return (
    <section className={s.section} aria-labelledby="closing-title">
      <div className={`${s.column} ${s.closing}`}>
        <h2 id="closing-title" className={`${s.closingTitle} reveal`}>
          {closing.headline.map((line) => (
            <span key={line} style={{ display: "block" }}>
              {line}
            </span>
          ))}
        </h2>
        <p className={`${s.body} reveal`}>
          {closing.sub.map((line) => (
            <span key={line} style={{ display: "block" }}>
              {line}
            </span>
          ))}
        </p>
        <div className={`${s.ctaRow} reveal`}>
          <a className={s.btn} href={links.sampleOrder}>
            {closing.primary}
          </a>
          <a className={s.btnGhost} href={links.consult}>
            {closing.secondary}
          </a>
        </div>
      </div>
    </section>
  );
}
