import { describe, expect, it } from "vitest";
import { makePeriod } from "../../lib/data/inflation/periods";
import { CRAWL_CELL_CAP, CRAWL_MAX_DECIMALS, CRAWL_MONTH_COLUMNS, crawlCaption, crawlTables, crawlTablesHtml, formatCrawlCell } from "../../lib/explorer/crawlTables";
import { lastPeriodsRange } from "../../lib/explorer/periodRange";
import { readableRowLabel, type WorkbookExportModel, type WorkbookReadableRow } from "../../lib/explorer/workbookModel";
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
    // A negative that rounds to zero digits carries no minus sign.
    [-0.04, "actual", "#,##0.0", "0.0"],
    [-0.00004, "actual", "0.0%", "0.0%"],
    [-0.01, "actual", "+0.0;−0.0;0.0", "0.0"],
    [-0.05, "actual", "#,##0.0", "−0.1"],
  ] as const)("%s %s %s", (v, b, f, out) => expect(formatCrawlCell(v, b, f, "en")).toBe(out));

  it.each([
    // Signed trade amounts keep 9 decimals in Excel; a crawl cell prints at most three.
    [1.234567891, "#,##0.000000000;\"−\"#,##0.000000000", "1.235"],
    [-0.00012, "#,##0.00000;\"−\"#,##0.00000", "0.000"],
    [0.5, "0.0####", "0.5"],
    [2.71828, "0.00#####", "2.718"],
    [0.123456, "0.00000%", "12.346%"],
  ] as const)("prints %s with %s to at most three decimals", (value, format, out) => {
    expect(CRAWL_MAX_DECIMALS).toBe(3);
    expect(formatCrawlCell(value, "actual", format, "en")).toBe(out);
  });

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
    expect(t.caption).toBe("T · GEL million · 2020–2021 · Actual");
    expect(t.columns).toEqual(["2020", "2021"]);
    expect(t.rows).toEqual([
      { label: "A", cells: ["1,000.0", "2,000.6"] },
      { label: "B", cells: ["50.0%", "25.0%"] },
      { label: "C", cells: ["1.0", "2.00"] },
    ]);
  });

  it("carries the workbook's own label-column heading, and none without one", () => {
    const y = [2020];
    const [named] = crawlTables([model({ years: y, headerLabels: { category: "Region", columns: ["2020"] }, rows: [row("A", [1], y)] })], en);
    expect(named.category).toBe("Region");
    const [plain] = crawlTables([model({ years: y, rows: [row("A", [1], y)] })], en);
    expect(plain).not.toHaveProperty("category");
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

  it("a capped table gives no slot to a series with no figure in any year; an uncapped one keeps it", () => {
    const y = years(20);
    const empty = (i: number) => row(`E${i}`, y.map(() => null), y);
    const unavailable = (i: number) => row(`U${i}`, y.map(() => 5), y, { basisByYear: Object.fromEntries(y.map((year) => [year, "not_available"])) });
    // 250 series, 150 slots, 100 series with figures: the free slots stay empty (and their cells go to later tables).
    const rows = [...Array.from({ length: 100 }, (_, i) => empty(i)), ...Array.from({ length: 50 }, (_, i) => unavailable(i)), ...Array.from({ length: 100 }, (_, i) => row(`I${i}`, y.map(() => i), y))];
    const [t] = crawlTables([model({ years: y, rows })], en);
    expect(t.rows.map((r) => r.label)).toEqual(Array.from({ length: 100 }, (_, i) => `I${i}`));
    expect(t.caption.endsWith("top 100 of 250; all of them in the Excel download")).toBe(true);
    // Beside a second table: 75 slots each, 50 series with figures here, so the next table gets the other 25 slots' cells.
    const [half, next] = crawlTables([model({ years: y, rows: rows.slice(0, 200) }), model({ years: y, rows: Array.from({ length: 200 }, (_, i) => row(`N${i}`, y.map(() => i), y)) })], en);
    expect(half.rows).toHaveLength(50);
    expect(next.rows).toHaveLength((CRAWL_CELL_CAP - 50 * 20) / 20);

    const [few] = crawlTables([model({ years: y, rows: [empty(0), row("A", y.map(() => 1), y)] })], en);
    expect(few.rows.map((r) => r.label)).toEqual(["E0", "A"]);
    expect(few.caption).not.toContain("top");
  });

  it("shares the cap between models", () => {
    const y = years(10);
    const big = () => model({ years: y, rows: Array.from({ length: 500 }, (_, i) => row(`R${i}`, y.map(() => i), y)) });
    const [a, b] = crawlTables([big(), big()], en);
    expect(a.rows.length).toBe(150);
    expect(b.rows.length).toBe(150);
  });

  it("keeps every column of a yearly table with header labels", () => {
    const y = years(40);
    const cols = y.map((v) => `${v}*`);
    const [t] = crawlTables([model({ years: y, headerLabels: { category: "c", columns: cols }, rows: [row("A", y.map((_, i) => i), y)] })], en);
    expect(t.columns).toEqual(cols);
    expect(t.rows[0].cells).toHaveLength(40);
    expect(t.rows[0].cells[0]).toBe("0.0");
    expect(t.rows[0].cells[39]).toBe("39.0");
  });

  it("prints an item under a parent as the Excel Summary sheet does", () => {
    const y = [2020];
    const rows = [
      row("Total", [3], y, { kind: "total", parentLabel: "Total" }),
      row("Programme", [1], y, { parentLabel: "Ministry" }),
      row("Alone", [2], y),
    ];
    const [t] = crawlTables([model({ years: y, rows })], en);
    expect(t.rows.map((r) => r.label)).toEqual(["Total", "Ministry — Programme", "Alone"]);
    expect(t.rows.map((r) => r.label)).toEqual(rows.map(readableRowLabel));
  });
});

