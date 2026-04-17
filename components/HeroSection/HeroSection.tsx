import styles from "./HeroSection.module.css";

/* =========================================================
   HeroSection
   -----------------------------------------------------------
   LP first-view for KAMITO.
   Purpose: show the brand film as the hero — let the video
   breathe and keep UI chrome to an absolute minimum.

   Design intent:
   - White / off-white base, generous whitespace.
   - Video presented as the "subject" (framed, 16:9 preserved),
     NOT slapped across the viewport as a cover-cropped bg.
   - Copy is quiet and sits below the film, like a caption.
   - CTA is a thin underline link, not a loud button.

   Everything text/media-related is driven by props so the
   section can be re-dressed without touching the markup.
   ========================================================= */

export type HeroSectionProps = {
  /** Path or URL to the .mp4 source. Served from /public recommended. */
  videoSrc: string;
  /** Optional .webm for better compression when available. */
  videoSrcWebm?: string;
  /** Poster frame shown until the video can play. Also the fallback image. */
  posterSrc: string;
  /** Small wordmark shown in the corner. Pass "" to hide. */
  brandName?: string;
  /** Main headline (h1). Keep it short — 2–6 words is ideal. */
  headline: string;
  /** One quiet line of supporting text. Optional. */
  subtext?: string;
  /** CTA label. Omit to hide the CTA entirely. */
  ctaLabel?: string;
  /** CTA link target. Required when ctaLabel is set. */
  ctaHref?: string;
  /**
   * Descriptive alt-like text for the video itself.
   * Read by AT users when the video is decorative-but-meaningful.
   */
  videoAriaLabel?: string;
};

export default function HeroSection({
  videoSrc,
  videoSrcWebm,
  posterSrc,
  brandName = "KAMITO",
  headline,
  subtext,
  ctaLabel,
  ctaHref,
  videoAriaLabel = "KAMITO brand film",
}: HeroSectionProps) {
  return (
    <section className={styles.hero} aria-label="KAMITO">
      {/* Wordmark — floats in the top corner like a letterhead.
          Kept tiny on purpose; it's identification, not a logo lockup. */}
      {brandName ? <p className={styles.wordmark}>{brandName}</p> : null}

      <div className={styles.inner}>
        {/* Film stage ---------------------------------------------------
            The video sits inside a 16:9 frame so its composition never
            gets cropped by the viewport. The frame carries a very soft
            drop-shadow to give the film weight without adding darkness. */}
        <figure className={styles.stage}>
          <video
            className={styles.video}
            poster={posterSrc}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            // `aria-label` lets AT users know this is the brand film —
            // we keep the headline as the semantic anchor (h1) though.
            aria-label={videoAriaLabel}
          >
            {videoSrcWebm ? (
              <source src={videoSrcWebm} type="video/webm" />
            ) : null}
            <source src={videoSrc} type="video/mp4" />
            {/* Fallback for browsers that can't play the video at all:
                render the poster image so the section still "lands". */}
            <img
              src={posterSrc}
              alt={videoAriaLabel}
              className={styles.fallbackImg}
            />
          </video>
        </figure>

        {/* Copy block --------------------------------------------------
            Kept centered and narrow — reads like a gallery caption
            rather than a marketing headline. */}
        <div className={styles.copy}>
          <h1 className={styles.headline}>{headline}</h1>

          {subtext ? <p className={styles.subtext}>{subtext}</p> : null}

          {ctaLabel && ctaHref ? (
            <a className={styles.cta} href={ctaHref}>
              <span className={styles.ctaLabel}>{ctaLabel}</span>
              <span className={styles.ctaArrow} aria-hidden="true">
                →
              </span>
            </a>
          ) : null}
        </div>
      </div>

      {/* A single hairline at the bottom acts as a section terminator.
          It's decorative; hide from AT. */}
      <span className={styles.terminator} aria-hidden="true" />
    </section>
  );
}
