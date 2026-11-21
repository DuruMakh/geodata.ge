import { describe, expect, it } from "vitest";
import { makePeriod } from "../../lib/data/inflation/periods";
import { CRAWL_CELL_CAP, CRAWL_MAX_DECIMALS, CRAWL_MONTH_COLUMNS, CRAWL_PAGE_CELL_CAP, CRAWL_WINDOW_CHARS, crawlBlockHtml, crawlCaption, crawlReaderChars, crawlTables, crawlTablesHtml, formatCrawlCell } from "../../lib/explorer/crawlTables";
import { earlierPeriodsRange, lastPeriodsRange } from "../../lib/explorer/periodRange";
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
    [-0.05, "actual", "#,##0.0", "−0.1"],
    // An amount too small for its format gains decimals until two significant digits show, so it never reads as zero.
    [-0.04, "actual", "#,##0.0", "−0.04"],
    [0.0000412, "actual", "#,##0.000", "0.000041"],
    [0.0004, "actual", "#,##0.000", "0.0004"],
    [0.00049, "actual", "0.0", "0.00049"],
    // A percentage and a signed change keep their format's decimals: annual inflation of 0.0037% reads 0.0%, as published.
    [0.000037, "actual", "0.0%", "0.0%"],
    [-0.00004, "actual", "0.0%", "0.0%"],
    [0.00097, "actual", "+0.0;−0.0;0.0", "+0.0"],
    [-0.01, "actual", "+0.0;−0.0;0.0", "0.0"],
    // Rounding noise stays zero, and a negative one carries no minus sign.
    [2.7e-17, "actual", "#,##0.0", "0.0"],
    [-2.7e-17, "actual", "#,##0.0", "0.0"],
    [0, "actual", "#,##0.0", "0.0"],
  ] as const)("%s %s %s", (v, b, f, out) => expect(formatCrawlCell(v, b, f, "en")).toBe(out));

  it.each([
    // Signed trade amounts keep 9 decimals in Excel; a crawl cell prints at most three.
    [1.234567891, "#,##0.000000000;\"−\"#,##0.000000000", "1.235"],
    [0.0012, "#,##0.00000;\"−\"#,##0.00000", "0.001"],
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
    expect(t.caption.endsWith(`top ${keptItems.length} of 300; the others follow below`)).toBe(true);
  });

  it("follows a cut table with its other series, in workbook order, and tells the reader so", () => {
    const y = years(20);
    const total: WorkbookReadableRow = { ...row("Total", y.map(() => 1), y), kind: "total" };
    const items = Array.from({ length: 300 }, (_, i) => row(`I${i}`, y.map(() => (i * 7) % 300), y));
    const tables = crawlTables([model({ years: y, rows: [total, ...items] })], en);
    expect(tables).toHaveLength(2);
    const [first, rest] = tables;
    expect(first.rest).toBeUndefined();
    expect(rest.rest).toBe(true);
    const kept = new Set(first.rows.map((r) => r.label));
    expect(rest.rows.map((r) => r.label)).toEqual(items.map((r) => r.label).filter((label) => !kept.has(label)));
    expect(rest.caption).toBe(`T · GEL · 2000–2019 · Actual · the other ${rest.rows.length}`);
    expect(rest.columns).toEqual(first.columns);
    expect(first.rows.length + rest.rows.length).toBe(301);
  });

  it("puts the earlier-period models last, whole, without a share of the first 3,000 cells", () => {
    const y = years(10);
    const big = () => model({ years: y, rows: Array.from({ length: 500 }, (_, i) => row(`R${i}`, y.map(() => i), y)) });
    const earlier = model({ title: "Earlier", years: y, rows: Array.from({ length: 400 }, (_, i) => row(`E${i}`, y.map(() => i), y)) });
    const tables = crawlTables([big(), big()], en, [earlier]);
    expect(tables.map((t) => [t.rest ?? false, t.rows.length])).toEqual([[false, 150], [false, 150], [true, 350], [true, 350], [true, 400]]);
    expect(tables[4].caption).toBe("Earlier · GEL · 2000–2009 · Actual");
    expect(crawlTables([], en, [earlier]).map((t) => [t.rest, t.rows.length])).toEqual([[true, 400]]);
  });

  it("stops at the page cap: a rest table that cannot be whole keeps its largest series and both captions say so", () => {
    const y = years(20);
    // Figures of three or four characters, so the cell caps and not the reader's window cut this page.
    const items = Array.from({ length: 2000 }, (_, i) => row(`I${i}`, y.map(() => i / 100), y, { numberFormat: "0.00" }));
    const [first, rest, ...more] = crawlTables([model({ years: y, rows: items })], en);
    expect(more).toEqual([]);
    expect(first.rows).toHaveLength(CRAWL_CELL_CAP / 20);
    expect(first.caption.endsWith("top 150 of 2000; all of them in the Excel download")).toBe(true);
    const restRows = (CRAWL_PAGE_CELL_CAP - CRAWL_CELL_CAP) / 20;
    expect(rest.rows).toHaveLength(restRows);
    expect(rest.rows[0].label).toBe(`I${2000 - 150 - restRows}`);
    expect(rest.caption.endsWith(`top ${restRows} of 1850; all of them in the Excel download`)).toBe(true);
  });

  it("keeps the first tables inside a short reader's window: long labels leave room for fewer rows, and the others follow", () => {
    const y = years(20);
    // 140 series of 20 years are 2,800 cells, under the cell cap, yet with these names the table is 45,000 characters of text.
    const name = (i: number) => `Series ${i} ${"with a long official name ".repeat(6)}`.trim();
    const items = Array.from({ length: 140 }, (_, i) => row(name(i), y.map(() => 1000 + i), y));
    expect(items.length * y.length).toBeLessThan(CRAWL_CELL_CAP);
    const whole = crawlTables([model({ years: y, rows: items.slice(0, 60) })], en);
    expect(whole.map((t) => t.rows.length)).toEqual([60]);
    expect(crawlReaderChars(whole)).toBeLessThanOrEqual(CRAWL_WINDOW_CHARS);

    const [first, rest, ...more] = crawlTables([model({ years: y, rows: items })], en);
    expect(more).toEqual([]);
    expect(crawlReaderChars([first])).toBeLessThanOrEqual(CRAWL_WINDOW_CHARS);
    // The window is used, not merely respected: no more than a tenth of it stays empty.
    expect(crawlReaderChars([first])).toBeGreaterThan(CRAWL_WINDOW_CHARS * 0.9);
    // The largest series stay in view, in workbook order; the others follow, none lost.
    expect(first.rows.map((r) => r.label)).toEqual(items.slice(140 - first.rows.length).map((r) => r.label));
    expect(first.caption.endsWith(`top ${first.rows.length} of 140; the others follow below`)).toBe(true);
    expect(rest.rest).toBe(true);
    expect(rest.rows.map((r) => r.label)).toEqual(items.slice(0, 140 - first.rows.length).map((r) => r.label));
  });

  it("counts a table's text as a reader prints it: a caption, a header, a rule and a line of cells per row", () => {
    const y = years(2);
    const tables = crawlTables([model({ years: y, rows: [row("Ab", [1, 22], y)] })], en);
    expect(tables[0].rows[0].cells).toEqual(["1.0", "22.0"]);
    // "T · GEL · 2000–2001 · Actual" and a break; "|  | 2000 | 2001 |" twice (the header and its rule); "| Ab | 1.0 | 22.0 |".
    expect(crawlReaderChars(tables)).toBe(tables[0].caption.length + 2 + 2 * (2 + 3 + 7 + 7) + (2 + 5 + 6 + 7));
    expect(crawlReaderChars([])).toBe(0);
  });

  it("a capped table gives no slot to a series with no figure in any year; an uncapped one keeps it", () => {
    const y = years(20);
    const empty = (i: number) => row(`E${i}`, y.map(() => null), y);
    const unavailable = (i: number) => row(`U${i}`, y.map(() => 5), y, { basisByYear: Object.fromEntries(y.map((year) => [year, "not_available"])) });
    // 250 series, 150 slots, 100 series with figures: the free slots stay empty (and their cells go to later tables).
    const rows = [...Array.from({ length: 100 }, (_, i) => empty(i)), ...Array.from({ length: 50 }, (_, i) => unavailable(i)), ...Array.from({ length: 100 }, (_, i) => row(`I${i}`, y.map(() => i), y))];
    const [t] = crawlTables([model({ years: y, rows })], en);
    expect(t.rows.map((r) => r.label)).toEqual(Array.from({ length: 100 }, (_, i) => `I${i}`));
    // Every series with a figure is there, so the table is complete: no "top" note, and nothing to follow.
    expect(t.caption).not.toContain("top");
    expect(crawlTables([model({ years: y, rows })], en)).toHaveLength(1);
    // A cut counts only the series that have figures, so its note and the rest table's add up: 150 + 150 of 300, not of 400.
    const [cut, others] = crawlTables([model({ years: y, rows: [...rows.slice(0, 100), ...Array.from({ length: 300 }, (_, i) => row(`I${i}`, y.map(() => i), y))] })], en);
    expect(cut.caption.endsWith("top 150 of 300; the others follow below")).toBe(true);
    expect(others.caption.endsWith("the other 150")).toBe(true);
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
    expect(html).toMatch(/<caption>T · GEL · 2000–2019 · Actual · top \d+ of 300; the others follow below<\/caption>/);
    expect(crawlTablesHtml([], "Category")).toBe("");
  });
});

