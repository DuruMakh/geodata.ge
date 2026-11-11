import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { IndexCrawlTables } from "../../components/explorer-shell/index-crawl-tables";
import { historyCaption, historyCrawlTable, municipalHistoryTables } from "../../lib/explorer/indexCrawlTables";

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

  it("historyCaption names the first and last column", () => {
    expect(historyCaption(["Schools", "Pupils"], ["2005/06", "2025/26"])).toBe("Schools · Pupils · 2005/06–2025/26");
    expect(historyCaption(["Schools"], ["2025/26"])).toBe("Schools · 2025/26");
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

  it("IndexCrawlTables writes the hidden wrapper", () => {
    const html = renderToStaticMarkup(React.createElement(IndexCrawlTables, { tables: [table], category: "Place" }));
    expect(html.startsWith('<div hidden="" data-testid="crawl-tables">')).toBe(true);
    expect(html).toContain("<td>3,936</td>");
    expect(html).toContain("<th>Place</th>");
    expect(renderToStaticMarkup(React.createElement(IndexCrawlTables, { tables: [], category: "Place" }))).toBe('<div hidden="" data-testid="crawl-tables"></div>');
  });
});
