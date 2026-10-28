// IST formatting helpers (admin, CSV, emails).
const fmt = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
export const formatIST = (iso: string | Date) => fmt.format(new Date(iso)) + " IST";

/** "YYYY-MM-DD HH:mm:ss" in IST — sortable, Excel-friendly. */
export function isoIST(iso: string | Date): string {
  const d = new Date(new Date(iso).getTime() + 5.5 * 3600_000);
  return d.toISOString().replace("T", " ").slice(0, 19);
}

/** Start of "today" in IST as a UTC Date. */
export function startOfTodayIST(now = new Date()): Date {
  const ist = new Date(now.getTime() + 5.5 * 3600_000);
  ist.setUTCHours(0, 0, 0, 0);
  return new Date(ist.getTime() - 5.5 * 3600_000);
}

/** IST calendar date key "YYYY-MM-DD". */
export const dayKeyIST = (iso: string | Date) => isoIST(iso).slice(0, 10);
