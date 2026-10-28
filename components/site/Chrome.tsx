// Fixed chrome: progress hairline, header, chapter rail, mobile sticky bar.
import Image from "next/image";
import logo from "@/public/logo.png";
import { inr, SCENE_NAMES, type SceneId, type Settings } from "@/lib/settings";

export function ProgressLine() {
  return <div className="progress" id="prog" aria-hidden="true" />;
}

export function Header({ brand }: { brand: string }) {
  return (
    <header className="top">
      <a className="mark" href="#top" aria-label={`${brand} home`}>
        <Image src={logo} alt={brand} style={{ width: "auto", height: 38 }} priority sizes="88px" />
      </a>
      <a className="pill" href="#preorder" data-cta="header">
        <i className="dot" aria-hidden="true" />
        Join the Pre-order List
      </a>
    </header>
  );
}

export function Rail({ ids }: { ids: SceneId[] }) {
  return (
    <nav className="rail" id="rail" aria-label="Chapters">
      {ids.map((id, i) => (
        <button key={id} type="button" data-go={id} className={i === 0 ? "on" : undefined}>
          <span>{SCENE_NAMES[id]}</span>
          <i aria-hidden="true" />
        </button>
      ))}
    </nav>
  );
}

export function StickyBar({ s }: { s: Settings }) {
  return (
    <div className="bar" id="bar" inert>
      <div className="price">
        {s.offer_active && <strong>{inr(s.price)}</strong>}
        <span>No payment now</span>
      </div>
      <a className="cta" href="#preorder" data-cta="sticky">
        <i className="dot" aria-hidden="true" />
        Join the pre-order list
      </a>
    </div>
  );
}
