import HeroSection from "@/components/HeroSection";
import Story from "@/components/sections/Story";
import ProductLines from "@/components/sections/ProductLines";
import Pricing from "@/components/sections/Pricing";
import SampleSet from "@/components/sections/SampleSet";
import OrderFlow from "@/components/sections/OrderFlow";
import Closing from "@/components/sections/Closing";
import SiteFooter from "@/components/sections/SiteFooter";

/* =========================================================
   KAMITO landing page.
   Hero props are set here; everything below the hero reads
   its copy and prices from content/kamito.ts.
   ========================================================= */
export default function Home() {
  return (
    <>
      <main>
        <HeroSection
          videoSrc="/videos/kamito-hero.mp4"
          // ~0.64MB VP9 version; browsers that support it load this instead of the 1.3MB mp4
          videoSrcWebm="/videos/kamito-hero.webm"
          // First frame of the film, so poster → playback is seamless.
          posterSrc="/images/kamito-hero-poster.jpg"
          // Source is 1280x656 (height kept a multiple of 16 to avoid green decoder edges).
          videoAspectRatio="1280 / 656"
          brandName="KAMITO"
          headline="Paper, carefully shaped."
          subtext="特殊加工と素材の静けさを、そのまま形にする。"
          ctaLabel="View the craft"
          ctaHref="#lines"
          videoAriaLabel="KAMITO brand film — paper and finishing"
        />
        <Story />
        <ProductLines />
        <Pricing />
        <SampleSet />
        <OrderFlow />
        <Closing />
      </main>
      <SiteFooter />
    </>
  );
}
