import s from "./sections.module.css";

type Props = {
  /** Section number shown as "01 —". */
  index: string;
  /** Large Latin category word, e.g. "Story". */
  category: string;
  /** Japanese section title. When omitted, the category itself is the h2. */
  title?: string;
  id: string;
};

/* Section opener: small press-mark number, a large light Jost word,
   then the Japanese title. Left-aligned on purpose. */
export default function SectionHeader({ index, category, title, id }: Props) {
  return (
    <header className={s.head}>
      <p className={`${s.index} reveal`}>
        <span>{index}</span>
        <span className={`${s.indexRule} reveal-line`} aria-hidden="true" />
      </p>
      {title ? (
        <>
          <p className={`${s.category} reveal`} aria-hidden="true">
            {category}
          </p>
          <h2 id={id} className={`${s.title} reveal`}>
            {title}
          </h2>
        </>
      ) : (
        <h2 id={id} className={`${s.category} reveal`}>
          {category}
        </h2>
      )}
    </header>
  );
}
