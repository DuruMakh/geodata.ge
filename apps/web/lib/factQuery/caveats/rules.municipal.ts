// apps/web/lib/factQuery/caveats/rules.municipal.ts
import { MUNICIPAL_FUNCTION_CODES } from "../../data/municipal/functionMapping";
import { ADJARA_REGION_ID, MUNICIPAL_COUNTRY_ID } from "../../data/municipal/types";
import { AGGREGATE_ONLY_MUNICIPAL_CODES } from "../types";
import type { MunicipalWarningType } from "../../data/municipal/types";
import type { CaveatContext, CaveatRule } from "./engine";

const EXCLUDED = new Set<string>(AGGREGATE_ONLY_MUNICIPAL_CODES);
const COUNTRY_ID = MUNICIPAL_COUNTRY_ID;
const ADJARA_ID = ADJARA_REGION_ID;
const TOTAL_SERIES = "municipal.total";

/**
 * Quality-state rules read warningType, never showWarning. Khulo (code 11) 2024
 * carries warningType "source_actual_missing" with showWarning false: a
 * display-flag rule would serve its fallback figure with no warning at all.
 */
function hasWarningType(context: Pick<CaveatContext, "municipalTotalInputs">, type: MunicipalWarningType) {
  return context.municipalTotalInputs.some((row) => row.warningType === type);
}

/**
 * Which RETURNED cells a contributing total row quality state describes.
 *
 * A row for municipality 06 can reach the response as its own figure, or
 * folded inside region.adjara total, or inside country.georgia. Emitting the
 * bare municipality code looked precise and was wrong at aggregate grain: a
 * region query returned caveats whose affects named member codes appearing
 * nowhere in the response, so the disclosure attached to zero observations
 * while the region own cells read clean. municipalInputServedBy maps each
 * contributing row to the entities whose returned figure includes it.
 *
 * seriesScope picks the grain the claim is actually true at: "total" for a
 * statement about the public total alone, "entity" for one about the
 * municipality-year data state as a whole.
 */
function affectedByWarningType(
  context: Pick<CaveatContext, "municipalTotalInputs" | "municipalInputServedBy" | "measure">,
  type: MunicipalWarningType,
  seriesScope: "total" | "entity",
) {
  return context.municipalTotalInputs
    .filter((row) => row.warningType === type)
    .flatMap((row) => {
      const served = context.municipalInputServedBy[`${row.municipalityCode}:${row.year}`] ?? [row.municipalityCode];
      // A share divides BY the public total, so on a share request even a
      // total-only claim describes every returned cell. On an amount request it
      // describes the total cell alone - a function amount is a primary reviewed
      // figure that stands on its own.
      const totalOnly = seriesScope === "total" && context.measure !== "share_of_total_pct";
      return served.map((entityId) =>
        totalOnly ? `${entityId}:${TOTAL_SERIES}:${row.year}` : `${entityId}:${row.year}`,
      );
    });
}

/**
 * Returned cells whose two comparison endpoints measure different things, as
 * `${entityId}:${seriesId}:${year}` for BOTH endpoints of each broken pair.
 */
/**
 * Entity-years whose returned functional shares fall short of the public total.
 *
 * The reconciliation field on a contributing municipality row cannot see this at
 * country grain: all eleven country rows carry reconciliationDifferenceGel null,
 * so the aggregate whose ten shares sum to 91.41% had no rule that could report
 * it. Measuring the returned shares works at every grain.
 *
 * Gated on the whole reviewed set being requested: three of ten shares summing
 * to less than 100 is a partial selection, not a reconciliation gap.
 */
