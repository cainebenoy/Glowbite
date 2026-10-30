// Typed site settings: schema, defaults and the derived (gated) content the page renders.
// Pure module — safe to import from client and server. Loading lives in lib/settings-server.ts.
import { z } from "zod";

const url = z
  .string()
  .trim()
  .max(500)
  .refine((s) => s === "" || /^https?:\/\/\S+$/i.test(s), "Enter a full URL starting with https://, or leave it blank.");

const shortText = (max = 200) => z.string().trim().max(max);
const markdown = z.string().max(50_000);

export const boxItemSchema = z.object({
  item: shortText(80).min(1, "Item name is required."),
  qty: z.coerce.number().int().min(1).max(99),
  confirmed: z.boolean().default(false),
});
export type BoxItem = z.infer<typeof boxItemSchema>;

/** Strict schema used when an admin saves settings. */
export const settingsSchema = z.object({
  // Offer
  brand_name: shortText(40).min(1, "Brand name is required."),
  price: z.coerce.number().int().min(0).max(1_000_000),
  mrp: z.coerce.number().int().min(0).max(1_000_000),
  show_mrp: z.boolean(),
  offer_active: z.boolean(),
  max_qty: z.coerce.number().int().min(1).max(20),
  // Claim gates
  ipx7_verified: z.boolean(),
  warranty_published: z.boolean(),
  warranty_text: shortText(120),
  free_shipping_confirmed: z.boolean(),
  // Dispatch
  dispatch_window: shortText(160),
  // Content
  in_the_box: z.array(boxItemSchema).max(12),
  instruction_guide_url: url,
  privacy_md: markdown,
  terms_md: markdown,
  shipping_md: markdown,
  refunds_md: markdown,
  // Contact & social
  contact_email: z
    .string()
    .trim()
    .max(120)
    .refine((s) => s === "" || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s), "Enter a valid email, or leave it blank."),
  contact_phone: shortText(30),
  whatsapp: shortText(30),
  instagram_url: url,
  facebook_url: url,
  youtube_url: url,
  // Consent
  consent_text_version: shortText(40).min(1),
});

export type Settings = z.infer<typeof settingsSchema>;

/** Seed defaults. Every claim gate starts off; nothing unconfirmed is published. */
export const DEFAULT_SETTINGS: Settings = {
  brand_name: "GlowBite",
  price: 1299,
  mrp: 1499,
  show_mrp: false,
  offer_active: true,
  max_qty: 5,
  ipx7_verified: false,
  warranty_published: false,
  warranty_text: "1 year",
  free_shipping_confirmed: false,
  dispatch_window: "",
  in_the_box: [
    { item: "GlowBite water flosser", qty: 1, confirmed: false },
    { item: "Flossing tips", qty: 5, confirmed: false },
    { item: "USB-C charging cable", qty: 1, confirmed: false },
  ],
  instruction_guide_url: "",
  privacy_md: "",
  terms_md: "",
  shipping_md: "",
  refunds_md: "",
  contact_email: "",
  contact_phone: "",
  whatsapp: "",
  instagram_url: "",
  facebook_url: "",
  youtube_url: "",
  consent_text_version: "2026-10-v1",
};

/** Lenient parse for reading: each invalid or missing field falls back to its default on its own. */
const lenientSchema = z.object(
  Object.fromEntries(
    Object.entries(settingsSchema.shape).map(([k, s]) => [k, (s as z.ZodType).catch(DEFAULT_SETTINGS[k as keyof Settings])]),
  ) as unknown as { [K in keyof Settings]: z.ZodType<Settings[K]> },
);

export function parseSettings(data: unknown): Settings {
  const r = lenientSchema.safeParse(data && typeof data === "object" ? data : {});
  return r.success ? (r.data as Settings) : DEFAULT_SETTINGS;
}

// ---------------------------------------------------------------- formatting
export { inr } from "./format";

// ---------------------------------------------------------------- derived copy
export const NO_PAYMENT = "No payment taken now.";

export function shippingLine(s: Settings): string {
  return s.free_shipping_confirmed ? "Free shipping" : "Free shipping, subject to confirmed terms";
}

export function dispatchLine(s: Settings): string {
  return s.dispatch_window.trim() || "Dispatch timing will be confirmed before your order is finalised";
}

export const TRUST_LINE =
  "Product details, availability, shipping and warranty terms will be confirmed before your order is finalised.";

export const showMrp = (s: Settings) => s.offer_active && s.show_mrp && s.mrp > s.price;
export const showWarranty = (s: Settings) => s.warranty_published && s.warranty_text.trim() !== "";

export function boxSummary(s: Settings): string {
  return s.in_the_box.map((b) => `${b.item} ×${b.qty}`).join("  ·  ");
}

export type Spec = { label: string; value: string; note?: string; full?: boolean };

