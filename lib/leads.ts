// Lead validation shared by the pre-order form (client) and POST /api/leads (server).
import { z } from "zod";

export const MESSAGES = {
  name: "Enter your full name.",
  phone: "Enter a 10-digit Indian mobile number.",
  pin: "Enter a valid 6-digit PIN code.",
  email: "Check the email address, or leave it blank.",
  quantity: "Choose a quantity.",
} as const;

export type LeadField = keyof typeof MESSAGES;

const digits = (s: string) => s.replace(/\D/g, "");

/** Strips formatting and the +91 / 91 / 0 prefixes. Returns the bare digits (valid or not). */
export function nationalDigits(input: string): string {
  let d = digits(input);
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  else if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return d;
}

/** Normalises an Indian mobile number to E.164 (+91XXXXXXXXXX), or null when invalid. */
export function normalisePhone(input: string): string | null {
  const d = nationalDigits(input);
  return /^[6-9]\d{9}$/.test(d) ? `+91${d}` : null;
}

export const isValidPin = (pin: string) => /^[1-9]\d{5}$/.test(pin.trim());

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const isValidEmail = (email: string) => email.length <= 120 && EMAIL_RE.test(email);

/** Field-level checks used for inline (on blur) validation. Empty string = valid. */
export const fieldRules = {
  name: (v: string) => {
    const t = v.trim();
    return t.length < 2 || t.length > 80 ? MESSAGES.name : "";
  },
  phone: (v: string) => (normalisePhone(v) ? "" : MESSAGES.phone),
  pin: (v: string) => (isValidPin(v) ? "" : MESSAGES.pin),
  email: (v: string) => (!v.trim() || isValidEmail(v.trim()) ? "" : MESSAGES.email),
} satisfies Record<Exclude<LeadField, "quantity">, (v: string) => string>;

const utmSchema = z
  .record(z.string(), z.string().max(200))
  .catch({})
  .transform((o) =>
    Object.fromEntries(
      Object.entries(o)
        .filter(([k]) => /^utm_[a-z_]{1,30}$/.test(k))
        .slice(0, 10),
    ),
  );

/** The payload the browser sends. `maxQty` comes from settings. */
export function leadSchema(maxQty: number) {
  return z.object({
    name: z
      .string()
      .transform((s) => s.trim().replace(/\s+/g, " "))
      .pipe(z.string().min(2, MESSAGES.name).max(80, MESSAGES.name)),
    phone: z
      .string()
      .max(20, MESSAGES.phone)
      .transform((s, ctx) => {
        const p = normalisePhone(s);
        if (!p) {
          ctx.addIssue({ code: "custom", message: MESSAGES.phone });
          return z.NEVER;
        }
        return p;
      }),
    pin: z
      .string()
      .transform((s) => s.trim())
      .refine(isValidPin, MESSAGES.pin),
    email: z
      .string()
      .optional()
      .nullable()
      .transform((s) => (s ?? "").trim())
      .refine((s) => !s || isValidEmail(s), MESSAGES.email)
      .transform((s) => (s ? s.toLowerCase() : null)),
    quantity: z.coerce
      .number({ error: MESSAGES.quantity })
      .int(MESSAGES.quantity)
      .min(1, MESSAGES.quantity)
      .max(maxQty, MESSAGES.quantity),
    optIn: z.boolean().default(false),
    company: z.string().max(200).optional().default(""), // honeypot
    turnstileToken: z.string().max(4096).optional().default(""),
    utm: utmSchema.optional().default({}),
    source: z.string().max(200).optional(),
  });
}

export type LeadInput = z.input<ReturnType<typeof leadSchema>>;
export type Lead = z.output<ReturnType<typeof leadSchema>>;

/** Flattens zod issues into { field: firstMessage }. */
export function fieldErrors(error: z.ZodError): Partial<Record<LeadField, string>> {
  const out: Partial<Record<LeadField, string>> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && key in MESSAGES && !out[key as LeadField]) {
      out[key as LeadField] = MESSAGES[key as LeadField];
    }
  }
  return out;
}
