import { closing, footer, links } from "@/content/kamito";
import s from "./sections.module.css";

export default function Closing() {
  return (
    <section
      className={`${s.section} ${s.closing}`}
      aria-labelledby="closing-title"
    >
      {/* The brand line, blind-embossed into the page behind the copy. */}
      <p className={`${s.embossBg} emboss`} aria-hidden="true">
        {footer.tagline.replace(/—+/g, "")}
      </p>
      <div className={s.container}>
        <h2 id="closing-title" className={`${s.closingTitle} reveal`}>
          {closing.headline.map((line) => (
            <span key={line}>{line}</span>
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
            <span className={s.arrow} aria-hidden="true">
              →
            </span>
          </a>
          <a className={s.link} href={links.consult}>
            {closing.secondary}
            <span className={s.arrow} aria-hidden="true">
              →
            </span>
          </a>
        </div>
      </div>
    </section>
  );
}
