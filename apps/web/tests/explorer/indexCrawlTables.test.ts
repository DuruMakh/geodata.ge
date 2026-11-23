import React from "react";
import { describe, expect, it, vi } from "vitest";
import { IndexCrawlTables } from "../../components/explorer-shell/index-crawl-tables";
import { historyCaption, historyCrawlTable, historyFromFacts, indexHistoryTables, municipalHistoryTables } from "../../lib/explorer/indexCrawlTables";
import type { MunicipalListRow } from "../../lib/explorer/municipalData";
import { renderPageMarkup } from "../helpers/render-localized";

const format = (value: number) => value.toLocaleString("en-US");

describe("index crawl tables", () => {
  const table = historyCrawlTable({
    caption: "Schools · Pupils · 2015/16–2016/17",
    years: [2015, 2016],
    columns: ["2015/16", "2016/17"],
    rows: [{ label: "Khulo", valuesByYear: { 2015: 3936 } }],
    format,
  });

  it("historyCrawlTable prints every year and a dash for a missing one", () => {
    expect(table.columns).toEqual(["2015/16", "2016/17"]);
    expect(table.rows[0]).toEqual({ label: "Khulo", cells: ["3,936", "—"] });
  });

  it("historyCrawlTable prints a dash for a null figure, never 0", () => {
    const withNull = historyCrawlTable({ caption: "c", years: [2000, 2001], columns: ["2000", "2001"], rows: [{ label: "Georgia", valuesByYear: { 2000: null, 2001: 0 } }], format });
    expect(withNull.rows[0]!.cells).toEqual(["—", "0"]);
  });

  it("historyCaption names the first and last column, then the basis", () => {
    expect(historyCaption(["Schools", "Pupils"], ["2005/06", "2025/26"], "Published")).toBe("Schools · Pupils · 2005/06–2025/26 · Published");
    expect(historyCaption(["Schools"], ["2025/26"], "Published")).toBe("Schools · 2025/26 · Published");
  });

  it("municipalHistoryTables puts Georgia first in both tables", () => {
    const tables = municipalHistoryTables({
      caption: (level) => `Schools · ${level}`,
      levels: { municipalities: "Municipalities", regions: "Regions" },
      years: [2015],
      columns: ["2015/16"],
      country: { label: "Georgia", valuesByYear: { 2015: 553914 } },
      municipalities: [{ label: "Khulo", valuesByYear: { 2015: 3936 } }, { label: "Shuakhevi", valuesByYear: { 2015: 2410 } }],
      regions: [{ label: "Adjara", valuesByYear: { 2015: 54115 } }],
      format,
    });
    expect(tables).toHaveLength(2);
    expect(tables[0]!.rows.map((row) => row.label)).toEqual(["Georgia", "Khulo", "Shuakhevi"]);
    expect(tables[1]!.rows.map((row) => row.label)).toEqual(["Georgia", "Adjara"]);
    expect(tables[0]!.caption).toContain("Municipalities");
    expect(tables[1]!.caption).toContain("Regions");
  });

  it("IndexCrawlTables writes the data-table block, on the server and in the browser alike", () => {
    const html = renderPageMarkup("en", React.createElement(IndexCrawlTables, { tables: [table], category: "Place" }));
    expect(html.startsWith('<div data-testid="crawl-tables" class="crawl-tables"><p>Data table</p><div role="region" aria-label="Data table: Schools · Pupils · 2015/16–2016/17"><table>')).toBe(true);
    expect(html).toContain("<td>3,936</td>");
    expect(html).toContain("<th>Place</th>");
    expect(renderPageMarkup("en", React.createElement(IndexCrawlTables, { tables: [], category: "Place" }))).toBe('<div data-testid="crawl-tables" class="crawl-tables"></div>');
    // A page opened by a link inside the site renders in the browser only: the tables are props, so the block is the same.
    vi.stubGlobal("window", {});
    expect(renderPageMarkup("en", React.createElement(IndexCrawlTables, { tables: [table], category: "Place" }))).toBe(html);
    vi.unstubAllGlobals();
  });

  it("indexHistoryTables writes two tables per figure, each over the years its places have (not Georgia's longer series)", () => {
    const row = (id: string, nameKa: string, kind: MunicipalListRow["kind"]): MunicipalListRow => ({ id, kind, nameKa, subtitleKa: "", regionId: null, valueGel: 0, budgetPerResidentGel: null, rank: null });
    const history = historyFromFacts([
      { id: "count", facts: [{ geographyId: "country.georgia", year: 2012, value: 690000 }, { geographyId: "country.georgia", year: 2013, value: 700000 }, { geographyId: "region.tbilisi", year: 2013, value: 160000 }, { geographyId: "11", year: 2014, value: 4547 }] },
      { id: "share", facts: [{ geographyId: "11", year: 2014, value: 21.3 }] },
    ]);
    const tables = indexHistoryTables({
      history,
      rows: { country: row("country.georgia", "საქართველო", "country"), municipalities: [row("04", "თბილისი", "municipality"), row("11", "ხულო", "municipality")], regions: [row("region.adjara", "აჭარა", "region")] },
      label: (listRow) => listRow.nameKa,
      levels: { municipalities: "მუნიციპალიტეტები", regions: "რეგიონები" },
      column: String,
      figures: { count: { parts: ["პენსიები", "პენსიონერები"], format }, share: { parts: ["პენსიები", "წილი"], format: (value) => value.toFixed(1) } },
      basis: "გამოქვეყნებული",
    });
    expect(tables).toHaveLength(4);
    expect(tables[0]!.columns).toEqual(["2013", "2014"]);
    expect(tables[0]!.caption).toBe("პენსიები · პენსიონერები · მუნიციპალიტეტები · 2013–2014 · გამოქვეყნებული");
    expect(tables[0]!.rows).toEqual([
      { label: "საქართველო", cells: ["700,000", "—"] },
      { label: "თბილისი", cells: ["160,000", "—"] },
      { label: "ხულო", cells: ["—", "4,547"] },
    ]);
    expect(tables[2]!.columns).toEqual(["2014"]);
    expect(tables[2]!.rows[2]).toEqual({ label: "ხულო", cells: ["21.3"] });
    expect(tables[3]!.rows.map((r) => r.label)).toEqual(["საქართველო", "აჭარა"]);
  });

  it("indexHistoryTables keeps the latest years that fit maxCells, for every figure alike", () => {
    const row = (id: string, kind: MunicipalListRow["kind"]): MunicipalListRow => ({ id, kind, nameKa: id, subtitleKa: "", regionId: null, valueGel: 0, budgetPerResidentGel: null, rank: null });
    const facts = [2020, 2021, 2022].flatMap((year) => [{ geographyId: "11", year, value: year }, { geographyId: "region.adjara", year, value: year }]);
    const input = {
      history: historyFromFacts([{ id: "a", facts }, { id: "b", facts }]),
      rows: { country: row("country.georgia", "country"), municipalities: [row("11", "municipality")], regions: [row("region.adjara", "region")] },
      label: (listRow: MunicipalListRow) => listRow.nameKa, levels: { municipalities: "M", regions: "R" }, column: String, basis: "P",
      figures: { a: { parts: ["A"], format }, b: { parts: ["B"], format } },
    };
    // Four tables of two rows: 24 cells over three years, 16 over two.
    expect(indexHistoryTables(input).flatMap((table) => table.columns)).toHaveLength(12);
    const trimmed = indexHistoryTables({ ...input, maxCells: 23 });
    const first = trimmed.filter((table) => !table.rest);
    expect(first.map((table) => table.columns)).toEqual([["2021", "2022"], ["2021", "2022"], ["2021", "2022"], ["2021", "2022"]]);
    expect(first[0]!.caption).toBe("A · M · 2021–2022 · P");
    // The years that did not fit follow as rest tables, which the block folds: the same figures and places, nothing lost.
    const rest = trimmed.filter((table) => table.rest);
    expect(trimmed.slice(4)).toEqual(rest);
    expect(rest.map((table) => table.columns)).toEqual([["2020"], ["2020"], ["2020"], ["2020"]]);
    expect(rest.map((table) => table.caption)).toEqual(["A · M · 2020 · P", "A · R · 2020 · P", "B · M · 2020 · P", "B · R · 2020 · P"]);
    expect(rest[0]!.rows).toEqual([{ label: "country.georgia", cells: ["—"] }, { label: "11", cells: ["2,020"] }]);
    const whole = indexHistoryTables({ ...input, maxCells: 24 });
    expect(whole[0]!.columns).toEqual(["2020", "2021", "2022"]);
    expect(whole.some((table) => table.rest)).toBe(false);
  });
});