function functionalShortfall(context: CaveatContext): string[] {
  if (context.measure !== "share_of_total_pct") return [];
  const requested = new Set(context.seriesIds.filter((id) => id !== TOTAL_SERIES));
  if (requested.size < MUNICIPAL_FUNCTION_CODES.length) return [];

  const sums = new Map<string, number>();
  for (const o of context.observations) {
    if (o.parentSeriesId === null || o.value === null) continue;
    const key = `${o.entityId}:${o.year}`;
    sums.set(key, (sums.get(key) ?? 0) + o.value);
  }

  return Array.from(sums)
    .filter(([, sum]) => sum < 99.99)
    .map(([key]) => key);
}

function definitionBreaks(context: CaveatContext): string[] {
  if (context.comparison === null) return [];
  const { fromYear, toYear } = context.comparison;
  const byPair = new Map<string, { from?: string; to?: string }>();

  for (const o of context.observations) {
    const key = `${o.entityId}:${o.seriesId}`;
    const entry = byPair.get(key) ?? {};
    if (o.year === fromYear) entry.from = o.valueDefinitionId;
    if (o.year === toYear) entry.to = o.valueDefinitionId;
    byPair.set(key, entry);
  }

  const broken: string[] = [];
  for (const [key, entry] of byPair) {
    if (entry.from === undefined || entry.to === undefined || entry.from === entry.to) continue;
    broken.push(`${key}:${fromYear}`, `${key}:${toYear}`);
  }
  return broken;
}

