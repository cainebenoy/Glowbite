"use client";
// Mounts the 3D stage after the page has loaded and the browser is idle, so HTML + CSS + fonts
// render the complete page first. No WebGL → the still poster stays.
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

export function StageMount({ hasGlb = false }: { hasGlb?: boolean }) {
  const [go, setGo] = useState(false);
  useEffect(() => {
    if (!hasWebGL()) {
      document.documentElement.classList.add("nogl");
      return;
    }
    let idle = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const start = () => {
      if (typeof requestIdleCallback === "function") idle = requestIdleCallback(() => setGo(true), { timeout: 2500 });
      else timer = setTimeout(() => setGo(true), 300);
    };
    if (document.readyState === "complete") start();
    else addEventListener("load", start, { once: true });
    return () => {
      removeEventListener("load", start);
      if (idle && typeof cancelIdleCallback === "function") cancelIdleCallback(idle);
      clearTimeout(timer);
    };
  }, []);
  return go ? <Stage hasGlb={hasGlb} /> : null;
}
