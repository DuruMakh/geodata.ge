import { chooseActivePublicFacts } from "../data/activeFacts";
import { loadServedDemographyData } from "../data/demography/importDemography";
import { SERIES } from "../data/demography/series";
import type { ServedDemographyObservation } from "../data/demography/types";
import type { ServedSectorObservation } from "../data/economicSectors/types";
import { EXPENDITURE_TYPES, loadServedExpenditureTypesData } from "../data/expenditureTypes/importExpenditureTypes";
import { EXPENDITURE_TYPES_TOTAL } from "../data/expenditureTypes/types";
import { MUNICIPAL_COUNTRY_ID } from "../data/municipal/types";
import {
  loadServedExplorerData,
  loadServedGeneralGovernmentBalanceData,
  loadServedGovernmentDebtData,
  loadServedMunicipalData,
  type ExplorerData,
  type MunicipalData,
} from "../data/servedData";
import { citedReviewedAt } from "../data/sources";
import { loadServedTaxBreaksRefundsData, toClientTaxBreaksRefundsFact } from "../data/taxBreaksRefunds/importTaxBreaksRefunds";
import type { TaxBreaksRefundsFact } from "../data/taxBreaksRefunds/types";
import { colorForItem, SERIES_COLORS } from "../explorer/colors";
import { isDerivedTotalItemId } from "../explorer/explorerData";
import { buildMunicipalListRows, MUNICIPAL_PER_RESIDENT_YEAR } from "../explorer/municipalData";
import { publicLabel } from "../i18n/labels";
import { message } from "../i18n/messages";
import { getMessages } from "../i18n/messages.server";
import { getPresentation } from "../i18n/presentation.server";
import type { Locale, Presentation } from "../i18n/types";
import { OTHER_UNCLASSIFIED_ID, REVENUE_BANDS, TAX_BAND_IDS } from "../landing/chapters/budgetSeries";
import { editionLabel, loadImfWeoManifest } from "../methodology/workbookSources";
import type { ServedGeneralGovernmentBalanceFact, ServedGovernmentDebtFact } from "../servedRows";
import type { Category, Values, YearReviewData, YearReviewSources } from "./types";

/** The seven served loads, by name: everything the page reads. */
export type YearReviewInput = {
  explorer: ExplorerData;
  expenditureTypes: { facts: ServedSectorObservation[] };
  taxBreaksRefunds: { facts: TaxBreaksRefundsFact[] };
  balance: { facts: ServedGeneralGovernmentBalanceFact[] };
  debt: { facts: ServedGovernmentDebtFact[] };
  municipal: MunicipalData;
  demography: { facts: ServedDemographyObservation[] };
};

/** Running costs: the subtotal of the types beside it, so a chart of the types leaves it out with the grand total. */
const EXPENDITURE_TYPES_EXPENSE = "spending_type.expense";
const TAX_IDS = new Set(TAX_BAND_IDS.flatMap((band) => REVENUE_BANDS[band]));
const BANDED_REVENUE_IDS = new Set(Object.values(REVENUE_BANDS).flat());

function sortedYears(rows: readonly { year: number }[]): number[] {
  return [...new Set(rows.map((row) => row.year))].sort((left, right) => left - right);
}

function span(years: readonly number[]): number[] {
  if (years.length === 0) return [];
  const first = Math.min(...years);
  return Array.from({ length: Math.max(...years) - first + 1 }, (_, index) => first + index);
}

/** One value per year of `years`: the sum of the rows of that year, null where none. */
function aligned<T extends { year: number }>(years: readonly number[], rows: readonly T[], value: (row: T) => number | null): Values {
  const index = new Map(years.map((year, position) => [year, position]));
  const values: Values = years.map(() => null);
  for (const row of rows) {
    const position = index.get(row.year);
    const amount = value(row);
    if (position === undefined || amount === null) continue;
    values[position] = (values[position] ?? 0) + amount;
  }
  return values;
}

