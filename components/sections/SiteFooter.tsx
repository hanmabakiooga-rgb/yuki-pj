import { footer } from "@/content/kamito";
import s from "./sections.module.css";

export default function SiteFooter() {
  return (
    <footer className={s.footer}>
      <p className={s.footerLogo}>KAMITO</p>
      <p className={s.footerTag}>{footer.tagline}</p>
      <p className={s.footerNote}>
        © {new Date().getFullYear()} KAMITO. All rights reserved.
      </p>
    </footer>
  );
}
