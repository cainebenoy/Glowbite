"use server";
import { headers } from "next/headers";
import { createSessionClient } from "@/lib/supabase/server";
import { isAllowlisted } from "@/lib/admin-auth";

export type LoginState = { status: "idle" | "sent" | "error"; message?: string };

export async function sendMagicLink(_prev: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get("email") || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { status: "error", message: "Enter a valid email address." };

  // Only allowlisted admins get a link. The reply is the same either way, so the allowlist isn't revealed.
  const sent: LoginState = { status: "sent", message: "If this email is on the admin list, a sign-in link is on its way. Check your inbox." };
  try {
    if (!(await isAllowlisted(email))) return sent;
  } catch (e) {
    console.error("[admin] allowlist check failed:", e);
    return { status: "error", message: "Sign-in is unavailable right now. Try again shortly." };
  }

  const h = await headers();
  const origin = process.env.NEXT_PUBLIC_SITE_URL || `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const supabase = await createSessionClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false, emailRedirectTo: `${origin.replace(/\/$/, "")}/admin/auth/callback` },
  });
  if (error) console.error("[admin] magic link failed:", error.message);
  return sent;
}
