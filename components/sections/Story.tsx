import { story } from "@/content/kamito";
import s from "./sections.module.css";

export default function Story() {
  return (
    <section className={s.section} aria-labelledby="story-title">
      <div className={s.column}>
        <p className={`${s.eyebrow} reveal`}>Story</p>
        <h2 id="story-title" className={`${s.title} reveal`}>
          {story.title}
        </h2>
        <div className={`${s.body} ${s.storyText}`}>
          {story.paragraphs.map((runs, i) => (
            <p key={i} className="reveal" style={{ margin: 0 }}>
              {runs.map((run, j) =>
                typeof run === "string" ? run : <strong key={j}>{run.strong}</strong>,
              )}
            </p>
          ))}
        </div>
        <hr className={`${s.divider} reveal-line`} />
        <p className={`${s.signature} reveal`}>{story.closing}</p>
      </div>
    </section>
  );
}
