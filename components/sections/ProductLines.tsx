import { productLines } from "@/content/kamito";
import Price from "./Price";
import SectionHeader from "./SectionHeader";
import s from "./sections.module.css";
import l from "./ProductLines.module.css";

/* Each line is a spread: a giant blind-embossed name, a large photo
   with three switchable views (pure CSS radio group — no JS, arrow
   keys work), and a spec sheet. */
export default function ProductLines() {
  const total = String(productLines.length).padStart(2, "0");

  return (
    <section className={s.section} id="lines" aria-labelledby="lines-title">
      <div className={s.container}>
        <SectionHeader index="02" category="Product Lines" id="lines-title" />

        <div className={l.list}>
          {productLines.map((line, n) => (
            <article
              key={line.id}
              className={l.line}
              data-line={line.id}
              aria-labelledby={`line-${line.id}`}
            >
              <p className={l.no}>
                No.{String(n + 1).padStart(2, "0")} / {total}
              </p>
              <p className={`${l.giant} emboss`} aria-hidden="true">
                {line.name}
              </p>

              <div className={`${s.grid} ${l.body}`}>
                <div className={`${l.gallery} reveal-photo`}>
                  {line.images.map((img, i) => (
                    <input
                      key={img.src}
                      className={l.radio}
                      type="radio"
                      name={`gallery-${line.id}`}
                      id={`${line.id}-${i}`}
                      defaultChecked={i === 0}
                      aria-label={`${line.name}：${img.label}`}
                    />
                  ))}

                  <div className={l.frames}>
                    {line.images.map((img) => (
                      <figure key={img.src} className={l.frame}>
                        <img
                          src={img.src}
                          alt={img.alt}
                          width={img.width}
                          height={img.height}
                          loading="lazy"
                          decoding="async"
                        />
                        <figcaption>{img.label}</figcaption>
                      </figure>
                    ))}
                  </div>

                  <div className={l.thumbs}>
                    {line.images.map((img, i) => (
                      <label
                        key={img.src}
                        htmlFor={`${line.id}-${i}`}
                        className={l.thumb}
                      >
                        <img src={img.src} alt="" loading="lazy" decoding="async" />
                      </label>
                    ))}
                  </div>
                </div>

                <div className={`${l.spec} reveal`}>
                  <h3 id={`line-${line.id}`} className={l.name}>
                    {line.name}
                  </h3>
                  <p className={l.copy}>{line.copy}</p>
                  <dl className={l.specList}>
                    <div>
                      <dt>Process</dt>
                      <dd>{line.process}</dd>
                    </div>
                    <div>
                      <dt>Price</dt>
                      <dd className={l.price}>
                        <Price value={line.price} />
                      </dd>
                    </div>
                    <div>
                      <dt>Order</dt>
                      <dd>{line.note}</dd>
                    </div>
                  </dl>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
