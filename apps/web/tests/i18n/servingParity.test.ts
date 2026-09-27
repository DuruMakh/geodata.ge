import { loadGdpOverviewFacts } from "../../lib/data/gdpOverview/importGdpOverview";
import { loadBasketWeights, loadCpiCategoryFacts, loadCpiCityFacts, loadCpiFacts, loadInflationTargets } from "../../lib/data/inflation/importInflation";
import { loadEconomicSectorFacts } from "../../lib/data/economicSectors/importEconomicSectors";
import { loadRegionalEconomyFacts } from "../../lib/data/regionalEconomies/importRegionalEconomies";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadBudgetFactRows } from "../../lib/data/importBudgetFacts";
import { loadGlossary } from "../../lib/data/glossary";
import { loadSourceDocuments } from "../../lib/data/sources";
import { loadAdminSpendingFacts } from "../../lib/data/adminSpending/importAdminSpendingFacts";
import { loadAdminSpendingCategoriesFile } from "../../lib/data/adminSpending/categoriesFile";
import { loadNationalGdpFacts } from "../../lib/data/nationalGdp/importNationalGdp";
import { loadServedExplorerData, loadServedMunicipalData, loadServedGovernmentDebtData, loadServedGeneralGovernmentBalanceData, resetServedDataCacheForTests, SERVED_DATA_FILES } from "../../lib/data/servedData";
import { buildFactQuerySnapshot } from "../../lib/factQuery/buildSnapshot";
import { getPresentation } from "../../lib/i18n/presentation.server";
import { buildExplorerModel } from "../../lib/explorer/explorerData";
import { projectAdminFact, projectBudgetFact, projectGdpFact } from "../../lib/explorer/clientData";

