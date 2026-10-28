// Single scroll source of truth shared by the DOM story and the 3D stage.
// The stage reads it every frame with useStory.getState() (no React re-renders).
import { create } from "zustand";
import type { SceneId } from "@/lib/settings";

export type StoryState = {
  /** pinned scene order, from settings */
  ids: SceneId[];
  /** continuous scene index (0 = hero … ids.length-1 = pre-order) */
  S: number;
  /** per-scene progress 0..1, keyed by id */
  t: Partial<Record<SceneId, number>>;
  /** current mode 1..5 (modes scene readout) */
  mode: number;
  /** routine beat 0..2 */
  beat: number;
  /** false once the opaque specs/FAQ/footer cover the viewport */
  stageActive: boolean;
  reduced: boolean;
};

export const useStory = create<StoryState>(() => ({
  ids: ["hero", "tank", "modes", "tips", "charging", "routine", "preorder"],
  S: 0,
  t: {},
  mode: 1,
  beat: 0,
  stageActive: true,
  reduced: false,
}));

export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const smooth = (x: number) => {
  x = clamp(x);
  return x * x * (3 - 2 * x);
};

/** Mode readout from the modes-scene progress (ported from the prototype). */
export const modeFor = (t: number) => (t <= 0 ? 1 : 1 + Math.min(4, Math.floor(smooth(t / 0.62) * 5)));
export const beatFor = (t: number) => (t < 0.28 ? 0 : t < 0.55 ? 1 : 2);
export const mlFor = (t: number) => Math.round(350 * smooth(t / 0.6));
