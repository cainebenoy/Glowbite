import { describe, expect, it } from "vitest";
import { fieldRules, leadSchema, MESSAGES, nationalDigits, normalisePhone } from "@/lib/leads";

describe("normalisePhone", () => {
  it.each([
    ["9876543210", "+919876543210"],
    ["+91 98765 43210", "+919876543210"],
    ["+919876543210", "+919876543210"],
    ["919876543210", "+919876543210"],
    ["09876543210", "+919876543210"],
    ["98765-43210", "+919876543210"],
    [" 6000000000 ", "+916000000000"],
    ["7000000000", "+917000000000"],
    ["8000000000", "+918000000000"],
  ])("%s → %s", (input, out) => expect(normalisePhone(input)).toBe(out));

  it.each([
    ["5876543210"], // invalid first digit
    ["0876543210"],
    ["1234567890"],
    ["987654321"], // 9 digits
    ["98765432101"], // 11 digits without a 0 prefix
    ["+44 7911 123456"],
    [""],
    ["abcdefghij"],
  ])("rejects %s", (input) => expect(normalisePhone(input)).toBeNull());

  it("strips the country code prefix only from 12-digit input", () => {
    expect(nationalDigits("+91 12345")).toBe("9112345");
  });
});

describe("PIN code", () => {
  it.each(["682001", "110001", "999999"])("accepts %s", (p) => expect(fieldRules.pin(p)).toBe(""));
  it.each(["012345", "68200", "6820011", "68a001", ""])("rejects %s", (p) => expect(fieldRules.pin(p)).toBe(MESSAGES.pin));
});

describe("email (optional)", () => {
  it("accepts blank", () => expect(fieldRules.email("")).toBe(""));
  it("accepts a valid address", () => expect(fieldRules.email("a@b.in")).toBe(""));
  it.each(["a@b", "a b@c.in", "@c.in", "a@.in"])("rejects %s", (e) => expect(fieldRules.email(e)).toBe(MESSAGES.email));
});

describe("leadSchema", () => {
  const base = { name: "  Asha   Menon ", phone: "098765 43210", pin: "682001", email: "", quantity: 2, optIn: true };

  it("normalises a valid lead", () => {
    const r = leadSchema(5).parse(base);
    expect(r).toMatchObject({ name: "Asha Menon", phone: "+919876543210", pin: "682001", email: null, quantity: 2, optIn: true });
  });

  it("lower-cases email", () => {
    expect(leadSchema(5).parse({ ...base, email: "Asha@Example.IN" }).email).toBe("asha@example.in");
  });

  it.each([0, 6, 1.5, -1])("rejects quantity %s with max 5", (q) => {
    expect(leadSchema(5).safeParse({ ...base, quantity: q }).success).toBe(false);
  });

  it("accepts quantity bounds", () => {
    expect(leadSchema(5).safeParse({ ...base, quantity: 1 }).success).toBe(true);
    expect(leadSchema(5).safeParse({ ...base, quantity: 5 }).success).toBe(true);
    expect(leadSchema(3).safeParse({ ...base, quantity: 4 }).success).toBe(false);
  });

  it("rejects short names", () => {
    expect(leadSchema(5).safeParse({ ...base, name: " A " }).success).toBe(false);
  });

  it("keeps only utm_* keys", () => {
    const r = leadSchema(5).parse({ ...base, utm: { utm_source: "ig", evil: "x", utm_campaign: "launch" } });
    expect(r.utm).toEqual({ utm_source: "ig", utm_campaign: "launch" });
  });
});
