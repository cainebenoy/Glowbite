"use client";
// Mounts the fixed, full-viewport WebGL canvas behind the story and drives the three.js studio
// (studio.ts). Pauses when the opaque specs/FAQ/footer cover the screen or the tab is hidden.
import { useEffect, useRef, useState } from "react";
import { poppins } from "@/lib/fonts";
import { useStory } from "./useStory";
import { adoptGltf, buildDevice } from "./model";
import { createStudio, isLowPower, type Studio } from "./studio";

export default function Stage({ hasGlb }: { hasGlb: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const studioRef = useRef<Studio | null>(null);
  const [ready, setReady] = useState(false);
  const active = useStory((s) => s.stageActive);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let studio: Studio;
    try {
      studio = createStudio(canvas, () => {
        setReady(true);
        document.documentElement.classList.add("gl-on");
      });
    } catch (e) {
      console.warn("[stage] WebGL unavailable, keeping the poster", e);
      document.documentElement.classList.add("nogl");
      return;
    }
    studioRef.current = studio;
    let cancelled = false;
    const lowPower = isLowPower();

    const procedural = () => {
      const d = buildDevice({ lowPower, logoFont: poppins.style.fontFamily });
      // repaint the printed logo once Poppins 600 has loaded
      document.fonts?.load(`600 150px ${poppins.style.fontFamily}`).then(() => d.redrawLogo()).catch(() => {});
      if (cancelled) d.dispose();
      else studio.setDevice(d);
    };
    if (hasGlb) {
      (async () => {
        try {
          const [{ GLTFLoader }, { DRACOLoader }] = await Promise.all([
            import("three/examples/jsm/loaders/GLTFLoader.js"),
            import("three/examples/jsm/loaders/DRACOLoader.js"),
          ]);
          const loader = new GLTFLoader();
          const draco = new DRACOLoader().setDecoderPath("/draco/");
          loader.setDRACOLoader(draco);
          const gltf = await loader.loadAsync("/models/glowbite.glb");
          draco.dispose();
          const d = adoptGltf(gltf.scene, { lowPower });
          if (cancelled) d.dispose();
          else studio.setDevice(d);
        } catch (e) {
          console.warn("[stage] GLB failed to load, using the procedural model", e);
          if (!cancelled) procedural();
        }
      })();
    } else procedural();

    const onVis = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVis);
      document.documentElement.classList.remove("gl-on");
      studio.dispose();
      studioRef.current = null;
    };
  }, [hasGlb]);

  const running = active && visible;
  useEffect(() => {
    studioRef.current?.setRunning(running);
  }, [running, ready]);

  return <canvas ref={canvasRef} className={`stage-canvas${ready ? " ready" : ""}${running ? "" : " paused"}`} aria-hidden="true" />;
}
