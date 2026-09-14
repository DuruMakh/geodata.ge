// apps/web/tests/factQuery/reference.test.ts
//
// Runs the spec section 14.3 reference fixture against the snapshot. This is
// the acceptance test for the product's actual promise: that a real budget
// question comes back with the right number, the right scope, its sources, and
// every limitation that qualifies it.
//
// A disagreement here is a section 18 stop condition. Fix the fixture only when
// the FIXTURE is wrong; if the engine is wrong, stop and report it. Never
// reconcile by editing an expectation to match the code.
import { beforeAll, describe, expect, it } from "vitest";
import { buildFactQuerySnapshot } from "../../lib/factQuery/buildSnapshot";
import { compare } from "../../lib/factQuery/compare";
import { describeCoverage } from "../../lib/factQuery/describeCoverage";
import { getSources } from "../../lib/factQuery/getSources";
import { queryMinistries } from "../../lib/factQuery/queryMinistries";
import { queryDebt } from "../../lib/factQuery/queryDebt";
import { queryDeficit } from "../../lib/factQuery/queryDeficit";
import { queryEconomicSectors } from "../../lib/factQuery/queryEconomicSectors";
import { queryGdp } from "../../lib/factQuery/queryGdp";
import { queryMunicipal } from "../../lib/factQuery/queryMunicipal";
import { queryNational } from "../../lib/factQuery/queryNational";
import { rank } from "../../lib/factQuery/rank";
import { RANKING_TOLERANCE, REFERENCE_INTENTS } from "./fixtures/referenceIntents";
import type { Comparison } from "../../lib/factQuery/compare";
import type { RankData } from "../../lib/factQuery/rank";
import type { Observation } from "../../lib/factQuery/observations";
import type { FactQueryResponse, FactQuerySnapshot } from "../../lib/factQuery/types";

let snapshot: FactQuerySnapshot;

beforeAll(async () => {
  snapshot = await buildFactQuerySnapshot({ releaseCommit: "test", generatedAt: "2026-09-02T00:00:00.000Z" });
});

function run(tool: string, args: unknown): FactQueryResponse {
  const dispatch: Record<string, (input: unknown) => FactQueryResponse> = {
    describe_coverage: (input) => describeCoverage(snapshot, input),
    query_national: (input) => queryNational(snapshot, input),
    query_ministries: (input) => queryMinistries(snapshot, input),
    query_municipal: (input) => queryMunicipal(snapshot, input),
    query_debt: (input) => queryDebt(snapshot, input),
    query_deficit: (input) => queryDeficit(snapshot, input),
    query_gdp: (input) => queryGdp(snapshot, input),
    query_economic_sectors: (input) => queryEconomicSectors(snapshot, input),
    compare: (input) => compare(snapshot, input),
    rank: (input) => rank(snapshot, input),
    get_sources: (input) => getSources(snapshot, input),
  };
  const fn = dispatch[tool];
  if (fn === undefined) throw new Error(`No such tool: ${tool}`);
  return fn(args);
}

function near(actual: number | null, expected: number | null, tolerance: number, label: string): void {
  if (expected === null || actual === null) {
    expect(actual, label).toBe(expected);
    return;
  }
  if (tolerance === 0) expect(actual, label).toBe(expected);
  else expect(Math.abs(actual - expected), `${label}: ${actual} vs ${expected}`).toBeLessThanOrEqual(tolerance);
}

