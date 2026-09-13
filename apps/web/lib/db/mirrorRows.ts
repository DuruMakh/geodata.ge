import type { Prisma } from "../generated/prisma/client";
import type {
  AdminSpendingCategory,
  AdminSpendingFact,
} from "../data/adminSpending/types";
import type { GlossaryEntry } from "../data/glossary";
import type { BudgetFactImportRow } from "../data/importBudgetFacts";
import type { NationalGdpFact } from "../data/nationalGdp/types";
import type { BasketWeightRow, CpiCategoryFact, CpiFact, InflationTargetRow } from "../data/inflation/types";
import type {
  ServedGeneralGovernmentBalanceFact,
  ServedGovernmentDebtFact,
} from "../servedRows";
import {
  ADJARA_REGION_ID,
  type AdjaraBudgetAdjustment,
  Municipality,
  MunicipalFunction,
  MunicipalFunctionFact,
  MunicipalRegion,
  MunicipalPopulationFact,
  MunicipalTotalFact,
} from "../data/municipal/types";
import type { SourceDocumentRow } from "../data/sources";
import type { SectorObservation } from "../data/economicSectors/types";

// Client-parameterized readers of the database mirror. They return exactly the
// same shapes as the CSV loaders. Used with the pooled singleton by the
// db-mode serving path (lib/db/servedDataDb.ts) and with the import's
// transaction client so the import can verify, before committing, that the
// serving path reproduces the CSV loaders row for row.
//
// PrismaClient is structurally assignable to Prisma.TransactionClient, so both
// callers share this type.
export type MirrorClient = Prisma.TransactionClient;

