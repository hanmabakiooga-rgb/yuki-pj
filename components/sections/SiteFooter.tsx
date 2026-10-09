import { footer } from "@/content/kamito";
import s from "./sections.module.css";

export default function SiteFooter() {
  return (
    <footer className={s.footer}>
      <div className={`${s.container} ${s.footerInner}`}>
        <p className={s.footerLogo}>
          KAMITO
          <span className={s.footerTag}>{footer.tagline}</span>
        </p>
        <p className={s.footerNote}>
          © {new Date().getFullYear()} KAMITO. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
