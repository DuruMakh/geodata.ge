import { describe, expect, test } from "vitest";
import { chooseActivePublicFacts } from "../../lib/data/activeFacts";
import { buildBreakRegister } from "../../lib/data/demography/breaks";
import { loadServedDemographyData } from "../../lib/data/demography/importDemography";
import {
  loadServedExplorerData,
  loadServedGeneralGovernmentBalanceData,
  loadServedGovernmentDebtData,
  loadServedMunicipalData,
} from "../../lib/data/servedData";
import { publicGlossaryEntry } from "../../lib/data/glossary";
import { projectBalanceFact, projectBudgetFact, projectDebtFact, projectGdpFact } from "../../lib/explorer/clientData";
import { buildDebtExplorerModel } from "../../lib/explorer/debtExplorer";
import { buildDeficitExplorerModel, DEFICIT_SERIES_ID } from "../../lib/explorer/deficitExplorer";
import { buildExplorerModel, isDerivedTotalItemId } from "../../lib/explorer/explorerData";
import { buildMedianMunicipalBudgetPerResident, buildMunicipalListRows, MUNICIPAL_PER_RESIDENT_YEAR } from "../../lib/explorer/municipalData";
import { getPresentation } from "../../lib/i18n/presentation.server";
import { REVENUE_BANDS } from "../../lib/landing/chapters/budgetSeries";
import { loadYearReviewData } from "../../lib/yearReview/buildYearReviewData";
import type { Values } from "../../lib/yearReview/types";
import { glanceKpis } from "../../lib/yearReview/yearView";

// Real CSV-mode served data: the page must agree with the topic pages it summarises.

const at = (years: number[], values: Values, year: number) => values[years.indexOf(year)];
const sum = (values: (number | null)[]) => values.reduce<number>((total, value) => total + (value ?? 0), 0);
const TAX_IDS = new Set([...REVENUE_BANDS.vat, ...REVENUE_BANDS.income, ...REVENUE_BANDS.profit, ...REVENUE_BANDS.excise, ...REVENUE_BANDS.otherTaxes]);

