import HeroSection from "@/components/HeroSection";

/* =========================================================
   Landing page — currently renders only the first view.
   Drop in-lower sections below <HeroSection /> later.
   ---------------------------------------------------------
   Swap the props below to change copy / media without
   touching the component internals.
   ========================================================= */
export default function Home() {
  return (
    <main>
      <HeroSection
        // Place the finished mp4 at /public/videos/kamito-hero.mp4
        videoSrc="/videos/kamito-hero.mp4"
        // ~0.66MB VP9 version; browsers that support it load this instead of the 3.3MB mp4
        videoSrcWebm="/videos/kamito-hero.webm"
        // First frame of the film, so poster → playback is seamless.
        posterSrc="/images/kamito-hero-poster.jpg"
        // Source is 1280x660 — keep the frame identical so nothing is cropped.
        videoAspectRatio="1280 / 660"
        brandName="KAMITO"
        headline="Paper, carefully shaped."
        subtext="特殊加工と素材の静けさを、そのまま形にする。"
        ctaLabel="View the craft"
        ctaHref="#collection"
        videoAriaLabel="KAMITO brand film — paper and finishing"
      />
    </main>
  );
}
