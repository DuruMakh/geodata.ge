import { beforeEach, describe, expect, it } from "vitest";
import { loadGovernmentDebtFacts } from "../../lib/data/governmentDebt/importGovernmentDebtFacts";
import { buildDebtWorkbookExportModel } from "../../lib/explorer/debtWorkbook";
import { loadDebtWorkbookSources, resetWorkbookSourceCacheForTests } from "../../lib/methodology/workbookSources";
import type { DebtFamily, DebtSeriesId } from "../../lib/servedRows";

// A golden test: the debt workbook's Sources sheet must list the same documents
// and years before and after lineage moves out of the UI (spec §3.3).
const cases: Array<{ name: string; family: DebtFamily; selectedIds: DebtSeriesId[]; range: { start: number; end: number } }> = [
  { name: "stock, full coverage", family: "stock", selectedIds: ["debt.stock.total", "debt.stock.domestic", "debt.stock.external"], range: { start: 2013, end: 2025 } },
  { name: "service, full coverage", family: "service", selectedIds: ["debt.service.total", "debt.service.principal", "debt.service.interest"], range: { start: 2013, end: 2030 } },
  { name: "rate, full coverage", family: "rate", selectedIds: ["debt.rate.total", "debt.rate.domestic", "debt.rate.external"], range: { start: 2015, end: 2025 } },
  { name: "service total, 2017–2021", family: "service", selectedIds: ["debt.service.total"], range: { start: 2017, end: 2021 } },
];

describe("debt workbook sources (golden)", () => {
  beforeEach(() => resetWorkbookSourceCacheForTests());

  it.each(cases)("lists the same documents and years: $name", async ({ family, selectedIds, range }) => {
    const [facts, sources] = await Promise.all([loadGovernmentDebtFacts(), loadDebtWorkbookSources()]);
    const model = buildDebtWorkbookExportModel({
      facts,
      gdpFacts: [],
      family,
      selectedIds,
      range,
      shareOfGdp: false,
      sources,
      gdpSources: [],
      siteOrigin: "https://fiscal.ge",
    });
    expect(model.sources.map(({ title, years, downloadHref }) => ({ title, years, downloadHref }))).toMatchSnapshot();
  });
});

it("loads each debt archive document with its exact registry id", async () => {
  const sourceModule = await import("../../lib/methodology/workbookSources");
  expect(sourceModule.loadDebtWorkbookSources).toBeTypeOf("function");
  const sources = await sourceModule.loadDebtWorkbookSources();
  expect(sources.length).toBeGreaterThan(0);
  expect(sources.every(source => source.sourceId.startsWith("source.mof_"))).toBe(true);
});

it("matches the registry id even when another filename contains the old filename", async () => {
  const facts = (await loadGovernmentDebtFacts()).filter(fact => fact.family === "stock" && fact.year === 2013);
  const sources = [
    { sourceId: "source.mof_public_debt_bulletin_n130", years: [2013], title: "Wrong bulletin", organization: "MoF", downloadHref: "/downloads/methodology/debt/files/2013-2019/public-debt-bulletin-n130.pdf" as const, retrievedAt: "2026-09-01" },
    { sourceId: "source.mof_public_debt_bulletin_n13", years: [2013], title: "Correct bulletin", organization: "MoF", downloadHref: "/downloads/methodology/debt/files/2013-2019/renamed-bulletin.pdf" as const, retrievedAt: "2026-09-01" },
  ];
  const model = buildDebtWorkbookExportModel({ facts, gdpFacts: [], family: "stock", selectedIds: ["debt.stock.total"], range: { start: 2013, end: 2013 }, shareOfGdp: false, sources, gdpSources: [], siteOrigin: "https://fiscal.ge" });
  expect(model.sources.map(source => source.title)).toEqual(["Correct bulletin"]);
});
