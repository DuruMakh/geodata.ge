import { describe, expect, it } from "vitest";
import { CRAWL_CELL_CAP, crawlTables, formatCrawlCell } from "../../lib/explorer/crawlTables";
import type { WorkbookExportModel, WorkbookReadableRow } from "../../lib/explorer/workbookModel";
import { workbookMessage } from "../../lib/i18n/workbook";
import en from "../../lib/i18n/messages/en/controls.json";

type Readable = WorkbookExportModel["readable"];

const row = (label: string, values: (number | null)[], years: number[], extra: Partial<WorkbookReadableRow> = {}): WorkbookReadableRow => ({
  kind: "item", parentLabel: null, label, change: null,
  valuesByYear: Object.fromEntries(years.map((y, i) => [y, values[i] ?? null])),
  basisByYear: Object.fromEntries(years.map((y, i) => [y, values[i] == null ? null : "actual"])),
  ...extra,
});
const model = (readable: Partial<Readable> & Pick<Readable, "years" | "rows">): WorkbookExportModel => ({
  locale: "en", filename: "x.xlsx", sheetNames: ["Summary", "Data", "Sources"],
  readable: { title: "T", subtitle: "S", unitLabel: "GEL", ...readable },
  analysis: { headers: [], rows: [] }, sources: [],
});
const years = (n: number) => Array.from({ length: n }, (_, i) => 2000 + i);

describe("formatCrawlCell", () => {
  it.each([
    [1234.56, "actual", "#,##0.0", "1,234.6"],
    [0.139, "actual", "0.0%", "13.9%"],
    [-1.25, "actual", "#,##0.00;[Red](#,##0.00);–", "−1.25"],
    [0.4, "actual", "+0.0;−0.0;0.0", "+0.4"],
    [0.5, "actual", "0.0#", "0.5"],
    [null, null, "0.0", "—"],
    [5, "not_available", "0.0", "—"],
  ] as const)("%s %s %s", (v, b, f, out) => expect(formatCrawlCell(v, b, f, "en")).toBe(out));

  it.each(["planned", "preliminary", "forecast"] as const)("marks %s", (basis) => {
    expect(formatCrawlCell(30.9, basis, "#,##0.0", "en")).toBe(`30.9 (${workbookMessage("en", `workbook.${basis}`).toLowerCase()})`);
  });
});

describe("crawlTables", () => {
  it("handles empty input and empty models", () => {
    expect(crawlTables([], en)).toEqual([]);
    expect(crawlTables([model({ years: [2020], rows: [] })], en)).toEqual([]);
  });

  it("builds caption, columns, cells and per-row formats", () => {
    const y = [2020, 2021];
    const [t] = crawlTables([model({ years: y, unitLabel: "GEL million", rows: [
      row("A", [1000, 2000.55], y),
      row("B", [0.5, 0.25], y, { numberFormat: "0.0%" }),
      row("C", [1, 2], y, { numberFormatByYear: { 2021: "0.00" } }),
    ] })], en);
    expect(t.caption).toBe("T · S");
    expect(t.columns).toEqual(["2020", "2021"]);
    expect(t.rows).toEqual([
      { label: "A", cells: ["1,000.0", "2,000.6"] },
      { label: "B", cells: ["50.0%", "25.0%"] },
      { label: "C", cells: ["1.0", "2.00"] },
    ]);
  });

  it("defaults to a percentage format when the unit has %", () => {
    const [t] = crawlTables([model({ years: [2020], unitLabel: "% of GDP", rows: [row("A", [0.139], [2020])] })], en);
    expect(t.rows[0].cells).toEqual(["13.9%"]);
  });

  it("caps cells, keeping the total first and the largest items in order", () => {
    const y = years(20);
    const total: WorkbookReadableRow = { ...row("Total", y.map(() => 1), y), kind: "total" };
    const items = Array.from({ length: 300 }, (_, i) => row(`I${i}`, y.map(() => (i * 7) % 300), y));
    const [t] = crawlTables([model({ years: y, rows: [total, ...items] })], en);
    expect(t.rows.length * 20).toBeLessThanOrEqual(CRAWL_CELL_CAP);
    expect(t.rows[0].label).toBe("Total");
    const keptItems = t.rows.slice(1).map((r) => Number(r.label.slice(1)));
    expect([...keptItems].sort((a, b) => a - b)).toEqual(keptItems);
    const min = Math.min(...keptItems.map((i) => (i * 7) % 300));
    const dropped = items.filter((r) => !t.rows.some((k) => k.label === r.label));
    expect(Math.max(...dropped.map((r) => r.valuesByYear[2000] as number))).toBeLessThanOrEqual(min);
    expect(t.caption.endsWith(`top ${keptItems.length} of 300; all of them in the Excel download`)).toBe(true);
  });

  it("shares the cap between models", () => {
    const y = years(10);
    const big = () => model({ years: y, rows: Array.from({ length: 500 }, (_, i) => row(`R${i}`, y.map(() => i), y)) });
    const [a, b] = crawlTables([big(), big()], en);
    expect(a.rows.length).toBe(150);
    expect(b.rows.length).toBe(150);
  });

  it("keeps the last 36 month columns", () => {
    const y = years(60);
    const cols = y.map((v) => `M${v}`);
    const [t] = crawlTables([model({ years: y, headerLabels: { category: "c", columns: cols }, rows: [row("A", y.map((_, i) => i), y)] })], en);
    expect(t.columns).toEqual(cols.slice(24));
    expect(t.rows[0].cells).toHaveLength(36);
    expect(t.rows[0].cells[35]).toBe("59.0");
    const [short] = crawlTables([model({ years: years(30), headerLabels: { category: "c", columns: years(30).map(String) }, rows: [row("A", [], years(30))] })], en);
    expect(short.columns).toHaveLength(30);
  });
});
