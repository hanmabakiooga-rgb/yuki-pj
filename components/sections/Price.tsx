import s from "./sections.module.css";

/* Bodoni's ¥ has hairline bars that vanish at display sizes and read as "Y".
   Set the yen sign small and raised in mincho, like a price tag. */
export default function Price({ value }: { value: string }) {
  if (!value.startsWith("¥")) return <>{value}</>;
  return (
    <>
      <span className={s.yen}>¥</span>
      {value.slice(1)}
    </>
  );
}