/** Largest in the default year first (a category without a value there last); spending.other_unclassified always last. */
function sortCategories<T extends Omit<Category, "color">>(categories: T[], defaultIndex: number): T[] {
  const amount = (category: T) => category.values[defaultIndex] ?? -Infinity;
  return categories.sort((left, right) => {
    if ((left.id === OTHER_UNCLASSIFIED_ID) !== (right.id === OTHER_UNCLASSIFIED_ID)) return left.id === OTHER_UNCLASSIFIED_ID ? 1 : -1;
    return amount(right) - amount(left) || left.id.localeCompare(right.id);
  });
}

/** Coloured by position in the sorted list, as the explorer colours its items (every budget id has a fixed hex). */
function coloured<T extends Omit<Category, "color">>(categories: T[]): (T & { color: string })[] {
  return categories.map((category, index) => ({ ...category, color: colorForItem(category.id, index) }));
}

function buildBudget(input: YearReviewInput, presentation: Presentation): YearReviewData["budget"] {
  const { facts, glossary, adminFacts, adminCategories, gdpFacts } = input.explorer;
  const { locale, englishLabels } = presentation;
  const active = chooseActivePublicFacts(facts).filter((fact) => !isDerivedTotalItemId(fact.itemId));
  const expenditure = active.filter((fact) => fact.side === "expenditure");
  const revenue = active.filter((fact) => fact.side === "revenue");

  const years = span(expenditure.map((fact) => fact.year));
  const planned = years.map((year) => expenditure.some((fact) => fact.year === year && fact.basis === "planned"));
  const defaultYear = years.findLast((_, index) => !planned[index]);
  if (defaultYear === undefined) throw new Error("Year in review: no state-budget year has actual expenditure");
  const defaultIndex = years.indexOf(defaultYear);

  const budgetLabel = (id: string) => publicLabel(locale, id, glossary.get(id)?.kaLabel ?? id, englishLabels);
  const byItem = <T extends { itemId: string; year: number; amountGel: number }>(rows: readonly T[], label: (id: string, row: T) => string) =>
    Array.from(Map.groupBy(rows, (row) => row.itemId), ([id, itemRows]) => ({
      id, label: label(id, itemRows.at(-1)!), values: aligned(years, itemRows, (row) => row.amountGel),
    }));

  const fields = coloured(sortCategories(byItem(expenditure, budgetLabel), defaultIndex));

  const categoryLabels = new Map(adminCategories.map((category) => [category.id, category.kaLabel]));
  const institutions = coloured(sortCategories(byItem(
    adminFacts.filter((fact) => fact.level === "admin_category"),
    (id, fact) => publicLabel(locale, id, categoryLabels.get(id) ?? fact.officialLabelKa ?? id, englishLabels),
  ), defaultIndex));

  for (const fact of revenue) {
    if (!BANDED_REVENUE_IDS.has(fact.itemId)) throw new Error(`Revenue item ${fact.itemId} is not assigned to a homepage band`);
  }
  const receipts = coloured(sortCategories(byItem(revenue, budgetLabel), defaultIndex))
    .map((receipt) => ({ ...receipt, tax: TAX_IDS.has(receipt.id) }));

  const population = input.demography.facts.filter((fact) => fact.seriesId === SERIES.populationTotal && fact.geographyId === MUNICIPAL_COUNTRY_ID);
  return {
    years,
    planned,
    defaultYear,
    fields,
    institutions,
    receipts,
    gdp: aligned(years, gdpFacts, (fact) => fact.gdpCurrentPricesGel),
    population: aligned(years, population, (fact) => fact.value),
  };
}

