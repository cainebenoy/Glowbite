// POST /api/leads — the only way a lead is written.
import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { fieldErrors, leadSchema } from "@/lib/leads";
import { getSettings } from "@/lib/settings-server";
import { createAdminClient } from "@/lib/supabase/admin";
import { clientIp, hashIp, verifyTurnstile } from "@/lib/request";
import { notifyAll } from "@/lib/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RATE_MAX = Number(process.env.RATE_LIMIT_MAX) || 5;
const RATE_WINDOW_SECONDS = 600;

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });

export async function POST(req: Request) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return json({ status: "invalid", errors: {} }, 400);
  }

  const settings = await getSettings();
  const parsed = leadSchema(settings.max_qty).safeParse(raw);
  if (!parsed.success) return json({ status: "invalid", errors: fieldErrors(parsed.error) }, 400);
  const lead = parsed.data;

  const ip = clientIp(req.headers);
  const turnstile = await verifyTurnstile(lead.turnstileToken, ip);
  if (!turnstile.ok) {
    return json({ status: "challenge_failed", message: "We couldn't verify this submission. Please try again." }, 403);
  }

  const db = createAdminClient();
  const ipHash = hashIp(ip);
  const { data: allowed, error: rlError } = await db.rpc("check_rate_limit", {
    p_ip_hash: ipHash,
    p_max: RATE_MAX,
    p_window_seconds: RATE_WINDOW_SECONDS,
  });
  if (rlError) {
    console.error("[leads] rate limit check failed:", rlError.message);
    return json({ status: "error" }, 500);
  }
  if (!allowed) {
    return json(
      { status: "rate_limited", message: "Too many attempts from this connection. Please wait a few minutes and try again." },
      429,
    );
  }

  // Honeypot: pretend success, save nothing.
  if (lead.company.trim()) return json({ status: "created" });

  const { data: row, error } = await db
    .from("leads")
    .insert({
      full_name: lead.name,
      phone: lead.phone,
      email: lead.email,
      pin_code: lead.pin,
      quantity: lead.quantity,
      marketing_opt_in: lead.optIn,
      consent_text_version: settings.consent_text_version,
      price_shown: settings.offer_active ? settings.price : null,
      source: lead.source?.slice(0, 200) || null,
      utm: lead.utm,
      referrer: req.headers.get("referer")?.slice(0, 1000) ?? null,
      user_agent: req.headers.get("user-agent")?.slice(0, 500) ?? null,
      ip_hash: ipHash,
    })
    .select("id, created_at")
    .single();

  if (error) {
    if (error.code === "23505") return json({ status: "duplicate" });
    console.error("[leads] insert failed:", error.code, error.message);
    return json({ status: "error" }, 500);
  }

  waitUntil(
    (async () => {
      const { data: ops } = await db.from("settings_ops").select("team_notify_emails").eq("id", 1).maybeSingle();
      await notifyAll(
        {
          id: row.id,
          name: lead.name,
          phone: lead.phone,
          pin: lead.pin,
          email: lead.email,
          quantity: lead.quantity,
          optIn: lead.optIn,
          createdAt: row.created_at,
        },
        { brand: settings.brand_name, teamEmails: ops?.team_notify_emails ?? [] },
      );
    })().catch((e) => console.error("[leads] notify failed:", e)),
  );

  return json({ status: "created" });
}
