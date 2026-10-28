import "server-only";
import { createHash } from "node:crypto";

export function clientIp(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return headers.get("x-real-ip")?.trim() || "0.0.0.0";
}

/** Salted SHA-256 of the IP. The raw IP is never stored. */
export function hashIp(ip: string): string {
  const salt = process.env.IP_HASH_SALT || "dev-only-salt";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

export async function verifyTurnstile(token: string, ip: string): Promise<{ ok: boolean; skipped?: boolean }> {
  const secret = process.env.TURNSTILE_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production" && process.env.VERCEL_ENV === "production") {
      console.error("[turnstile] TURNSTILE_SECRET missing in production; rejecting");
      return { ok: false };
    }
    console.info("[turnstile] skipped (TURNSTILE_SECRET not set)");
    return { ok: true, skipped: true };
  }
  if (!token) return { ok: false };
  try {
    const body = new URLSearchParams({ secret, response: token, remoteip: ip });
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body });
    const j = (await r.json()) as { success?: boolean };
    return { ok: Boolean(j.success) };
  } catch (e) {
    console.error("[turnstile] verify failed:", e);
    return { ok: false };
  }
}
