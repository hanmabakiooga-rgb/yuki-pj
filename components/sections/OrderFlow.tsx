import { orderFlow } from "@/content/kamito";
import SectionHeader from "./SectionHeader";
import s from "./sections.module.css";

export default function OrderFlow() {
  return (
    <section className={s.section} aria-labelledby="flow-title">
      <div className={s.container}>
        <SectionHeader
          index="05"
          category="How to Order"
          title="発注の流れ"
          id="flow-title"
        />
        <ol className={s.steps}>
          {orderFlow.steps.map((step, i) => (
            <li key={step.title} className={`${s.step} reveal`}>
              <span className={s.stepNum} aria-hidden="true">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className={s.stepTitle}>{step.title}</h3>
              <p className={s.body}>{step.body}</p>
              {step.tags.length > 0 ? (
                <ul className={s.tags}>
                  {step.tags.map((tag) => (
                    <li key={tag}>{tag}</li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ol>
        <div className={`${s.flowCta} reveal`}>
          <a className={s.link} href="#sample">
            {orderFlow.cta}
            <span className={s.arrow} aria-hidden="true">
              →
            </span>
          </a>
        </div>
      </div>
    </section>
  );
}
