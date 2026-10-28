import type { MetadataRoute } from "next";
import { getSettings } from "@/lib/settings-server";
import { hasPolicy, POLICY_KEYS } from "@/lib/settings";
import { siteUrl } from "@/lib/seo";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const s = await getSettings();
  const base = siteUrl();
  return [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    ...POLICY_KEYS.filter((k) => hasPolicy(s, k)).map((k) => ({ url: `${base}/${k}`, changeFrequency: "monthly" as const, priority: 0.3 })),
  ];
}
