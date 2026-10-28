import Link from "next/link";
import { filterQuery, leadsQuery, PAGE_SIZE, parseFilters, STATUSES, type LeadRow } from "@/lib/admin-leads";
import { formatIST } from "@/lib/time";
import { StatusSelect } from "./StatusSelect";

export default async function LeadsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const f = parseFilters(sp);
  const from = (f.page! - 1) * PAGE_SIZE;
  const { data, count, error } = await leadsQuery(f, "id, created_at, full_name, phone, pin_code, quantity, marketing_opt_in, status", {
    count: "exact",
  }).range(from, from + PAGE_SIZE - 1);
  if (error) throw error;
  const rows = (data ?? []) as unknown as LeadRow[];
  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const qs = filterQuery(f);
  const pageHref = (p: number) => `/admin/leads?${[qs, `page=${p}`].filter(Boolean).join("&")}`;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-light">Leads</h1>
        <a href={`/admin/export${qs ? `?${qs}` : ""}`} className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-[#07090c]">
          Export CSV{qs ? " (filtered)" : ""}
        </a>
      </div>
      {sp.deleted && (
        <p role="status" className="rounded-xl border border-line bg-panel px-4 py-2 text-sm text-ink-70">
          Lead deleted.
        </p>
      )}
      <form className="flex flex-wrap items-end gap-3 text-sm" role="search">
        <label className="flex flex-col gap-1">
          <span className="text-ink-45">Search name, phone or PIN</span>
          <input name="q" defaultValue={f.q} className="w-64 rounded-lg border border-white/15 bg-panel px-3 py-2" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-ink-45">Status</span>
          <select name="status" defaultValue={f.status ?? ""} className="rounded-lg border border-white/15 bg-panel px-3 py-2">
            <option value="">All</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-ink-45">Marketing opt-in</span>
          <select name="optin" defaultValue={f.optin ?? ""} className="rounded-lg border border-white/15 bg-panel px-3 py-2">
            <option value="">All</option>
            <option value="yes">Opted in</option>
            <option value="no">Not opted in</option>
          </select>
        </label>
        <button className="rounded-lg border border-white/25 px-4 py-2">Filter</button>
        {qs && (
          <Link href="/admin/leads" className="py-2 text-ink-70 underline">
            Clear
          </Link>
        )}
      </form>

      {rows.length === 0 ? (
        <p className="rounded-2xl border border-line bg-panel p-6 text-ink-70">{qs ? "No leads match these filters." : "No leads yet."}</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-panel text-left text-xs uppercase tracking-[0.15em] text-ink-45">
              <tr>
                <th className="px-3 py-2 font-medium">Received (IST)</th>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Mobile</th>
                <th className="px-3 py-2 font-medium">PIN</th>
                <th className="px-3 py-2 font-medium">Qty</th>
                <th className="px-3 py-2 font-medium">Opt-in</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-line hover:bg-white/[.03]">
                  <td className="whitespace-nowrap px-3 py-2 text-ink-70">{formatIST(r.created_at)}</td>
                  <td className="px-3 py-2">
                    <Link href={`/admin/leads/${r.id}`} className="underline-offset-2 hover:underline">
                      {r.full_name}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums">{r.phone}</td>
                  <td className="px-3 py-2 tabular-nums">{r.pin_code}</td>
                  <td className="px-3 py-2 tabular-nums">{r.quantity}</td>
                  <td className="px-3 py-2">{r.marketing_opt_in ? "Yes" : "No"}</td>
                  <td className="px-3 py-2">
                    <StatusSelect id={r.id} status={r.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex items-center justify-between text-sm text-ink-70">
        <span>
          {total} lead{total === 1 ? "" : "s"}
        </span>
        {pages > 1 && (
          <nav className="flex items-center gap-3" aria-label="Pagination">
            {f.page! > 1 && <Link href={pageHref(f.page! - 1)}>← Newer</Link>}
            <span>
              Page {f.page} of {pages}
            </span>
            {f.page! < pages && <Link href={pageHref(f.page! + 1)}>Older →</Link>}
          </nav>
        )}
      </div>
    </div>
  );
}
