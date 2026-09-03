// apps/web/lib/factQuery/caveats/rules.national.ts
import type { CaveatRule } from "./engine";

const NATIONAL_TOTAL_IDS = new Set(["revenue.total", "expenditure.total"]);
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

export const NATIONAL_CAVEAT_RULES: readonly CaveatRule[] = [
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
    messageKa: "შედეგი შეიცავს გეგმურ (და არა ფაქტობრივ) მაჩვენებელს.",
    messageEn: "The result contains planned rather than actual values.",
    methodologyRef: "ai-grounding-and-caveats.md#planned_values",
    applies: (c) => c.observations.some((o) => o.basis === "planned"),
    affects: (c) => c.observations.filter((o) => o.basis === "planned").map((o) => `${o.seriesId}:${o.year}`),
  },
  {
    code: "revenue_2004_total_scope",
    severity: "severe",
    comparisonEffect: "breaks",
    messageKa: "2004 წლის შემოსავლების ჯამი უფრო ვიწრო მოცულობისაა: ვალდებულებების ზრდა მიუწვდომელია.",
    messageEn: "The 2004 receipts total has narrower coverage: increase in liabilities is unavailable.",
    methodologyRef: "revenue-methodology.md",
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
    messageKa: "2004 წლისთვის ვალდებულებების ზრდა მიუწვდომელია — ის ნული არ არის.",
    messageEn: "Increase in liabilities is unavailable for 2004. It is not zero.",
    methodologyRef: "revenue-methodology.md",
    applies: (c) => c.years.includes(2004) && c.seriesIds.includes(LIABILITIES_ID),
    affects: () => [`${LIABILITIES_ID}:2004`],
  },
  {
    code: "budget_scopes_differ",
    severity: "severe",
    comparisonEffect: "none",
    messageKa: "ეროვნული შემოსავლებისა და ხარჯების ჯამები სხვადასხვა საბიუჯეტო მოცულობას ეყრდნობა; მათი გამოკლებით დეფიციტი არ დგინდება.",
    messageEn: "National revenue and expenditure totals use different budget concepts; subtracting them does not establish a deficit.",
    methodologyRef: "revenue-methodology.md",
    applies: (c) => c.seriesIds.some((id) => NATIONAL_TOTAL_IDS.has(id)),
    affects: (c) => c.seriesIds.filter((id) => NATIONAL_TOTAL_IDS.has(id)),
  },
  {
    code: "negative_revenue_correction",
    severity: "note",
    comparisonEffect: "none",
    messageKa: "უარყოფითი მნიშვნელობა გადამოწმებული კორექციაა და არა დაკარგული მონაცემი.",
    messageEn: "A negative value is a reviewed correction, not missing or invalid data.",
    methodologyRef: "revenue-methodology.md",
    applies: (c) => c.observations.some((o) => o.value !== null && o.value < 0),
    affects: (c) => c.observations.filter((o) => o.value !== null && o.value < 0).map((o) => `${o.seriesId}:${o.year}`),
  },
  {
    code: "revenue_internal_flows_netted",
    severity: "note",
    comparisonEffect: "breaks",
    messageKa: "შერჩეული მუხლი შიდა ნაკადების დოკუმენტირებულ ნეტირებას იყენებს.",
    messageEn: "The selected item uses the documented netting of internal flows.",
    methodologyRef: "revenue-methodology.md",
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
    messageKa: "მშპ-ის მაჩვენებელი 2010 წელს აღრიცხვის სტანდარტს იცვლის (SNA 1993 → SNA 2008).",
    messageEn: "The GDP denominator changes accounting standard at 2010 (SNA 1993 to SNA 2008).",
    methodologyRef: "national-nominal-gdp.md",
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
    messageKa: "გამოყენებული მშპ-ის მაჩვენებელი წინასწარია.",
    messageEn: "A GDP denominator used by this result is preliminary.",
    methodologyRef: "national-nominal-gdp.md",
    applies: (c) => c.measure === "share_of_gdp_pct" && c.gdpInputs.some((g) => c.years.includes(g.year) && g.status === "preliminary"),
    affects: (c) => c.gdpInputs.filter((g) => c.years.includes(g.year) && g.status === "preliminary").map((g) => `gdp:${g.year}`),
  },
];
