import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  dispatchLine,
  faq,
  footerLinks,
  parseSettings,
  scenes,
  settingsSchema,
  shippingLine,
  showMrp,
  showWarranty,
  specs,
  type Settings,
} from "@/lib/settings";
import { KEYS } from "@/components/stage/keyframes";

const S = (o: Partial<Settings> = {}): Settings => ({ ...DEFAULT_SETTINGS, ...o });

describe("defaults", () => {
  it("start with every claim gate off", () => {
    expect(DEFAULT_SETTINGS).toMatchObject({
      show_mrp: false,
      ipx7_verified: false,
      warranty_published: false,
      free_shipping_confirmed: false,
      dispatch_window: "",
    });
    expect(DEFAULT_SETTINGS.in_the_box.every((b) => !b.confirmed)).toBe(true);
  });
  it("match the brief's offer", () => {
    expect(DEFAULT_SETTINGS).toMatchObject({ brand_name: "GlowBite", price: 1299, mrp: 1499, offer_active: true, max_qty: 5 });
  });
  it("pass the strict schema", () => expect(settingsSchema.safeParse(DEFAULT_SETTINGS).success).toBe(true));
  it("are exactly what the seed inserts", () => {
    const sql = readFileSync("supabase/seed.sql", "utf8");
    const json = sql.match(/values \(1, '([\s\S]*?)'::jsonb\)/)![1]!.replace(/''/g, "'");
    expect(JSON.parse(json)).toEqual(DEFAULT_SETTINGS);
  });
});

describe("parseSettings", () => {
  it("returns defaults for garbage", () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings("x")).toEqual(DEFAULT_SETTINGS);
  });
  it("falls back per field", () => {
    const s = parseSettings({ price: 999, ipx7_verified: "yes", brand_name: "" });
    expect(s.price).toBe(999);
    expect(s.ipx7_verified).toBe(false);
    expect(s.brand_name).toBe("GlowBite");
  });
});

describe("claim gates", () => {
  it("IPX7 is hidden when not verified", () => {
    const s = S();
    expect(scenes(s)).not.toContain("ipx7");
    expect(specs(s).map((x) => x.value)).not.toContain("IPX7");
    expect(faq(s).some((f) => /IPX7/.test(f.a))).toBe(false);
  });
  it("IPX7 appears in scenes, specs and FAQ when verified", () => {
    const s = S({ ipx7_verified: true });
    expect(scenes(s)).toEqual(["hero", "tank", "modes", "tips", "charging", "ipx7", "routine", "preorder"]);
    expect(specs(s).find((x) => x.label === "Water resistance")?.value).toBe("IPX7");
    expect(faq(s).some((f) => /rated IPX7/.test(f.a))).toBe(true);
  });
  it("every scene has camera keyframes", () => {
    for (const id of scenes(S({ ipx7_verified: true }))) expect(KEYS[id]).toBeDefined();
  });
  it("MRP needs the gate, an active offer and MRP above price", () => {
    expect(showMrp(S())).toBe(false);
    expect(showMrp(S({ show_mrp: true }))).toBe(true);
    expect(showMrp(S({ show_mrp: true, offer_active: false }))).toBe(false);
    expect(showMrp(S({ show_mrp: true, mrp: 1299 }))).toBe(false);
  });
  it("warranty needs the gate", () => {
    expect(showWarranty(S())).toBe(false);
    expect(specs(S()).some((x) => x.label === "Warranty")).toBe(false);
    expect(showWarranty(S({ warranty_published: true }))).toBe(true);
    expect(specs(S({ warranty_published: true })).find((x) => x.label === "Warranty")?.value).toBe("1 year");
  });
  it("shipping line follows the gate", () => {
    expect(shippingLine(S())).toBe("Free shipping, subject to confirmed terms");
    expect(shippingLine(S({ free_shipping_confirmed: true }))).toBe("Free shipping");
  });
  it("dispatch line falls back to the unconfirmed wording", () => {
    expect(dispatchLine(S())).toBe("Dispatch timing will be confirmed before your order is finalised");
    expect(dispatchLine(S({ dispatch_window: "Expected dispatch: March 2027" }))).toBe("Expected dispatch: March 2027");
  });
});

describe("FAQ", () => {
  const ans = (s: Settings, q: RegExp) => faq(s).find((f) => q.test(f.q))!.a;
  it("has the brief's 8 questions by default", () => expect(faq(S())).toHaveLength(8));
  it("ship date follows dispatch_window", () => {
    expect(ans(S(), /When will it ship/)).toMatch(/isn't confirmed yet/);
    expect(ans(S({ dispatch_window: "Expected dispatch: March 2027" }), /When will it ship/)).toBe("Expected dispatch: March 2027.");
  });
  it("shipping and warranty answers switch with gates", () => {
    expect(ans(S(), /shipping free/)).toMatch(/subject to confirmed terms/);
    expect(ans(S({ free_shipping_confirmed: true }), /shipping free/)).toBe("Yes, shipping is free.");
    expect(ans(S(), /warranty/)).toMatch(/will be published/);
    expect(ans(S({ warranty_published: true }), /warranty/)).toMatch(/Warranty: 1 year/);
  });
  it("children answer only mentions child mode and supervision", () => {
    expect(ans(S(), /children/)).toBe(
      "GlowBite includes a child mode. For children, follow the product instructions and use it with adult supervision.",
    );
  });
  it("adds the instruction guide only when set", () => {
    expect(faq(S()).some((f) => /instruction guide/.test(f.q))).toBe(false);
    expect(faq(S({ instruction_guide_url: "https://x.example/guide.pdf" })).at(-1)!.link!.href).toBe("https://x.example/guide.pdf");
  });
  it("never claims ratings, testimonials or clinical results", () => {
    const all = JSON.stringify(faq(S({ ipx7_verified: true, warranty_published: true, free_shipping_confirmed: true })));
    expect(all).not.toMatch(/dentist|clinically|rating|review|testimonial|guarantee/i);
  });
});

describe("footer links", () => {
  it("lists only policies and socials that exist", () => {
    expect(footerLinks(S())).toEqual([]);
    expect(footerLinks(S({ privacy_md: "# Privacy", instagram_url: "https://instagram.com/x" }))).toEqual([
      { label: "Privacy Notice", href: "/privacy" },
      { label: "Instagram", href: "https://instagram.com/x" },
    ]);
  });
});
