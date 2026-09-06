// apps/web/lib/factQuery/caveats/rules.national.ts
import type { CaveatRule } from "./engine";

const NATIONAL_TOTAL_IDS = new Set(["revenue.total", "expenditure.total"]);
const NATIONAL_DATASET_IDS = new Set(["national-revenue", "national-expenditure"]);
// revenue_2004_total_scope is about the revenue-side 2004 panel omitting increase-in-liabilities
// (revenue-methodology.md §5.6). The 2004 expenditure total has no analogous gap — the treasury
// methodology's 2004 execution annex is complete and reconciled — so this must stay revenue-only
// and not reuse NATIONAL_TOTAL_IDS.
const REVENUE_TOTAL_ID = "revenue.total";
const LIABILITIES_ID = "revenue.increase_liabilities";
const NETTED_REVENUE_IDS = new Set(["revenue.grants", "revenue.other_revenue"]);
// revenue.grants / revenue.other_revenue are net of internal government flows only from 2008
// onward. revenue-methodology.md §6.2 (line 398): "Old-code years (2005-2007) have no netting -
// their classification predates these internal rows". The era table (§2.3, line 103) shows 2008
// is the first year on GFS codes, the classification that carries the 1.3.3 / 1.4.1.1.3 rows the
// netting subtracts. Confirmed in code: generateFacts.ts's oldCodeYears (2005-2007, matched by
// isOldRevenueRow's 12-/8-digit patterns) route through generateOldCodeRevenueFacts, which takes
// revenue.grants/revenue.other_revenue as a single required row with no subtraction; only
// modernRows (year not in oldCodeYears, i.e. 2008 on) go through the branch that subtracts 1.3.3
// and 1.4.1.1.3. 2004 predates this entirely (a separate reviewed annual-report panel,
// year2004Revenue.ts, with no subtraction either) and is excluded by the same year >= 2008 gate.
const NETTING_START_YEAR = 2008;
const CHANGED_2004_COMPONENTS = new Set(["revenue.asset_decrease", "revenue.other_taxes"]);

