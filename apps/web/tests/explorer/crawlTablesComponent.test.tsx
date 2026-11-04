import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CrawlTables, useCrawlModels } from "../../components/explorer-shell/crawl-tables";
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

  it("heads the label column with the workbook's own label when it has one", () => {
    const named: WorkbookExportModel = { ...model, readable: { ...model.readable, headerLabels: { category: "Region", columns: ["2024", "2025"] } } };
    expect(renderPageMarkup("en", <CrawlTables models={[named]} />)).toContain("<thead><tr><th>Region</th><th>2024</th><th>2025</th></tr></thead>");
  });

  it("carries no class or style inside the wrapper", () => {
    const markup = renderPageMarkup("en", <CrawlTables models={[model]} />);
    expect(markup.slice(markup.indexOf("<table"))).not.toMatch(/class=|style=/);
  });

  it("renders the empty hidden wrapper without models, as the browser does", () => {
    expect(renderPageMarkup("en", <CrawlTables models={[]} />)).toBe('<div hidden="" data-testid="crawl-tables"></div>');
  });
});

// Tests run in Node, where there is no window: the server render. Stubbing window makes it the browser's.
describe("useCrawlModels", () => {
  afterEach(() => vi.unstubAllGlobals());
  const Page = ({ build }: { build: () => readonly WorkbookExportModel[] }) => <CrawlTables models={useCrawlModels(build)} />;

  it("builds the models during the server render", () => {
    const build = vi.fn(() => [model]);
    expect(useCrawlModels(build)).toEqual([model]);
    expect(renderPageMarkup("en", <Page build={build} />)).toContain("<table><caption>T · S</caption>");
    expect(build).toHaveBeenCalledTimes(2);
  });

  it("never builds them in the browser, which renders the same wrapper empty for hydration to keep the server's tables", () => {
    vi.stubGlobal("window", {});
    const build = vi.fn(() => [model]);
    expect(useCrawlModels(build)).toEqual([]);
    expect(useCrawlModels(build)).toBe(useCrawlModels(build));
    expect(renderPageMarkup("en", <Page build={build} />)).toBe('<div hidden="" data-testid="crawl-tables"></div>');
    expect(build).not.toHaveBeenCalled();
  });
});
