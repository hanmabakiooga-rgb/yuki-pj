import { story } from "@/content/kamito";
import s from "./sections.module.css";

export default function Story() {
  return (
    <section className={s.section} aria-labelledby="story-title">
      <div className={s.column}>
        <h2 id="story-title" className={s.eyebrow}>
          Story
        </h2>
        <div className={`${s.body} ${s.storyText}`}>
          {story.paragraphs.map((runs, i) => (
            <p key={i} style={{ margin: 0 }}>
              {runs.map((run, j) =>
                typeof run === "string" ? run : <strong key={j}>{run.strong}</strong>,
              )}
            </p>
          ))}
        </div>
        <hr className={s.divider} />
        <p className={s.signature}>{story.closing}</p>
      </div>
    </section>
  );
}
