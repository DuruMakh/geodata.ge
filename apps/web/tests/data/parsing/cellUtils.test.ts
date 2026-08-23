import { describe, expect, it } from "vitest";
import { cellText, normalizeSheetName, numericCell, pickSheetName } from "../../../lib/data/parsing/cellUtils";

describe("cellText", () => {
  it("returns an empty string for null and undefined", () => {
    expect(cellText(null)).toBe("");
    expect(cellText(undefined)).toBe("");
  });

  it("stringifies and trims values", () => {
    expect(cellText("  სულ ჯამი  ")).toBe("სულ ჯამი");
    expect(cellText(12.5)).toBe("12.5");
    expect(cellText(false)).toBe("false");
  });
});

describe("numericCell", () => {
  it("parses plain and comma-formatted numbers", () => {
    expect(numericCell(110)).toBe(110);
    expect(numericCell("15,923,792.9")).toBe(15923792.9);
    expect(numericCell("-214.68")).toBe(-214.68);
    expect(numericCell(0)).toBe(0);
  });

  it("returns null for blank and non-numeric values", () => {
    expect(numericCell(null)).toBeNull();
    expect(numericCell(undefined)).toBeNull();
    expect(numericCell("")).toBeNull();
    expect(numericCell("ხარჯები")).toBeNull();
  });

  it("keeps percent values as-is by default (realExpenditure behavior)", () => {
    expect(numericCell("101.6%")).toBe(101.6);
    expect(numericCell("99%")).toBe(99);
  });

  it("does not strip inner whitespace by default (realExpenditure behavior)", () => {
    expect(numericCell("1 000")).toBeNull();
  });

  it("strips regular and non-breaking spaces when stripWhitespace is set (adminSpending behavior)", () => {
    expect(numericCell("1 000", { stripWhitespace: true })).toBe(1000);
    expect(numericCell("3 01,056,407", { stripWhitespace: true })).toBe(301056407);
    expect(numericCell("1\u00a0234.5", { stripWhitespace: true })).toBe(1234.5);
  });

  it("converts trailing percents to fractions in fraction mode (realRevenue behavior)", () => {
    expect(numericCell("99%", { stripWhitespace: true, percentMode: "fraction" })).toBe(0.99);
    expect(numericCell("1.09", { stripWhitespace: true, percentMode: "fraction" })).toBe(1.09);
    expect(numericCell(1.09, { stripWhitespace: true, percentMode: "fraction" })).toBe(1.09);
  });

  it("keeps the historical behavior for a bare percent sign", () => {
    // Number("") === 0 once the trailing % is removed; preserved from the original parsers.
    expect(numericCell("%")).toBe(0);
  });
});

describe("normalizeSheetName", () => {
  it("lowercases, trims, and collapses whitespace", () => {
    expect(normalizeSheetName("  VI  თავი ")).toBe("vi თავი");
    expect(normalizeSheetName("Tavi 6")).toBe("tavi 6");
  });
});

describe("pickSheetName", () => {
  const workbook = { SheetNames: ["ბალანსი", "VI თავი", "tavi I"] };

  it("returns the first preferred sheet that exists (normalized match)", () => {
    expect(pickSheetName(workbook, { preferredNames: ["missing", "vi  თავი"] })).toBe("VI თავი");
  });

  it("falls back to a pattern match when no preferred name exists", () => {
    expect(
      pickSheetName(workbook, {
        preferredNames: ["missing"],
        fallbackPattern: (normalized) => normalized.includes("vi თავი"),
      }),
    ).toBe("VI თავი");
  });

  it("falls back to the first sheet when defaultToFirstSheet is set (adminSpending behavior)", () => {
    expect(pickSheetName(workbook, { fallbackPattern: () => false, defaultToFirstSheet: true })).toBe("ბალანსი");
  });

  it("throws a descriptive error when nothing matches (realRevenue behavior)", () => {
    expect(() => pickSheetName(workbook, { preferredNames: ["missing"], sheetDescription: "revenue sheet" })).toThrow(
      "Could not find revenue sheet. Available sheets: ბალანსი, VI თავი, tavi I",
    );
  });

  it("throws instead of returning undefined when the workbook has no sheets", () => {
    expect(() =>
      pickSheetName({ SheetNames: [] }, { defaultToFirstSheet: true, sheetDescription: "revenue sheet" }),
    ).toThrow("Could not find revenue sheet. Available sheets: ");
  });
});
