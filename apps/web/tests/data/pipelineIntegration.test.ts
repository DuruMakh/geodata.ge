import { describe, expect, it } from "vitest";
import { loadAdminSpendingCategoriesFile } from "../../lib/data/adminSpending/categoriesFile";
import { ADMIN_SPENDING_RECONCILIATION_TOLERANCE_GEL } from "../../lib/data/adminSpending/generateAdminSpendingFacts";
import { loadAdminSpendingFacts } from "../../lib/data/adminSpending/importAdminSpendingFacts";
import type { AdminSpendingCategory, AdminSpendingFact } from "../../lib/data/adminSpending/types";
import {
  ADMIN_SPENDING_YEARS,
  EXPENDITURE_DETAILED_YEARS,
  EXPENDITURE_TOTAL_ONLY_YEARS,
  EXPENDITURE_YEARS,
  REVENUE_TOTAL_ONLY_YEARS,
  REVENUE_PARTIAL_YEARS,
  REVENUE_YEARS,
} from "../../lib/data/coverage";
import { validateFoundationReferences } from "../../lib/data/foundationValidation";
import type { GlossaryEntry } from "../../lib/data/glossary";
import { loadGlossary } from "../../lib/data/glossary";
import type { BudgetFactImportRow } from "../../lib/data/importBudgetFacts";
import { loadBudgetFactRows } from "../../lib/data/importBudgetFacts";
import { loadNationalGdpFacts } from "../../lib/data/nationalGdp/importNationalGdp";
import type { NationalGdpFact } from "../../lib/data/nationalGdp/types";
import type { SpendingMapping } from "../../lib/data/mappings";
import { loadSpendingMappings } from "../../lib/data/mappings";
import { SERVED_DATA_FILES } from "../../lib/data/servedData";
import type { SourceDocumentRow } from "../../lib/data/sources";
import { loadSourceDocuments } from "../../lib/data/sources";
import type { TaxonomyItem } from "../../lib/data/taxonomy";
import { loadTaxonomyFiles } from "../../lib/data/taxonomy";
import { TOTAL_ONLY_BUDGET_FACTS } from "../../lib/data/totalOnlyBudgetFacts";

// End-to-end gate over the REAL production data files that app/page.tsx ships at
// build time. Every path below matches the corresponding loader call in
// app/page.tsx (plus the taxonomy/mapping files used by foundation validation).
// Legacy-join facts (pre-2012 program points joined onto modern series) are marked by the
// mapping-notes prefix stamped in lib/data/adminSpending/legacyProgramJoins.ts — key their
// gate exemptions on this marker, never on a year literal.
const LEGACY_JOIN_NOTE_PREFIX = "Pre-2012 organizational line(s) joined";
const isLegacyJoinFact = (fact: AdminSpendingFact) => fact.mappingNotes.startsWith(LEGACY_JOIN_NOTE_PREFIX);

const BUDGET_FACTS_CSV = SERVED_DATA_FILES.budgetFacts;
const ADMIN_SPENDING_FACTS_CSV = SERVED_DATA_FILES.adminSpendingFacts;
const GLOSSARY_CSV = SERVED_DATA_FILES.glossary;
const SOURCE_DOCUMENTS_CSV = SERVED_DATA_FILES.sourceDocuments;
const NATIONAL_GDP_CSV = SERVED_DATA_FILES.gdpFacts;
const ADMIN_CATEGORIES_JSON = SERVED_DATA_FILES.adminSpendingCategories;
const TAXONOMY_DIR = "../../data/taxonomy";
const SPENDING_FIELD_MAPPING_CSV = "../../data/mappings/spending-field-mapping.csv";

// Tolerance reused from the revenue pipeline: mirrors the unexported
// `roundingToleranceGel` (10 GEL) in lib/data/realRevenue/validateRealRevenue.ts
// and lib/data/realRevenue/generateFacts.ts. Keep in sync with those files.
const REVENUE_ROUNDING_TOLERANCE_GEL = 10;

