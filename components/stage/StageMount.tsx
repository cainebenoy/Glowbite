"use client";
// Mounts the 3D stage only after HTML + CSS + fonts have rendered the full page.
// - Desktop: after `load` and an idle callback.
// - Phones: on the first interaction (scroll, touch, key). Building the model, environment and
//   shaders costs seconds of CPU on mid-range phones; until then the poster (a render of the
//   same hero frame) stands in, so nothing visibly changes.
// - No WebGL, or Save-Data on: the poster stays.
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const Stage = dynamic(() => import("./Stage"), { ssr: false });

function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

const INTERACTIONS = ["scroll", "wheel", "touchstart", "pointerdown", "keydown"] as const;

export function StageMount({ hasGlb = false }: { hasGlb?: boolean }) {
  const [go, setGo] = useState(false);
  useEffect(() => {
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    if (saveData || !hasWebGL()) {
      document.documentElement.classList.add("nogl");
      return;
    }
    let idle = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const mount = () => setGo(true);
    const cleanupListeners = () => INTERACTIONS.forEach((e) => removeEventListener(e, onFirst));
    const onFirst = () => {
      cleanupListeners();
      mount();
    };

    const phone = innerWidth < 860 || matchMedia("(pointer: coarse)").matches;
    const start = () => {
      if (phone) {
        INTERACTIONS.forEach((e) => addEventListener(e, onFirst, { passive: true, once: true }));
        // already scrolled before hydration (e.g. reload mid-page)
        if (scrollY > 0) onFirst();
      } else if (typeof requestIdleCallback === "function") idle = requestIdleCallback(mount, { timeout: 2500 });
      else timer = setTimeout(mount, 300);
    };
    if (document.readyState === "complete") start();
    else addEventListener("load", start, { once: true });
    return () => {
      removeEventListener("load", start);
      cleanupListeners();
      if (idle && typeof cancelIdleCallback === "function") cancelIdleCallback(idle);
      clearTimeout(timer);
    };
  }, []);
  return go ? <Stage hasGlb={hasGlb} /> : null;
}
