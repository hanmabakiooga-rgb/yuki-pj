import s from "./sections.module.css";

/* Yen sign set small and raised, like a price tag. */
export default function Price({ value }: { value: string }) {
  if (!value.startsWith("¥")) return <>{value}</>;
  return (
    <>
      <span className={s.yen}>¥</span>
      {value.slice(1)}
    </>
  );
}