function buildSpendingTypes(input: YearReviewInput, presentation: Presentation): YearReviewData["spendingTypes"] {
  const nominal = input.expenditureTypes.facts.filter((fact) => fact.measure === "nominal");
  const years = sortedYears(nominal);
  const series = (id: string) => aligned(years, nominal.filter((fact) => fact.seriesId === id), (fact) => fact.value);
  const types = [...EXPENDITURE_TYPES]
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .filter((type) => type.id !== EXPENDITURE_TYPES_TOTAL && type.id !== EXPENDITURE_TYPES_EXPENSE)
    .map((type) => {
      const color = SERIES_COLORS[type.id];
      if (!color) throw new Error(`Year in review: spending type ${type.id} has no colour`);
      return { id: type.id, label: publicLabel(presentation.locale, type.id, type.labelKa, presentation.englishLabels), color, values: series(type.id) };
    });
  return { years, total: series(EXPENDITURE_TYPES_TOTAL), types };
}

function buildTaxBreaksAndRefunds(input: YearReviewInput): Pick<YearReviewData, "taxBreaks" | "refunds"> {
  // Served values are million GEL as exact decimal text; the client projection turns them into lari at full precision.
  const facts = input.taxBreaksRefunds.facts.map(toClientTaxBreaksRefundsFact);
  const breaks = facts.filter((fact) => fact.indicatorId.startsWith("tax_breaks."));
  const refunds = facts.filter((fact) => fact.indicatorId === "tax_refunds.total");
  const breakYears = sortedYears(breaks);
  const indicator = (id: string) => aligned(breakYears, breaks.filter((fact) => fact.indicatorId === id), (fact) => fact.value);
  const refundYears = sortedYears(refunds);
  return {
    taxBreaks: { years: breakYears, vat: indicator("tax_breaks.vat.total"), income: indicator("tax_breaks.income.total"), all: indicator("tax_breaks.total") },
    refunds: { years: refundYears, values: aligned(refundYears, refunds, (fact) => fact.value) },
  };
}

function buildBalance(input: YearReviewInput): YearReviewData["balance"] {
  const { facts } = input.balance;
  const years = sortedYears(facts);
  return {
    years,
    pctGdp: aligned(years, facts, (fact) => fact.generalGovernmentBalancePctGdp),
    gel: aligned(years, facts, (fact) => fact.generalGovernmentBalanceGel),
    projection: years.map((year) => facts.some((fact) => fact.year === year && fact.status === "projection")),
  };
}

function buildDebt(input: YearReviewInput): YearReviewData["debt"] {
  const { facts } = input.debt;
  const family = (name: ServedGovernmentDebtFact["family"]) => facts.filter((fact) => fact.family === name);
  const series = (rows: ServedGovernmentDebtFact[], years: number[], id: ServedGovernmentDebtFact["seriesId"]) =>
    aligned(years, rows.filter((fact) => fact.seriesId === id), (fact) => fact.value);

  const stock = family("stock").filter((fact) => fact.status === "actual");
  const stockYears = sortedYears(stock);
  const rates = family("rate");
  const rateYears = sortedYears(rates);
  const service = family("service");
  const serviceYears = sortedYears(service);
  return {
    stock: {
      years: stockYears,
      external: series(stock, stockYears, "debt.stock.external"),
      domestic: series(stock, stockYears, "debt.stock.domestic"),
      total: series(stock, stockYears, "debt.stock.total"),
    },
    rates: {
      years: rateYears,
      total: series(rates, rateYears, "debt.rate.total"),
      external: series(rates, rateYears, "debt.rate.external"),
      domestic: series(rates, rateYears, "debt.rate.domestic"),
    },
    service: {
      years: serviceYears,
      principal: series(service, serviceYears, "debt.service.principal"),
      interest: series(service, serviceYears, "debt.service.interest"),
      projection: serviceYears.map((year) => service.some((fact) => fact.year === year && fact.status === "projection_existing_portfolio")),
    },
  };
}

