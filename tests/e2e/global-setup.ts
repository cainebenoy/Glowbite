// Ensures the e2e admin (allowlisted) and intruder (not allowlisted) users exist, and settings are at seed defaults.
import { DEFAULT_SETTINGS } from "../../lib/settings";
import { INTRUDER, service, TEST_ADMIN } from "./helpers";

export default async function globalSetup() {
  const db = service();
  const { error } = await db.from("admins").upsert({ email: TEST_ADMIN });
  if (error) throw new Error(`Is local Supabase running and .env.local filled in? ${error.message}`);
  await db.from("admins").delete().eq("email", INTRUDER);
  for (const email of [TEST_ADMIN, INTRUDER]) {
    const { error: e } = await db.auth.admin.createUser({ email, email_confirm: true });
    if (e && !/already/i.test(e.message)) throw e;
  }
  await db.from("settings").upsert({ id: 1, data: DEFAULT_SETTINGS });
}
