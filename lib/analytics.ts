// Typed custom events over @vercel/analytics (cookieless). No third-party trackers.
import { track as vercelTrack } from "@vercel/analytics";

type Events = {
  cta_click: { location: string };
  scene_view: { scene: string };
  form_view: Record<string, never>;
  form_start: Record<string, never>;
  form_error: { field: string };
  lead_submit: { quantity: number; opt_in: boolean; duplicate: boolean };
  faq_open: { q: string };
};

export function track<E extends keyof Events>(event: E, props?: Events[E]) {
  try {
    vercelTrack(event, props as Record<string, string | number | boolean>);
  } catch {
    // analytics must never break the page
  }
}
