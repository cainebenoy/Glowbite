// Lead field rules with no dependencies, so the browser form doesn't ship Zod.
// lib/leads.ts builds the server schema on top of these.
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
