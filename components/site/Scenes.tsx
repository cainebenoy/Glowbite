// The pinned story scenes. Copy per BUILD_PROMPT §3 (brief benefit lines), rendered on the server.
import type { ReactNode } from "react";
import { inr, showMrp, type SceneId, type Settings } from "@/lib/settings";

function Scene({ id, align, tall, children }: { id: SceneId; align?: "right"; tall?: boolean; children: ReactNode }) {
  return (
    <section className={["scene", align, tall && "tall"].filter(Boolean).join(" ")} id={id} data-scene={id}>
      <div className="pin">
        <div className="copy" data-copy>
          <div className="inner">{children}</div>
        </div>
      </div>
    </section>
  );
}

const HEADLINE = "A fresher-feeling clean, made simple.";

export function Hero({ s }: { s: Settings }) {
  const words = HEADLINE.split(" ");
  return (
    <section className="scene hero" id="hero" data-scene="hero">
      <div className="pin">
        <div className="copy" data-copy>
          <div className="inner">
            <span className="tag fade">{s.brand_name} Water Flosser</span>
            <h1>
              {words.map((w, i) => (
                <span key={i}>
                  <span className={`w${i >= words.length - 2 ? " dim" : ""}`} style={{ "--i": i } as React.CSSProperties}>
                    {w}
                  </span>
                  {i < words.length - 1 ? " " : ""}
                </span>
              ))}
            </h1>
            <p className="sub fade">
              Discover the {s.brand_name} Water Flosser — a rechargeable device designed to make water flossing part of your
              daily oral-care routine.
            </p>
            <div className="buy fade d2">
              <a className="cta" href="#preorder" data-cta="hero">
                <i className="dot" aria-hidden="true" />
                Join the Pre-order List
              </a>
              {s.offer_active && (
                <div className="price">
                  <strong>
                    {inr(s.price)}
                    {showMrp(s) && (
                      <span className="mrp">
                        <span className="sr-only">MRP </span>
                        {inr(s.mrp)}
                      </span>
                    )}
                  </strong>
                  <span>Pre-order interest price</span>
                </div>
              )}
            </div>
            <p className="fine fade d2">No payment taken now.</p>
          </div>
        </div>
        <div className="scroll-cue" aria-hidden="true">
          SCROLL<b />
        </div>
      </div>
    </section>
  );
}

export function Tank() {
  return (
    <Scene id="tank" align="right">
      <span className="tag">Water tank</span>
      <div className="giant">
        <span id="ml">350</span>
        <small>ml</small>
      </div>
      <p className="line">A generous 350 ml tank.</p>
    </Scene>
  );
}

export function Modes() {
  return (
    <Scene id="modes">
      <span className="tag">Modes</span>
      <div className="giant">
        5<small>modes</small>
      </div>
      <p className="line">Multiple modes for a personalised feel, including a child mode.</p>
      <div className="readout" aria-hidden="true">
        MODE <span id="modeN">1</span>/5{" "}
        <b id="modeDots">
          <i className="on" />
          <i />
          <i />
          <i />
          <i />
        </b>
      </div>
    </Scene>
  );
}

export function Tips() {
  return (
    <Scene id="tips">
      <span className="tag">In the box</span>
      <div className="giant">
        5<small>tips</small>
      </div>
      <p className="line">Multiple tips for different users and routines.</p>
    </Scene>
  );
}

export function Charging() {
  return (
    <Scene id="charging" align="right">
      <span className="tag">Charging</span>
      <div className="giant wide">USB-C</div>
      <p className="line">Portable, rechargeable convenience over USB-C.</p>
    </Scene>
  );
}

export function Ipx7() {
  return (
    <Scene id="ipx7" align="right">
      <span className="tag">Water resistance</span>
      <div className="giant wide">IPX7</div>
      <p className="line">Rated IPX7 for water resistance.</p>
    </Scene>
  );
}

export function Routine({ s }: { s: Settings }) {
  const beats = [
    { word: "Fill.", text: "Fill the tank." },
    { word: "Choose.", text: "Choose a comfortable mode." },
    {
      word: "Glide.",
      text: "Direct the water stream along the gumline and between teeth, following the product instructions.",
    },
  ];
  return (
    <Scene id="routine" tall>
      <div className="beats">
        {beats.map((b, i) => (
          <div key={b.word} className={`beat${i === 0 ? " on" : ""}`} data-b={i}>
            <span className="tag">Your routine · {i + 1}</span>
            <div className="giant">{b.word}</div>
            <p className="line">
              {b.text}
              {i === 2 && s.instruction_guide_url && (
                <>
                  {" "}
                  <a href={s.instruction_guide_url} target="_blank" rel="noopener noreferrer">
                    Read the instruction guide
                  </a>
                  .
                </>
              )}
            </p>
          </div>
        ))}
      </div>
    </Scene>
  );
}