describe("crawlCaption", () => {
  const y = [2020, 2021];
  it("is title · view · unit · period · basis, never the workbook subtitle's notes", () => {
    const m = model({ years: y, title: "Trading partners", view: "Exports", unitLabel: "billion USD", subtitle: "Exports · 2020–2021 · billion USD · Total trade = exports + imports. Publication status: unspecified.", rows: [row("A", [1, 2], y)] });
    expect(crawlCaption(m)).toBe("Trading partners · Exports · billion USD · 2020–2021 · Actual");
  });

  it("names the mixed basis, and none when no cell has a status", () => {
    const mixed = row("A", [1, 2], y, { basisByYear: { 2020: "actual", 2021: "planned" } });
    expect(crawlCaption(model({ years: y, rows: [mixed] }))).toBe("T · GEL · 2020–2021 · Actual and planned");
    expect(crawlCaption(model({ years: y, rows: [row("A", [1, 2], y, { basisByYear: { 2020: "not_available", 2021: "actual" } })] }))).toBe("T · GEL · 2020–2021 · Actual");
    expect(crawlCaption(model({ years: y, rows: [row("A", [1, 2], y, { basisByYear: { 2020: null, 2021: null } })] }))).toBe("T · GEL · 2020–2021");
  });

  it("names preliminary years beside settled ones instead of calling the table preliminary", () => {
    const gdp = row("A", [1, 2], y, { basisByYear: { 2020: "published", 2021: "preliminary" } });
    expect(crawlCaption(model({ years: y, rows: [gdp] }))).toBe("T · GEL · 2020–2021 · Published · Preliminary: 2021");
    const allPreliminary = row("A", [1, 2], y, { basisByYear: { 2020: "preliminary", 2021: "preliminary" } });
    expect(crawlCaption(model({ years: y, rows: [allPreliminary] }))).toBe("T · GEL · 2020–2021 · Preliminary");
  });

  it("names the long unit where the sheet prints a short one", () => {
    expect(crawlCaption(model({ years: y, unitLabel: "GEL", longUnit: "GEL per month", rows: [] }))).toBe("T · GEL per month · 2020–2021");
  });

  it("takes the period from the model when its columns are not years, and writes school years as the page does", () => {
    expect(crawlCaption(model({ years: [1, 2, 3], period: "January 2024 – September 2026", rows: [] }))).toBe("T · GEL · January 2024 – September 2026");
    expect(crawlCaption({ ...model({ years: [2017, 2025], rows: [] }), periodLabel: (year: number) => `${year}/${String(year + 1).slice(2)}` })).toBe("T · GEL · 2017/18–2025/26");
    expect(crawlCaption(model({ years: [2025], rows: [] }))).toBe("T · GEL · 2025");
  });

  it("does not repeat a view or unit the title already names, and skips an empty unit", () => {
    expect(crawlCaption(model({ years: y, title: "Sectors · Real growth %", unitLabel: "Real growth %", rows: [] }))).toBe("Sectors · Real growth % · 2020–2021");
    expect(crawlCaption(model({ years: y, title: "Tax breaks · Amount", view: "Amount", unitLabel: "", rows: [] }))).toBe("Tax breaks · Amount · 2020–2021");
  });
});