export const NATIONAL_CAVEAT_RULES: readonly CaveatRule[] = [
  {
    code: "revenue_2004_component_scope",
    severity: "severe",
    comparisonEffect: "breaks",
    messageKey: "caveats.revenue_2004_component_scope",
    methodologyRef: "revenue-methodology.md#56-2004--annual-report-partial-panel",
    methodologyRefEn: "/en/methodology/revenue",
    applies: (c) => c.datasetId === "national-revenue" && c.observations.some((o) => o.year === 2004 && o.value !== null && CHANGED_2004_COMPONENTS.has(o.seriesId)),
    affects: (c) => c.observations.filter((o) => o.year === 2004 && o.value !== null && CHANGED_2004_COMPONENTS.has(o.seriesId)).map((o) => `${o.seriesId}:${o.year}`),
  },
  // `nominal_gel` was removed on 2026-09-04. Every GEL figure this service has
  // ever served is nominal, in every year, for every dataset - so as a caveat it
  // was true of everything and therefore said nothing about any particular
  // answer, while crowding the ones that are specific to it. Budget figures are
  // nominal by convention; deflating them is a deliberate separate step. The
  // fact is now stated once in the server instructions, where dataset-wide
  // properties belong, rather than attached to every multi-year request.
  {
    code: "planned_values",
    severity: "severe",
    comparisonEffect: "none",
    messageKey: "caveats.planned_values",
    methodologyRef: "ai-grounding-and-caveats.md#planned_values",
    methodologyRefEn: "/en/methodology/expenditure",
    applies: (c) => c.observations.some((o) => o.basis === "planned"),
    affects: (c) => c.observations.filter((o) => o.basis === "planned").map((o) => `${o.seriesId}:${o.year}`),
  },
  {
    code: "revenue_2004_total_scope",
    severity: "severe",
    comparisonEffect: "breaks",
    messageKey: "caveats.revenue_2004_total_scope",
    methodologyRef: "revenue-methodology.md",
    methodologyRefEn: "/en/methodology/revenue",
    // Fires directly on the 2004 revenue total, AND on any share_of_total_pct query against
    // national revenue in 2004 - spec 5.2's measure matrix makes "the applicable consolidated
    // receipts total" the share_of_total_pct denominator for every national revenue category and
    // the total itself, so a 2004 percentage silently inherits the narrower-total limitation even
    // when revenue.total is never named in seriesIds. Gated on datasetId === "national-revenue"
    // so this does not bleed onto a same-shaped national-expenditure query (expenditure's 2004
    // total has no analogous gap; see the REVENUE_TOTAL_ID comment above).
    applies: (c) =>
      c.years.includes(2004) &&
      (c.seriesIds.includes(REVENUE_TOTAL_ID) || (c.datasetId === "national-revenue" && c.measure === "share_of_total_pct")),
    // Precise per (seriesId, year), not just "2004": the two applies() branches
    // affect different sets of observations, and a bare year string would
    // attach this to every 2004 observation in the request regardless of
    // which branch actually fired. share_of_total_pct widens to every
    // requested series in 2004 (each one's denominator is the narrower
    // total), but amount_gel only widens to revenue.total itself - a VAT
    // amount requested alongside the 2004 total is not, on its own, narrower.
    affects: (c) => {
      const wideningMeasure = c.datasetId === "national-revenue" && c.measure === "share_of_total_pct";
      return c.observations
        .filter((o) => o.year === 2004 && (o.seriesId === REVENUE_TOTAL_ID || wideningMeasure))
        .map((o) => `${o.seriesId}:${o.year}`);
    },
  },
  {
    code: "revenue_2004_liabilities_unavailable",
    severity: "severe",
    comparisonEffect: "breaks",
    messageKey: "caveats.revenue_2004_liabilities_unavailable",
    methodologyRef: "revenue-methodology.md",
    methodologyRefEn: "/en/methodology/revenue",
    applies: (c) => c.years.includes(2004) && c.seriesIds.includes(LIABILITIES_ID),
    affects: () => [`${LIABILITIES_ID}:2004`],
  },
  {
    code: "budget_scopes_differ",
    severity: "severe",
    comparisonEffect: "none",
    messageKey: "caveats.budget_scopes_differ",
    methodologyRef: "revenue-methodology.md",
    methodologyRefEn: "/en/methodology/revenue",
    applies: (c) => c.seriesIds.some((id) => NATIONAL_TOTAL_IDS.has(id)),
    affects: (c) => c.seriesIds.filter((id) => NATIONAL_TOTAL_IDS.has(id)),
  },
  {
    code: "negative_revenue_correction",
    severity: "note",
    comparisonEffect: "none",
    messageKey: "caveats.negative_revenue_correction",
    methodologyRef: "revenue-methodology.md",
    methodologyRefEn: "/en/methodology/revenue",
    // Gated on the national datasets. A negative number means "a reviewed
    // correction" only where positive is the norm; in the general government
    // balance a negative value is the ordinary case - it is a deficit - and
    // this note fired on every deficit answer, telling readers a correction had
    // been applied when none had. Caught by live verification against the
    // deployed preview, not by any unit test, because no test asked a
    // national rule what it does with another dataset's numbers.
    applies: (c) => NATIONAL_DATASET_IDS.has(c.datasetId) && c.observations.some((o) => o.value !== null && o.value < 0),
    affects: (c) => c.observations.filter((o) => o.value !== null && o.value < 0).map((o) => `${o.seriesId}:${o.year}`),
  },
  {
    code: "revenue_internal_flows_netted",
    severity: "note",
    comparisonEffect: "breaks",
    messageKey: "caveats.revenue_internal_flows_netted",
    methodologyRef: "revenue-methodology.md",
    methodologyRefEn: "/en/methodology/revenue",
    applies: (c) =>
      c.seriesIds.some((id) => NETTED_REVENUE_IDS.has(id)) && c.years.some((y) => y >= NETTING_START_YEAR),
    // Precise per (seriesId, year), not a bare seriesId: applies() only needs
    // ONE requested year to be >= 2008 to put this caveat on meta.caveats at
    // all, but a bare "revenue.grants" would then attach it to every
    // requested year for that series - including a pre-2008 year in the same
    // request, where the comment above documents there is no netting.
    affects: (c) =>
      c.observations
        .filter((o) => NETTED_REVENUE_IDS.has(o.seriesId) && o.year >= NETTING_START_YEAR)
        .map((o) => `${o.seriesId}:${o.year}`),
  },
  {
    code: "gdp_sna_break_2010",
    severity: "note",
    comparisonEffect: "limits",
    messageKey: "caveats.gdp_sna_break_2010",
    methodologyRef: "national-nominal-gdp.md",
    methodologyRefEn: "/en/methodology/expenditure",
    applies: (c) => {
      if (c.measure !== "share_of_gdp_pct") return false;
      const standards = new Set(c.gdpInputs.filter((g) => c.years.includes(g.year)).map((g) => g.accountingStandard));
      return standards.size > 1;
    },
    affects: () => ["gdp"],
  },
  {
    code: "gdp_preliminary",
    severity: "note",
    comparisonEffect: "none",
    messageKey: "caveats.gdp_preliminary",
    methodologyRef: "national-nominal-gdp.md",
    methodologyRefEn: "/en/methodology/expenditure",
    applies: (c) => c.measure === "share_of_gdp_pct" && c.gdpInputs.some((g) => c.years.includes(g.year) && g.status === "preliminary"),
    affects: (c) => c.gdpInputs.filter((g) => c.years.includes(g.year) && g.status === "preliminary").map((g) => `gdp:${g.year}`),
  },
];
