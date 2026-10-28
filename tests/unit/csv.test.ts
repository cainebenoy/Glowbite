import { describe, expect, it } from "vitest";
import { BOM, csvCell, toCsv } from "@/lib/csv";
import { isoIST } from "@/lib/time";

describe("csv", () => {
  it("quotes commas, quotes and newlines", () => {
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("line1\nline2")).toBe('"line1\nline2"');
  });
  it("renders null/undefined as empty and objects as JSON", () => {
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
    expect(csvCell({ utm_source: "ig" })).toBe('"{""utm_source"":""ig""}"');
  });
  it("neutralises spreadsheet formulas", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell("+cmd|x")).toBe("'+cmd|x");
    expect(csvCell("-2+3+cmd")).toBe("'-2+3+cmd");
    expect(csvCell("+91 98765 43210")).toBe("+91 98765 43210");
    expect(csvCell("@x")).toBe("'@x");
  });
  it("starts with a UTF-8 BOM and uses CRLF", () => {
    const out = toCsv(["a", "b"], [[1, "₹1,299"]]);
    expect(out.startsWith(BOM)).toBe(true);
    expect(out).toBe(`${BOM}a,b\r\n1,"₹1,299"\r\n`);
  });
  it("formats IST timestamps", () => {
    expect(isoIST("2026-10-29T18:45:00Z")).toBe("2026-10-30 00:15:00");
  });
});
