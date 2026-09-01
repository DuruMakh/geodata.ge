// apps/web/lib/factQuery/caveats/rules.ministries.ts
import type { CaveatContext, CaveatRule } from "./engine";

type ContextObservation = CaveatContext["observations"][number];

const LEVEL_ADMIN_CATEGORY = "admin_category";
const LEVEL_MAJOR_PROGRAM = "major_program";

/**
 * The distinct series ids inside a `${seriesId}:${year}` cell list. Item ids carry no
 * colon (generateAdminSpendingFacts.ts's makeProgramItemId builds
 * `admin_program.<code>.<hash>`), so the last colon is always the year separator.
 */
function joinedSeriesIdsOf(cells: readonly string[]): Set<string> {
  const ids = new Set<string>();
  for (const cell of cells) {
    const separator = cell.lastIndexOf(":");
    if (separator > 0) ids.add(cell.slice(0, separator));
  }
  return ids;
}

/**
 * A served program cell whose parent administrative category had no row of its own that
 * year — the parent is the series' modern grouping, not a claim about who held the money.
 * Restricted to available cells: pinning a parent-attribution note onto a null cell
 * describes a figure that was never returned.
 */
function hasModernOnlyParent(context: CaveatContext, observation: ContextObservation): boolean {
  return (
    observation.level === LEVEL_MAJOR_PROGRAM &&
    observation.value !== null &&
    observation.parentSeriesId !== null &&
    !context.adminCategoryYears.includes(`${observation.parentSeriesId}:${observation.year}`)
  );
}

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
    // is a genuine absence, not a zero).
    //
    // Gated on level === "major_program" as well as the dataset, because BOTH
    // messages here are about a program series and an admin_category cell can
    // legitimately be null too: only thirteen of the fourteen categories run
    // 2004-2025, and admin_spending.regional_development_infrastructure starts
    // in 2009 (verified against the served facts, not assumed). An earlier
    // comment claimed admin_category "never legitimately produces a null cell"
    // and gated on the dataset alone, which put this severe "program series"
    // message - and a programs-methodology reference - on a 2004
    // admin_category observation with no program anywhere in the request.
    // admin_category_not_yet_established below is that case's own code.
    applies: (c) =>
      c.datasetId === "ministries" && c.observations.some((o) => o.level === LEVEL_MAJOR_PROGRAM && o.value === null),
    affects: (c) =>
      c.observations.filter((o) => o.level === LEVEL_MAJOR_PROGRAM && o.value === null).map((o) => `${o.seriesId}:${o.year}`),
  },
  {
    code: "admin_category_not_yet_established",
    severity: "severe",
    messageKa:
      "მოთხოვნილი ადმინისტრაციული კატეგორია ამ წლის კლასიფიკაციაში არ არსებობს — ის მოგვიანებით ჩამოყალიბდა; არარსებული მნიშვნელობა ნული არ არის.",
    messageEn:
      "The requested administrative category does not exist in that year's classification — it was established later; a missing value is not zero.",
    methodologyRef: "ministries-expenditure-methodology.md",
    // The admin_category counterpart of program_coverage_partial, split off from it
    // because the two situations have different causes, different remedies and
    // different methodology documents. Category coverage is contiguous WITHIN each
    // category's own range but the ranges are not all the same: thirteen categories run
    // 2004-2025 and admin_spending.regional_development_infrastructure only from 2009,
    // so a null category cell means the category was not yet part of that year's
    // administrative classification - never a within-range hole, and never a zero.
    applies: (c) =>
      c.datasetId === "ministries" && c.observations.some((o) => o.level === LEVEL_ADMIN_CATEGORY && o.value === null),
    affects: (c) =>
      c.observations
        .filter((o) => o.level === LEVEL_ADMIN_CATEGORY && o.value === null)
        .map((o) => `${o.seriesId}:${o.year}`),
  },
  {
    code: "program_historical_join",
    severity: "note",
    messageKa:
      "მწკრივი იყენებს დამტკიცებულ ისტორიულ გაერთიანებას; შენარჩუნებულია მისი მოცულობა და ორიგინალი დასახელება.",
    messageEn: "The series uses an approved historical succession join; its scope and original label are preserved.",
    methodologyRef: "ministries-drilldown-programs-methodology.md",
    // Must key on historicalJoinSeriesYears - Task 3's resolved list of the exact
    // program CELLS carrying an approved PROGRAM_SUCCESSIONS or LEGACY_PROGRAM_JOINS
    // entry (buildSnapshot.ts historicalJoinSeriesYears()). An earlier draft keyed on
    // datasetId === "ministries" && years.some(y => y < 2012), which would have
    // attached a join disclosure to ANY pre-2012 ministries query, including an
    // admin_category total with no join anywhere in it.
    //
    // applies() stays at series grain - naming a joined series is what puts the
    // disclosure in meta.caveats - while affects() narrows to the joined YEARS, the
    // same split rules.national.ts's revenue_internal_flows_netted uses. A joined
    // series serves most of its years natively: admin_program.09_01.f5bec61a is joined
    // for 2006-2011 (legacy "09 02" common-courts lines) and native for 2012-2025 under
    // its own code 09 01, and a bare seriesId claimed a join on all twenty. Available
    // cells only: "its scope and original label are preserved" says nothing true about
    // a row with no value.
    applies: (c) => {
      const joinedSeriesIds = joinedSeriesIdsOf(c.historicalJoinSeriesYears);
      return c.seriesIds.some((id) => joinedSeriesIds.has(id));
    },
    affects: (c) => {
      const joinedCells = new Set(c.historicalJoinSeriesYears);
      return c.observations
        .filter((o) => o.value !== null && joinedCells.has(`${o.seriesId}:${o.year}`))
        .map((o) => `${o.seriesId}:${o.year}`);
    },
  },
  {
    code: "program_parent_category_modern_grouping",
    severity: "severe",
    messageKa:
      "მშობელი ადმინისტრაციული კატეგორია სერიის თანამედროვე მიკუთვნებაა და ამ წელს ჯერ არ არსებობდა; ხარჯი მაშინ სხვა უწყებამ განახორციელა. თანხა და წილი სწორია, მაგრამ მშობელი კატეგორია ამ წლისთვის კუთვნილების მტკიცება არ არის.",
    messageEn:
      "The parent administrative category is this series' modern grouping and did not exist in that year; the spending was administered by a different institution. The amount and share are correct, but the parent is not a containment claim for that year.",
    methodologyRef: "ministries-drilldown-programs-methodology.md",
    // A joined series keeps ONE parent - its modern owner - across every year it
    // serves, which is the approved grouping decision, not a statement about the
    // year's institutions. Where the modern parent postdates the year, following
    // parentSeriesId produces a false sentence about a real ministry: the roads
    // series' 2006-2008 cells name admin_spending.regional_development_infrastructure,
    // whose ministry was created in 2009, while the reviewed rows themselves record
    // the Ministry of Economic Development as the administering institution. The
    // figure is untouched - it is inside that year's administrative total and its
    // share is real - so this qualifies the parent only.
    applies: (c) => c.datasetId === "ministries" && c.observations.some((o) => hasModernOnlyParent(c, o)),
    affects: (c) => c.observations.filter((o) => hasModernOnlyParent(c, o)).map((o) => `${o.seriesId}:${o.year}`),
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
