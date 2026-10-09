import { productLines } from "@/content/kamito";
import s from "./sections.module.css";
import l from "./ProductLines.module.css";

/* Each line shows one large photo with three thumbnails.
   Switching is pure CSS (a radio group), so it needs no JS and
   arrow keys move between photos for keyboard users. */
export default function ProductLines() {
  return (
    <section
      className={`${s.section} ${s.sectionAlt}`}
      id="lines"
      aria-labelledby="lines-title"
    >
      <div className={l.wrap}>
        <h2 id="lines-title" className={`${s.eyebrow} reveal`}>
          Product Lines
        </h2>

        <div className={l.list}>
          {productLines.map((line) => (
            <article
              key={line.id}
              className={l.line}
              aria-labelledby={`line-${line.id}`}
            >
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
                  {line.images.map((img, i) => (
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

              <div className={`${l.text} reveal`}>
                <p className={l.process}>{line.process}</p>
                <h3 id={`line-${line.id}`} className={l.name}>
                  {line.name}
                </h3>
                <p className={l.copy}>{line.copy}</p>
                <p className={l.price}>
                  {line.price}
                  <span className={l.note}>{line.note}</span>
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