// Mirrors the unexported `requiredRevenueFactIds` list in
// lib/data/realRevenue/validateRealRevenue.ts: the nine net-revenue categories
// plus the two receipt categories every published revenue year must carry.
const REVENUE_FACT_ITEM_IDS = [
  "revenue.vat",
  "revenue.income_tax",
  "revenue.profit_tax",
  "revenue.excise_tax",
  "revenue.import_tax",
  "revenue.property_tax",
  "revenue.other_taxes",
  "revenue.grants",
  "revenue.other_revenue",
  "revenue.asset_decrease",
  "revenue.increase_liabilities",
] as const;

const EXPENDITURE_TOTAL_ITEM_ID = "expenditure.total";
const REVENUE_TOTAL_ITEM_ID = "revenue.total";

type Pipeline = {
  facts: BudgetFactImportRow[];
  adminFacts: AdminSpendingFact[];
  glossary: Map<string, GlossaryEntry>;
  sources: SourceDocumentRow[];
  adminCategories: AdminSpendingCategory[];
  taxonomy: TaxonomyItem[];
  mappings: SpendingMapping[];
  gdpFacts: NationalGdpFact[];
};

let pipelinePromise: Promise<Pipeline> | null = null;

function loadPipeline(): Promise<Pipeline> {
  pipelinePromise ??= (async () => {
    const [facts, adminFacts, glossary, sources, adminCategories, taxonomy, mappings, gdpFacts] = await Promise.all([
      loadBudgetFactRows(BUDGET_FACTS_CSV),
      loadAdminSpendingFacts(ADMIN_SPENDING_FACTS_CSV),
      loadGlossary(GLOSSARY_CSV),
      loadSourceDocuments(SOURCE_DOCUMENTS_CSV),
      loadAdminSpendingCategoriesFile(ADMIN_CATEGORIES_JSON),
      loadTaxonomyFiles(TAXONOMY_DIR),
      loadSpendingMappings(SPENDING_FIELD_MAPPING_CSV),
      loadNationalGdpFacts(NATIONAL_GDP_CSV),
    ]);

    return { facts, adminFacts, glossary, sources, adminCategories, taxonomy, mappings, gdpFacts };
  })();

  return pipelinePromise;
}

function uniqueSortedYears(rows: { year: number }[]): number[] {
  return Array.from(new Set(rows.map((row) => row.year))).sort((a, b) => a - b);
}

function sumAmountGel(rows: { amountGel: number }[]): number {
  return rows.reduce((sum, row) => sum + row.amountGel, 0);
}

function expenditureCategoryFacts(facts: BudgetFactImportRow[]): BudgetFactImportRow[] {
  return facts.filter((fact) => fact.side === "expenditure" && fact.itemId !== EXPENDITURE_TOTAL_ITEM_ID);
}

function revenueFacts(facts: BudgetFactImportRow[]): BudgetFactImportRow[] {
  return facts.filter((fact) => fact.side === "revenue");
}

function actualOnly<T extends { basis: string }>(rows: T[]): T[] {
  return rows.filter((row) => row.basis === "actual");
}

