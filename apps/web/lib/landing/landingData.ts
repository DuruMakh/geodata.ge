import type { GlossaryEntry } from "../data/glossary";
import {
  MUNICIPAL_COUNTRY_ID,
  type Municipality,
  type MunicipalTotalFact,
} from "../data/municipal/types";
import type { SourceDocumentRow } from "../data/sources";
import type { ServedBudgetFact } from "../servedRows";
import { chooseActivePublicFacts } from "../data/activeFacts";
import { isDerivedTotalItemId } from "../explorer/explorerData";
import { colorForItem } from "../explorer/colors";

// Server-side model for the landing page (GeoData Site v2 design): the revenue
// sparkline, the 30-cell expenditure waffle, and the Excel preview are computed
// from the same active facts the explorer renders, so both screens always agree.

export type ExcelPreview = {
  sheetNames: ["მარტივი ცხრილი", "მონაცემები", "წყაროები"];
  headers: ["კატეგორია", string, string];
  rows: Array<[string, number, number]>;
};

export type LandingBasisStatus = "actual" | "planned" | "mixed";

export type LandingSummaryRow = {
  id: string;
  labelKa: string;
  amountGel: number;
  share: number;
};

export type LandingDatasetSummary = {
  latestYear: number;
  totalGel: number;
  basis: LandingBasisStatus;
  rows: LandingSummaryRow[];
};

export type LandingContext = {
  yearsLabel: string;
  updatedAt: string;
};

export type LandingModel = LandingContext & {
  revMin: number;
  revMax: number;
  expMax: number;
  yearsLabel: string;
  updatedAt: string;
  sparkTotal: string;
  sparkVat: string;
  sparkEndX: string;
  sparkEndY: string;
  waffleCells: string[];
  excelPreview: ExcelPreview;
  expenditure: LandingDatasetSummary;
  revenue: LandingDatasetSummary;
  municipalities: LandingDatasetSummary;
  commonLatestYear: number | null;
};

type BuildLandingModelInput = {
  facts: ServedBudgetFact[];
  glossary: Map<string, GlossaryEntry>;
  sourceDocuments: SourceDocumentRow[];
  municipalities: Municipality[];
  municipalTotalFacts: MunicipalTotalFact[];
  municipalCountryTotalFacts: MunicipalTotalFact[];
};

const SPARK_WIDTH = 260;
const SPARK_HEIGHT = 84;
const SPARK_PAD = 6;
const WAFFLE_CELLS = 30;

function basisStatus(rows: ServedBudgetFact[]): LandingBasisStatus {
  const hasActual = rows.some((row) => row.basis === "actual");
  const hasPlanned = rows.some((row) => row.basis === "planned");
  return hasActual && hasPlanned ? "mixed" : hasPlanned ? "planned" : "actual";
}

function buildNationalSummary(
  activeFacts: ServedBudgetFact[],
  glossary: Map<string, GlossaryEntry>,
  side: ServedBudgetFact["side"],
): LandingDatasetSummary {
  const sideFacts = activeFacts.filter((fact) => fact.side === side && !isDerivedTotalItemId(fact.itemId));
  const latestYear = sideFacts.map((fact) => fact.year).sort((left, right) => left - right).at(-1) ?? 0;
  const latestFacts = sideFacts.filter((fact) => fact.year === latestYear);
  const totalGel = latestFacts.reduce((sum, fact) => sum + fact.amountGel, 0);

  return {
    latestYear,
    totalGel,
    basis: basisStatus(latestFacts),
    rows: latestFacts
      .slice()
      .sort((left, right) => right.amountGel - left.amountGel || left.itemId.localeCompare(right.itemId))
      .slice(0, 4)
      .map((fact) => ({
        id: fact.itemId,
        labelKa: glossary.get(fact.itemId)?.kaLabel ?? fact.itemId,
        amountGel: fact.amountGel,
        share: fact.amountGel / totalGel,
      })),
  };
}

