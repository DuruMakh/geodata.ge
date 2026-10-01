import { PRODUCT_DATASET_ID } from "../inflationProductSeries";
import type { FactQuerySnapshot } from "../types";
import type { CaveatContext, CaveatRule } from "./engine";

const key = (cell: CaveatContext["observations"][number]) => `${cell.seriesId}:${cell.period}`;
const derived = (c: CaveatContext) => c.observations.filter(cell => cell.calculationBasePeriod !== undefined);
const history = (c: CaveatContext, snapshot: FactQuerySnapshot) => c.observations.filter(cell =>
  snapshot.inflationProducts.historyNotes.some(note => note.productId === cell.seriesId &&
    (cell.calculationBasePeriod === undefined ? cell.year <= note.boundaryYear : Number(cell.calculationBasePeriod.slice(0, 4)) + 1 <= note.boundaryYear)),
);
const discrepancy = (c: CaveatContext) => c.observations.filter(cell => cell.seriesId === "cpi.product.p0148");
const owner = { methodologyRef: "inflation-products.md", methodologyRefEn: "/en/methodology/inflation" };

export const INFLATION_PRODUCT_CAVEAT_RULES: readonly CaveatRule[] = [
  {
    code: "inflation_product_cumulative_derived", severity: "severe", comparisonEffect: "none",
    messageKey: "caveats.inflation_product_cumulative_derived", ...owner,
    applies: c => c.datasetId === PRODUCT_DATASET_ID && derived(c).length > 0,
    affects: c => derived(c).map(key),
  },
  {
    code: "inflation_product_history_limits", severity: "note", comparisonEffect: "limits",
    messageKey: "caveats.inflation_product_history_limits", ...owner,
    applies: (c, snapshot) => c.datasetId === PRODUCT_DATASET_ID && history(c, snapshot).length > 0,
    affects: (c, snapshot) => history(c, snapshot).map(key),
  },
  {
    code: "inflation_product_label_discrepancy", severity: "note", comparisonEffect: "none",
    messageKey: "caveats.inflation_product_label_discrepancy", ...owner,
    applies: c => c.datasetId === PRODUCT_DATASET_ID && discrepancy(c).length > 0,
    affects: c => discrepancy(c).map(key),
  },
];