describe("section 14.3 bilingual reference fixture", () => {
  // Spec section 14.3 fixed 20; four more were added on 2026-09-04 when debt
  // and the general government balance began being served, covering a recorded
  // debt year, a projected service year, a documented rate gap, and a signed
  // deficit. Four more on 2026-09-14 for GDP and economic sectors: a published
  // GDP year, a preliminary one, a sector share of GDP, and a missing growth year.
  it("covers 28 intents, each asked in both languages", () => {
    expect(REFERENCE_INTENTS).toHaveLength(28);
    expect(REFERENCE_INTENTS.map((intent) => intent.id)).toEqual(Array.from({ length: 28 }, (_, i) => i + 1));

    for (const intent of REFERENCE_INTENTS) {
      expect(intent.promptKa.length, `intent ${intent.id} promptKa`).toBeGreaterThan(10);
      expect(intent.promptEn.length, `intent ${intent.id} promptEn`).toBeGreaterThan(10);
      // The Georgian prompt must actually be Georgian, not a transliteration.
      expect(intent.promptKa, `intent ${intent.id} promptKa script`).toMatch(/[Ⴀ-ჿ]/);
      expect(intent.note.length, `intent ${intent.id} note`).toBeGreaterThan(10);
    }
  });

  for (const intent of REFERENCE_INTENTS) {
    describe(`intent ${intent.id}: ${intent.promptEn}`, () => {
      it("returns the reviewed answer with its scope, sources and caveats", () => {
        const response = run(intent.call.tool, intent.call.arguments);

        function verifyLanguageCompanions(value: unknown): void {
          if (value === null || typeof value !== "object") return;
          const record = value as Record<string, unknown>;
          for (const [key, item] of Object.entries(record)) {
            if (key.endsWith("Ka")) {
              const translated = record[`${key.slice(0, -2)}En`];
              if (item === null) expect(translated).toBeNull();
              else {
                expect(typeof translated, key).toBe("string");
                expect((translated as string).trim().length, key).toBeGreaterThan(0);
              }
            }
            verifyLanguageCompanions(item);
          }
        }
        verifyLanguageCompanions(response);

        expect(response.status, "status").toBe(intent.expectedStatus);

        if (intent.expectedStatus === "error") {
          expect(response.kind).toBe("error");
          return;
        }
        if (response.kind === "error") throw new Error(`unexpected error: ${response.error.messageEn}`);

        const data = response.data as Record<string, unknown>;

        // --- observation cells -------------------------------------------
        if (intent.expectedCells !== undefined) {
          const observations = (data.observations ?? []) as Observation[];
          expect(observations, "cell count").toHaveLength(intent.expectedCells.length);

          for (const expected of intent.expectedCells) {
            const actual = observations.find((observation) => observation.observationId === expected.id);
            expect(actual, `missing cell ${expected.id}`).toBeDefined();
            near(actual!.value, expected.value, intent.allowedRounding, expected.id);
            expect(actual!.unit, `${expected.id} unit`).toBe(expected.unit);
            // A null value must be reported as MISSING with a reason, never as
            // an available zero.
            if (expected.value === null) {
              expect(actual!.availability, `${expected.id} availability`).toBe("missing");
              expect(actual!.missingReason, `${expected.id} missingReason`).not.toBeNull();
            } else {
              expect(actual!.availability, `${expected.id} availability`).toBe("available");
            }
            if (intent.expectedBudgetScope !== null) {
              expect(actual!.budgetScope, `${expected.id} budgetScope`).toBe(intent.expectedBudgetScope);
            }
          }
        }

        // --- comparison ---------------------------------------------------
        if (intent.expectedComparison !== undefined) {
          const comparisons = (data.comparisons ?? []) as Comparison[];
          const actual = comparisons.find((c) => c.comparisonId === intent.expectedComparison!.id);
          expect(actual, `missing comparison ${intent.expectedComparison.id}`).toBeDefined();

          const want = intent.expectedComparison;
          near(actual!.from.value, want.from, intent.allowedRounding, `${want.id} from`);
          near(actual!.to.value, want.to, intent.allowedRounding, `${want.id} to`);
          near(actual!.absoluteChange, want.absoluteChange, intent.allowedRounding, `${want.id} absoluteChange`);
          near(actual!.percentageChange, want.percentageChange, intent.allowedRounding, `${want.id} percentageChange`);
          near(
            actual!.percentagePointChange,
            want.percentagePointChange,
            intent.allowedRounding,
            `${want.id} percentagePointChange`,
          );
          expect(actual!.comparability, `${want.id} comparability`).toBe(want.comparability);

          // A declined comparison still preserves both reviewed endpoint values.
          if (want.comparability === "not_comparable") {
            expect(actual!.from.value, "declined comparisons keep their endpoints").not.toBeNull();
            expect(actual!.to.value, "declined comparisons keep their endpoints").not.toBeNull();
            expect(actual!.reasons.length, "a decline must say why").toBeGreaterThan(0);
          }
        }

        // --- ranking --------------------------------------------------------
        if (intent.expectedRanking !== undefined) {
          const { entries, universe } = data as unknown as RankData;
          const want = intent.expectedRanking;
          const actualIds = entries.map((entry) => (entry.entityId === "country.georgia" ? entry.seriesId : entry.entityId));

          expect(actualIds.slice(0, want.orderedIds.length), "ranking order").toEqual(want.orderedIds);
          for (const entry of entries) expect(entry.unit, `entry ${entry.position} unit`).toBe(want.unit);
          expect(universe.candidateCount, "candidateCount").toBe(want.candidateCount);
          expect(universe.eligibleCount, "eligibleCount").toBe(want.eligibleCount);
          // The values themselves, not only their order: a uniform scaling
          // error keeps every position and every unit intact.
          want.topValues.forEach((expected, index) => {
            near(entries[index]!.value, expected, RANKING_TOLERANCE, `ranking value ${index}`);
          });
          // Monotonic in the direction the call actually asked for.
          const ascending = (intent.call.arguments as { order?: string }).order === "ascending";
          for (let i = 1; i < entries.length; i += 1) {
            const [previous, current] = [entries[i - 1]!.value!, entries[i]!.value!];
            if (ascending) expect(current, `entry ${i} above its predecessor`).toBeGreaterThanOrEqual(previous);
            else expect(current, `entry ${i} below its predecessor`).toBeLessThanOrEqual(previous);
          }
        }

        // --- exclusions -----------------------------------------------------
        if (intent.requiredExcludedEntityIds !== undefined) {
          const coverage = data.coverage as { excludedEntities: { entityId: string; reason: string }[] };
          for (const entityId of intent.requiredExcludedEntityIds) {
            const excluded = coverage.excludedEntities.find((entry) => entry.entityId === entityId);
            expect(excluded, `${entityId} must be reported as excluded`).toBeDefined();
            // Excluded with an EXPLANATION, not silently dropped.
            expect(excluded!.reason.length, `${entityId} exclusion reason`).toBeGreaterThan(10);
          }
        }

        // --- evidence -------------------------------------------------------
        const sourceIds = response.meta.sources.map((source) => source.sourceId);
        for (const required of intent.requiredSourceIds) {
          expect(sourceIds, `must cite ${required}`).toContain(required);
        }
        const documentIds = response.meta.sources.flatMap((source) => source.documents.map((d) => d.documentId));
        for (const required of intent.requiredDocumentIds) {
          expect(documentIds, `must show document ${required}`).toContain(required);
        }

        // --- caveats --------------------------------------------------------
        const caveatCodes = response.meta.caveats.map((caveat) => caveat.code);
        for (const required of intent.requiredCaveatCodes) {
          expect(caveatCodes, `must carry caveat ${required}`).toContain(required);
        }
        // Every caveat carries both languages, because a client may show either.
        for (const caveat of response.meta.caveats) {
          expect(caveat.messageKa.length, `${caveat.code} messageKa`).toBeGreaterThan(0);
          expect(caveat.messageEn.length, `${caveat.code} messageEn`).toBeGreaterThan(0);
          expect(caveat.messageKa, `${caveat.code} messageKa script`).toMatch(/[Ⴀ-ჿ]/);
        }

        // An intent flagged as needing a qualification must actually have
        // something to qualify with.
        if (intent.mustDeclineOrQualify) {
          // Three of the twenty responses carry no caveat at all, and none of
          // those three is flagged, so the flag discriminates. Requiring a
          // SEVERE caveat would be the opposite mistake: intents 8, 9, 15 and
          // 16 qualify correctly with a note. What this flag means is that the
          // service holds something back specific to THIS question.
          //
          // The `nominal_gel` exclusion that used to sit here went with the rule
          // itself: it rode along on every multi-year answer as boilerplate,
          // which is precisely why it had to be discounted.
          const declined =
            response.status !== "ok" ||
            response.meta.caveats.length > 0 ||
            (data.comparisons as Comparison[] | undefined)?.some((c) => c.comparability !== "comparable") === true;
          expect(declined, `intent ${intent.id} must decline or qualify`).toBe(true);
        }
      });
    });
  }
});

