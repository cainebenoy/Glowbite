// CSV building for the admin export. RFC 4180 quoting, UTF-8 BOM for Excel,
// and a guard against spreadsheet formula injection.
export const BOM = "﻿";

export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let s = typeof value === "object" ? JSON.stringify(value) : String(value);
  // A leading = @ tab or CR, or a +/- that isn't just a signed number (e.g. "+91 98765 43210"), could run as a formula.
  if (/^[=@\t\r]/.test(s) || /^[+-](?![\d ]+$)/.test(s)) s = "'" + s;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: string[], rows: unknown[][]): string {
  return BOM + [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
