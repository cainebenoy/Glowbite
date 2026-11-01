// Social preview: black, logo, product, price only while the offer is active.
import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getSettings } from "@/lib/settings-server";
import { inr } from "@/lib/format";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "GlowBite Water Flosser — Join the Pre-order List";

// Outfit Light is bundled (assets/fonts, SIL OFL). Outfit has no ₹ glyph, so a one-glyph Noto Sans subset
// supplies it (as browsers do on the page via a system fallback).
export default async function OpengraphImage() {
  const s = await getSettings();
  const pub = path.join(process.cwd(), "public");
  const [logo, product, outfit] = await Promise.all([
    readFile(path.join(pub, "logo.png")),
    readFile(path.join(pub, "poster.jpg")),
    readFile(path.join(process.cwd(), "assets/fonts/Outfit-Light.ttf")),
  ]);
  const rupee = await readFile(path.join(process.cwd(), "assets/fonts/NotoSans-Light-rupee.ttf"));
  const src = (buf: Buffer, type: string) => `data:${type};base64,${buf.toString("base64")}`;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", background: "#000", display: "flex", padding: "64px 80px", color: "#F4F6F8", fontFamily: "Outfit" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src(logo, "image/png")} width={204} height={88} alt="" />
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ fontSize: 64, lineHeight: 1.05, letterSpacing: -2, display: "flex", flexDirection: "column" }}>
              <span>A fresher-feeling clean,</span>
              <span style={{ color: "rgba(236,241,245,.5)" }}>made simple.</span>
            </div>
            <div style={{ fontSize: 28, color: "rgba(236,241,245,.75)", display: "flex" }}>
              {s.offer_active ? `Join the pre-order list · ${inr(s.price)} · No payment taken now` : "Join the pre-order list · No payment taken now"}
            </div>
          </div>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src(product, "image/jpeg")} height={540} width={198} alt="" style={{ marginLeft: 40 }} />
      </div>
    ),
    { ...size, fonts: [
        { name: "Outfit", data: outfit, weight: 300, style: "normal" },
        { name: "Noto Sans", data: rupee, weight: 300, style: "normal" },
      ] },
  );
}
