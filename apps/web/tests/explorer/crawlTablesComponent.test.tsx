import React from "react";
import { describe, expect, it } from "vitest";
import { CrawlTables } from "../../components/explorer-shell/crawl-tables";
import type { WorkbookExportModel } from "../../lib/explorer/workbookModel";
import { workbookMessage } from "../../lib/i18n/workbook";
import { renderPageMarkup } from "../helpers/render-localized";

const model: WorkbookExportModel = {
  locale: "en", filename: "x.xlsx", sheetNames: ["Summary", "Data", "Sources"],
  readable: {
    title: "T", subtitle: "S", unitLabel: "GEL", years: [2024, 2025],
    rows: [
      { kind: "item", parentLabel: null, label: "Total", change: null, valuesByYear: { 2024: 1, 2025: 2 }, basisByYear: { 2024: "actual", 2025: "actual" } },
      { kind: "item", parentLabel: null, label: "Other", change: null, valuesByYear: { 2024: 3, 2025: null }, basisByYear: { 2024: "actual", 2025: null } },
    ],
  },
  analysis: { headers: [], rows: [] }, sources: [],
};

describe("CrawlTables", () => {
  it.each(["en", "ka"] as const)("renders one minimal hidden table per model in %s", (locale) => {
    expect(renderPageMarkup(locale, <CrawlTables models={[model]} />)).toBe(
      `<div hidden="" data-testid="crawl-tables"><table><caption>T · S</caption><thead><tr><th>${workbookMessage(locale, "workbook.category")}</th><th>2024</th><th>2025</th></tr></thead>` +
      `<tbody><tr><th>Total</th><td>1.0</td><td>2.0</td></tr><tr><th>Other</th><td>3.0</td><td>—</td></tr></tbody></table></div>`,
    );
  });

  it("carries no class or style inside the wrapper", () => {
    const markup = renderPageMarkup("en", <CrawlTables models={[model]} />);
    expect(markup.slice(markup.indexOf("<table"))).not.toMatch(/class=|style=/);
  });

  it("renders nothing without models", () => {
    expect(renderPageMarkup("en", <CrawlTables models={[]} />)).toBe("");
  });
});