describe("data pipeline gate (real shipped data files)", () => {
  it("covers every national budget year with one registered GDP denominator", async () => {
    const { facts, gdpFacts, sources } = await loadPipeline();
    const gdpByYear = new Map(gdpFacts.map((fact) => [fact.year, fact]));
    const budgetYears = uniqueSortedYears(facts);
    const registeredSourceIds = new Set(sources.map((source) => source.sourceId));

    expect(budgetYears.filter((year) => !gdpByYear.has(year))).toEqual([]);
    expect(gdpFacts.filter((fact) => !registeredSourceIds.has(fact.sourceId))).toEqual([]);
  });
  it("loads every production data file through the same loaders app/page.tsx uses", async () => {
    const pipeline = await loadPipeline();

    expect(pipeline.facts.length).toBeGreaterThan(0);
    expect(pipeline.adminFacts.length).toBeGreaterThan(0);
    expect(pipeline.glossary.size).toBeGreaterThan(0);
    expect(pipeline.sources.length).toBeGreaterThan(0);
    expect(pipeline.taxonomy.length).toBeGreaterThan(0);
    expect(pipeline.mappings.length).toBeGreaterThan(0);
    expect(pipeline.adminCategories.length).toBeGreaterThan(0);

    for (const category of pipeline.adminCategories) {
      expect(category.id).toMatch(/^admin_spending\.[a-z0-9_]+$/);
      expect(category.kaLabel.length).toBeGreaterThan(0);
      expect(category.enLabel.length).toBeGreaterThan(0);
      expect(Number.isInteger(category.sortOrder)).toBe(true);
    }
  });

  it("matches expenditure year coverage in coverage.ts exactly", async () => {
    const { facts } = await loadPipeline();
    const expenditure = facts.filter((fact) => fact.side === "expenditure");
    const detailedYears = uniqueSortedYears(expenditure.filter((fact) => fact.itemId.startsWith("spending.")));
    const totalOnlyYears = uniqueSortedYears(expenditure.filter((fact) => fact.itemId === EXPENDITURE_TOTAL_ITEM_ID));

    expect(uniqueSortedYears(expenditure)).toEqual([...EXPENDITURE_YEARS].sort((a, b) => a - b));
    expect(detailedYears).toEqual(EXPENDITURE_DETAILED_YEARS);
    expect(totalOnlyYears).toEqual(EXPENDITURE_TOTAL_ONLY_YEARS);
  });

  it("matches revenue year coverage in coverage.ts exactly", async () => {
    const { facts } = await loadPipeline();
    const revenue = revenueFacts(facts);
    const totalRowYears = uniqueSortedYears(revenue.filter((fact) => fact.itemId === REVENUE_TOTAL_ITEM_ID));

    expect(uniqueSortedYears(revenue)).toEqual(REVENUE_YEARS);
    // REVENUE_TOTAL_ONLY_YEARS is empty: the shipped CSV must not carry any
    // revenue.total rows because every revenue year is fully detailed.
    expect(totalRowYears).toEqual(REVENUE_TOTAL_ONLY_YEARS);
  });

  it("matches admin spending year coverage in coverage.ts exactly", async () => {
    const { adminFacts } = await loadPipeline();

    expect(uniqueSortedYears(adminFacts)).toEqual(ADMIN_SPENDING_YEARS);
  });

  it("resolves every fact reference against taxonomy, glossary, and source documents with no orphans", async () => {
    const { facts, adminFacts, glossary, sources, taxonomy, mappings } = await loadPipeline();

    // Taxonomy + source referential integrity, using the shared production validator.
    expect(() => validateFoundationReferences({ taxonomy, sources, mappings, facts })).not.toThrow();

    // Every non-total fact item must have a glossary entry (totals get hardcoded labels).
    const factItemIdsWithoutGlossary = Array.from(
      new Set(
        facts
          .map((fact) => fact.itemId)
          .filter((itemId) => itemId !== EXPENDITURE_TOTAL_ITEM_ID && itemId !== REVENUE_TOTAL_ITEM_ID)
          .filter((itemId) => !glossary.has(itemId)),
      ),
    ).sort();
    expect(factItemIdsWithoutGlossary).toEqual([]);

    // Glossary and taxonomy must describe the same id universe (no orphans on either side).
    const taxonomyIds = new Set(taxonomy.map((item) => item.id));
    expect(Array.from(glossary.keys()).sort()).toEqual(Array.from(taxonomyIds).sort());

    // Admin spending facts may carry semicolon-joined source ids; every part must resolve.
    const registeredSourceIds = new Set(sources.map((source) => source.sourceId));
    const unresolvedAdminSourceIds = Array.from(
      new Set(
        adminFacts
          .flatMap((fact) => fact.sourceId.split(";"))
          .filter((sourceId) => !registeredSourceIds.has(sourceId)),
      ),
    ).sort();
    expect(unresolvedAdminSourceIds).toEqual([]);

    // Admin category facts must resolve to the shipped category taxonomy JSON.
    const adminCategories = await loadPipeline().then((pipeline) => pipeline.adminCategories);
    const adminCategoryIds = new Set(adminCategories.map((category) => category.id));
    const unresolvedCategoryFactIds = Array.from(
      new Set(
        adminFacts
          .filter((fact) => fact.level === "admin_category")
          .map((fact) => fact.itemId)
          .filter((itemId) => !adminCategoryIds.has(itemId)),
      ),
    ).sort();
    expect(unresolvedCategoryFactIds).toEqual([]);

    // Every major program must roll up to an admin category fact in the same year.
    // Exception: a legacy-join point (marked by its mapping_notes prefix, stamped in
    // adminSpending/legacyProgramJoins.ts) follows the PROGRAM across machinery-of-government
    // changes, so it may precede its modern parent category's first year (2006-2008 roads ran
    // under the Economy ministry; the Regional Development category only starts in 2009). Such
    // a point must still name a category that exists in some year; every other fact — including
    // legacy joins whose parent category does exist that year — keeps the same-year requirement.
    const categoryFactKeys = new Set(
      adminFacts.filter((fact) => fact.level === "admin_category").map((fact) => `${fact.year}:${fact.itemId}`),
    );
    const categoryItemIds = new Set(
      adminFacts.filter((fact) => fact.level === "admin_category").map((fact) => fact.itemId),
    );
    const orphanPrograms = adminFacts
      .filter((fact) => fact.level === "major_program")
      .filter((fact) => {
        if (!fact.parentItemId) return true;
        if (categoryFactKeys.has(`${fact.year}:${fact.parentItemId}`)) return false;
        return !(isLegacyJoinFact(fact) && categoryItemIds.has(fact.parentItemId));
      })
      .map((fact) => `${fact.year}:${fact.itemId}`);
    expect(orphanPrograms).toEqual([]);
  });

  it("has exactly one fact per year, item, and basis in each import", async () => {
    const { facts, adminFacts } = await loadPipeline();

    const duplicateBudgetKeys = new Set<string>();
    const seenBudgetKeys = new Set<string>();
    for (const fact of facts) {
      const key = `${fact.year}:${fact.side}:${fact.itemId}:${fact.basis}`;
      if (seenBudgetKeys.has(key)) duplicateBudgetKeys.add(key);
      seenBudgetKeys.add(key);
    }
    expect(Array.from(duplicateBudgetKeys)).toEqual([]);

    const duplicateAdminKeys = new Set<string>();
    const seenAdminKeys = new Set<string>();
    for (const fact of adminFacts) {
      const key = `${fact.year}:${fact.itemId}`;
      if (seenAdminKeys.has(key)) duplicateAdminKeys.add(key);
      seenAdminKeys.add(key);
    }
    expect(Array.from(duplicateAdminKeys)).toEqual([]);
  });

  it("keeps total-only expenditure years to exactly the official total row", async () => {
    const { facts } = await loadPipeline();
    const expenditure = facts.filter((fact) => fact.side === "expenditure");

    for (const year of EXPENDITURE_TOTAL_ONLY_YEARS) {
      const yearRows = expenditure.filter((fact) => fact.year === year);

      expect(yearRows).toHaveLength(1);
      expect(yearRows[0]?.itemId).toBe(EXPENDITURE_TOTAL_ITEM_ID);
      expect(yearRows[0]?.basis).toBe("actual");

      // The shipped CSV row must carry the same officially evidenced amount as
      // the curated total-only constant in lib/data/totalOnlyBudgetFacts.ts.
      const curated = TOTAL_ONLY_BUDGET_FACTS.find(
        (row) => row.year === year && row.side === "expenditure" && row.item_id === EXPENDITURE_TOTAL_ITEM_ID,
      );
      expect(curated).toBeDefined();
      expect(yearRows[0]?.amountGel).toBe(Number(curated?.amount_gel));
    }

    // Detailed years must NOT carry an explicit total row: the app derives
    // their totals by summing the category facts.
    const totalRowsInDetailedYears = expenditure.filter(
      (fact) => fact.itemId === EXPENDITURE_TOTAL_ITEM_ID && EXPENDITURE_DETAILED_YEARS.includes(fact.year),
    );
    expect(totalRowsInDetailedYears).toEqual([]);
  });

  it("carries a complete category panel for every detailed year on both sides", async () => {
    const { facts, taxonomy } = await loadPipeline();
    const spendingFieldIds = taxonomy
      .filter((item) => item.side === "expenditure" && item.level === "public_spending_field")
      .map((item) => item.id)
      .sort();
    const expectedRevenueIds = [...REVENUE_FACT_ITEM_IDS].sort();

    for (const year of EXPENDITURE_DETAILED_YEARS) {
      const itemIds = expenditureCategoryFacts(facts)
        .filter((fact) => fact.year === year)
        .map((fact) => fact.itemId)
        .sort();
      expect(itemIds, `expenditure ${year}`).toEqual(spendingFieldIds);
    }

    for (const year of REVENUE_YEARS) {
      const itemIds = revenueFacts(facts)
        .filter((fact) => fact.year === year)
        .map((fact) => fact.itemId)
        .sort();
      const expectedIds = REVENUE_PARTIAL_YEARS.includes(year)
        ? expectedRevenueIds.filter((itemId) => itemId !== "revenue.increase_liabilities")
        : expectedRevenueIds;
      expect(itemIds, `revenue ${year}`).toEqual(expectedIds);
    }
  });

  it("reconciles every detailed expenditure year against the independent admin-spending pipeline", async () => {
    const { facts, adminFacts } = await loadPipeline();

    // The functional (spending.*) and administrative (admin_spending.*) imports
    // are generated from independent official sources but both cover the full
    // state budget payments for a year, so their per-year actual sums must agree.
    // For 2017-2025 both draw on the same tavi-6 execution workbooks and match
    // within a single pipeline's reconciliation tolerance (1000 GEL). The pre-2017
    // backfill overlap (2005-2016) draws each pipeline on a DIFFERENT official
    // document (functional: treasury E11 PDFs + supplements; admin: mof.ge annual-
    // execution reports), so the two independently round the same budget at the
    // thousand-GEL annex level and their sums can diverge by the sum of both
    // pipelines' rounding budgets. Cross-pipeline agreement therefore tolerates 2x
    // the single-pipeline reconciliation tolerance (observed worst case: 2016,
    // 1,120 GEL on a 10.3B budget = 0.00001%). This is a rounding envelope across
    // two independent sources, NOT a data-quality slack: each pipeline still
    // reconciles to its own official total within 1000 GEL at generation time.
    const CROSS_PIPELINE_TOLERANCE_GEL = 2 * ADMIN_SPENDING_RECONCILIATION_TOLERANCE_GEL;
    const mismatches: { year: number; functionalTotalGel: number; adminTotalGel: number; differenceGel: number }[] = [];

    for (const year of EXPENDITURE_DETAILED_YEARS.filter((candidate) => ADMIN_SPENDING_YEARS.includes(candidate))) {
      const functionalTotalGel = sumAmountGel(
        actualOnly(expenditureCategoryFacts(facts)).filter((fact) => fact.year === year),
      );
      const adminTotalGel = sumAmountGel(
        actualOnly(adminFacts).filter((fact) => fact.level === "admin_category" && fact.year === year),
      );
      const differenceGel = Math.abs(functionalTotalGel - adminTotalGel);

      if (differenceGel > CROSS_PIPELINE_TOLERANCE_GEL) {
        mismatches.push({ year, functionalTotalGel, adminTotalGel, differenceGel });
      }
    }

    expect(mismatches).toEqual([]);

    const functional2004TotalGel = sumAmountGel(
      actualOnly(expenditureCategoryFacts(facts)).filter((fact) => fact.year === 2004),
    );
    const admin2004TotalGel = sumAmountGel(
      actualOnly(adminFacts).filter((fact) => fact.level === "admin_category" && fact.year === 2004),
    );
    expect(Math.abs(functional2004TotalGel - admin2004TotalGel)).toBeLessThanOrEqual(2_000);
  });

  it("keeps every major program within its admin category envelope", async () => {
    const { adminFacts } = await loadPipeline();
    const categoryAmountByKey = new Map(
      adminFacts.filter((fact) => fact.level === "admin_category").map((fact) => [`${fact.year}:${fact.itemId}`, fact.amountGel]),
    );
    const programSumByKey = new Map<string, number>();

    // All program facts participate, including legacy-join points — the envelope holds for
    // them too wherever their parent category exists that year. The ONLY exemption is a
    // (year, category) cell with no category fact whose program sum comes entirely from
    // legacy-join points: those follow the PROGRAM across ministry moves, so their money can
    // sit under a different administrative owner that year (2006-2008 roads: economy owner,
    // regional-infrastructure series; the regional category only starts in 2009).
    const keyHasNonJoinFact = new Set<string>();
    for (const fact of adminFacts.filter((row) => row.level === "major_program")) {
      const key = `${fact.year}:${fact.parentItemId}`;
      programSumByKey.set(key, (programSumByKey.get(key) ?? 0) + fact.amountGel);
      if (!isLegacyJoinFact(fact)) keyHasNonJoinFact.add(key);
    }

    // Major programs are a curated subset of each category, so their sum can
    // never exceed the category total (beyond GEL rounding drift).
    const overflows = Array.from(programSumByKey.entries())
      .filter(([key]) => categoryAmountByKey.has(key) || keyHasNonJoinFact.has(key))
      .filter(([key, programSum]) => programSum > (categoryAmountByKey.get(key) ?? 0) + ADMIN_SPENDING_RECONCILIATION_TOLERANCE_GEL)
      .map(([key, programSum]) => ({ key, programSum, categoryAmount: categoryAmountByKey.get(key) ?? 0 }));
    expect(overflows).toEqual([]);
  });

  it("reconciles 2006 revenue receipts against the curated official total", async () => {
    const { facts } = await loadPipeline();

    // lib/data/totalOnlyBudgetFacts.ts preserves the official 2006 consolidated
    // receipts total; the detailed 2006 revenue facts shipped in the CSV must
    // sum to it within the revenue pipeline's rounding tolerance.
    const curated2006Total = TOTAL_ONLY_BUDGET_FACTS.find(
      (row) => row.year === 2006 && row.side === "revenue" && row.item_id === REVENUE_TOTAL_ITEM_ID,
    );
    expect(curated2006Total).toBeDefined();

    const detailed2006Sum = sumAmountGel(actualOnly(revenueFacts(facts)).filter((fact) => fact.year === 2006));
    const differenceGel = Math.abs(detailed2006Sum - Number(curated2006Total?.amount_gel));

    expect(differenceGel).toBeLessThanOrEqual(REVENUE_ROUNDING_TOLERANCE_GEL);
  });

  it("pins the derived totals for the two most recent years", async () => {
    const { facts } = await loadPipeline();

    // INTENTIONAL REGRESSION PINS. These are the exact derived totals (in GEL)
    // the explorer displays for the two most recent years, computed by summing
    // the actual category facts (there are no explicit total rows for detailed
    // years). If a data refresh legitimately changes any of these numbers, the
    // new value must be verified against the official source documents and this
    // pin consciously updated in the same change. Do NOT loosen these into
    // tolerances or drop them to make a red build green.
    const totalFor = (side: "revenue" | "expenditure", year: number): number =>
      sumAmountGel(
        actualOnly(side === "revenue" ? revenueFacts(facts) : expenditureCategoryFacts(facts)).filter(
          (fact) => fact.year === year,
        ),
      );

    expect(totalFor("expenditure", 2004)).toBe(1_930_210_300);
    expect(totalFor("expenditure", 2024)).toBe(25_946_342_918);
    expect(totalFor("expenditure", 2025)).toBe(27_723_319_039);
    // Revenue totals are consolidated receipts: the nine net-revenue categories
    // plus asset decrease and liabilities increase, matching the app's derived
    // "Total revenue" series.
    expect(totalFor("revenue", 2024)).toBe(29_744_320_017);
    expect(totalFor("revenue", 2025)).toBe(32_368_880_408);

    // Same intentional pins for the oldest detailed expenditure years (added
    // 2026-07): E11 functional PDF plus mof.ge annual execution report
    // payments-by-program supplements. Official annual totals they reconcile
    // against (thousand-GEL annex rounding): 7,806,801,800, 8,104,217,600,
    // 9,009,812,200, 9,703,127,100, and 10,292,234,100 GEL.
    expect(totalFor("expenditure", 2012)).toBe(7_806_801_963);
    expect(totalFor("expenditure", 2013)).toBe(8_104_217_952);
    expect(totalFor("expenditure", 2014)).toBe(9_009_812_195);
    expect(totalFor("expenditure", 2015)).toBe(9_703_126_964);
    expect(totalFor("expenditure", 2016)).toBe(10_292_234_620);

    // 2008-2011 (added 2026-07): E11 functional PDF plus mof.ge annual
    // execution report payments-by-organization supplements (2008 uses the
    // report's whole-budget aggregates). Official annual totals they
    // reconcile against (thousand-GEL report rounding): 6,758,831,800,
    // 6,754,106,800, 6,972,343,800, and 7,459,279,500 GEL.
    expect(totalFor("expenditure", 2008)).toBe(6_758_831_737);
    expect(totalFor("expenditure", 2009)).toBe(6_754_106_742);
    expect(totalFor("expenditure", 2010)).toBe(6_972_343_653);
    expect(totalFor("expenditure", 2011)).toBe(7_459_279_360);

    // 2007 (added 2026-07): the old-classification E11 already covers the
    // whole payments concept (lending and debt repayment inside functional
    // blocks), so the composition is the mapped E11 alone, reconciled against
    // the execution report total of 5,237,131.1 thousand GEL.
    expect(totalFor("expenditure", 2007)).toBe(5_237_131_090);

    // 2005-2006 (added 2026-07): the pre-COFOG 14-group functional
    // classification mapped to public categories (group total minus
    // carve-outs). Category totals sum exactly to the official payments
    // grand totals: 2,626,507.3 thousand GEL (2005) and 3,822,512.6 (2006).
    expect(totalFor("expenditure", 2005)).toBe(2_626_507_300);
    expect(totalFor("expenditure", 2006)).toBe(3_822_512_626);

    // 2017-2023 (pinned 2026-07): E11 functional PDF plus tavi-6 workbook
    // financial-asset/liability supplements. These reconcile at generation
    // time; pinning here closes the regression gap so all 22 detailed years
    // (2004-2025) are guarded, not just the endpoints.
    expect(totalFor("expenditure", 2017)).toBe(11_764_835_158);
    expect(totalFor("expenditure", 2018)).toBe(12_590_181_621);
    expect(totalFor("expenditure", 2019)).toBe(13_469_688_961);
    expect(totalFor("expenditure", 2020)).toBe(16_174_635_967);
    expect(totalFor("expenditure", 2021)).toBe(19_807_502_469);
    expect(totalFor("expenditure", 2022)).toBe(20_163_012_511);
    expect(totalFor("expenditure", 2023)).toBe(22_350_179_410);
  });

  it("has no negative actual amounts where the domain forbids them", async () => {
    const { facts, adminFacts } = await loadPipeline();

    // Negative expenditure is a validation error in both pipelines (the budget
    // loader throws on it and tests/fixtures/negative-expenditure-facts.csv
    // documents that); assert the shipped data honours the rule end to end.
    const negativeExpenditure = facts
      .filter((fact) => fact.side === "expenditure" && fact.amountGel < 0)
      .map((fact) => `${fact.year}:${fact.itemId}`);
    expect(negativeExpenditure).toEqual([]);

    const negativeAdminAmounts = adminFacts
      .filter((fact) => fact.amountGel < 0)
      .map((fact) => `${fact.year}:${fact.itemId}`);
    expect(negativeAdminAmounts).toEqual([]);

    // Negative revenue rows ARE allowed as official correction entries (see
    // tests/fixtures/negative-revenue-facts.csv and the loader's asymmetry).
    // Pin the exact set of shipped corrections so a new negative row is a
    // conscious decision rather than silent drift.
    const negativeRevenue = revenueFacts(facts)
      .filter((fact) => fact.amountGel < 0)
      .map((fact) => `${fact.year}:${fact.itemId}`)
      .sort();
    expect(negativeRevenue).toEqual(["2019:revenue.other_taxes", "2020:revenue.other_taxes"]);
  });
});