describe("crawlTablesHtml", () => {
  it("writes caption, header row and rows as React rendered them", () => {
    expect(crawlTablesHtml(crawlTables([model({ years: [2024, 2025], rows: [row("Total", [1, 2], [2024, 2025])] })], en), "Category")).toBe(
      "<table><caption>T · GEL · 2024–2025 · Actual</caption><thead><tr><th>Category</th><th>2024</th><th>2025</th></tr></thead>" +
      "<tbody><tr><th>Total</th><td>1.0</td><td>2.0</td></tr></tbody></table>",
    );
  });

  it("heads the label column with the table's own label, else the fallback", () => {
    const named = crawlTablesHtml([{ caption: "C", category: "Region", columns: ["2024"], rows: [] }], "Category");
    expect(named).toContain("<thead><tr><th>Region</th><th>2024</th></tr></thead>");
    expect(crawlTablesHtml([{ caption: "C", columns: [], rows: [] }], "Category")).toContain("<thead><tr><th>Category</th></tr></thead>");
  });

  it("escapes every text as React does: & < > \" '", () => {
    const html = crawlTablesHtml([{ caption: `A & B <i>"x"</i> 'y'`, category: "<b>", columns: ["1&2"], rows: [{ label: "R&D <x>", cells: ["'5'"] }] }], "Category");
    expect(html).toBe(
      "<table><caption>A &amp; B &lt;i&gt;&quot;x&quot;&lt;/i&gt; &#x27;y&#x27;</caption><thead><tr><th>&lt;b&gt;</th><th>1&amp;2</th></tr></thead>" +
      "<tbody><tr><th>R&amp;D &lt;x&gt;</th><td>&#x27;5&#x27;</td></tr></tbody></table>",
    );
  });

  it("carries the cap note in the caption, and writes nothing for no tables", () => {
    const y = years(20);
    const items = Array.from({ length: 300 }, (_, i) => row(`I${i}`, y.map(() => i), y));
    const html = crawlTablesHtml(crawlTables([model({ years: y, rows: items })], en), "Category");
    expect(html).toMatch(/<caption>T · GEL · 2000–2019 · Actual · top \d+ of 300; all of them in the Excel download<\/caption>/);
    expect(crawlTablesHtml([], "Category")).toBe("");
  });
});

describe("lastPeriodsRange (monthly crawl window)", () => {
  it("starts in January two years before the latest month's year", () => {
    expect(lastPeriodsRange({ min: makePeriod(2010, 1), max: makePeriod(2026, 9) }, CRAWL_MONTH_COLUMNS))
      .toEqual({ kind: "manual", start: makePeriod(2024, 1), end: makePeriod(2026, 9) });
    expect(lastPeriodsRange({ min: makePeriod(2010, 1), max: makePeriod(2026, 12) }, CRAWL_MONTH_COLUMNS))
      .toEqual({ kind: "manual", start: makePeriod(2024, 1), end: makePeriod(2026, 12) });
    expect(lastPeriodsRange({ min: makePeriod(2010, 1), max: makePeriod(2026, 1) }, CRAWL_MONTH_COLUMNS))
      .toEqual({ kind: "manual", start: makePeriod(2024, 1), end: makePeriod(2026, 1) });
  });

  it("never starts before the coverage", () => {
    expect(lastPeriodsRange({ min: makePeriod(2025, 3), max: makePeriod(2026, 9) }, CRAWL_MONTH_COLUMNS))
      .toEqual({ kind: "manual", start: makePeriod(2025, 3), end: makePeriod(2026, 9) });
  });
});
