// Server-side lead schema (POST /api/leads). The field rules themselves live in lead-rules.ts.
import { z } from "zod";
import { isValidEmail, isValidPin, MESSAGES, normalisePhone, type LeadField } from "./lead-rules";

export * from "./lead-rules";

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
