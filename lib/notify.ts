// Post-submit notifications. All fire-and-forget: failures are logged, never shown to the visitor.
// Each channel logs "skipped" when it isn't configured, so the app works with only Supabase set.
import "server-only";
import { Resend } from "resend";
import { formatIST } from "./time";

export type LeadNotice = {
  id: string;
  name: string;
  phone: string;
  pin: string;
  email: string | null;
  quantity: number;
  optIn: boolean;
  createdAt: string;
};

type Ctx = { brand: string; teamEmails: string[] };

const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function resend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  return key ? new Resend(key) : null;
}
const mailFrom = () => process.env.MAIL_FROM || "";

export async function notifyTeam(lead: LeadNotice, ctx: Ctx) {
  const client = resend();
  if (!client || !mailFrom() || ctx.teamEmails.length === 0) {
    console.info("[notify] team email skipped (RESEND_API_KEY, MAIL_FROM or team_notify_emails not set)");
    return;
  }
  const link = `${siteUrl()}/admin/leads/${lead.id}`;
  const rows: [string, string][] = [
    ["Name", lead.name],
    ["Mobile", lead.phone],
    ["PIN code", lead.pin],
    ["Quantity", String(lead.quantity)],
    ["Marketing opt-in", lead.optIn ? "Yes" : "No"],
    ["Time", formatIST(lead.createdAt)],
  ];
  const text = rows.map(([k, v]) => `${k}: ${v}`).join("\n") + `\n\nOpen in admin: ${link}`;
  const html =
    `<table cellpadding="4">${rows.map(([k, v]) => `<tr><td><b>${esc(k)}</b></td><td>${esc(v)}</td></tr>`).join("")}</table>` +
    `<p><a href="${esc(link)}">Open in admin</a></p>`;
  const { error } = await client.emails.send({
    from: mailFrom(),
    to: ctx.teamEmails,
    subject: `New pre-order lead: ${lead.name} (${lead.pin})`,
    text,
    html,
  });
  if (error) console.error("[notify] team email failed:", error.message);
}

export async function notifyCustomer(lead: LeadNotice, ctx: Ctx) {
  if (!lead.email) return;
  const client = resend();
  if (!client || !mailFrom()) {
    console.info("[notify] customer email skipped (RESEND_API_KEY or MAIL_FROM not set)");
    return;
  }
  // Transactional only: confirms what they signed up for. No marketing content.
  const first = lead.name.split(" ")[0] || lead.name;
  const text = [
    `Hi ${first},`,
    "",
    `You're on the ${ctx.brand} pre-order list. Thanks for your interest in ${ctx.brand}. We'll reach out with the next steps and availability details.`,
    "",
    "No payment has been taken. Joining the list is non-binding.",
    "",
    `If you didn't sign up, you can ignore this email or reply and we'll remove your details.`,
    "",
    ctx.brand,
  ].join("\n");
  const { error } = await client.emails.send({
    from: mailFrom(),
    to: lead.email,
    subject: `You're on the ${ctx.brand} pre-order list`,
    text,
    html: text
      .split("\n\n")
      .map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`)
      .join(""),
  });
  if (error) console.error("[notify] customer email failed:", error.message);
}

export async function notifyWebhook(lead: LeadNotice, ctx: Ctx) {
  const url = process.env.TEAM_WEBHOOK_URL;
  if (!url) {
    console.info("[notify] webhook skipped (TEAM_WEBHOOK_URL not set)");
    return;
  }
  // Slack ("text") and Discord ("content") compatible.
  const msg = `New ${ctx.brand} pre-order lead: ${lead.name}, ${lead.phone}, PIN ${lead.pin}, qty ${lead.quantity}${lead.optIn ? ", opted in" : ""}. ${siteUrl()}/admin/leads/${lead.id}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text: msg, content: msg }),
  });
  if (!r.ok) console.error("[notify] webhook failed:", r.status);
}

/**
 * WhatsApp/SMS follow-up hook. Not built: it needs a WhatsApp Business API provider
 * (e.g. Gupshup, Twilio, Meta Cloud API). Implement here; it receives every new lead.
 */
export async function notifyWhatsApp(_lead: LeadNotice, _ctx: Ctx) {
  console.info("[notify] whatsapp skipped (no provider configured)");
}

export async function notifyAll(lead: LeadNotice, ctx: Ctx) {
  const results = await Promise.allSettled([
    notifyTeam(lead, ctx),
    notifyCustomer(lead, ctx),
    notifyWebhook(lead, ctx),
    notifyWhatsApp(lead, ctx),
  ]);
  for (const r of results) if (r.status === "rejected") console.error("[notify] failed:", r.reason);
}