const mirror = vi.hoisted(() => ({ loadLandingDataFromDb: vi.fn(), loadExplorerDataFromDb: vi.fn(), loadMunicipalDataFromDb: vi.fn(), loadGovernmentDebtFactsFromDb: vi.fn(), loadGeneralGovernmentBalanceFactsFromDb: vi.fn(), loadGdpOverviewFactsFromDb: vi.fn(), loadInflationDataFromDb: vi.fn(), loadEconomicSectorFactsFromDb: vi.fn(), loadRegionalEconomyFactsFromDb: vi.fn() }));
vi.mock("../../lib/db/servedDataDb", () => mirror);
afterEach(() => { resetServedDataCacheForTests(); vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe("bilingual presentation on both serving paths", () => {
  it("uses the same catalogue, original rows and data identity for CSV and database-loader fixtures", async () => {
    vi.stubEnv("GEODATA_DATA_SOURCE", "csv");
    resetServedDataCacheForTests();
    const [facts, glossary, sourceDocuments, adminFacts, adminCategories, gdpFacts, municipal, debt, balance, csv] = await Promise.all([
      loadBudgetFactRows(SERVED_DATA_FILES.budgetFacts), loadGlossary(SERVED_DATA_FILES.glossary), loadSourceDocuments(SERVED_DATA_FILES.sourceDocuments),
      loadAdminSpendingFacts(SERVED_DATA_FILES.adminSpendingFacts), loadAdminSpendingCategoriesFile(SERVED_DATA_FILES.adminSpendingCategories), loadNationalGdpFacts(SERVED_DATA_FILES.gdpFacts),
      loadServedMunicipalData(), loadServedGovernmentDebtData(), loadServedGeneralGovernmentBalanceData(), loadServedExplorerData(),
    ]);
    const raw = { facts, glossary, sourceDocuments, adminFacts: [...adminFacts].reverse(), adminCategories, gdpFacts };
    mirror.loadLandingDataFromDb.mockResolvedValue(raw);
    mirror.loadExplorerDataFromDb.mockResolvedValue(raw);
    mirror.loadMunicipalDataFromDb.mockResolvedValue(municipal);
    mirror.loadGovernmentDebtFactsFromDb.mockResolvedValue(debt.facts);
    mirror.loadGeneralGovernmentBalanceFactsFromDb.mockResolvedValue(balance.facts);
    mirror.loadGdpOverviewFactsFromDb.mockResolvedValue(await loadGdpOverviewFacts());
    mirror.loadEconomicSectorFactsFromDb.mockResolvedValue(await loadEconomicSectorFacts());
    mirror.loadRegionalEconomyFactsFromDb.mockResolvedValue(await loadRegionalEconomyFacts());
    // The snapshot loads inflation through its memoised served loader, so in db
    // mode this mirror reader runs and its rows face the parity check.
    mirror.loadInflationDataFromDb.mockResolvedValue({
      facts: await loadCpiFacts(), targets: await loadInflationTargets(),
      categories: await loadCpiCategoryFacts(), weights: await loadBasketWeights(),
      cities: await loadCpiCityFacts(),
    });
    const options = { releaseCommit: "loader-parity-fixture", generatedAt: "2026-09-06T00:00:00Z" };
    const csvSnapshot = await buildFactQuerySnapshot(options);
    const presentation = await getPresentation("en", ["main"], [...glossary.keys(), "expenditure.total", "admin_spending.total", ...adminCategories.map(row => row.id), ...adminFacts.map(row => row.itemId)]);
    vi.stubEnv("GEODATA_DATA_SOURCE", "db");
    resetServedDataCacheForTests();
    const db = await loadServedExplorerData();
    const dbSnapshot = await buildFactQuerySnapshot(options);
    expect(mirror.loadExplorerDataFromDb).toHaveBeenCalled();
    expect(mirror.loadMunicipalDataFromDb).toHaveBeenCalled();
    expect(mirror.loadGovernmentDebtFactsFromDb).toHaveBeenCalled();
    expect(mirror.loadGeneralGovernmentBalanceFactsFromDb).toHaveBeenCalled();
    // Once each: the snapshot takes these four from the memoised served
    // loaders, so in db mode they come from the mirror and each dataset's
    // parity check runs exactly once.
    expect(mirror.loadGdpOverviewFactsFromDb).toHaveBeenCalledTimes(1);
    expect(mirror.loadEconomicSectorFactsFromDb).toHaveBeenCalledTimes(1);
    expect(mirror.loadRegionalEconomyFactsFromDb).toHaveBeenCalledTimes(1);
    expect(mirror.loadInflationDataFromDb).toHaveBeenCalledTimes(1);
    expect(dbSnapshot).toEqual(csvSnapshot);
    for (const grouping of ["fields", "ministries"] as const) {
      const input = { facts: csv.facts.map(projectBudgetFact), adminFacts: csv.adminFacts.map(projectAdminFact), adminCategories: new Map(csv.adminCategories.map(row => [row.id, row])), glossary: csv.glossary, gdpFacts: csv.gdpFacts.map(projectGdpFact), side: "expenditure" as const, expenditureGrouping: grouping, selectedItemIds: [grouping === "fields" ? "spending.education" : "admin_spending.defence"], startYear: 2020, endYear: 2025, measure: "nominal" as const };
      expect(buildExplorerModel({ ...input, facts: db.facts.map(projectBudgetFact), adminFacts: db.adminFacts.map(projectAdminFact), adminCategories: new Map(db.adminCategories.map(row => [row.id, row])), glossary: db.glossary, gdpFacts: db.gdpFacts.map(projectGdpFact) }, presentation)).toEqual(buildExplorerModel(input, presentation));
    }
    // The translation layer must not let a numerically stale mirror through.
    mirror.loadExplorerDataFromDb.mockResolvedValue({ ...raw, facts: raw.facts.map((fact, index) => index ? fact : { ...fact, amountGel: fact.amountGel + 1 }) });
    resetServedDataCacheForTests();
    await expect(loadServedExplorerData()).rejects.toThrow(/parity|differs|mismatch/i);
  });
});
