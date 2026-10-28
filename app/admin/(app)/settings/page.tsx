import { createAdminClient } from "@/lib/supabase/admin";
import { parseSettings } from "@/lib/settings";
import { formatIST } from "@/lib/time";
import { SettingsForm } from "./SettingsForm";

export default async function SettingsPage() {
  const db = createAdminClient();
  const [{ data: row, error: e1 }, { data: ops, error: e2 }] = await Promise.all([
    db.from("settings").select("data, updated_at").eq("id", 1).maybeSingle(),
    db.from("settings_ops").select("team_notify_emails, updated_by, updated_at").eq("id", 1).maybeSingle(),
  ]);
  if (e1 || e2) throw e1 ?? e2;
  const settings = parseSettings(row?.data);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h1 className="text-2xl font-light">Settings</h1>
        <p className="text-sm text-ink-45">
          {ops?.updated_by ? (
            <>
              Last changed by {ops.updated_by} on {formatIST(ops.updated_at)}
            </>
          ) : (
            "Not changed since setup"
          )}
        </p>
      </div>
      <p className="max-w-3xl text-sm text-ink-70">
        Everything on the public page comes from here. Claim gates stay off until the claim is confirmed; while off, the claim
        isn&apos;t shown anywhere on the site. Saving updates the live page within a few seconds.
      </p>
      <SettingsForm initial={settings} initialEmails={ops?.team_notify_emails ?? []} />
    </div>
  );
}
