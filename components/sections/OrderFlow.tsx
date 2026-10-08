import { orderFlow } from "@/content/kamito";
import s from "./sections.module.css";

export default function OrderFlow() {
  return (
    <section
      className={`${s.section} ${s.sectionAlt}`}
      aria-labelledby="flow-title"
    >
      <div className={s.column}>
        <p className={s.eyebrow}>How to Order</p>
        <h2 id="flow-title" className={s.title}>
          発注の流れ
        </h2>
        <ol className={s.steps}>
          {orderFlow.steps.map((step, i) => (
            <li key={step.title} className={s.step}>
              <span className={s.stepNum} aria-hidden="true">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className={s.stepBody}>
                <h3 className={s.stepTitle}>{step.title}</h3>
                <p className={s.body}>{step.body}</p>
                {step.tags.length > 0 ? (
                  <ul className={s.tags}>
                    {step.tags.map((tag) => (
                      <li key={tag}>{tag}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
        <div className={s.flowCta}>
          <a className={s.btnGhost} href="#sample">
            {orderFlow.cta}
          </a>
        </div>
      </div>
    </section>
  );
}
