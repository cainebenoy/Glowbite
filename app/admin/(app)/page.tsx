// Overview: real numbers only, empty states when there are none.
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { dayKeyIST, startOfTodayIST } from "@/lib/time";

type Row = { created_at: string; marketing_opt_in: boolean; quantity: number; pin_code: string };

export default async function Overview() {
  const { data, error } = await createAdminClient()
    .from("leads")
    .select("created_at, marketing_opt_in, quantity, pin_code")
    .order("created_at", { ascending: false })
    .limit(50000);
  if (error) throw error;
  const rows = (data ?? []) as Row[];

  const total = rows.length;
  const todayStart = startOfTodayIST().getTime();
  const today = rows.filter((r) => new Date(r.created_at).getTime() >= todayStart).length;
  const optIns = rows.filter((r) => r.marketing_opt_in).length;
  const qty = rows.reduce((a, r) => a + r.quantity, 0);

  // last 7 IST days, oldest first
  const days = Array.from({ length: 7 }, (_, i) => dayKeyIST(new Date(todayStart - (6 - i) * 86400_000 + 3600_000)));
  const perDay = new Map(days.map((d) => [d, 0]));
  for (const r of rows) {
    const k = dayKeyIST(r.created_at);
    if (perDay.has(k)) perDay.set(k, perDay.get(k)! + 1);
  }
  const week = days.map((d) => ({ d, n: perDay.get(d)! }));
  const weekTotal = week.reduce((a, w) => a + w.n, 0);
  const max = Math.max(1, ...week.map((w) => w.n));

  const prefixes = new Map<string, number>();
  for (const r of rows) prefixes.set(r.pin_code.slice(0, 3), (prefixes.get(r.pin_code.slice(0, 3)) ?? 0) + 1);
  const top = [...prefixes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);

  const Stat = ({ label, value, hint }: { label: string; value: string; hint?: string }) => (
    <div className="rounded-2xl border border-line bg-panel p-4">
      <div className="text-xs font-medium uppercase tracking-[0.2em] text-ink-45">{label}</div>
      <div className="mt-2 text-3xl font-extralight tracking-tight">{value}</div>
      {hint && <div className="mt-1 text-xs text-ink-45">{hint}</div>}
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-light">Overview</h1>
      {total === 0 ? (
        <p className="rounded-2xl border border-line bg-panel p-6 text-ink-70">
          No leads yet. When someone joins the pre-order list, they&apos;ll appear here and under{" "}
          <Link className="underline" href="/admin/leads">
            Leads
          </Link>
          .
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <Stat label="Total leads" value={String(total)} />
            <Stat label="Today" value={String(today)} hint="IST" />
            <Stat label="Last 7 days" value={String(weekTotal)} />
            <Stat label="Opt-in rate" value={`${Math.round((optIns / total) * 100)}%`} hint={`${optIns} of ${total}`} />
            <Stat label="Units requested" value={String(qty)} />
          </div>
          <div className="grid gap-6 md:grid-cols-[2fr_1fr]">
            <section className="rounded-2xl border border-line bg-panel p-4">
              <h2 className="text-sm text-ink-70">Leads per day, last 7 days (IST)</h2>
              <svg viewBox="0 0 350 140" className="mt-3 w-full" role="img" aria-label={week.map((w) => `${w.d}: ${w.n}`).join(", ")}>
                {week.map((w, i) => {
                  const h = (w.n / max) * 100;
                  return (
                    <g key={w.d}>
                      <rect x={i * 50 + 8} y={110 - h} width={34} height={Math.max(h, 1)} rx={3} fill={w.n ? "#F4F6F8" : "rgba(255,255,255,.12)"} />
                      <text x={i * 50 + 25} y={104 - h} textAnchor="middle" fontSize="11" fill="rgba(236,241,245,.68)">
                        {w.n || ""}
                      </text>
                      <text x={i * 50 + 25} y={128} textAnchor="middle" fontSize="10" fill="rgba(236,241,245,.42)">
                        {w.d.slice(5)}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </section>
            <section className="rounded-2xl border border-line bg-panel p-4">
              <h2 className="text-sm text-ink-70">Top PIN prefixes</h2>
              <table className="mt-3 w-full text-sm">
                <tbody>
                  {top.map(([p, n]) => (
                    <tr key={p} className="border-b border-line last:border-0">
                      <td className="py-1.5 tabular-nums">{p}xxx</td>
                      <td className="py-1.5 text-right tabular-nums text-ink-70">{n}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