export const MUNICIPAL_CAVEAT_RULES: readonly CaveatRule[] = [
  {
    code: "municipality_not_territorial",
    severity: "severe",
    comparisonEffect: "none",
    messageKey: "caveats.municipality_not_territorial",
    methodologyRef: "municipal-functional-annual-2015-2025.md",
    methodologyRefEn: "/en/methodology/municipalities",
    // The five codes are already absent from every served registry and fact file
    // (methodology "Public exclusion decision"), so this rule is never about
    // filtering output — it only fires when a query explicitly names one.
    applies: (c) => c.entityIds.some((id) => EXCLUDED.has(id)),
    affects: (c) => c.entityIds.filter((id) => EXCLUDED.has(id)),
  },
  {
    code: "municipal_country_scope",
    severity: "note",
    comparisonEffect: "none",
    messageKey: "caveats.municipal_country_scope",
    methodologyRef: "municipal-functional-annual-2015-2025.md",
    methodologyRefEn: "/en/methodology/municipalities",
    // Gated on datasetId, matching the precedent already in this catalogue
    // (rules.national.ts's revenue_2004_total_scope gates on
    // "national-revenue"; rules.ministries.ts's program_coverage_partial
    // gates on "ministries", with the same failure mode documented inline
    // there). COUNTRY_ID ("country.georgia") is the exact entityId spec 7.2
    // assigns every national observation, and this rule has no other
    // condition - without the gate, any caller populating entityIds with the
    // national entity id (as queryNational legitimately could, since that IS
    // its entity) would spuriously inherit a caveat about the municipal
    // aggregate.
    applies: (c) => c.datasetId === "municipal-expenditure" && c.entityIds.includes(COUNTRY_ID),
    affects: () => [COUNTRY_ID],
  },
  {
    code: "adjara_consolidation_applied",
    severity: "note",
    comparisonEffect: "none",
    messageKey: "caveats.adjara_consolidation_applied",
    methodologyRef: "municipal-functional-annual-2015-2025.md",
    methodologyRefEn: "/en/methodology/municipalities",
    // Fires when the total series is explicitly requested, AND for
    // share_of_total_pct on any series for Adjara: percentages always divide by
    // public_total_gel, and for Adjara that denominator is always the
    // consolidated total even when the total series is never named in
    // seriesIds (methodology "Adjara consolidated adjustment": "the Adjara and
    // Georgia total line, percentages, comparisons and Excel workbook total
    // use the consolidated denominator"). Deliberately NOT triggered by a
    // plain amount_gel functional-category request, whose numerator is the
    // unconsolidated municipal-only functional sum and was never adjusted.
    applies: (c) => c.entityIds.includes(ADJARA_ID) && (c.seriesIds.includes(TOTAL_SERIES) || c.measure === "share_of_total_pct"),
    // Built from c.observations per the precision contract, because the two
    // firing paths above affect DIFFERENT cells. A share request consolidates
    // every denominator, so every Adjara cell carries it; a plain amount_gel
    // request consolidates only the total, and the function amounts beside it
    // are the unconsolidated municipal-only sums the comment above describes.
    // A bare ADJARA_ID matched both, so asking for the total and education
    // together stamped education 74,676,498.54 - which contains no republican
    // money - with "the net Adjara adjustment is applied once".
    affects: (c) =>
      c.observations
        .filter((o) => o.entityId === ADJARA_ID && (c.measure === "share_of_total_pct" || o.seriesId === TOTAL_SERIES))
        .map((o) => `${o.entityId}:${o.seriesId}:${o.year}`),
  },
  {
    code: "municipal_functions_no_republican_crosswalk",
    severity: "note",
    comparisonEffect: "none",
    messageKey: "caveats.municipal_functions_no_republican_crosswalk",
    methodologyRef: "municipal-functional-annual-2015-2025.md",
    methodologyRefEn: "/en/methodology/municipalities",
    // Gated on datasetId for the same reason as municipal_country_scope above:
    // COUNTRY_ID collides with the national entityId, and this rule has no
    // other condition that would stop it firing on a national-shaped context.
    applies: (c) =>
      c.datasetId === "municipal-expenditure" &&
      (c.entityIds.includes(ADJARA_ID) || c.entityIds.includes(COUNTRY_ID)) &&
      c.seriesIds.some((id) => id !== TOTAL_SERIES),
    affects: (c) => c.entityIds.filter((id) => id === ADJARA_ID || id === COUNTRY_ID),
  },
  {
    code: "municipal_total_definition_changed",
    // Measured across all 64 municipalities in every year where both totals
    // exist: the median gap between the functional sum and the official
    // headline is 0.94% (2016) falling to 0.20% (2024). The tail is real - p90
    // is 4.2% in 2016 and the worst municipality reaches 13.5% - so the
    // difference is stated, not hidden. But refusing the comparison outright
    // withheld a usable ten-year answer from every reader to protect a handful
    // of cases, which is the wrong trade for a public explorer. Owner decision,
    // 2026-09-04.
    severity: "note",
    comparisonEffect: "none",
    messageKey: "caveats.municipal_total_definition_changed",
    methodologyRef: "municipal-functional-annual-2015-2025.md",
    methodologyRefEn: "/en/methodology/municipalities",
    // Gated on datasetId like its four siblings above. Without the gate it fired
    // on any comparison whose endpoint definitions differed, including a
    // MINISTRIES program comparison - pointing a reader at a municipal
    // methodology document to explain a figure with no public total in it.
    //
    // Reads valueDefinitionId, the structured identity, rather than display
    // prose: a municipal FUNCTION series carries constant prose across the 2015
    // portal-fallback break, which is exactly how that break went undeclined.
    applies: (c) => c.datasetId === "municipal-expenditure" && definitionBreaks(c).length > 0,
    affects: (c) => definitionBreaks(c),
  },
  {
    code: "municipal_source_actual_missing",
    severity: "severe",
    comparisonEffect: "none",
    messageKey: "caveats.municipal_source_actual_missing",
    methodologyRef: "municipal-functional-annual-2015-2025.md",
    methodologyRefEn: "/en/methodology/municipalities",
    // Reads warningType, never showWarning: Khulo 2024 has showWarning false
    // (it never trips the GEL 1M review-difference rule, since there is no
    // official total to compare its fallback against) but still needs this
    // disclosure every time its fallback figure is served.
    applies: (c) => hasWarningType(c, "source_actual_missing"),
    // Total-only: this says the PUBLIC TOTAL is a functional-total stand-in.
    // Khulo education figure beside it is a primary reviewed function fact,
    // not a substitute for anything, and was wrongly carrying this.
    affects: (c) => affectedByWarningType(c, "source_actual_missing", "total"),
  },
  {
    code: "municipal_source_version_difference",
    severity: "severe",
    comparisonEffect: "none",
    messageKey: "caveats.municipal_source_version_difference",
    methodologyRef: "municipal-functional-annual-2015-2025.md",
    methodologyRefEn: "/en/methodology/municipalities",
    applies: (c) => hasWarningType(c, "source_version_difference"),
    // Entity-year, deliberately: this one names BOTH the functional and the
    // total inputs, so it is true of every series of that municipality-year.
    affects: (c) => affectedByWarningType(c, "source_version_difference", "entity"),
  },
  {
    code: "municipal_financing_outside_functional",
    severity: "note",
    comparisonEffect: "none",
    messageKey: "caveats.municipal_financing_outside_functional",
    methodologyRef: "municipal-functional-annual-2015-2025.md",
    methodologyRefEn: "/en/methodology/municipalities",
    applies: (c) => hasWarningType(c, "financing_outside_functional"),
    // Entity-year, deliberately: the claim is about the relationship between
    // the total and the ten functions, so it describes the function cells just
    // as much as the total cell.
    affects: (c) => affectedByWarningType(c, "financing_outside_functional", "entity"),
  },
  {
    code: "municipal_functional_total_gap",
    severity: "note",
    comparisonEffect: "none",
    messageKey: "caveats.municipal_functional_total_gap",
    methodologyRef: "municipal-functional-annual-2015-2025.md",
    methodologyRefEn: "/en/methodology/municipalities",
    applies: (c) =>
      c.measure === "share_of_total_pct" &&
      (c.municipalTotalInputs.some((row) => row.reconciliationDifferenceGel !== null && row.reconciliationDifferenceGel !== 0) ||
        functionalShortfall(c).length > 0),
    // Entity-year on the SERVING entity: the shares that fail to reach 100% are
    // the ones in the response, so a region query must flag region.adjara own
    // cells (they sum to 57.4%), not the member codes that produced them.
    affects: (c) => {
      const entities = new Set(
        c.municipalTotalInputs
          .filter((row) => row.reconciliationDifferenceGel !== null && row.reconciliationDifferenceGel !== 0)
          .flatMap((row) => c.municipalInputServedBy[`${row.municipalityCode}:${row.year}`] ?? [row.municipalityCode]),
      );
      const byReconciliation = c.observations
        .filter((o) => entities.has(o.entityId))
        .map((o) => `${o.entityId}:${o.year}`);
      return Array.from(new Set([...byReconciliation, ...functionalShortfall(c)]));
    },
  },
  {
    code: "per_resident_coverage_limited",
    severity: "severe",
    comparisonEffect: "none",
    messageKey: "caveats.per_resident_coverage_limited",
    methodologyRef: "municipal-population-regional-gdp.md",
    methodologyRefEn: "/en/methodology/municipalities",
    // Approved coverage is 2025, municipality/region entities, and the public
    // total series only (municipal-population-regional-gdp.md: "budget_per_resident_gel
    // = 2025 public_total_gel / 2025 population_persons"). The Georgia
    // aggregate is excluded even at year 2025 with the total series requested:
    // "The Georgia aggregate receives no per-resident value because its
    // numerator includes five aggregate-only municipal budgets without a
    // territorial population assignment" - a wrong-entity case that a
    // year/series check alone would not catch.
    applies: (c) =>
      c.measure === "gel_per_resident" &&
      (c.years.some((year) => year !== 2025) || c.seriesIds.some((id) => id !== TOTAL_SERIES) || c.entityIds.includes(COUNTRY_ID)),
    affects: (c) => [
      ...c.years.filter((year) => year !== 2025).map(String),
      ...c.seriesIds.filter((id) => id !== TOTAL_SERIES),
      ...c.entityIds.filter((id) => id === COUNTRY_ID),
    ],
  },
];
