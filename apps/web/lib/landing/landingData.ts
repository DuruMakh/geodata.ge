import type { GlossaryEntry } from "../data/glossary";
import type { BudgetFactImportRow } from "../data/importBudgetFacts";
import type { SourceDocumentRow } from "../data/sources";
import { chooseActivePublicFacts } from "../data/activeFacts";
import { isDerivedTotalItemId } from "../explorer/explorerData";
import { colorForItem } from "../explorer/colors";

// Server-side model for the landing page (GeoData Site v2 design): the revenue
// sparkline, the 30-cell expenditure waffle, and the CSV preview are computed
// from the same active facts the explorer renders, so both screens always agree.

export type LandingModel = {
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
  csvLines: [string, string, string];
};

type BuildLandingModelInput = {
  facts: BudgetFactImportRow[];
  glossary: Map<string, GlossaryEntry>;
  sourceDocuments: SourceDocumentRow[];
};

const SPARK_WIDTH = 260;
const SPARK_HEIGHT = 84;
const SPARK_PAD = 6;
const WAFFLE_CELLS = 30;

export function buildLandingModel({ facts, glossary, sourceDocuments }: BuildLandingModelInput): LandingModel {
  const active = chooseActivePublicFacts(facts).filter((fact) => !isDerivedTotalItemId(fact.itemId));
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

  // CSV preview: the download's real header plus one revenue and one
  // expenditure row, labels from the glossary and basis from the active fact.
  const vatFact = revenueFacts.find((fact) => fact.year === revMax && fact.itemId === "revenue.vat");
  const socialFact = expenditureFacts.find((fact) => fact.year === expMax && fact.itemId === "spending.social_protection");
  const csvRow = (fact: BudgetFactImportRow | undefined) =>
    fact
      ? `${fact.year},${fact.itemId},${glossary.get(fact.itemId)?.kaLabel ?? fact.itemId},${fact.amountGel},${fact.basis}`
      : "";
  const csvLines: [string, string, string] = ["year,category_id,ka_label,amount_gel,basis", csvRow(vatFact), csvRow(socialFact)];

  return {
    revMin,
    revMax,
    expMax,
    yearsLabel: revMin && revMax ? `${revMin}–${revMax}` : "",
    updatedAt: sourceDocuments.map((source) => source.lastReviewedAt).sort().at(-1) ?? "",
    sparkTotal,
    sparkVat,
    sparkEndX: px(revenueYears.length - 1),
    sparkEndY: py(totals.at(-1) ?? 0),
    waffleCells: waffleCells.slice(0, WAFFLE_CELLS),
    csvLines,
  };
}
