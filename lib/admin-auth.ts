// Admin guard. Call in the admin layout AND inside every admin server action / route handler:
// layouts do not protect actions or route handlers.
import "server-only";
import { redirect } from "next/navigation";
import { createSessionClient } from "./supabase/server";
import { createAdminClient } from "./supabase/admin";

export type AdminUser = { id: string; email: string };

export async function isAllowlisted(email: string): Promise<boolean> {
  const { data, error } = await createAdminClient()
    .from("admins")
    .select("email")
    .eq("email", email.toLowerCase())
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

/** Returns the signed-in admin, or null (signing out a non-allowlisted session). */
export async function getAdmin(): Promise<AdminUser | null> {
  const supabase = await createSessionClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user?.email) return null;
  if (!(await isAllowlisted(user.email))) {
    await supabase.auth.signOut();
    return null;
  }
  return { id: user.id, email: user.email.toLowerCase() };
}

/** For pages and actions: redirects to login when not an admin. */
export async function requireAdmin(): Promise<AdminUser> {
  const supabase = await createSessionClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user?.email) redirect("/admin/login");
  const admin = await getAdmin();
  if (!admin) redirect("/admin/auth/signout?error=not_authorised");
  return admin;
}