describe("buildYearReviewData", () => {
  test("budget years run from the first active expenditure year to the plan year; the default is the last actual year", async () => {
    const { data } = await loadYearReviewData("ka");
    expect(data.budget.years[0]).toBe(2004);
    expect(data.budget.defaultYear).toBe(2025);
    expect(data.budget.planned.at(-1)).toBe(true);
    expect(data.budget.planned.length).toBe(data.budget.years.length);
    // Receipts have no plan-year values: null there, never 0.
    for (const receipt of data.budget.receipts) expect(receipt.values.at(-1)).toBeNull();
  });

  test("the fields and institutions add up to the Expenditure page's totals", async () => {
    const { data } = await loadYearReviewData("ka");
    const { facts, adminFacts } = await loadServedExplorerData();
    const { years } = data.budget;
    for (const year of [2004, 2025, 2026]) {
      const fieldsTotal = chooseActivePublicFacts(facts)
        .filter((fact) => fact.side === "expenditure" && fact.year === year && !isDerivedTotalItemId(fact.itemId))
        .reduce((total, fact) => total + fact.amountGel, 0);
      expect(sum(data.budget.fields.map((field) => at(years, field.values, year)))).toBeCloseTo(fieldsTotal, 0);
      const institutionsTotal = adminFacts
        .filter((fact) => fact.level === "admin_category" && fact.year === year)
        .reduce((total, fact) => total + fact.amountGel, 0);
      expect(sum(data.budget.institutions.map((row) => at(years, row.values, year)))).toBeCloseTo(institutionsTotal, 0);
    }
  });

  test("fields are sorted by the default year with other_unclassified last, and carry labels and colours", async () => {
    const { data } = await loadYearReviewData("ka");
    const { fields, institutions, years, defaultYear } = data.budget;
    expect(fields.at(-1)!.id).toBe("spending.other_unclassified");
    const ranked = fields.slice(0, -1).map((field) => at(years, field.values, defaultYear) ?? -Infinity);
    expect(ranked).toEqual([...ranked].sort((left, right) => right - left));
    const ministryRanks = institutions.map((row) => at(years, row.values, defaultYear) ?? -Infinity);
    expect(ministryRanks).toEqual([...ministryRanks].sort((left, right) => right - left));
    for (const category of [...fields, ...institutions, ...data.budget.receipts]) {
      expect(category.label).not.toBe(category.id);
      expect(category.color).toMatch(/^#[0-9A-F]{6}$/i);
      expect(category.values.length).toBe(years.length);
    }
    for (const type of data.spendingTypes.types) {
      expect(type.label).not.toBe(type.id);
      expect(type.color).toMatch(/^#[0-9A-F]{6}$/i);
      expect(type.values.length).toBe(data.spendingTypes.years.length);
    }
  });

  test("receipts' tax items are exactly the five tax bands, and every receipt is in some band", async () => {
    const { data } = await loadYearReviewData("ka");
    const banded = new Set(Object.values(REVENUE_BANDS).flat());
    for (const receipt of data.budget.receipts) expect(banded.has(receipt.id)).toBe(true);
    expect(new Set(data.budget.receipts.filter((receipt) => receipt.tax).map((receipt) => receipt.id))).toEqual(TAX_IDS);
  });

  test("gdp and population are aligned to the budget years", async () => {
    const { data } = await loadYearReviewData("ka");
    const { facts } = await loadServedDemographyData();
    const georgia2025 = facts.find((fact) => fact.seriesId === "demography.population_total" && fact.geographyId === "country.georgia" && fact.year === 2025)!;
    expect(at(data.budget.years, data.budget.population, 2025)).toBe(georgia2025.value);
    const { gdpFacts } = await loadServedExplorerData();
    expect(at(data.budget.years, data.budget.gdp, 2025)).toBe(gdpFacts.find((fact) => fact.year === 2025)!.gdpCurrentPricesGel);
  });

  test("the population break is the register's census recalculation, where the served population changes basis", async () => {
    const { data } = await loadYearReviewData("ka");
    const census = buildBreakRegister().find((row) => row.appliesTo.includes("demography.population_total"))!;
    expect(data.budget.populationBreak).toBe(Number(census.referenceDate.slice(0, 4)));
    const { facts } = await loadServedDemographyData();
    const basis = (year: number) =>
      facts.find((fact) => fact.seriesId === "demography.population_total" && fact.geographyId === "country.georgia" && fact.year === year)!.estimateBasis;
    expect(basis(data.budget.populationBreak!)).toBe("census_based");
    expect(basis(data.budget.populationBreak! - 1)).not.toBe("census_based");
  });

  test("spending types exclude the total and running-cost subtotal", async () => {
    const { data } = await loadYearReviewData("ka");
    const ids = data.spendingTypes.types.map((type) => type.id);
    expect(ids).not.toContain("spending_type.total");
    expect(ids).not.toContain("spending_type.expense");
    expect(ids.length).toBeGreaterThan(0);
    expect(data.spendingTypes.total.length).toBe(data.spendingTypes.years.length);
  });

  test("tax breaks and refunds are in GEL", async () => {
    const { data } = await loadYearReviewData("ka");
    expect(at(data.taxBreaks.years, data.taxBreaks.all, 2024)).toBeCloseTo(6403.18e6, -4);
    expect(at(data.refunds.years, data.refunds.values, 2025)).toBeCloseTo(2721.1e6, -4);
  });

  test("balance and debt-service projection flags follow the served status", async () => {
    const { data } = await loadYearReviewData("ka");
    const { facts: balance } = await loadServedGeneralGovernmentBalanceData();
    expect(data.balance.years).toEqual(balance.map((fact) => fact.year).sort((a, b) => a - b));
    for (const fact of balance) {
      expect(data.balance.projection[data.balance.years.indexOf(fact.year)]).toBe(fact.status === "projection");
    }
    const { facts: debt } = await loadServedGovernmentDebtData();
    const service = debt.filter((fact) => fact.family === "service");
    for (const fact of service) {
      expect(data.debt.service.projection[data.debt.service.years.indexOf(fact.year)]).toBe(fact.status === "projection_existing_portfolio");
    }
    expect(data.debt.stock.years.length).toBeGreaterThan(0);
    for (const fact of debt.filter((row) => row.family === "stock")) expect(fact.status).toBe("actual");
  });

  test("2025's tax revenue, balance and debt are the Revenue, Deficit and Debt pages' own figures", async () => {
    const { data } = await loadYearReviewData("ka");
    const kpis = new Map(glanceKpis(data, 2025).map((kpi) => [kpi.id, kpi]));
    const year = { start: 2025, end: 2025 };

    // Revenue: the page's model (MainExplorer on the revenue side), its tax items summed.
    const { facts, glossary, gdpFacts } = await loadServedExplorerData();
    const revenue = buildExplorerModel({
      facts: facts.filter((fact) => fact.side === "revenue").map(projectBudgetFact),
      glossary: new Map(Array.from(glossary.values(), (entry) => [entry.id, publicGlossaryEntry(entry)])),
      gdpFacts: gdpFacts.map(projectGdpFact),
      side: "revenue",
      selectedItemIds: [...TAX_IDS],
      startYear: year.start,
      endYear: year.end,
      measure: "nominal",
    });
    expect(revenue.tableRows.map((row) => row.itemId).sort()).toEqual([...TAX_IDS].sort());
    const tax = kpis.get("tax")!;
    expect(tax).toMatchObject({ year: 2025, fallback: false, planned: false });
    expect(tax.value).toBeCloseTo(sum(revenue.tableRows.map((row) => row.valuesByYear[2025] ?? null)), 2);

    // Balance: the Deficit page's model, % of GDP.
    const { facts: balanceFacts } = await loadServedGeneralGovernmentBalanceData();
    // The page's own presentation (lib/pages/deficit.tsx): the model names its one series in English from it.
    const deficitPresentation = await getPresentation("ka", ["format", "main", "deficit"], [DEFICIT_SERIES_ID], [DEFICIT_SERIES_ID]);
    const deficit = buildDeficitExplorerModel({ facts: balanceFacts.map(projectBalanceFact), range: year, percentage: true, selected: true }, deficitPresentation);
    const balance = kpis.get("balance")!;
    expect(balance).toMatchObject({ year: 2025, fallback: false, planned: false });
    expect(deficit.points).toHaveLength(1);
    expect(balance.value).toBe(deficit.points[0]!.value);

    // Debt: the Debt page's model, the stock total at the end of 2025.
    const { facts: debtFacts } = await loadServedGovernmentDebtData();
    const debt = buildDebtExplorerModel({
      facts: debtFacts.map(projectDebtFact),
      gdpFacts: gdpFacts.map(projectGdpFact),
      family: "stock",
      selectedIds: ["debt.stock.total"],
      range: year,
      shareOfGdp: false,
    });
    const debtKpi = kpis.get("debt")!;
    expect(debtKpi).toMatchObject({ year: 2025, fallback: false });
    expect(debtKpi.value).toBe(debt.totalRow!.valuesByYear[2025]);
  });

  test("municipal places agree with the Municipalities page", async () => {
    const { data } = await loadYearReviewData("ka");
    expect(data.municipal.year).toBe(MUNICIPAL_PER_RESIDENT_YEAR);
    expect(data.municipal.places.length).toBe(64);
    const municipal = await loadServedMunicipalData();
    const list = buildMunicipalListRows({
      municipalities: municipal.municipalities,
      regionLabels: new Map(municipal.regions.map((region) => [region.id, region.kaLabel])),
      totalFacts: municipal.totalFacts,
      populationFacts: municipal.populationFacts,
      adjaraBudgetAdjustments: municipal.adjaraBudgetAdjustments,
      year: MUNICIPAL_PER_RESIDENT_YEAR,
    });
    const byCode = new Map(list.municipalities.map((row) => [row.id, row]));
    const residents = new Map(municipal.populationFacts.map((row) => [row.municipalityCode, row.populationPersons]));
    for (const place of data.municipal.places) {
      expect(place.perResidentGel).toBe(byCode.get(place.code)!.budgetPerResidentGel);
      expect(place.totalGel).toBe(byCode.get(place.code)!.valueGel);
      expect(place.populationPersons).toBe(residents.get(place.code));
    }
    // The median is the Municipalities page's own (its index KPI).
    expect(data.municipal.median).toBe(buildMedianMunicipalBudgetPerResident(list.municipalities));
    // One dot-plot row per region, Tbilisi included, and every place's region is listed.
    const regionIds = new Set(data.municipal.regions.map((region) => region.id));
    expect(regionIds.size).toBe(11);
    expect(regionIds.has("region.tbilisi")).toBe(true);
    for (const place of data.municipal.places) expect(regionIds.has(place.regionId)).toBe(true);
  });

  test("the English page names every series in English", async () => {
    const { data, presentation } = await loadYearReviewData("en");
    expect(presentation.locale).toBe("en");
    const labels = [
      ...data.budget.fields, ...data.budget.institutions, ...data.budget.receipts, ...data.spendingTypes.types,
      ...data.municipal.regions, ...data.municipal.places,
    ].map((row) => row.label);
    for (const label of labels) expect(label).not.toMatch(/[Ⴀ-ჿ]/);
    expect(data.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
