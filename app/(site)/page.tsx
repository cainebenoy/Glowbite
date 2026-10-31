// Landing page. Static; rebuilt when an admin saves settings (revalidateTag("settings")).
import type { Metadata } from "next";
import { getImageProps } from "next/image";
import poster from "@/public/poster.jpg";
import posterPhone from "@/public/poster-phone.jpg";
import { existsSync } from "node:fs";
import path from "node:path";
import { getSettings } from "@/lib/settings-server";
import { faq, scenes, type SceneId, type Settings } from "@/lib/settings";
import { Header, ProgressLine, Rail, StickyBar } from "@/components/site/Chrome";
import { Charging, Hero, Ipx7, Modes, Routine, Tank, Tips } from "@/components/site/Scenes";
import { Preorder } from "@/components/site/Preorder";
import { Specs } from "@/components/site/Specs";
import { Faq } from "@/components/site/Faq";
import { Footer } from "@/components/site/Footer";
import { StoryDriver } from "@/components/stage/StoryDriver";
import { StageMount } from "@/components/stage/StageMount";
import { productJsonLd, siteDescription, siteTitle } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  const title = siteTitle(s);
  const description = siteDescription(s);
  return {
    title,
    description,
    alternates: { canonical: "/" },
    openGraph: { type: "website", title, description, locale: "en_IN", siteName: s.brand_name },
    twitter: { card: "summary_large_image", title, description },
  };
}

/** Still renders of the hero frame (scripts/render-poster.ts): phone and desktop framings, art-directed. */
function Poster() {
  const common = { alt: "", priority: true, fetchPriority: "high" as const };
  const { props: phone } = getImageProps({ ...common, src: posterPhone, sizes: "24vh" });
  const { props: desk } = getImageProps({ ...common, src: poster, sizes: "34vh" });
  return (
    <picture>
      <source media="(max-width: 860px)" srcSet={phone.srcSet} sizes={phone.sizes} />
      {/* eslint-disable-next-line jsx-a11y/alt-text -- decorative; alt="" comes from props */}
      <img {...desk} className="fallback-prod" />
    </picture>
  );
}

function SceneFor({ id, s }: { id: SceneId; s: Settings }) {
  switch (id) {
    case "hero":
      return <Hero s={s} />;
    case "tank":
      return <Tank />;
    case "modes":
      return <Modes />;
    case "tips":
      return <Tips />;
    case "charging":
      return <Charging />;
    case "ipx7":
      return <Ipx7 />;
    case "routine":
      return <Routine s={s} />;
    case "preorder":
      return <Preorder s={s} />;
  }
}

// Manufacturer CAD slot: drop public/models/glowbite.glb in to replace the procedural model.
const HAS_GLB = existsSync(path.join(process.cwd(), "public/models/glowbite.glb"));

export default async function Page() {
  const s = await getSettings();
  const ids = scenes(s);
  return (
    <div className="site" id="top">
      <a className="skip" href="#preorder">
        Skip to the pre-order form
      </a>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd(s)) }} />
      <noscript>
        <style>{`.beats{display:flex;flex-direction:column;gap:3rem}.beat{opacity:1;transform:none}.scene.tall{height:auto}.scene.tall .pin{position:relative;height:auto;padding-block:20vh}`}</style>
      </noscript>
      <div className="fallback-bg" aria-hidden="true">
        <Poster />
      </div>
      <StageMount hasGlb={HAS_GLB} />
      <ProgressLine />
      <Header brand={s.brand_name} />
      <Rail ids={ids} />
      <main className="story" id="main">
        {ids.map((id) => (
          <SceneFor key={id} id={id} s={s} />
        ))}
      </main>
      <div className="after">
        <Specs s={s} />
        <Faq items={faq(s)} />
        <Footer s={s} year={new Date().getFullYear()} />
      </div>
      <StickyBar s={s} />
      <StoryDriver />
    </div>
  );
}
