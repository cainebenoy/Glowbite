// Loads settings for rendering. Cached under the "settings" tag; the admin save action
// calls revalidateTag("settings") so the static landing page rebuilds with new content.
import "server-only";
import { unstable_cache } from "next/cache";
import { DEFAULT_SETTINGS, parseSettings, type Settings } from "./settings";
import { createPublicClient } from "./supabase/public";
import { hasSupabase } from "./supabase/env";

export const SETTINGS_TAG = "settings";

async function load(): Promise<Settings> {
  if (!hasSupabase()) return DEFAULT_SETTINGS;
  try {
    const { data, error } = await createPublicClient().from("settings").select("data").eq("id", 1).maybeSingle();
    if (error) throw error;
    return parseSettings(data?.data);
  } catch (e) {
    console.error("[settings] load failed, using defaults:", e instanceof Error ? e.message : e);
    return DEFAULT_SETTINGS;
  }
}

export const getSettings = unstable_cache(load, ["settings-v1"], { tags: [SETTINGS_TAG] });