function buildMunicipalSummary(
  municipalities: Municipality[],
  municipalTotalFacts: MunicipalTotalFact[],
  municipalCountryTotalFacts: MunicipalTotalFact[],
): LandingDatasetSummary {
  const countryTotal = municipalCountryTotalFacts
    .filter((fact) => fact.municipalityCode === MUNICIPAL_COUNTRY_ID)
    .slice()
    .sort((left, right) => left.year - right.year)
    .at(-1)!;
  const labels = new Map(municipalities.map((municipality) => [municipality.code, municipality.displayNameKa]));

  return {
    latestYear: countryTotal.year,
    totalGel: countryTotal.publicTotalGel,
    basis: "actual",
    rows: municipalTotalFacts
      .filter((fact) => fact.year === countryTotal.year && labels.has(fact.municipalityCode))
      .slice()
      .sort(
        (left, right) =>
          right.publicTotalGel - left.publicTotalGel || left.municipalityCode.localeCompare(right.municipalityCode),
      )
      .slice(0, 4)
      .map((fact) => ({
        id: fact.municipalityCode,
        labelKa: labels.get(fact.municipalityCode)!,
        amountGel: fact.publicTotalGel,
        share: fact.publicTotalGel / countryTotal.publicTotalGel,
      })),
  };
}

function buildLandingContextFromActive(
  activeFacts: ServedBudgetFact[],
  sourceDocuments: SourceDocumentRow[],
): LandingContext {
  const revenueYears = Array.from(new Set(activeFacts.filter((fact) => fact.side === "revenue").map((fact) => fact.year))).sort(
    (left, right) => left - right,
  );
  const revMin = revenueYears.at(0) ?? 0;
  const revMax = revenueYears.at(-1) ?? 0;

  return {
    yearsLabel: revMin && revMax ? `${revMin}–${revMax}` : "",
    updatedAt: sourceDocuments.map((source) => source.lastReviewedAt).sort().at(-1) ?? "",
  };
}

export function buildLandingContext({
  facts,
  sourceDocuments,
}: Pick<BuildLandingModelInput, "facts" | "sourceDocuments">): LandingContext {
  return buildLandingContextFromActive(
    chooseActivePublicFacts(facts).filter((fact) => !isDerivedTotalItemId(fact.itemId)),
    sourceDocuments,
  );
}