describe("boundary cases beyond the section 14.3 table", () => {
  it("excludes every aggregate-only municipal code, not just 05", () => {
    for (const code of ["05", "42", "43", "46", "64"]) {
      const response = queryMunicipal(snapshot, {
        entityIds: [code],
        seriesIds: ["municipal.total"],
        years: [2024],
        measure: "amount_gel",
      });
      if (response.kind === "error") throw new Error(response.error.messageEn);

      const data = response.data as { observations: Observation[]; coverage: { excludedEntities: { entityId: string }[] } };
      expect(data.observations, `${code} must produce no row`).toHaveLength(0);
      expect(data.coverage.excludedEntities.map((e) => e.entityId), `${code} must be explained`).toContain(code);
    }
  });

  it("suggests real neighbours for an unknown series id and invents none", () => {
    const response = queryNational(snapshot, {
      side: "expenditure",
      seriesIds: ["spending.helth"],
      years: [2024],
      measure: "amount_gel",
    });
    if (response.kind !== "error") throw new Error("expected an error");

    expect(response.error.code).toBe("unknown_series");

    // The legitimate set is the catalogue's, not `national.items`: a CALCULATED
    // total has no fact row but is a real queryable series, and suggesting it
    // is correct.
    const catalogue = describeCoverage(snapshot, { datasetId: "national-expenditure" });
    if (catalogue.kind === "error") throw new Error(catalogue.error.messageEn);
    const known = new Set(
      ((catalogue.data as { series: { seriesId: string }[] }).series ?? []).map((entry) => entry.seriesId),
    );

    expect(response.error.validChoices?.length ?? 0).toBeGreaterThan(0);
    for (const choice of response.error.validChoices ?? []) {
      expect(known.has(choice), `suggested ${choice} does not exist`).toBe(true);
    }
  });

  it("refuses an unknown entity id", () => {
    const response = queryMunicipal(snapshot, {
      entityIds: ["99"],
      seriesIds: ["municipal.total"],
      years: [2024],
      measure: "amount_gel",
    });

    expect(response.kind).toBe("error");
    if (response.kind === "error") expect(response.error.code).toBe("unknown_entity");
  });

  it("refuses a year beyond this baseline rather than extrapolating", () => {
    const response = queryNational(snapshot, {
      side: "expenditure",
      seriesIds: ["spending.health"],
      years: [2026],
      measure: "amount_gel",
    });

    expect(response.kind).toBe("error");
    if (response.kind === "error") expect(response.error.code).toBe("year_out_of_range");
  });

  it("refuses a measure the dataset does not support", () => {
    const response = queryMunicipal(snapshot, {
      entityIds: ["11"],
      seriesIds: ["municipal.total"],
      years: [2024],
      measure: "share_of_gdp_pct",
    });

    expect(response.kind).toBe("error");
  });

  it("reports a data version change rather than answering from a different release", () => {
    const response = queryNational(snapshot, {
      side: "expenditure",
      seriesIds: ["spending.health"],
      years: [2024],
      measure: "amount_gel",
      expectedDataVersion: "0".repeat(64),
    });

    expect(response.kind).toBe("error");
    if (response.kind === "error") expect(response.error.code).toBe("data_version_changed");
  });

  it("declines a percentage change from a non-positive base instead of dividing by zero", () => {
    // Every comparison in the snapshot whose base is <= 0 must have a null
    // percentageChange and a stated reason - never Infinity, never NaN.
    // The ten categories the reviewed data actually carries for 2004; the
    // later-classification series do not exist in that year.
    const response = compare(snapshot, {
      target: {
        dataset: "national",
        side: "revenue",
        seriesIds: [
          "revenue.asset_decrease", "revenue.excise_tax", "revenue.grants", "revenue.import_tax",
          "revenue.income_tax", "revenue.other_revenue", "revenue.other_taxes", "revenue.profit_tax",
          "revenue.property_tax", "revenue.vat",
        ],
      },
      fromYear: 2004,
      toYear: 2005,
      measure: "amount_gel",
    });
    if (response.kind === "error") throw new Error(response.error.messageEn);

    for (const comparison of (response.data as { comparisons: Comparison[] }).comparisons) {
      if (comparison.from.value !== null && comparison.from.value <= 0) {
        expect(comparison.percentageChange, `${comparison.comparisonId} from a non-positive base`).toBeNull();
      }
      if (comparison.percentageChange !== null) expect(Number.isFinite(comparison.percentageChange)).toBe(true);
    }
  });

  it("caps a ranking at its declared limit", () => {
    const response = rank(snapshot, {
      datasetId: "municipal-expenditure",
      dimension: "entities",
      entityType: "municipality",
      seriesId: "municipal.total",
      year: 2024,
      measure: "amount_gel",
      metric: "value",
      order: "descending",
      limit: 3,
    });
    if (response.kind === "error") throw new Error(response.error.messageEn);

    expect((response.data as unknown as RankData).entries).toHaveLength(3);
  });

  it("rejects a ranking limit above the documented maximum", () => {
    const response = rank(snapshot, {
      datasetId: "municipal-expenditure",
      dimension: "entities",
      entityType: "municipality",
      seriesId: "municipal.total",
      year: 2024,
      measure: "amount_gel",
      metric: "value",
      order: "descending",
      limit: 101,
    });

    expect(response.kind).toBe("error");
  });

  it("rejects an unknown source id rather than resolving a sentinel", () => {
    const response = getSources(snapshot, { sourceIds: ["source.does_not_exist"] });

    expect(response.kind).toBe("error");
    if (response.kind === "error") expect(response.error.code).toBe("unknown_source");
  });
});