describe("crawlBlockHtml", () => {
  const labels = { category: "Category", heading: "Data table", rest: "The rest of the data" };
  const table = { caption: "C", columns: ["2024"], rows: [{ label: "A", cells: ["1"] }] };
  const tableHtml = "<table><caption>C</caption><thead><tr><th>Category</th><th>2024</th></tr></thead><tbody><tr><th>A</th><td>1</td></tr></tbody></table>";

  it("writes nothing for no tables", () => {
    expect(crawlBlockHtml([], labels)).toBe("");
  });

  it("is a label and one named, focusable scrolling region around the tables", () => {
    expect(crawlBlockHtml([table], labels)).toBe(`<p>Data table</p><div role="region" aria-label="Data table: C" tabindex="0">${tableHtml}</div>`);
  });

  it("folds the rest tables in a closed details element, after the first ones", () => {
    const rest = { ...table, caption: "D", rest: true as const };
    expect(crawlBlockHtml([table, rest, table], labels)).toBe(
      `<p>Data table</p><div role="region" aria-label="Data table: C" tabindex="0">${tableHtml}${tableHtml}` +
      `<details><summary>The rest of the data</summary>${tableHtml.replace("<caption>C", "<caption>D")}</details></div>`,
    );
  });

  it("escapes its labels, and carries no class or style", () => {
    const html = crawlBlockHtml([{ ...table, caption: `"A" & B` }], { category: "Category", heading: "<Data>", rest: "R" });
    expect(html.startsWith(`<p>&lt;Data&gt;</p><div role="region" aria-label="&lt;Data&gt;: &quot;A&quot; &amp; B" tabindex="0">`)).toBe(true);
    expect(html).not.toMatch(/class=|style=/);
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

describe("earlierPeriodsRange (the months before the crawl window)", () => {
  it("runs from the first month to the December before the window's January", () => {
    const coverage = { min: makePeriod(2004, 1), max: makePeriod(2026, 9) };
    expect(earlierPeriodsRange(coverage, CRAWL_MONTH_COLUMNS)).toEqual({ kind: "manual", start: makePeriod(2004, 1), end: makePeriod(2023, 12) });
  });

  it("is null when the window already starts at the first month", () => {
    expect(earlierPeriodsRange({ min: makePeriod(2024, 1), max: makePeriod(2026, 9) }, CRAWL_MONTH_COLUMNS)).toBeNull();
    expect(earlierPeriodsRange({ min: makePeriod(2025, 6), max: makePeriod(2026, 9) }, CRAWL_MONTH_COLUMNS)).toBeNull();
  });
});
