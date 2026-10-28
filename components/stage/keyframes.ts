// Camera/device keyframes per scene, ported from the prototype's K array and keyed by scene id
// so gated scenes (IPX7) can be inserted without shifting the others.
import type { SceneId } from "@/lib/settings";

export type Key = {
  mx: number; // device x offset
  ry: number;
  rx: number;
  rz: number;
  dist: number; // camera distance
  camY: number;
  tgt: number; // look-at height
  sway: number;
  jet: number;
  spread: number; // spare tips orbit
  charge: number; // charging ring + plug
};

const hero: Key = { mx: 1.6, ry: -0.38, rx: 0.05, rz: 0.05, dist: 9.0, camY: 2.5, tgt: 1.9, sway: 0.55, jet: 0.2, spread: 0, charge: 0 };
const charging: Key = { mx: -1.0, ry: -0.35, rx: 0.06, rz: 0.04, dist: 6.4, camY: 2.1, tgt: 1.55, sway: 0.3, jet: 0, spread: 0, charge: 1 };

export const KEYS: Record<SceneId, Key> = {
  hero,
  tank: { mx: -1.0, ry: -0.5, rx: 0.14, rz: 0, dist: 3.6, camY: 1.25, tgt: 0.72, sway: 0.2, jet: 0, spread: 0, charge: 0 },
  modes: { mx: 0.78, ry: 0.22, rx: 0.05, rz: 0, dist: 2.55, camY: 2.45, tgt: 2.22, sway: 0.1, jet: 1, spread: 0, charge: 0 },
  tips: { mx: 1.35, ry: 0.2, rx: 0.1, rz: 0, dist: 9.4, camY: 2.9, tgt: 1.7, sway: 0.6, jet: 0, spread: 1, charge: 0 },
  charging,
  // IPX7 reuses the charging framing, without the plug and ring
  ipx7: { ...charging, charge: 0 },
  routine: { mx: 1.2, ry: 0.55, rx: 0.02, rz: -0.55, dist: 7.8, camY: 2.6, tgt: 1.95, sway: 0.2, jet: 1, spread: 0, charge: 0 },
  preorder: { mx: -2.7, ry: -0.3, rx: 0.05, rz: 0.04, dist: 10.5, camY: 3.3, tgt: 3.55, sway: 0.55, jet: 0, spread: 0, charge: 0 },
};

export const KEY_NAMES = Object.keys(hero) as (keyof Key)[];

/** The prototype's cubic in-out easing between neighbouring keyframes. */
export const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
