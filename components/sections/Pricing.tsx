import { pricingNotes, productLines } from "@/content/kamito";
import Price from "./Price";
import SectionHeader from "./SectionHeader";
import s from "./sections.module.css";

export default function Pricing() {
  return (
    <section className={s.section} id="pricing" aria-labelledby="pricing-title">
      <div className={s.container}>
        <SectionHeader
          index="03"
          category="Pricing"
          title="価格・仕様"
          id="pricing-title"
        />
        <table className={`${s.table} reveal`}>
          <thead>
            <tr>
              <th scope="col">Line</th>
              <th scope="col">Process</th>
              <th scope="col" style={{ textAlign: "right" }}>
                Price (税抜)
              </th>
            </tr>
          </thead>
          <tbody>
            {productLines.map((line) => (
              <tr key={line.id}>
                <th scope="row">{line.name}</th>
                <td>{line.process}</td>
                <td className={s.price}>
                  <Price value={line.price} />
                </td>
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
