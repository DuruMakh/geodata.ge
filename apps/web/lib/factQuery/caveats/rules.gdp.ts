// apps/web/lib/factQuery/caveats/rules.gdp.ts
//
// The GDP overview's own disclosures. gdp_preliminary is shared with the budget
// share-of-GDP measure and lives in rules.national.ts.
import type { CaveatContext, CaveatRule } from "./engine";
import type { FactQuerySnapshot } from "../types";

const DATASET_ID = "gdp-overview";

/** The Geostat nominal series; the real_* series come from the World Bank. */
const nominalCells = (c: CaveatContext) => c.observations.filter((o) => !o.seriesId.startsWith("real_") && o.value !== null);
const realCells = (c: CaveatContext) => c.observations.filter((o) => o.seriesId.startsWith("real_") && o.value !== null);

/**
 * Geostat marks its newest national accounts preliminary; the World Bank
 * republishes the same year without a marker, so `basis` on a real cell is
 * "published" and the request itself cannot reveal the difference.
 */
const geostatPreliminaryYears = (snapshot: FactQuerySnapshot) =>
  new Set(
    snapshot.gdpOverview.facts
      .filter((fact) => fact.status === "preliminary")
      .map((fact) => fact.year),
  );

/** queryGdp writes the accounting standard as the last segment of valueDefinitionId. */
const standardOf = (valueDefinitionId: string) => valueDefinitionId.slice(valueDefinitionId.lastIndexOf(":") + 1);

export const GDP_CAVEAT_RULES: readonly CaveatRule[] = [
  {
    code: "gdp_historical_method",
    severity: "note",
    // The same judgement as gdp_sna_break_2010: Geostat publishes both sides as
    // one aggregate, so a change across the break is usable but must be qualified.
    comparisonEffect: "limits",
    messageKey: "caveats.gdp_historical_method",
    methodologyRef: "gdp-overview.md",
    methodologyRefEn: "/en/methodology/gdp",
    // Only when the returned nominal cells span both standards. Each cell already
    // names its own standard in valueDefinitionId; the disclosure is about mixing
    // them. It used to ride on every nominal cell, including a 2024-only answer.
    applies: (c) => c.datasetId === DATASET_ID && new Set(nominalCells(c).map((o) => standardOf(o.valueDefinitionId))).size > 1,
    affects: (c) => nominalCells(c).map((o) => `${o.seriesId}:${o.year}`),
  },
  {
    code: "gdp_world_bank_history",
    severity: "note",
    comparisonEffect: "none",
    messageKey: "caveats.gdp_world_bank_history",
    methodologyRef: "gdp-overview.md",
    methodologyRefEn: "/en/methodology/gdp",
    // The source metadata does not say which years were reconstructed, so there
    // is no narrower scope to give it than the World Bank cells themselves.
    applies: (c) => c.datasetId === DATASET_ID && realCells(c).length > 0,
    affects: (c) => realCells(c).map((o) => `${o.seriesId}:${o.year}`),
  },
  {
    code: "gdp_world_bank_preliminary_basis",
    severity: "note",
    comparisonEffect: "none",
    messageKey: "caveats.gdp_world_bank_preliminary_basis",
    methodologyRef: "gdp-overview.md",
    methodologyRefEn: "/en/methodology/gdp",
    applies: (c, snapshot) =>
      c.datasetId === DATASET_ID &&
      realCells(c).some((observation) => geostatPreliminaryYears(snapshot).has(observation.year)),
    affects: (c, snapshot) => {
      const preliminary = geostatPreliminaryYears(snapshot);
      return realCells(c)
        .filter((observation) => preliminary.has(observation.year))
        .map((observation) => `${observation.seriesId}:${observation.year}`);
    },
  },
];
