// apps/web/lib/factQuery/caveats/rules.ministries.ts
import type { CaveatRule } from "./engine";

export const MINISTRIES_CAVEAT_RULES: readonly CaveatRule[] = [
  {
    code: "program_coverage_partial",
    severity: "severe",
    messageKa:
      "მოთხოვნილი პროგრამული მწკრივი ზოგიერთ წელს არ ფარავს; არარსებული მნიშვნელობა ნული არ არის.",
    messageEn: "The requested program series does not cover every requested year; a missing value is not zero.",
    methodologyRef: "ministries-drilldown-programs-methodology.md",
    // A missing cell surfaces in `observations` as value: null (never a genuine
    // zero - ministries-drilldown-programs-methodology.md §7 documents real
    // within-range gaps, e.g. "30 06 Civil security 2015-2025 (gap 2018)", and §1
    // caps native program detail to 2012-2025 with nine joined series reaching
    // back to 2006 - so a requested program year outside a series' own coverage
    // is a genuine absence, not a zero). Gated on datasetId === "ministries"
    // because admin_category totals are contiguous across their full stated
    // range (ministries-expenditure-methodology.md line 33: "contiguous
    // 2004-2025"; line 512: "no fabricated 2004 major programs") and never
    // legitimately produce a null cell - without this gate, a missing cell
    // surfaced by a different dataset's query would be mislabeled as a
    // "program series" gap.
    applies: (c) => c.datasetId === "ministries" && c.observations.some((o) => o.value === null),
    affects: (c) => c.observations.filter((o) => o.value === null).map((o) => `${o.seriesId}:${o.year}`),
  },
  {
    code: "program_historical_join",
    severity: "note",
    messageKa:
      "მწკრივი იყენებს დამტკიცებულ ისტორიულ გაერთიანებას; შენარჩუნებულია მისი მოცულობა და ორიგინალი დასახელება.",
    messageEn: "The series uses an approved historical succession join; its scope and original label are preserved.",
    methodologyRef: "ministries-drilldown-programs-methodology.md",
    // Must key on historicalJoinSeriesIds - Task 3's resolved list of the exact
    // program identities carrying an approved PROGRAM_SUCCESSIONS or
    // LEGACY_PROGRAM_JOINS entry (buildSnapshot.ts historicalJoinSeriesIds()).
    // An earlier draft keyed on datasetId === "ministries" && years.some(y =>
    // y < 2012), which would have attached a join disclosure to ANY pre-2012
    // ministries query, including an admin_category total with no join
    // anywhere in it. Checking membership in the resolved id list is exact
    // instead: only series that actually carry a join ever match.
    applies: (c) => c.seriesIds.some((id) => c.historicalJoinSeriesIds.includes(id)),
    affects: (c) => c.seriesIds.filter((id) => c.historicalJoinSeriesIds.includes(id)),
  },
  {
    code: "non_positive_comparison_base",
    severity: "note",
    messageKa:
      "საწყისი მაჩვენებელი ნულოვანი ან უარყოფითია, ამიტომ პროცენტული ზრდა არ გამოითვლება; აბსოლუტური სხვაობა შესაძლოა დარჩეს.",
    messageEn: "The starting value is zero or negative, so percentage growth is unavailable; an absolute difference may remain.",
    methodologyRef: "ai-grounding-and-caveats.md#non_positive_comparison_base",
    // Concerns the comparison's EARLIER endpoint specifically (spec §6.6: percentage
    // change is (later - earlier) / earlier * 100), not any value anywhere in the
    // result - a non-positive LATER value is not a division problem.
    // Gated on measure === "amount_gel": spec §6.6 computes percentage change (a
    // division by the earlier value) only for amount_gel. Percentage measures
    // (share_of_total_pct / share_of_gdp_pct) use percentage-POINT difference - a
    // subtraction that a zero or negative base does not break. Without this gate, a
    // category whose share was legitimately 0% in the earlier year would carry a
    // caveat claiming "percentage growth is unavailable" for a computation
    // (point-change) that was never a division in the first place.
    applies: (c) => {
      if (c.comparison === null || c.measure !== "amount_gel") return false;
      const from = c.comparison.fromYear;
      return c.observations.some((o) => o.year === from && o.value !== null && o.value <= 0);
    },
    // Lists only the offending endpoint observations, not every series in a
    // batched comparison.
    affects: (c) => {
      if (c.comparison === null) return [];
      const from = c.comparison.fromYear;
      return c.observations
        .filter((o) => o.year === from && o.value !== null && o.value <= 0)
        .map((o) => `${o.seriesId}:${o.year}`);
    },
  },
];
