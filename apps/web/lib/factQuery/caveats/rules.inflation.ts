// apps/web/lib/factQuery/caveats/rules.inflation.ts
//
// Four rules, all gated on the inflation dataset and scoped to single months.
// Facts true of every inflation answer (the index is a weighted mean of city
// indices; percentages are percentages) live in the server instructions, not
// here, for the reason nominal_gel was retired: a caveat on every answer
// teaches a client to ignore caveats.
import { RESIDUAL_SERIES_ID, TARGET_SERIES_ID } from "../inflationSeries";
import type { CaveatContext, CaveatRule } from "./engine";

const DATASET_ID = "inflation";
const OWNER = "inflation-cpi-national.md";
const OWNER_EN = "/en/methodology/inflation";

type Cell = CaveatContext["observations"][number];
const cellKey = (cell: Cell) => `${cell.seriesId}:${cell.period ?? cell.year}`;

const contributionCells = (c: CaveatContext) =>
  c.measure === "contribution_pp" ? c.observations.filter((o) => o.seriesId !== RESIDUAL_SERIES_ID && o.value !== null) : [];
const residualCells = (c: CaveatContext) => c.observations.filter((o) => o.seriesId === RESIDUAL_SERIES_ID);
const targetGaps = (c: CaveatContext) => c.observations.filter((o) => o.seriesId === TARGET_SERIES_ID && o.value === null);

export const INFLATION_CAVEAT_RULES: readonly CaveatRule[] = [
  {
    code: "inflation_contribution_derived",
    severity: "severe",
    comparisonEffect: "none",
    messageKey: "caveats.inflation_contribution_derived",
    methodologyRef: OWNER,
    methodologyRefEn: OWNER_EN,
    // Severe: presented as a Geostat figure, a contribution is a false provenance claim.
    applies: (c) => c.datasetId === DATASET_ID && contributionCells(c).length > 0,
    affects: (c) => contributionCells(c).map(cellKey),
  },
  {
    code: "inflation_contribution_residual",
    severity: "note",
    comparisonEffect: "none",
    messageKey: "caveats.inflation_contribution_residual",
    methodologyRef: OWNER,
    methodologyRefEn: OWNER_EN,
    applies: (c) => c.datasetId === DATASET_ID && residualCells(c).length > 0,
    affects: (c) => residualCells(c).map(cellKey),
  },
  {
    code: "inflation_contribution_weights_differ",
    severity: "note",
    // The basket is re-weighted each January: usable, but not like-for-like.
    comparisonEffect: "limits",
    messageKey: "caveats.inflation_contribution_weights_differ",
    methodologyRef: OWNER,
    methodologyRefEn: OWNER_EN,
    applies: (c) => c.datasetId === DATASET_ID && c.comparison !== null && c.comparison.fromYear !== c.comparison.toYear && contributionCells(c).length > 0,
    affects: (c) => contributionCells(c).map(cellKey),
  },
  {
    code: "inflation_target_unverified_before_2015",
    severity: "note",
    comparisonEffect: "none",
    messageKey: "caveats.inflation_target_unverified_before_2015",
    methodologyRef: OWNER,
    methodologyRefEn: OWNER_EN,
    // A missing target month exists only before the first reviewed target, which carries forward.
    applies: (c) => c.datasetId === DATASET_ID && targetGaps(c).length > 0,
    affects: (c) => targetGaps(c).map(cellKey),
  },
];