export function buildLandingModel({
  facts,
  glossary,
  sourceDocuments,
  municipalities,
  municipalTotalFacts,
  municipalCountryTotalFacts,
}: BuildLandingModelInput): LandingModel {
  const active = chooseActivePublicFacts(facts).filter((fact) => !isDerivedTotalItemId(fact.itemId));
  const context = buildLandingContextFromActive(active, sourceDocuments);
  const expenditure = buildNationalSummary(active, glossary, "expenditure");
  const revenue = buildNationalSummary(active, glossary, "revenue");
  const municipalSummary = buildMunicipalSummary(municipalities, municipalTotalFacts, municipalCountryTotalFacts);
  const commonLatestYear =
    expenditure.latestYear === revenue.latestYear && revenue.latestYear === municipalSummary.latestYear
      ? expenditure.latestYear
      : null;
  const revenueFacts = active.filter((fact) => fact.side === "revenue");
  const expenditureFacts = active.filter((fact) => fact.side === "expenditure");

  const revenueYears = Array.from(new Set(revenueFacts.map((fact) => fact.year))).sort((a, b) => a - b);
  const expenditureYears = Array.from(new Set(expenditureFacts.map((fact) => fact.year))).sort((a, b) => a - b);
  const revMin = revenueYears.at(0) ?? 0;
  const revMax = revenueYears.at(-1) ?? 0;
  const expMax = expenditureYears.at(-1) ?? 0;

  // Revenue sparkline: total per year (ink) with VAT underneath (accent),
  // both normalized to the max total, points on a 260×84 viewBox.
  const totalsByYear = new Map<number, number>();
  const vatByYear = new Map<number, number>();
  for (const fact of revenueFacts) {
    totalsByYear.set(fact.year, (totalsByYear.get(fact.year) ?? 0) + fact.amountGel);
    if (fact.itemId === "revenue.vat") vatByYear.set(fact.year, fact.amountGel);
  }
  const totals = revenueYears.map((year) => totalsByYear.get(year) ?? 0);
  const maxTotal = Math.max(...totals, 1);
  const px = (index: number) =>
    (SPARK_PAD + (revenueYears.length > 1 ? (index / (revenueYears.length - 1)) * (SPARK_WIDTH - 2 * SPARK_PAD) : 0)).toFixed(1);
  const py = (value: number) => (SPARK_HEIGHT - SPARK_PAD - (value / maxTotal) * (SPARK_HEIGHT - 2 * SPARK_PAD)).toFixed(1);
  const sparkTotal = totals.map((value, index) => `${px(index)},${py(value)}`).join(" ");
  const sparkVat = vatByYear.size
    ? revenueYears.map((year, index) => `${px(index)},${py(vatByYear.get(year) ?? 0)}`).join(" ")
    : "";

  // Expenditure waffle: latest year's field structure, 30 cells distributed by
  // largest remainder so the grid always sums to exactly 30.
  const latestFields = expenditureFacts
    .filter((fact) => fact.year === expMax)
    .sort((a, b) => b.amountGel - a.amountGel);
  const fieldTotal = latestFields.reduce((sum, fact) => sum + fact.amountGel, 0) || 1;
  const rawCells = latestFields.map((fact) => (fact.amountGel / fieldTotal) * WAFFLE_CELLS);
  const floors = rawCells.map(Math.floor);
  const remaining = WAFFLE_CELLS - floors.reduce((sum, cells) => sum + cells, 0);
  const byFraction = rawCells
    .map((raw, index) => ({ index, fraction: raw - Math.floor(raw) }))
    .sort((a, b) => b.fraction - a.fraction);
  for (let k = 0; k < remaining && byFraction.length > 0; k++) {
    const slot = byFraction[k % byFraction.length];
    if (slot) floors[slot.index] = (floors[slot.index] ?? 0) + 1;
  }
  const waffleCells: string[] = [];
  latestFields.forEach((fact, index) => {
    const color = colorForItem(fact.itemId, index);
    for (let k = 0; k < (floors[index] ?? 0); k++) waffleCells.push(color);
  });

  const [previousYear = "", latestYear = ""] = expenditureYears.slice(-2);
  const previewFacts = expenditureFacts.filter((fact) => fact.year === previousYear || fact.year === latestYear);
  const previewRows = Array.from(new Set(previewFacts.map((fact) => fact.itemId)))
    .map((itemId) => {
      const values = [previousYear, latestYear].map((year) => previewFacts.find((fact) => fact.itemId === itemId && fact.year === year)?.amountGel);
      return { itemId, values };
    })
    .filter((row): row is { itemId: string; values: [number, number] } => row.values[0] !== undefined && row.values[1] !== undefined)
    .sort((a, b) => b.values[1] - a.values[1])
    .slice(0, 1)
    .map((row) => [glossary.get(row.itemId)?.kaLabel ?? row.itemId, row.values[0], row.values[1]] as [string, number, number]);
  const excelPreview: ExcelPreview = {
    sheetNames: ["მარტივი ცხრილი", "მონაცემები", "წყაროები"],
    headers: ["კატეგორია", String(previousYear), String(latestYear)],
    rows: previewRows,
  };

  return {
    ...context,
    revMin,
    revMax,
    expMax,
    sparkTotal,
    sparkVat,
    sparkEndX: px(revenueYears.length - 1),
    sparkEndY: py(totals.at(-1) ?? 0),
    waffleCells: waffleCells.slice(0, WAFFLE_CELLS),
    excelPreview,
    expenditure,
    revenue,
    municipalities: municipalSummary,
    commonLatestYear,
  };
}
