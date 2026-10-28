// CSV export of the current filter. Admin only (route handlers aren't covered by the layout guard).
import { NextResponse } from "next/server";
import { getAdmin } from "@/lib/admin-auth";
import { leadsQuery, parseFilters, type LeadRow } from "@/lib/admin-leads";
import { toCsv } from "@/lib/csv";
import { isoIST } from "@/lib/time";

export const dynamic = "force-dynamic";

const HEADER = [
  "received_ist",
  "full_name",
  "phone",
  "email",
  "pin_code",
  "quantity",
  "marketing_opt_in",
  "status",
  "price_shown",
  "notes",
  "source",
  "utm",
  "consent_text_version",
  "updated_ist",
  "id",
];

export async function GET(request: Request) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "unauthorised" }, { status: 401 });

  const url = new URL(request.url);
  const f = parseFilters(Object.fromEntries(url.searchParams));
  const { data, error } = await leadsQuery(f).limit(50000);
  if (error) return NextResponse.json({ error: "export failed" }, { status: 500 });
  const rows = (data ?? []) as unknown as LeadRow[];

  const csv = toCsv(
    HEADER,
    rows.map((r) => [
      isoIST(r.created_at),
      r.full_name,
      r.phone.replace(/^\+91(\d{5})(\d{5})$/, "+91 $1 $2"), // spaced so spreadsheets keep it as text
      r.email,
      r.pin_code,
      r.quantity,
      r.marketing_opt_in ? "yes" : "no",
      r.status,
      r.price_shown,
      r.notes,
      r.source,
      Object.keys(r.utm ?? {}).length ? r.utm : "",
      r.consent_text_version,
      isoIST(r.updated_at),
      r.id,
    ]),
  );
  const stamp = isoIST(new Date()).slice(0, 16).replace(/[: ]/g, "-");
  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="glowbite-leads-${stamp}.csv"`,
      "cache-control": "no-store",
    },
  });
}
