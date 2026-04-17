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
        // Optional — include a .webm next to the mp4 for better compression
        // videoSrcWebm="/videos/kamito-hero.webm"
        // A neutral SVG placeholder ships in /public/images. Replace it with a
        // still frame (e.g. kamito-hero-poster.jpg, ~1920x1080) when available.
        posterSrc="/images/kamito-hero-poster.svg"
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
