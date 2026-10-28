import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import type { LeadRow } from "@/lib/admin-leads";
import { formatIST } from "@/lib/time";
import { inr } from "@/lib/settings";
import { deleteLead, saveLeadNotes } from "../../actions";
import { StatusSelect } from "../StatusSelect";

export default async function LeadDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ confirm?: string; error?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data, error } = await createAdminClient().from("leads").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) notFound();
  const l = data as LeadRow;

  const rows: [string, React.ReactNode][] = [
    ["Mobile", l.phone],
    ["Email", l.email ?? "—"],
    ["PIN code", l.pin_code],
    ["Quantity", l.quantity],
    ["Marketing opt-in", l.marketing_opt_in ? "Yes" : "No"],
    ["Price shown", l.price_shown != null ? inr(l.price_shown) : "—"],
    ["Consent text version", l.consent_text_version],
    ["Received", formatIST(l.created_at)],
    ["Last updated", formatIST(l.updated_at)],
    ["Source", l.source ?? "—"],
    ["UTM", Object.keys(l.utm ?? {}).length ? Object.entries(l.utm).map(([k, v]) => `${k}=${v}`).join(", ") : "—"],
    ["Referrer", l.referrer ?? "—"],
    ["User agent", l.user_agent ?? "—"],
    ["Lead ID", l.id],
  ];

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Link href="/admin/leads" className="text-sm text-ink-70">
        ← All leads
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-light">{l.full_name}</h1>
        <StatusSelect id={l.id} status={l.status} />
      </div>
      <dl className="grid grid-cols-[minmax(120px,180px)_1fr] gap-x-4 gap-y-2 rounded-2xl border border-line bg-panel p-4 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-ink-45">{k}</dt>
            <dd className="break-words">{v}</dd>
          </div>
        ))}
      </dl>

      <form action={saveLeadNotes} className="flex flex-col gap-2">
        <input type="hidden" name="id" value={l.id} />
        <label htmlFor="notes" className="text-sm text-ink-70">
          Notes (internal)
        </label>
        <textarea id="notes" name="notes" defaultValue={l.notes ?? ""} rows={5} maxLength={5000} className="rounded-xl border border-white/15 bg-panel p-3" />
        <button className="self-start rounded-full bg-ink px-4 py-2 text-sm font-medium text-[#07090c]">Save notes</button>
      </form>

      <section className="rounded-2xl border border-err/30 p-4">
        <h2 className="text-sm font-medium">Delete this lead</h2>
        <p className="mt-1 text-sm text-ink-70">For data-removal requests. This permanently deletes the record and can&apos;t be undone.</p>
        {sp.confirm ? (
          <form action={deleteLead} className="mt-3 flex flex-wrap items-end gap-3">
            <input type="hidden" name="id" value={l.id} />
            <label className="flex flex-col gap-1 text-sm">
              <span>
                Type <b>DELETE</b> to confirm
              </span>
              <input name="confirm" autoComplete="off" className="rounded-lg border border-white/15 bg-panel px-3 py-2" />
            </label>
            <button className="rounded-full bg-err px-4 py-2 text-sm font-medium text-black">Delete permanently</button>
            <Link href={`/admin/leads/${l.id}`} className="py-2 text-sm text-ink-70 underline">
              Cancel
            </Link>
            {sp.error === "confirm" && (
              <p role="alert" className="w-full text-sm text-err">
                Type DELETE exactly to confirm.
              </p>
            )}
          </form>
        ) : (
          <Link href={`/admin/leads/${l.id}?confirm=1`} className="mt-3 inline-block rounded-full border border-err/50 px-4 py-2 text-sm text-err">
            Delete…
          </Link>
        )}
      </section>
    </div>
  );
}
