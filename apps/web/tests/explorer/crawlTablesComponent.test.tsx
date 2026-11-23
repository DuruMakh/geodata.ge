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

const models = (...list: WorkbookExportModel[]) => ({ models: list, earlier: [] });
const block = (locale: "en" | "ka", inner: string) => {
  const heading = locale === "en" ? "Data table" : "მონაცემთა ცხრილი";
  return `<div data-testid="crawl-tables" class="crawl-tables"><p>${heading}</p><div role="region" aria-label="${heading}: T · GEL · 2024–2025 · Actual">${inner}</div></div>`;
};

describe("CrawlTables", () => {
  it.each(["en", "ka"] as const)("renders one plain table per model in %s, in a named region", (locale) => {
    expect(renderPageMarkup(locale, <CrawlTables models={models(model)} />)).toBe(block(locale,
      `<table><caption>T · GEL · 2024–2025 · Actual</caption><thead><tr><th>${workbookMessage(locale, "workbook.category")}</th><th>2024</th><th>2025</th></tr></thead>` +
      `<tbody><tr><th>Total</th><td>1.0</td><td>2.0</td></tr><tr><th>Other</th><td>3.0</td><td>—</td></tr></tbody></table>`,
    ));
  });

  it("is never hidden from a reader: no hidden, aria-hidden or inert on the wrapper", () => {
    expect(renderPageMarkup("en", <CrawlTables models={models(model)} />)).not.toMatch(/\bhidden\b|aria-hidden|\binert\b/);
  });

  it("heads the label column with the workbook's own label when it has one", () => {
    const named: WorkbookExportModel = { ...model, readable: { ...model.readable, headerLabels: { category: "Region", columns: ["2024", "2025"] } } };
    expect(renderPageMarkup("en", <CrawlTables models={models(named)} />)).toContain("<thead><tr><th>Region</th><th>2024</th><th>2025</th></tr></thead>");
  });

  it("carries no class or style inside the wrapper", () => {
    const markup = renderPageMarkup("en", <CrawlTables models={models(model)} />);
    expect(markup.slice(markup.indexOf("<p>"))).not.toMatch(/class=|style=/);
  });

  it("folds the earlier-period models below the first tables", () => {
    const earlier: WorkbookExportModel = { ...model, readable: { ...model.readable, title: "Earlier" } };
    const markup = renderPageMarkup("en", <CrawlTables models={{ models: [model], earlier: [earlier] }} />);
    expect(markup).toContain('</table><details><summary tabindex="-1">The rest of the data</summary><table><caption>Earlier · GEL · 2024–2025 · Actual</caption>');
    expect(markup.endsWith("</table></details></div></div>")).toBe(true);
  });

  it("renders the empty wrapper without models, as the browser first does", () => {
    expect(renderPageMarkup("en", <CrawlTables models={models()} />)).toBe('<div data-testid="crawl-tables" class="crawl-tables"></div>');
  });
});

// Tests run in Node, where there is no window: the server render. Stubbing window makes it the browser's first render.
describe("useCrawlModels", () => {
  afterEach(() => vi.unstubAllGlobals());
  const Page = ({ build, buildEarlier }: { build: () => readonly WorkbookExportModel[]; buildEarlier?: () => readonly WorkbookExportModel[] }) => <CrawlTables models={useCrawlModels(build, buildEarlier)} />;

  it("builds the models, and the earlier ones, during the server render", () => {
    const build = vi.fn(() => [model]);
    const buildEarlier = vi.fn(() => [model]);
    const markup = renderPageMarkup("en", <Page build={build} buildEarlier={buildEarlier} />);
    expect(markup).toContain("<table><caption>T · GEL · 2024–2025 · Actual</caption>");
    expect(markup).toContain("<details>");
    expect(build).toHaveBeenCalledTimes(1);
    expect(buildEarlier).toHaveBeenCalledTimes(1);
  });

  it("never builds them while the browser renders: the wrapper is empty, for hydration to keep the server's tables", () => {
    vi.stubGlobal("window", {});
    const build = vi.fn(() => [model]);
    expect(renderPageMarkup("en", <Page build={build} />)).toBe('<div data-testid="crawl-tables" class="crawl-tables"></div>');
    expect(build).not.toHaveBeenCalled();
  });
});
