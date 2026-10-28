"use client";
// Drives the scroll story: Lenis smooth scroll, scene progress (ported readScroll/ui from the
// prototype, keyed by scene id), DOM effects, and the shared useStory store read by the 3D stage.
import { useEffect } from "react";
import Lenis from "lenis";
import type { SceneId } from "@/lib/settings";
import { track } from "@/lib/analytics";
import { beatFor, clamp, mlFor, modeFor, smooth, useStory } from "./useStory";

export function StoryDriver() {
  useEffect(() => {
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const sections = [...document.querySelectorAll<HTMLElement>("[data-scene]")];
    const ids = sections.map((s) => s.dataset.scene as SceneId);
    const last = ids.length - 1;
    useStory.setState({ ids, reduced });

    const $ = <T extends Element = HTMLElement>(sel: string) => document.querySelector<T>(sel);
    const copies = sections.slice(0, last).map((s) => s.querySelector<HTMLElement>("[data-copy]"));
    const ml = $("#ml"),
      modeN = $("#modeN"),
      dots = [...document.querySelectorAll<HTMLElement>("#modeDots i")],
      beats = [...document.querySelectorAll<HTMLElement>(".beat")],
      railBtns = [...document.querySelectorAll<HTMLElement>("#rail button")],
      rail = $("#rail"),
      bar = $("#bar"),
      prog = $("#prog"),
      specs = $("#specs"),
      formCard = $("#formCard");

    // ---- smooth scroll
    let lenis: Lenis | null = null;
    let raf = 0;
    if (!reduced) {
      try {
        lenis = new Lenis({ lerp: 0.085, smoothWheel: true });
        const loop = (t: number) => {
          lenis!.raf(t);
          raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
      } catch {
        lenis = null;
      }
    }
    const goTo = (el: HTMLElement) => {
      if (lenis) lenis.scrollTo(el, { duration: 1.6 });
      else el.scrollIntoView({ behavior: reduced ? "auto" : "smooth" });
    };
    const onClick = (e: MouseEvent) => {
      const target = e.target as Element | null;
      const cta = target?.closest<HTMLElement>("[data-cta]");
      if (cta) track("cta_click", { location: cta.dataset.cta! });
      const go = target?.closest<HTMLElement>("[data-go]");
      if (go) {
        const el = document.getElementById(go.dataset.go!);
        if (el) goTo(el);
        return;
      }
      const a = target?.closest<HTMLAnchorElement>('a[href^="#"]');
      const href = a?.getAttribute("href");
      if (!a || !href || href.length < 2) return;
      const el = document.getElementById(href.slice(1));
      if (!el) return;
      e.preventDefault();
      goTo(el);
      // move keyboard/screen-reader focus with the scroll, without popping a mobile keyboard
      if (href === "#preorder") document.getElementById("preorder-title")?.focus({ preventScroll: true });
    };
    document.addEventListener("click", onClick);

    // ---- scroll model
    const t: Partial<Record<SceneId, number>> = {};
    let lastScene = -1;
    let lastMl = -1;
    let lastMode = -1;
    let lastBeat = -1;

    const readScroll = () => {
      const y = scrollY,
        vh = innerHeight;
      let S = 0;
      sections.forEach((s, i) => {
        const top = s.offsetTop,
          h = s.offsetHeight;
        t[ids[i]!] = i === last ? clamp((y - (top - vh)) / vh) : clamp((y - top) / Math.max(1, h - vh));
      });
      // hold each scene, blend to the next over the last 30% of its pin
      for (let i = 0; i < last; i++) if (sections[i]!.offsetTop <= y + 1) S = i + smooth(((t[ids[i]!] ?? 0) - 0.7) / 0.3);
      return S;
    };

    const ui = () => {
      const S = readScroll();
      if (!reduced)
        copies.forEach((c, i) => {
          if (!c) return;
          const out = smooth(((t[ids[i]!] ?? 0) - 0.68) / 0.24);
          c.style.opacity = String(1 - out);
          c.style.transform = `translate3d(0,${-50 * out}px,0)`;
        });

      const mlv = reduced ? 350 : mlFor(t.tank ?? 0);
      if (ml && mlv !== lastMl) ml.textContent = String((lastMl = mlv));
      const mode = modeFor(t.modes ?? 0);
      if (mode !== lastMode) {
        lastMode = mode;
        if (modeN) modeN.textContent = String(mode);
        dots.forEach((d, i) => d.classList.toggle("on", i < mode));
      }
      const beat = beatFor(t.routine ?? 0);
      if (beat !== lastBeat) {
        lastBeat = beat;
        beats.forEach((el, i) => el.classList.toggle("on", i === beat));
      }

      const cur = Math.min(last, Math.round(S));
      if (cur !== lastScene) {
        railBtns.forEach((r, i) => r.classList.toggle("on", i === cur));
        railBtns.forEach((r, i) => (i === cur ? r.setAttribute("aria-current", "step") : r.removeAttribute("aria-current")));
        sections.forEach((sc, i) => sc.classList.toggle("lit", i === cur));
        if (lastScene !== -1) track("scene_view", { scene: ids[cur]! });
        lastScene = cur;
      }

      const maxY = document.documentElement.scrollHeight - innerHeight;
      prog?.style.setProperty("--p", maxY > 0 ? (scrollY / maxY).toFixed(4) : "0");
      const specsTop = specs ? specs.getBoundingClientRect().top : Infinity;
      rail?.classList.toggle("hide", specsTop < innerHeight * 0.6);
      if (bar && formCard) {
        const r = formCard.getBoundingClientRect();
        const show = scrollY > innerHeight * 0.8 && !(r.top < innerHeight && r.bottom > 0);
        bar.classList.toggle("show", show);
        bar.toggleAttribute("inert", !show);
      }

      useStory.setState({ S, t: { ...t }, mode, beat, stageActive: specsTop > -innerHeight * 0.2 });
    };

    let queued = false;
    const onScroll = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        ui();
      });
    };
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", onScroll);
    ui();

    return () => {
      removeEventListener("scroll", onScroll);
      removeEventListener("resize", onScroll);
      document.removeEventListener("click", onClick);
      cancelAnimationFrame(raf);
      lenis?.destroy();
    };
  }, []);

  return null;
}