// DATE columns come back as JS Dates whose midnight may be UTC or local
// depending on the driver's DATE parsing; pick whichever components the
// midnight sits on so the calendar date survives on any machine timezone.
function isoDate(value: Date): string {
  if (value.getUTCHours() === 0 && value.getUTCMinutes() === 0) {
    return value.toISOString().slice(0, 10);
  }

  const year = String(value.getFullYear()).padStart(4, "0");
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export async function loadBudgetFactsFromMirror(db: MirrorClient): Promise<BudgetFactImportRow[]> {
  const facts = await db.budgetFact.findMany({
    orderBy: [{ year: "asc" }, { side: "asc" }, { itemId: "asc" }, { basis: "asc" }],
  });

  if (facts.length === 0) {
    throw new Error(
      "The database has no budget facts. Run `npm run data:import` first, " +
        "or build with GEODATA_DATA_SOURCE=csv. If the import has already " +
        "succeeded, check the role in DATABASE_URL: the mirror tables use " +
        "row level security, which hides all rows from non-owner roles.",
    );
  }

  return facts.map((fact) => ({
    year: fact.year,
    side: fact.side,
    itemId: fact.itemId,
    amountGel: Number(fact.amountGel),
    basis: fact.basis,
    sourceId: fact.sourceDocumentId,
    officialInstitution: fact.officialInstitution,
    officialProgram: fact.officialProgram,
    officialSubprogram: fact.officialSubprogram,
    publicSpendingFieldId: fact.publicSpendingFieldId,
    mappingConfidence: fact.mappingConfidence,
    mappingNotes: fact.mappingNotes,
  }));
}

export async function loadGlossaryFromMirror(db: MirrorClient): Promise<Map<string, GlossaryEntry>> {
  // sortOrder values repeat across the revenue and spending taxonomy files, so
  // a deterministic id tie-break keeps db builds reproducible.
  const items = await db.budgetItem.findMany({ orderBy: [{ sortOrder: "asc" }, { id: "asc" }] });
  const glossary = new Map<string, GlossaryEntry>();

  for (const item of items) {
    glossary.set(item.id, {
      id: item.id,
      kaLabel: item.kaLabel,
      enLabel: item.enLabel,
      description: item.description,
      notes: item.notes,
    });
  }

  return glossary;
}

export async function loadSourceDocumentsFromMirror(db: MirrorClient): Promise<SourceDocumentRow[]> {
  const sources = await db.sourceDocument.findMany({ orderBy: { id: "asc" } });

  return sources.map((source) => ({
    sourceId: source.id,
    sourceName: source.sourceName,
    sourceUrlOrFile: source.sourceUrlOrFile,
    lastReviewedAt: isoDate(source.lastReviewedAt),
  }));
}

export async function loadAdminFactsFromMirror(db: MirrorClient): Promise<AdminSpendingFact[]> {
  const facts = await db.adminSpendingFact.findMany({
    orderBy: [{ year: "asc" }, { itemId: "asc" }],
  });

  return facts.map((fact) => {
    if (fact.basis !== "actual") {
      throw new Error(`Admin spending fact ${fact.id} must have basis=actual, got ${fact.basis}`);
    }

    return {
      year: fact.year,
      itemId: fact.itemId,
      parentItemId: fact.parentItemId,
      level: fact.level,
      amountGel: Number(fact.amountGel),
      basis: "actual" as const,
      sourceId: fact.sourceId,
      officialCode: fact.officialCode,
      officialLabelKa: fact.officialLabelKa,
      officialInstitutionCode: fact.officialInstitutionCode,
      officialInstitutionLabelKa: fact.officialInstitutionLabelKa,
      mappingConfidence: fact.mappingConfidence,
      mappingNotes: fact.mappingNotes,
    };
  });
}

export async function loadAdminCategoriesFromMirror(
  db: MirrorClient,
): Promise<AdminSpendingCategory[]> {
  const categories = await db.adminSpendingCategory.findMany({
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });

  return categories.map((category) => ({
    id: category.id,
    kaLabel: category.kaLabel,
    enLabel: category.enLabel,
    sortOrder: category.sortOrder,
  }));
}

export async function loadNationalGdpFactsFromMirror(
  db: MirrorClient,
): Promise<NationalGdpFact[]> {
  const rows = await db.nationalGdpFact.findMany({ orderBy: { year: "asc" } });

  return rows.map((row) => ({
    year: row.year,
    gdpCurrentPricesGel: Number(row.gdpCurrentPricesGel),
    gdpCurrentPricesMillionGel: Number(row.gdpCurrentPricesGel) / 1_000_000,
    accountingStandard: row.accountingStandard,
    status: row.status,
    sourceId: row.sourceDocumentId,
    sourceSheet: row.sourceSheet,
    sourceCell: row.sourceCell,
    sourceUnit: row.sourceUnit as "mil. GEL",
    transformation: row.transformation,
    lastReviewedAt: isoDate(row.lastReviewedAt),
  }));
}

export async function loadGovernmentDebtFactsFromMirror(
  db: MirrorClient,
): Promise<ServedGovernmentDebtFact[]> {
  const rows = await db.governmentDebtFact.findMany({
    orderBy: [{ year: "asc" }, { seriesId: "asc" }],
  });

  return rows.map((row) => ({
    year: row.year,
    family: row.family as ServedGovernmentDebtFact["family"],
    seriesId: row.seriesId as ServedGovernmentDebtFact["seriesId"],
    value: decimalOrNull(row.value),
    valueKind: row.valueKind as ServedGovernmentDebtFact["valueKind"],
    status: row.status as ServedGovernmentDebtFact["status"],
    sourceId: row.sourceId,
    snapshotDate: row.snapshotDate === null ? null : isoDate(row.snapshotDate),
    lastReviewedAt: isoDate(row.lastReviewedAt),
  }));
}

export async function loadGeneralGovernmentBalanceFactsFromMirror(
  db: MirrorClient,
): Promise<ServedGeneralGovernmentBalanceFact[]> {
  const rows = await db.generalGovernmentBalanceFact.findMany({ orderBy: { year: "asc" } });

  return rows.map((row) => ({
    year: row.year,
    generalGovernmentBalancePctGdp: Number(row.generalGovernmentBalancePctGdp),
    generalGovernmentBalanceGel: Number(row.generalGovernmentBalanceGel),
    status: row.status as ServedGeneralGovernmentBalanceFact["status"],
    sourceId: row.sourceDocumentId,
    lastReviewedAt: isoDate(row.lastReviewedAt),
  }));
}

// Nullable money columns: a `null` column means "the official source does not
// publish this value" and must stay `null`. `Number(null)` is `0`, so a plain
// `Number(...)` conversion would silently turn "not published" into "spent
// zero" — this helper is what stands between the two.
function decimalOrNull(value: { toString(): string } | null): number | null {
  return value === null ? null : Number(value);
}

export async function loadMunicipalFunctionsFromMirror(
  db: MirrorClient,
): Promise<MunicipalFunction[]> {
  const rows = await db.municipalFunctionCategory.findMany({
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });

  return rows.map((row) => ({
    id: row.id,
    kaLabel: row.kaLabel,
    functionalCode: row.functionalCode,
    sortOrder: row.sortOrder,
  }));
}

export async function loadMunicipalRegionsFromMirror(
  db: MirrorClient,
): Promise<MunicipalRegion[]> {
  const rows = await db.municipalRegion.findMany({
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });

  return rows.map((row) => ({ id: row.id, kaLabel: row.kaLabel, sortOrder: row.sortOrder }));
}

export async function loadMunicipalitiesFromMirror(db: MirrorClient): Promise<Municipality[]> {
  const rows = await db.municipality.findMany({ orderBy: [{ sortId: "asc" }, { code: "asc" }] });

  return rows.map((row) => ({
    code: row.code,
    sortId: row.sortId,
    nameKa: row.nameKa,
    displayNameKa: row.displayNameKa,
    regionId: row.regionId,
    isSelfGoverningCity: row.isSelfGoverningCity,
  }));
}

export async function loadMunicipalFunctionFactsFromMirror(
  db: MirrorClient,
): Promise<MunicipalFunctionFact[]> {
  const rows = await db.municipalFunctionFact.findMany({
    orderBy: [{ year: "asc" }, { municipalityCode: "asc" }, { categoryId: "asc" }],
  });

  if (rows.length === 0) {
    throw new Error(
      "The database has no municipal function facts. Run `npm run data:import` first, " +
        "or build with GEODATA_DATA_SOURCE=csv. If the import has already succeeded, " +
        "check the role in DATABASE_URL: the mirror tables use row level security, " +
        "which hides all rows from non-owner roles.",
    );
  }

  return rows.map((row) => {
    if (row.basis !== "actual") {
      throw new Error(`Municipal function fact ${row.id} must have basis=actual, got ${row.basis}`);
    }

    return {
      year: row.year,
      municipalityCode: row.municipalityCode,
      categoryId: row.categoryId,
      functionalCode: row.functionalCode,
      amountGel: Number(row.amountGel),
      basis: "actual" as const,
      sourceId: row.sourceId,
    };
  });
}

export async function loadMunicipalTotalFactsFromMirror(
  db: MirrorClient,
): Promise<MunicipalTotalFact[]> {
  const rows = await db.municipalTotalFact.findMany({
    orderBy: [{ year: "asc" }, { municipalityCode: "asc" }],
  });

  return rows.map((row) => {
    if (row.basis !== "actual") {
      throw new Error(`Municipal total fact ${row.id} must have basis=actual, got ${row.basis}`);
    }

    return {
      year: row.year,
      municipalityCode: row.municipalityCode,
      publicTotalGel: Number(row.publicTotalGel),
      publicTotalMeasure: row.publicTotalMeasure,
      totalPaymentsGel: decimalOrNull(row.totalPaymentsGel),
      expensesGel: decimalOrNull(row.expensesGel),
      nonfinancialAssetGrowthGel: decimalOrNull(row.nonfinancialAssetGrowthGel),
      financialAssetGrowthGel: decimalOrNull(row.financialAssetGrowthGel),
      liabilityDecreaseGel: decimalOrNull(row.liabilityDecreaseGel),
      functionalSumGel: Number(row.functionalSumGel),
      reconciliationDifferenceGel: decimalOrNull(row.reconciliationDifferenceGel),
      warningAmountGel: decimalOrNull(row.warningAmountGel),
      showWarning: row.showWarning,
      warningType: row.warningType,
      basis: "actual" as const,
      sourceId: row.sourceId,
    };
  });
}

export async function loadMunicipalPopulationFactsFromMirror(
  db: MirrorClient,
): Promise<MunicipalPopulationFact[]> {
  const rows = await db.municipalPopulationFact.findMany({
    orderBy: [{ year: "asc" }, { municipalityCode: "asc" }],
  });

  return rows.map((row) => {
    if (row.year !== 2025) {
      throw new Error(`Municipal population fact ${row.id} must have year=2025, got ${row.year}`);
    }
    if (row.sourceDocumentId !== "source.geostat_municipal_population") {
      throw new Error(
        `Municipal population fact ${row.id} must use source.geostat_municipal_population`,
      );
    }
    const referenceDate = isoDate(row.referenceDate);
    if (referenceDate !== "2025-01-01") {
      throw new Error(
        `Municipal population fact ${row.id} must use 2025-01-01, got ${referenceDate}`,
      );
    }

    return {
      year: 2025,
      municipalityCode: row.municipalityCode,
      populationThousand: Number(row.populationThousand),
      populationPersons: row.populationPersons,
      referenceDate,
      sourceId: row.sourceDocumentId,
      sourceSheet: row.sourceSheet,
      sourceCell: row.sourceCell,
      sourceUnit: "(thousands)" as const,
      transformation: row.transformation,
      lastReviewedAt: isoDate(row.lastReviewedAt),
    };
  });
}

export async function loadMunicipalCountryFunctionFactsFromMirror(
  db: MirrorClient,
): Promise<MunicipalFunctionFact[]> {
  const rows = await db.municipalCountryFunctionFact.findMany({
    orderBy: [{ year: "asc" }, { scopeId: "asc" }, { categoryId: "asc" }],
  });

  if (rows.length === 0) {
    throw new Error(
      "The database has no Georgia municipal function facts. Run `npm run data:import` first, " +
        "or build with GEODATA_DATA_SOURCE=csv. If the import has already succeeded, " +
        "check the role in DATABASE_URL: the mirror tables use row level security, " +
        "which hides all rows from non-owner roles.",
    );
  }

  return rows.map((row) => {
    if (row.basis !== "actual") {
      throw new Error(
        `Georgia municipal function fact ${row.id} must have basis=actual, got ${row.basis}`,
      );
    }

    return {
      year: row.year,
      municipalityCode: row.scopeId,
      categoryId: row.categoryId,
      functionalCode: row.functionalCode,
      amountGel: Number(row.amountGel),
      basis: "actual" as const,
      sourceId: row.sourceId,
    };
  });
}

export async function loadMunicipalCountryTotalFactsFromMirror(
  db: MirrorClient,
): Promise<MunicipalTotalFact[]> {
  const rows = await db.municipalCountryTotalFact.findMany({
    orderBy: [{ year: "asc" }, { scopeId: "asc" }],
  });

  return rows.map((row) => {
    if (row.basis !== "actual") {
      throw new Error(
        `Georgia municipal total fact ${row.id} must have basis=actual, got ${row.basis}`,
      );
    }

    return {
      year: row.year,
      municipalityCode: row.scopeId,
      publicTotalGel: Number(row.publicTotalGel),
      publicTotalMeasure: row.publicTotalMeasure,
      totalPaymentsGel: decimalOrNull(row.totalPaymentsGel),
      expensesGel: decimalOrNull(row.expensesGel),
      nonfinancialAssetGrowthGel: decimalOrNull(row.nonfinancialAssetGrowthGel),
      financialAssetGrowthGel: decimalOrNull(row.financialAssetGrowthGel),
      liabilityDecreaseGel: decimalOrNull(row.liabilityDecreaseGel),
      functionalSumGel: Number(row.functionalSumGel),
      reconciliationDifferenceGel: decimalOrNull(row.reconciliationDifferenceGel),
      warningAmountGel: decimalOrNull(row.warningAmountGel),
      showWarning: row.showWarning,
      warningType: row.warningType,
      basis: "actual" as const,
      sourceId: row.sourceId,
    };
  });
}

export async function loadMunicipalAdjaraBudgetAdjustmentsFromMirror(
  db: MirrorClient,
): Promise<AdjaraBudgetAdjustment[]> {
  const rows = await db.municipalAdjaraBudgetAdjustment.findMany({
    orderBy: [{ year: "asc" }],
  });

  return rows.map((row) => {
    if (row.basis !== "actual") {
      throw new Error(`Adjara budget adjustment ${row.id} must have basis=actual, got ${row.basis}`);
    }
    if (row.scopeId !== ADJARA_REGION_ID) {
      throw new Error(
        `Adjara budget adjustment ${row.id} must have scopeId=${ADJARA_REGION_ID}, got ${row.scopeId}`,
      );
    }
    return {
      year: row.year,
      scopeId: row.scopeId,
      republicPaymentsGel: Number(row.republicPaymentsGel),
      municipalTransfersGel: Number(row.municipalTransfersGel),
      netRepublicPaymentsGel: Number(row.netRepublicPaymentsGel),
      basis: "actual" as const,
      republicSourceId: row.republicSourceId,
      transferSourceId: row.transferSourceId,
    };
  });
}

export async function loadGdpOverviewFactsFromMirror(db:MirrorClient):Promise<import('../data/gdpOverview/types').GdpObservation[]> {
  const rows=await db.gdpOverviewFact.findMany({orderBy:[{seriesId:'asc'},{year:'asc'}]});
  return rows.map(row=>({seriesId:row.seriesId as import('../data/gdpOverview/types').GdpSeriesId,year:row.year,value:row.value.toFixed(),unit:row.unit as import('../data/gdpOverview/types').GdpObservation['unit'],status:row.status as import('../data/gdpOverview/types').GdpObservation['status'],accountingStandard:row.accountingStandard as import('../data/gdpOverview/types').GdpObservation['accountingStandard'],sourceId:row.sourceDocumentId,sourceLocator:row.sourceLocator,lastReviewedAt:row.lastReviewedAt.toISOString().slice(0,10)}));
}

export async function loadEconomicSectorFactsFromMirror(db: MirrorClient): Promise<SectorObservation[]> {
  const rows = await db.economicSectorFact.findMany({ orderBy: [{ seriesId: "asc" }, { measure: "asc" }, { year: "asc" }] });
  return rows.map(row => ({
    seriesId: row.seriesId, measure: row.measure as SectorObservation["measure"], year: row.year,
    value: row.value.toFixed(), unit: row.unit as SectorObservation["unit"],
    valuation: row.valuation as SectorObservation["valuation"], priceBasis: row.priceBasis as SectorObservation["priceBasis"],
    calculation: row.calculation as SectorObservation["calculation"], status: row.status as SectorObservation["status"],
    sourceId: row.sourceDocumentId, sourceLocator: row.sourceLocator, lastReviewedAt: isoDate(row.lastReviewedAt),
  }));
}

export async function loadInflationCpiFactsFromMirror(db: MirrorClient): Promise<CpiFact[]> {
  const rows = await db.inflationCpiFact.findMany({ orderBy: [{ seriesId: "asc" }, { measure: "asc" }, { period: "asc" }] });
  return rows.map((row) => ({
    seriesId: row.seriesId as CpiFact["seriesId"],
    measure: row.measure as CpiFact["measure"],
    period: row.period,
    value: row.value.toFixed(),
    status: row.status as CpiFact["status"],
    sourceId: row.sourceDocumentId,
    sourceLocator: row.sourceLocator,
    lastReviewedAt: isoDate(row.lastReviewedAt),
  }));
}

export async function loadInflationTargetsFromMirror(db: MirrorClient): Promise<InflationTargetRow[]> {
  const rows = await db.inflationTarget.findMany({ orderBy: { effectiveFrom: "asc" } });
  return rows.map((row) => ({
    effectiveFrom: row.effectiveFrom,
    effectiveTo: row.effectiveTo,
    targetPct: row.targetPct.toFixed(),
    sourceId: row.sourceDocumentId,
    lastReviewedAt: isoDate(row.lastReviewedAt),
  }));
}

export async function loadInflationCategoryFactsFromMirror(db: MirrorClient): Promise<CpiCategoryFact[]> {
  const rows = await db.inflationCategoryFact.findMany({ orderBy: [{ categoryId: "asc" }, { measure: "asc" }, { period: "asc" }] });
  return rows.map((row) => ({
    categoryId: row.categoryId,
    coicopCode: row.coicopCode,
    level: row.level as CpiCategoryFact["level"],
    parentId: row.parentId,
    measure: row.measure as CpiCategoryFact["measure"],
    period: row.period,
    value: row.value.toFixed(),
    status: row.status as CpiCategoryFact["status"],
    sourceId: row.sourceDocumentId,
    sourceLocator: row.sourceLocator,
    lastReviewedAt: isoDate(row.lastReviewedAt),
  }));
}

export async function loadInflationBasketWeightsFromMirror(db: MirrorClient): Promise<BasketWeightRow[]> {
  const rows = await db.inflationBasketWeight.findMany({ orderBy: [{ categoryId: "asc" }, { year: "asc" }] });
  return rows.map((row) => ({
    categoryId: row.categoryId,
    year: row.year,
    weightPct: row.weightPct.toFixed(),
    sourceId: row.sourceDocumentId,
    lastReviewedAt: isoDate(row.lastReviewedAt),
  }));
}
