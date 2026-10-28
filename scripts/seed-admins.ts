// Seeds the admin allowlist from ADMIN_EMAILS and makes sure each admin has an auth user
// (sign-ups are disabled, so magic links only work for existing users).
// Run after `supabase db reset` (pnpm db:reset does this). Reads .env.local.
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });
config();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const emails = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

async function main() {
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  if (!emails.length) {
    console.warn("ADMIN_EMAILS is empty; no admins seeded");
    return;
  }
  const db = createClient(url, key, { auth: { persistSession: false } });
  const { error } = await db.from("admins").upsert(emails.map((email) => ({ email })));
  if (error) throw error;
  for (const email of emails) {
    const { error: e } = await db.auth.admin.createUser({ email, email_confirm: true });
    if (e && !/already/i.test(e.message)) throw e;
  }
  console.log(`seeded ${emails.length} admin(s): ${emails.join(", ")}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
