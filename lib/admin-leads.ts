// Lead queries for the admin (list + CSV export share the same filters).
import "server-only";
import { createAdminClient } from "./supabase/admin";

import { STATUSES, type LeadStatus } from "./lead-status";
export { STATUSES, type LeadStatus };

export type LeadRow = {
  id: string;
  created_at: string;
  updated_at: string;
  full_name: string;
  phone: string;
  email: string | null;
  pin_code: string;
  quantity: number;
  marketing_opt_in: boolean;
  consent_text_version: string;
  price_shown: number | null;
  status: LeadStatus;
  notes: string | null;
  source: string | null;
  utm: Record<string, string>;
  referrer: string | null;
  user_agent: string | null;
};

export type LeadFilters = { q?: string; status?: string; optin?: string; page?: number };

export const PAGE_SIZE = 25;

export function parseFilters(sp: Record<string, string | string[] | undefined>): LeadFilters {
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]![0] : sp[k]) as string | undefined;
  const status = one("status");
  const optin = one("optin");
  return {
    q: one("q")?.slice(0, 80) || undefined,
    status: status && (STATUSES as readonly string[]).includes(status) ? status : undefined,
    optin: optin === "yes" || optin === "no" ? optin : undefined,
    page: Math.max(1, Number(one("page")) || 1),
  };
}

export function filterQuery(f: LeadFilters): string {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.status) p.set("status", f.status);
  if (f.optin) p.set("optin", f.optin);
  return p.toString();
}

/** Search text safe for a PostgREST `or` filter (strip syntax and wildcard characters). */
export const searchTerm = (q: string) => q.replace(/[%_,()*\:"'.]/g, " ").trim().replace(/\s+/g, " ");

export function leadsQuery(f: LeadFilters, columns = "*", opts?: { count?: "exact" }) {
  let query = createAdminClient().from("leads").select(columns, opts).order("created_at", { ascending: false });
  if (f.status) query = query.eq("status", f.status);
  if (f.optin) query = query.eq("marketing_opt_in", f.optin === "yes");
  if (f.q) {
    const t = searchTerm(f.q);
    const digits = t.replace(/\D/g, "");
    const ors = [`full_name.ilike.%${t}%`];
    if (digits.length >= 3) ors.push(`phone.ilike.%${digits}%`, `pin_code.ilike.%${digits}%`);
    if (t) query = query.or(ors.join(","));
  }
  return query;
}
