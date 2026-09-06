import { describe, expect, it } from "vitest";
import { buildExplorerModel, type ExplorerModel, type ExplorerModelInput } from "../../lib/explorer/explorerData";
import type { ExplorerTableRow } from "../../lib/explorer/types";
import type { Presentation } from "../../lib/i18n/types";

const englishLabels = {
  "spending.education": "Education",
  "spending.health": "Health",
  "expenditure.total": "Total expenditure",
};
const presentation = (locale: "ka" | "en"): Presentation => ({ locale, englishLabels, messages: {} });
const input: ExplorerModelInput = {
  facts: [
    { year: 2020, side: "expenditure", itemId: "spending.education", amountGel: 100, basis: "actual" },
    { year: 2020, side: "expenditure", itemId: "spending.education", amountGel: 120, basis: "planned" },
    { year: 2020, side: "expenditure", itemId: "spending.health", amountGel: 50, basis: "actual" },
    { year: 2021, side: "expenditure", itemId: "spending.education", amountGel: 0, basis: "actual" },
    { year: 2022, side: "expenditure", itemId: "spending.education", amountGel: 160, basis: "planned" },
  ],
  glossary: new Map([
    ["spending.education", { id: "spending.education", kaLabel: "განათლება", enLabel: "Old English label", description: "", notes: "" }],
    ["spending.health", { id: "spending.health", kaLabel: "ჯანდაცვა", enLabel: "Health", description: "", notes: "" }],
  ]),
  gdpFacts: [
    { year: 2020, gdpCurrentPricesGel: 1000, accountingStandard: "sna_2008", status: "final_as_published" },
    { year: 2021, gdpCurrentPricesGel: 1100, accountingStandard: "sna_2008", status: "final_as_published" },
    { year: 2022, gdpCurrentPricesGel: 1200, accountingStandard: "sna_2008", status: "preliminary" },
  ],
  side: "expenditure", selectedItemIds: ["spending.education", "spending.health"],
  startYear: 2020, endYear: 2022, measure: "nominal",
};

const numericalRow = ({ kaLabel: _ka, enLabel: _en, ...row }: ExplorerTableRow) => row;
function numericalModel(model: ExplorerModel) {
  return {
    ...model,
    items: model.items.map(({ kaLabel: _ka, enLabel: _en, ...item }) => item),
    selectedItems: model.selectedItems.map(({ kaLabel: _ka, enLabel: _en, ...item }) => item),
    tableRows: model.tableRows.map(numericalRow),
    totalRow: model.totalRow ? numericalRow(model.totalRow) : null,
    comparisonRows: model.comparisonRows.map(numericalRow),
    topGrowth: model.topGrowth.map(numericalRow),
    bottomGrowth: model.bottomGrowth.map(numericalRow),
  };
}

describe("national presentation parity", () => {
  it.each(["nominal", "share_of_gdp"] as const)("keeps all numbers, statuses, colours and ordering for %s", (measure) => {
    const ka = buildExplorerModel({ ...input, measure }, presentation("ka"));
    const en = buildExplorerModel({ ...input, measure }, presentation("en"));
    expect(numericalModel(en)).toEqual(numericalModel(ka));
    expect(numericalModel(ka)).toEqual(numericalModel(buildExplorerModel({ ...input, measure })));
    expect(en.totalRow?.valuesByYear[2020]).toBe(150);
    expect(en.tableRows.find(row => row.itemId === "spending.education")?.valuesByYear[2021]).toBe(0);
    expect(en.tableRows.find(row => row.itemId === "spending.health")?.valuesByYear[2021]).toBeUndefined();
    expect(en.hasPlannedValues).toBe(true);
    expect(en.points.find(point => point.itemId === "spending.education" && point.year === 2020)?.basis).toBe("actual");
  });

  it("uses the reviewed English label in both languages while retaining the original Georgian", () => {
    for (const locale of ["ka", "en"] as const) {
      const model = buildExplorerModel(input, presentation(locale));
      expect(model.items.find(item => item.id === "spending.education")).toMatchObject({ kaLabel: "განათლება", enLabel: "Education" });
      expect(model.tableRows.find(row => row.itemId === "spending.education")?.enLabel).toBe("Education");
    }
  });

  it("fails if a reviewed English series label is missing", () => {
    expect(() => buildExplorerModel(input, { ...presentation("en"), englishLabels: { "expenditure.total": "Total expenditure" } }))
      .toThrow("spending.education");
  });

  it("names the receipts total without changing its values", () => {
    const revenue: ExplorerModelInput = {
      ...input, side: "revenue", selectedItemIds: ["revenue.total"],
      facts: [{ year: 2020, side: "revenue", itemId: "revenue.vat", amountGel: 500, basis: "actual" }],
      glossary: new Map([["revenue.vat", { id: "revenue.vat", kaLabel: "დღგ", enLabel: "VAT", description: "", notes: "" }]]),
    };
    const en = buildExplorerModel(revenue, { locale: "en", messages: {}, englishLabels: { "revenue.total": "Total receipts", "revenue.vat": "VAT" } });
    expect(en.totalRow?.enLabel).toBe("Total receipts");
    expect(en.totalRow?.valuesByYear[2020]).toBe(500);
  });
});