/** The Municipalities page's own list (same year, population and Adjara adjustment), so the two pages agree. */
function buildMunicipal(input: YearReviewInput, presentation: Presentation): YearReviewData["municipal"] {
  const { municipalities, regions, totalFacts, populationFacts, adjaraBudgetAdjustments } = input.municipal;
  const { locale, englishLabels } = presentation;
  const list = buildMunicipalListRows({
    municipalities,
    regionLabels: new Map(regions.map((region) => [region.id, region.kaLabel])),
    totalFacts,
    populationFacts,
    adjaraBudgetAdjustments,
    year: MUNICIPAL_PER_RESIDENT_YEAR,
  });
  return {
    year: MUNICIPAL_PER_RESIDENT_YEAR,
    regions: [...regions]
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((region) => ({ id: region.id, label: publicLabel(locale, region.id, region.kaLabel, englishLabels) })),
    places: list.municipalities.map((row) => ({
      code: row.id,
      label: publicLabel(locale, row.id, row.nameKa, englishLabels),
      regionId: row.regionId!,
      totalGel: row.valueGel,
      perResidentGel: row.budgetPerResidentGel!,
    })),
  };
}

/** Pure: the page's data object from the served loads, named in `presentation.locale`. */
export function buildYearReviewData(input: YearReviewInput, presentation: Presentation, sources: YearReviewSources): YearReviewData {
  const { facts, adminFacts, sourceDocuments } = input.explorer;
  return {
    budget: buildBudget(input, presentation),
    spendingTypes: buildSpendingTypes(input, presentation),
    ...buildTaxBreaksAndRefunds(input),
    balance: buildBalance(input),
    debt: buildDebt(input),
    municipal: buildMunicipal(input, presentation),
    // Dated from the budget and ministry facts, as the page was before (lib/pages/analysis.tsx) and the sitemap dates it.
    updatedAt: citedReviewedAt(sourceDocuments, [...facts, ...adminFacts]),
    sources,
  };
}

/** The source lines of the Tax breaks and refunds, Deficit, Debt, Spending by type and Municipalities pages, worded as those pages word them. */
async function loadSources(locale: Locale): Promise<YearReviewSources> {
  const [messages, manifest] = await Promise.all([getMessages(locale, ["taxBreaksRefunds", "deficit", "debt", "expenditureTypes", "municipal"]), loadImfWeoManifest()]);
  return {
    taxBreaks: message(messages, "taxBreaksRefunds.sourceNote"),
    balance: message(messages, "deficit.source", { edition: editionLabel(messages, manifest.publicationDate) }),
    debt: message(messages, "debt.source"),
    spendingTypes: message(messages, "expenditureTypes.source"),
    municipal: message(messages, "municipal.source"),
  };
}

/** The ids the page names: budget items, ministries, spending types, municipalities and regions. */
export function yearReviewLabelIds(input: YearReviewInput): string[] {
  return [
    ...input.explorer.glossary.keys(),
    ...input.explorer.adminCategories.map((category) => category.id),
    ...EXPENDITURE_TYPES.map((type) => type.id),
    ...input.municipal.municipalities.map((municipality) => municipality.code),
    ...input.municipal.regions.map((region) => region.id),
  ];
}

export async function loadYearReviewData(locale: Locale): Promise<{ data: YearReviewData; presentation: Presentation }> {
  const [explorer, expenditureTypes, taxBreaksRefunds, balance, debt, municipal, demography, sources] = await Promise.all([
    loadServedExplorerData(),
    loadServedExpenditureTypesData(),
    loadServedTaxBreaksRefundsData(),
    loadServedGeneralGovernmentBalanceData(),
    loadServedGovernmentDebtData(),
    loadServedMunicipalData(),
    loadServedDemographyData(),
    loadSources(locale),
  ]);
  const input: YearReviewInput = { explorer, expenditureTypes, taxBreaksRefunds, balance, debt, municipal, demography };
  // The English names ride along on the Georgian page too, as on the page this replaces (lib/pages/analysis.tsx).
  const ids = yearReviewLabelIds(input);
  const presentation = await getPresentation(locale, ["yearReview", "format", "main"], ids, ids);
  return { data: buildYearReviewData(input, presentation, sources), presentation };
}
