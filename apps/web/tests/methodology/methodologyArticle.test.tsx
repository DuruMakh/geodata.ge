import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MethodologyArticle } from "../../components/methodology/methodology-article";
import { METHODOLOGY_CONTENT } from "../../lib/methodology/catalog";

const archiveSummary = {
  fileCount: 1,
  totalBytes: 1,
  latestRetrievedAt: "2026-09-01",
  validated: true,
};

function renderArticle(dataset: "debt" | "expenditure") {
  return renderToStaticMarkup(createElement(MethodologyArticle, {
    content: METHODOLOGY_CONTENT[dataset],
    coverage: dataset === "debt" ? { firstYear: 2013, lastYear: 2030 } : { firstYear: 2004, lastYear: 2025 },
    rows: [],
    archiveSummary,
    processedDataHref: dataset === "debt"
      ? "/downloads/data/government-debt.csv"
      : "/downloads/data/national-expenditure.csv",
    breadcrumbItems: [],
  }));
}

describe("methodology processed-download caption", () => {
  it("describes the Debt CSV with neutral status metadata rather than fact/plan metadata", () => {
    const markup = renderArticle("debt");

    expect(markup).toContain('href="/downloads/data/government-debt.csv"');
    expect(markup).toContain("სტატუსის მეტამონაცემებით");
    expect(markup).not.toContain("ფაქტი/გეგმის მეტამონაცემებით");
  });

  it("preserves the existing category download link and shared format/licence caption", () => {
    const markup = renderArticle("expenditure");

    expect(markup).toContain('href="/downloads/data/national-expenditure.csv"');
    expect(markup).toContain("UTF-8 / Excel თავსებადი · CC BY 4.0");
    expect(markup).toContain("სტატუსის მეტამონაცემებით");
  });
});
