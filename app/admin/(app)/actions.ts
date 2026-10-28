"use server";
// Admin server actions. Each one re-checks the admin session: the layout guard does not cover actions.
import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { STATUSES } from "@/lib/admin-leads";
import { settingsSchema } from "@/lib/settings";
import { SETTINGS_TAG } from "@/lib/settings-server";

const id = z.uuid();

export async function setLeadStatus(form: FormData) {
  await requireAdmin();
  const leadId = id.parse(form.get("id"));
  const status = z.enum(STATUSES).parse(form.get("status"));
  const { error } = await createAdminClient().from("leads").update({ status }).eq("id", leadId);
  if (error) throw new Error("Couldn't update the status.");
  revalidatePath("/admin/leads");
  revalidatePath(`/admin/leads/${leadId}`);
}

export async function saveLeadNotes(form: FormData) {
  await requireAdmin();
  const leadId = id.parse(form.get("id"));
  const notes = z.string().max(5000).parse(String(form.get("notes") ?? "")).trim();
  const { error } = await createAdminClient().from("leads").update({ notes: notes || null }).eq("id", leadId);
  if (error) throw new Error("Couldn't save the notes.");
  revalidatePath(`/admin/leads/${leadId}`);
}

export async function deleteLead(form: FormData) {
  await requireAdmin();
  const leadId = id.parse(form.get("id"));
  if (form.get("confirm") !== "DELETE") redirect(`/admin/leads/${leadId}?confirm=1&error=confirm`);
  const { error } = await createAdminClient().from("leads").delete().eq("id", leadId);
  if (error) throw new Error("Couldn't delete the lead.");
  revalidatePath("/admin/leads");
  redirect("/admin/leads?deleted=1");
}

export type SaveSettingsState = { status: "idle" | "saved" | "error"; errors?: Record<string, string>; at?: string };

export async function saveSettings(_prev: SaveSettingsState, form: FormData): Promise<SaveSettingsState> {
  const admin = await requireAdmin();
  let raw: unknown;
  try {
    raw = JSON.parse(String(form.get("payload") ?? ""));
  } catch {
    return { status: "error", errors: { _: "The form couldn't be read. Reload and try again." } };
  }
  const payload = z.object({ settings: z.unknown(), team_notify_emails: z.array(z.string()) }).safeParse(raw);
  if (!payload.success) return { status: "error", errors: { _: "The form couldn't be read. Reload and try again." } };

  const parsed = settingsSchema.safeParse(payload.data.settings);
  const errors: Record<string, string> = {};
  if (!parsed.success) for (const i of parsed.error.issues) errors[i.path.join(".")] ??= i.message;
  if (parsed.success && parsed.data.show_mrp && parsed.data.mrp <= parsed.data.price)
    errors.mrp = "MRP must be higher than the pre-order price to be shown.";
  const emails = payload.data.team_notify_emails.map((e) => e.trim().toLowerCase()).filter(Boolean);
  const badEmail = emails.find((e) => !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e));
  if (badEmail) errors.team_notify_emails = `"${badEmail}" isn't a valid email.`;
  if (emails.length > 20) errors.team_notify_emails = "Up to 20 notification emails.";
  if (!parsed.success || Object.keys(errors).length) return { status: "error", errors };

  const db = createAdminClient();
  const now = new Date().toISOString();
  const [a, b] = await Promise.all([
    db.from("settings").upsert({ id: 1, data: parsed.data }),
    db.from("settings_ops").upsert({ id: 1, team_notify_emails: [...new Set(emails)], updated_by: admin.email, updated_at: now }),
  ]);
  if (a.error || b.error) {
    console.error("[admin] settings save failed:", a.error?.message, b.error?.message);
    return { status: "error", errors: { _: "Saving failed. Check the values and try again." } };
  }
  revalidateTag(SETTINGS_TAG);
  revalidatePath("/", "layout");
  return { status: "saved", at: now };
}
