import { pricingNotes, productLines } from "@/content/kamito";
import s from "./sections.module.css";

export default function Pricing() {
  return (
    <section className={s.section} id="pricing" aria-labelledby="pricing-title">
      <div className={s.column}>
        <p className={`${s.eyebrow} reveal`}>Pricing</p>
        <h2 id="pricing-title" className={`${s.title} reveal`}>
          価格・仕様
        </h2>
        <table className={`${s.table} reveal`}>
          <thead>
            <tr>
              <th scope="col">ライン</th>
              <th scope="col">加工</th>
              <th scope="col" style={{ textAlign: "right" }}>
                価格（税抜）
              </th>
            </tr>
          </thead>
          <tbody>
            {productLines.map((line) => (
              <tr key={line.id}>
                <th scope="row">{line.name}</th>
                <td>{line.process}</td>
                <td className={s.price}>{line.price}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <ul className={`${s.notes} reveal`}>
          {pricingNotes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
