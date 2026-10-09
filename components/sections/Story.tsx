import { story } from "@/content/kamito";
import SectionHeader from "./SectionHeader";
import s from "./sections.module.css";

export default function Story() {
  return (
    <section className={s.section} aria-labelledby="story-title">
      <div className={s.container}>
        <SectionHeader
          index="01"
          category="Story"
          title={story.title}
          id="story-title"
        />
        <div className={s.grid}>
          <div className={`${s.body} ${s.storyText}`}>
            {story.paragraphs.map((p, i) => (
              <p
                key={i}
                className={`${p.pivot ? s.pivot : ""} reveal`}
                style={p.pivot ? undefined : { margin: 0 }}
              >
                {p.text.map((run, j) =>
                  typeof run === "string" ? run : <strong key={j}>{run.strong}</strong>,
                )}
              </p>
            ))}
          </div>
          <p className={`${s.signature} reveal`}>{story.closing}</p>
        </div>
      </div>
    </section>
  );
}