export function specs(s: Settings): Spec[] {
  const out: Spec[] = [
    { label: "Modes", value: "5", note: "Including a child mode" },
    { label: "Water tank", value: "350 ml" },
    { label: "Tips included", value: "5" },
    { label: "Charging", value: "USB-C", note: "Rechargeable" },
  ];
  if (s.ipx7_verified) out.push({ label: "Water resistance", value: "IPX7" });
  if (showWarranty(s)) out.push({ label: "Warranty", value: s.warranty_text.trim() });
  if (s.in_the_box.length) out.push({ label: "In the box", value: "", note: boxSummary(s), full: true });
  return out;
}

export type FaqItem = { q: string; a: string; link?: { href: string; label: string } };

export const POLICY_KEYS = ["privacy", "terms", "shipping", "refunds"] as const;
export type PolicyKey = (typeof POLICY_KEYS)[number];
export const POLICY_TITLES: Record<PolicyKey, string> = {
  privacy: "Privacy Notice",
  terms: "Terms",
  shipping: "Shipping",
  refunds: "Cancellations & refunds",
};
export const policyBody = (s: Settings, k: PolicyKey) => s[`${k}_md` as const].trim();
export const hasPolicy = (s: Settings, k: PolicyKey) => policyBody(s, k) !== "";

export function faq(s: Settings): FaqItem[] {
  const box = s.in_the_box.map((b) => `${b.item} (×${b.qty})`).join(", ");
  const items: FaqItem[] = [
    {
      q: "What is a water flosser?",
      a: "A water flosser directs a stream of water along the gumline and between teeth. It's an additional step in your routine and doesn't replace brushing or professional dental care.",
    },
    {
      q: "What comes in the box?",
      a: box
        ? `${box}. We'll confirm the final contents before your order is finalised.`
        : "We'll confirm the box contents before your order is finalised.",
    },
    { q: "How is it charged?", a: `${s.brand_name} is rechargeable over USB-C.` },
    {
      q: "Is shipping free?",
      a: s.free_shipping_confirmed
        ? "Yes, shipping is free."
        : "Free shipping is planned, subject to confirmed terms and serviceable PIN codes. We'll confirm this before your order is finalised.",
      link: hasPolicy(s, "shipping") ? { href: "/shipping", label: "Shipping information" } : undefined,
    },
    {
      q: "When will it ship?",
      a: s.dispatch_window.trim()
        ? s.dispatch_window.trim().replace(/\.?$/, ".")
        : "Dispatch timing isn't confirmed yet. We'll share it before your order is finalised.",
    },
    {
      q: "What is the warranty process?",
      a: showWarranty(s)
        ? `Warranty: ${s.warranty_text.trim()}.${hasPolicy(s, "terms") ? " Full terms and the service process are in our Terms." : ""}`
        : "Warranty terms and the service process will be published before your order is finalised.",
      link: showWarranty(s) && hasPolicy(s, "terms") ? { href: "/terms", label: "Terms" } : undefined,
    },
    {
      q: "Do I pay anything now? Can I cancel?",
      a: "No payment is taken now. Joining is non-binding, so there's nothing to cancel. If you change your mind, just tell us when we contact you.",
      link: hasPolicy(s, "refunds") ? { href: "/refunds", label: "Cancellations & refunds" } : undefined,
    },
    {
      q: "Is it suitable for children?",
      a: `${s.brand_name} includes a child mode. For children, follow the product instructions and use it with adult supervision.`,
    },
  ];
  if (s.ipx7_verified) items.splice(3, 0, { q: "Is it water resistant?", a: `${s.brand_name} is rated IPX7 for water resistance.` });
  if (s.instruction_guide_url)
    items.push({
      q: "Where is the instruction guide?",
      a: `Read the official ${s.brand_name} instruction guide.`,
      link: { href: s.instruction_guide_url, label: "Instruction guide" },
    });
  return items;
}

// ---------------------------------------------------------------- scenes
export type SceneId = "hero" | "tank" | "modes" | "tips" | "charging" | "ipx7" | "routine" | "preorder";
export const SCENE_NAMES: Record<SceneId, string> = {
  hero: "GlowBite",
  tank: "Tank",
  modes: "Modes",
  tips: "Tips",
  charging: "Charging",
  ipx7: "IPX7",
  routine: "Routine",
  preorder: "Pre-order",
};

/** The pinned story, in order. IPX7 appears only when verified. */
export function scenes(s: Settings): SceneId[] {
  return ["hero", "tank", "modes", "tips", "charging", ...(s.ipx7_verified ? (["ipx7"] as const) : []), "routine", "preorder"];
}

export type SocialLink = { label: string; href: string };
export function footerLinks(s: Settings): SocialLink[] {
  const links: SocialLink[] = POLICY_KEYS.filter((k) => hasPolicy(s, k)).map((k) => ({ label: POLICY_TITLES[k], href: `/${k}` }));
  if (s.instagram_url) links.push({ label: "Instagram", href: s.instagram_url });
  if (s.facebook_url) links.push({ label: "Facebook", href: s.facebook_url });
  if (s.youtube_url) links.push({ label: "YouTube", href: s.youtube_url });
  return links;
}
