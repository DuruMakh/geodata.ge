// apps/web/tests/factQuery/queryMunicipal.test.ts
import { readFileSync } from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { beforeAll, describe, expect, it } from "vitest";
import { testSnapshot } from "../helpers/factQuerySnapshot";
import { queryMunicipal } from "../../lib/factQuery/queryMunicipal";
import { envelopeSchema } from "../../lib/factQuery/schemas";
import { AGGREGATE_ONLY_MUNICIPAL_CODES, type FactQuerySnapshot } from "../../lib/factQuery/types";
import type { Observation } from "../../lib/factQuery/observations";
import type { Coverage } from "../../lib/factQuery/types";

let snapshot: FactQuerySnapshot;

beforeAll(async () => {
  snapshot = testSnapshot({ releaseCommit: "test", generatedAt: "2026-08-29T00:00:00.000Z" });
});

const TOTAL = "municipal.total";
const KHULO = "11";
const COUNTRY = "country.georgia";
const ADJARA = "region.adjara";

type ObservationData = { observations: Observation[]; coverage: Coverage };
const data = (result: ReturnType<typeof queryMunicipal>) => (result as { data: ObservationData }).data;
const errorOf = (result: ReturnType<typeof queryMunicipal>) => (result as { error: { code: string; validChoices?: string[] } }).error;
const cell = (result: ReturnType<typeof queryMunicipal>, entityId: string, year: number) =>
  data(result).observations.find((o) => o.entityId === entityId && o.year === year);

/** The ten reviewed functional categories (lib/data/municipal/functionMapping.ts). */
const FUNCTION_SERIES = [
  "municipal.general_public_services",
  "municipal.defence",
  "municipal.public_order_safety",
  "municipal.economic_affairs",
  "municipal.environment",
  "municipal.housing_communal",
  "municipal.health",
  "municipal.recreation_culture",
  "municipal.education",
  "municipal.social_protection",
];
describe("queryMunicipal", () => {
  it("returns a conforming observations envelope", () => {
    const result = queryMunicipal(snapshot, {
      entityIds: [KHULO],
      seriesIds: [TOTAL],
      years: [2024],
      measure: "amount_gel",
    });

    expect(envelopeSchema.parse(result)).toBeTruthy();
    expect(result.kind).toBe("observations");
  });

  describe("Khulo 2024 — the load-bearing fallback case", () => {
    const khulo2024 = () =>
      queryMunicipal(snapshot, { entityIds: [KHULO], seriesIds: [TOTAL], years: [2024], measure: "amount_gel" });

    it("returns the exact reviewed figure and names the fallback in valueDefinition", () => {
      const observation = cell(khulo2024(), KHULO, 2024);

      expect(observation?.value).toBe(30969077.43);
      expect(observation?.availability).toBe("available");
      // Every other 2024 municipality is a payment total; this one is the
      // functional sum standing in for a missing payment actual, and the
      // definition must say so rather than reading like the others.
      expect(observation?.valueDefinition).toBe("მუნიციპალიტეტის საჯარო ჯამი, გაზომვის საფუძველი: ფუნქციების მიხედვით ხარჯების ჯამი, რომელიც გამოიყენება, რადგან ფაქტობრივი ჯამური გადახდები გამოქვეყნებული არ არის.");
      expect(observation?.valueDefinitionEn).toBe("The municipality's public total, measured on the following basis: sum of spending by function, used because actual total payments are not published.");
    });

    it("fires municipal_source_actual_missing even though show_warning is false", () => {
      const fact = snapshot.municipal.totalFacts.find((f) => f.municipalityCode === KHULO && f.year === 2024);
      // Guard the premise: if the data ever flips showWarning true this test
      // stops proving that warningType drives the rule.
      expect(fact?.showWarning).toBe(false);
      expect(fact?.warningType).toBe("source_actual_missing");

      expect(cell(khulo2024(), KHULO, 2024)?.caveatIds).toContain("municipal_source_actual_missing");
    });

    it("does not attach that caveat to a clean municipality in the same request", () => {
      const result = queryMunicipal(snapshot, {
        entityIds: [KHULO, "04"],
        seriesIds: [TOTAL],
        years: [2024],
        measure: "amount_gel",
      });

      expect(cell(result, "04", 2024)?.caveatIds).not.toContain("municipal_source_actual_missing");
    });
  });

  describe("excluded municipalities are explained, not denied", () => {
    it("returns no row, no error, and an exclusion entry with a reason", () => {
      const code = AGGREGATE_ONLY_MUNICIPAL_CODES[0];
      const result = queryMunicipal(snapshot, {
        entityIds: [code, KHULO],
        seriesIds: [TOTAL],
        years: [2024],
        measure: "amount_gel",
      });

      expect(result.kind).toBe("observations");
      expect(data(result).observations.some((o) => o.entityId === code)).toBe(false);
      const exclusion = data(result).coverage.excludedEntities.find((e) => e.entityId === code);
      expect(exclusion).toBeDefined();
      expect(exclusion?.reason.length).toBeGreaterThan(0);
      expect(data(result).observations.some((o) => o.entityId === KHULO)).toBe(true);
    });

    it("carries municipality_not_territorial", () => {
      const result = queryMunicipal(snapshot, {
        entityIds: [AGGREGATE_ONLY_MUNICIPAL_CODES[0]],
        seriesIds: [TOTAL],
        years: [2024],
        measure: "amount_gel",
      });

      expect(result.meta.caveats.map((c) => c.code)).toContain("municipality_not_territorial");
    });

    it("covers every excluded code, none of which may produce a row", () => {
      const result = queryMunicipal(snapshot, {
        entityIds: [...AGGREGATE_ONLY_MUNICIPAL_CODES],
        seriesIds: [TOTAL],
        years: [2024],
        measure: "amount_gel",
      });

      for (const code of AGGREGATE_ONLY_MUNICIPAL_CODES) {
        expect(data(result).observations.some((o) => o.entityId === code)).toBe(false);
        expect(data(result).coverage.excludedEntities.some((e) => e.entityId === code)).toBe(true);
      }
    });

    it("still returns unknown_entity for a genuinely unknown id", () => {
      const result = queryMunicipal(snapshot, {
        entityIds: ["99"],
        seriesIds: [TOTAL],
        years: [2024],
        measure: "amount_gel",
      });

      // The distinction that matters: "99" does not exist, "05" exists and is
      // excluded. Reporting the excluded one as unknown would tell a model the
      // municipality is not real.
      expect(result.kind).toBe("error");
      expect(errorOf(result).code).toBe("unknown_entity");
      expect(errorOf(result).validChoices).not.toContain(AGGREGATE_ONLY_MUNICIPAL_CODES[0]);
    });
  });

  describe("three entity grains, three arithmetics", () => {
    it("country.georgia uses the served consolidated total, not the sum of the 64", () => {
      const result = queryMunicipal(snapshot, {
        entityIds: [COUNTRY],
        seriesIds: [TOTAL],
        years: [2024],
        measure: "amount_gel",
      });

      const sum64 = snapshot.municipal.totalFacts
        .filter((f) => f.year === 2024)
        .reduce((sum, f) => sum + f.publicTotalGel, 0);

      expect(cell(result, COUNTRY, 2024)?.value).toBe(5553107287.81);
      // The country total also covers the five excluded budgets and the Adjara
      // republic layer, so it must NOT equal the municipal sum.
      expect(cell(result, COUNTRY, 2024)?.value).not.toBeCloseTo(sum64, 2);
    });

    it("region.adjara adds the republic payments to its members", () => {
      const result = queryMunicipal(snapshot, {
        entityIds: [ADJARA],
        seriesIds: [TOTAL],
        years: [2024],
        measure: "amount_gel",
      });

      const memberCodes = snapshot.municipal.municipalities.filter((m) => m.regionId === ADJARA).map((m) => m.code);
      const memberSum = snapshot.municipal.totalFacts
        .filter((f) => f.year === 2024 && memberCodes.includes(f.municipalityCode))
        .reduce((sum, f) => sum + f.publicTotalGel, 0);
      const net = snapshot.municipal.adjaraBudgetAdjustments.find((a) => a.year === 2024)?.netRepublicPaymentsGel ?? 0;

      expect(memberCodes.length).toBe(6);
      expect(net).toBeGreaterThan(0);
      expect(cell(result, ADJARA, 2024)?.value).toBeCloseTo(memberSum + net, 2);
      // Would fail if the adjustment were dropped.
      expect(cell(result, ADJARA, 2024)?.value).not.toBeCloseTo(memberSum, 2);
    });

    it("an ordinary region is a plain member sum with no adjustment", () => {
      const regionId = "region.guria";
      const result = queryMunicipal(snapshot, {
        entityIds: [regionId],
        seriesIds: [TOTAL],
        years: [2024],
        measure: "amount_gel",
      });

      const memberCodes = snapshot.municipal.municipalities.filter((m) => m.regionId === regionId).map((m) => m.code);
      const memberSum = snapshot.municipal.totalFacts
        .filter((f) => f.year === 2024 && memberCodes.includes(f.municipalityCode))
        .reduce((sum, f) => sum + f.publicTotalGel, 0);

      expect(cell(result, regionId, 2024)?.value).toBeCloseTo(memberSum, 2);
    });

    it("a municipality returns its own reviewed row", () => {
      const fact = snapshot.municipal.totalFacts.find((f) => f.municipalityCode === "04" && f.year === 2023);
      const result = queryMunicipal(snapshot, {
        entityIds: ["04"],
        seriesIds: [TOTAL],
        years: [2023],
        measure: "amount_gel",
      });

      expect(cell(result, "04", 2023)?.value).toBe(fact?.publicTotalGel);
    });
  });

  describe("2015 is a different measure from later years", () => {
    // queryMunicipal looks the measure up by `municipalTotalMeasures.<id>` and throws on a missing key, so a new
    // public_total_measure in the reviewed CSV must fail here, with its name, before any query does.
    it("has a Georgian and an English name for every public total measure the snapshot holds", () => {
      const held = [...new Set(snapshot.municipal.totalFacts.map((fact) => fact.publicTotalMeasure))].sort();
      expect(held.length).toBeGreaterThan(0);
      for (const measure of held) {
        for (const locale of ["ka", "en"] as const) {
          const messages = snapshot.localization.messages[locale] as Record<string, string>;
          expect(messages[`municipalTotalMeasures.${measure}`]?.trim(), `add municipalTotalMeasures.${measure} to data/localization/${locale}/service-messages.json and to SERVICE_MESSAGE_KEYS`).toBeTruthy();
        }
      }
    });

    it("gives a 2015 total a different valueDefinition than a 2020 total", () => {
      const result = queryMunicipal(snapshot, {
        entityIds: [KHULO],
        seriesIds: [TOTAL],
        years: [2015, 2020],
        measure: "amount_gel",
      });

      const in2015 = cell(result, KHULO, 2015);
      const in2020 = cell(result, KHULO, 2020);

      expect(in2015?.value).not.toBeNull();
      expect(in2020?.value).not.toBeNull();
      expect(in2015?.valueDefinition).not.toBe(in2020?.valueDefinition);
      expect(in2015?.valueDefinition).toBe("მუნიციპალიტეტის საჯარო ჯამი, გაზომვის საფუძველი: ფუნქციების მიხედვით ხარჯების ჯამი მუნიციპალიტეტების ანალიტიკური პორტალის დაარქივებული მონაცემებიდან, რომელიც ოფიციალური ჯამური გადახდების ნაცვლად გამოიყენება.");
      expect(in2015?.valueDefinitionEn).toBe("The municipality's public total, measured on the following basis: sum of spending by function from the archived municipal portal, used instead of the official total payments.");
      expect(in2020?.valueDefinitionEn).toBe("The municipality's public total, measured on the following basis: official total payments.");
    });
  });

  describe("measures", () => {
    it("share_of_total_pct uses the entity's own total, not the selected rows", () => {
      const seriesIds = ["municipal.education", "municipal.health", "municipal.social_protection"];
      const result = queryMunicipal(snapshot, {
        entityIds: [KHULO],
        seriesIds,
        years: [2024],
        measure: "share_of_total_pct",
      });

      const shares = data(result).observations.map((o) => o.value ?? 0);
      const sum = shares.reduce((a, b) => a + b, 0);

      expect(shares.length).toBe(3);
      // If the denominator were the three selected rows they would sum to 100.
      expect(sum).toBeLessThan(99);
      expect(sum).toBeGreaterThan(0);

      const total = snapshot.municipal.totalFacts.find((f) => f.municipalityCode === KHULO && f.year === 2024);
      const education = snapshot.municipal.functionFacts.find(
        (f) => f.municipalityCode === KHULO && f.year === 2024 && f.categoryId === "municipal.education",
      );
      const expected = ((education?.amountGel ?? 0) / (total?.publicTotalGel ?? 1)) * 100;
      const observed = data(result).observations.find((o) => o.seriesId === "municipal.education")?.value;
      expect(observed).toBeCloseTo(expected, 8);
    });

    it("gel_per_resident in 2025 divides the total by the reviewed population", () => {
      const result = queryMunicipal(snapshot, {
        entityIds: [KHULO],
        seriesIds: [TOTAL],
        years: [2025],
        measure: "gel_per_resident",
      });

      const total = snapshot.municipal.totalFacts.find((f) => f.municipalityCode === KHULO && f.year === 2025);
      const population = snapshot.municipal.populationFacts.find((f) => f.municipalityCode === KHULO);
      const observation = cell(result, KHULO, 2025);

      expect(observation?.unit).toBe("GEL_per_resident");
      expect(observation?.value).toBeCloseTo((total?.publicTotalGel ?? 0) / (population?.populationPersons ?? 1), 8);
    });

    it("gel_per_resident outside 2025 is a missing cell, not year_out_of_range and not zero", () => {
      const result = queryMunicipal(snapshot, {
        entityIds: [KHULO],
        seriesIds: [TOTAL],
        years: [2020],
        measure: "gel_per_resident",
      });

      expect(result.kind).toBe("observations");
      const observation = cell(result, KHULO, 2020);
      expect(observation?.value).toBeNull();
      expect(observation?.value).not.toBe(0);
      expect(observation?.availability).toBe("missing");
      expect((observation?.missingReason ?? "").length).toBeGreaterThan(0);
      expect(result.meta.caveats.map((c) => c.code)).toContain("per_resident_coverage_limited");
    });

    it("gel_per_resident for country.georgia is missing even in 2025", () => {
      const result = queryMunicipal(snapshot, {
        entityIds: [COUNTRY],
        seriesIds: [TOTAL],
        years: [2025],
        measure: "gel_per_resident",
      });

      const observation = cell(result, COUNTRY, 2025);
      expect(observation?.value).toBeNull();
      expect(observation?.availability).toBe("missing");
      expect(result.meta.caveats.map((c) => c.code)).toContain("per_resident_coverage_limited");
    });

    it("never emits a non-finite value", () => {
      const result = queryMunicipal(snapshot, {
        entityIds: snapshot.municipal.municipalities.slice(0, 20).map((m) => m.code),
        seriesIds: [TOTAL],
        years: [2025],
        measure: "gel_per_resident",
      });

      for (const observation of data(result).observations) {
        if (observation.value !== null) expect(Number.isFinite(observation.value)).toBe(true);
      }
    });

    it("rejects share_of_gdp_pct at parse time", () => {
      const result = queryMunicipal(snapshot, {
        entityIds: [KHULO],
        seriesIds: [TOTAL],
        years: [2024],
        measure: "share_of_gdp_pct",
      });

      expect(result.kind).toBe("error");
      expect(errorOf(result).code).toBe("invalid_parameters");
    });
  });

  describe("missing, zero and out of range stay distinct", () => {
    it("keeps a genuine zero available rather than calling it missing", () => {
      const zero = snapshot.municipal.functionFacts.find((f) => f.amountGel === 0);
      expect(zero).toBeDefined();

      const result = queryMunicipal(snapshot, {
        entityIds: [zero!.municipalityCode],
        seriesIds: [zero!.categoryId],
        years: [zero!.year],
        measure: "amount_gel",
      });

      const observation = cell(result, zero!.municipalityCode, zero!.year);
      expect(observation?.value).toBe(0);
      expect(observation?.availability).toBe("available");
      expect(observation?.missingReason).toBeNull();
    });

    it("returns year_out_of_range without a clamped row", () => {
      const result = queryMunicipal(snapshot, {
        entityIds: [KHULO],
        seriesIds: [TOTAL],
        years: [2011],
        measure: "amount_gel",
      });

      expect(result.kind).toBe("error");
      expect(errorOf(result).code).toBe("year_out_of_range");
    });

    it("rejects an unknown series id", () => {
      const result = queryMunicipal(snapshot, {
        entityIds: [KHULO],
        seriesIds: ["municipal.not_a_function"],
        years: [2024],
        measure: "amount_gel",
      });

      expect(result.kind).toBe("error");
      expect(errorOf(result).code).toBe("unknown_series");
      expect(errorOf(result).validChoices).toContain(TOTAL);
    });
  });

  describe("provenance and coverage", () => {
    it("resolves every source id it cites", () => {
      const result = queryMunicipal(snapshot, {
        entityIds: [KHULO],
        seriesIds: [TOTAL],
        years: [2024],
        measure: "amount_gel",
      });

      expect(result.meta.sources.length).toBeGreaterThan(0);
      const known = new Set(snapshot.sources.map((s) => s.sourceId));
      for (const observation of data(result).observations) {
        expect(observation.sourceIds.length).toBeGreaterThan(0);
        for (const id of observation.sourceIds) expect(known.has(id)).toBe(true);
      }
    });

    it("reports requested, available and returned years", () => {
      const result = queryMunicipal(snapshot, {
        entityIds: [KHULO],
        seriesIds: [TOTAL],
        years: [2015, 2024],
        measure: "amount_gel",
      });

      const coverage = data(result).coverage;
      expect(coverage.requestedYears).toEqual([2015, 2024]);
      expect(coverage.availableYears[0]).toBe(2015);
      expect(coverage.availableYears[coverage.availableYears.length - 1]).toBe(2025);
      expect(coverage.returnedYears).toEqual([2015, 2024]);
    });

    it("carries the entity slug as a url handle and reviewed bilingual labels", () => {
      const result = queryMunicipal(snapshot, {
        entityIds: [KHULO],
        seriesIds: [TOTAL],
        years: [2024],
        measure: "amount_gel",
      });

      const observation = cell(result, KHULO, 2024);
      expect(observation?.entitySlug).toBe(snapshot.municipal.slugByCode[KHULO]);
      expect(observation?.entityLabelKa).toBe("ხულო");
      expect(observation?.entityLabelEn).toBe("Khulo");
      expect(observation?.seriesLabelEn).toBe("Total budget");
    });

    it("rejects a stale expectedDataVersion", () => {
      const result = queryMunicipal(snapshot, {
        entityIds: [KHULO],
        seriesIds: [TOTAL],
        years: [2024],
        measure: "amount_gel",
        expectedDataVersion: "0".repeat(64),
      });

      expect(result.kind).toBe("error");
      expect(errorOf(result).code).toBe("data_version_changed");
    });
  });

  describe("scope caveats", () => {
    it("marks the country aggregate's scope", () => {
      const result = queryMunicipal(snapshot, {
        entityIds: [COUNTRY],
        seriesIds: [TOTAL],
        years: [2024],
        measure: "amount_gel",
      });

      expect(cell(result, COUNTRY, 2024)?.caveatIds).toContain("municipal_country_scope");
    });

    it("marks the Adjara consolidation and its missing functional crosswalk", () => {
      const totalResult = queryMunicipal(snapshot, {
        entityIds: [ADJARA],
        seriesIds: [TOTAL],
        years: [2024],
        measure: "amount_gel",
      });
      expect(cell(totalResult, ADJARA, 2024)?.caveatIds).toContain("adjara_consolidation_applied");

      const functionResult = queryMunicipal(snapshot, {
        entityIds: [ADJARA],
        seriesIds: ["municipal.education"],
        years: [2024],
        measure: "amount_gel",
      });
      // The republic payments have no functional breakdown, so Adjara's
      // functions do not add up to its total.
      expect(cell(functionResult, ADJARA, 2024)?.caveatIds).toContain("municipal_functions_no_republican_crosswalk");
    });

    it("does not mark an ordinary municipality with either scope caveat", () => {
      const result = queryMunicipal(snapshot, {
        entityIds: [KHULO],
        seriesIds: ["municipal.education"],
        years: [2024],
        measure: "amount_gel",
      });

      const caveatIds = cell(result, KHULO, 2024)?.caveatIds ?? [];
      expect(caveatIds).not.toContain("municipal_country_scope");
      expect(caveatIds).not.toContain("adjara_consolidation_applied");
      expect(caveatIds).not.toContain("municipal_functions_no_republican_crosswalk");
    });
  });

  // ---------------------------------------------------------------------------
  // Regression cover for the review of 2026-09-02.
  // ---------------------------------------------------------------------------

  describe("Adjara consolidation is claimed only where it is true", () => {
    // The two triggering paths affect DIFFERENT cells, and the old test issued
    // them as two separate requests - the only two shapes where the mislabel is
    // invisible. One combined request is what exposes it.
    it("does not stamp an unconsolidated function amount when the total is in the same request", () => {
      const result = queryMunicipal(snapshot, {
        entityIds: ["region.adjara"],
        seriesIds: ["municipal.total", "municipal.education"],
        years: [2024],
        measure: "amount_gel",
      });

      const rows = data(result).observations;
      const total = rows.find((o) => o.seriesId === "municipal.total")!;
      const education = rows.find((o) => o.seriesId === "municipal.education")!;

      expect(total.caveatIds).toContain("adjara_consolidation_applied");
      // Education is the plain municipal-only functional sum of the six members.
      // No republican payment is inside it.
      expect(education.caveatIds).not.toContain("adjara_consolidation_applied");
    });

    it("does claim it on every cell of a share request, where the denominator IS consolidated", () => {
      const result = queryMunicipal(snapshot, {
        entityIds: ["region.adjara"],
        seriesIds: ["municipal.education"],
        years: [2024],
        measure: "share_of_total_pct",
      });

      expect(data(result).observations[0]!.caveatIds).toContain("adjara_consolidation_applied");
    });
  });

  describe("every caveat attaches to something", () => {
    // The general invariant. A caveat whose affects match no returned cell is
    // simultaneously over-disclosure (it is in meta.caveats) and under-disclosure
    // (no row carries it), and it is unjoinable to any number. A region query
    // produced four such caveats, one with 548 affects entries.
    const shapes = [
      { entityIds: ["region.adjara"], seriesIds: ["municipal.total"], years: [2020, 2024], measure: "amount_gel" as const },
      { entityIds: ["region.adjara"], seriesIds: FUNCTION_SERIES, years: [2024], measure: "share_of_total_pct" as const },
      { entityIds: ["country.georgia"], seriesIds: FUNCTION_SERIES, years: [2024], measure: "share_of_total_pct" as const },
      { entityIds: ["11"], seriesIds: ["municipal.total", "municipal.education"], years: [2024], measure: "amount_gel" as const },
      { entityIds: ["04", "11"], seriesIds: ["municipal.total"], years: [2015, 2024], measure: "amount_gel" as const },
    ];

    for (const [index, request] of shapes.entries()) {
      it(`shape ${index} raises no caveat that matches zero returned cells`, () => {
        const result = queryMunicipal(snapshot, request);
        const rows = data(result).observations;
        const carried = new Set(rows.flatMap((o) => o.caveatIds));

        for (const caveat of result.meta.caveats) {
          // municipality_not_territorial is the one legitimate exception: it
          // explains entities that deliberately produce NO row, so it can never
          // attach to one.
          if (caveat.code === "municipality_not_territorial") continue;
          expect(carried.has(caveat.code), `${caveat.code} attaches to no returned cell`).toBe(true);
        }
      });
    }
  });

  describe("the shares-never-reach-100% disclosure works at all three grains", () => {
    for (const entityId of ["04", "region.adjara", "country.georgia"]) {
      it(`discloses the functional gap for ${entityId}`, () => {
        const result = queryMunicipal(snapshot, {
          entityIds: [entityId],
          seriesIds: FUNCTION_SERIES,
          years: [2024],
          measure: "share_of_total_pct",
        });

        const rows = data(result).observations;
        const sum = rows.reduce((total, o) => total + (o.value ?? 0), 0);
        if (sum >= 99.999) return; // no gap to disclose

        // Country shares summed to 91.41% and region to 57.38% with nothing in
        // meta.caveats saying so - the reporting half of "never normalised to
        // 100%" simply did not exist above municipality grain.
        const codes = result.meta.caveats.map((c) => c.code);
        expect(codes).toContain("municipal_functional_total_gap");
        expect(rows.some((o) => o.caveatIds.includes("municipal_functional_total_gap"))).toBe(true);
      });
    }
  });

  describe("valueDefinition describes the measure that was asked for", () => {
    it("does not describe a GEL total on a per-resident value", () => {
      const result = queryMunicipal(snapshot, {
        entityIds: ["11"],
        seriesIds: ["municipal.total"],
        years: [2025],
        measure: "gel_per_resident",
      });

      const row = data(result).observations[0]!;
      expect(row.value).not.toBeNull();
      // gel_per_resident is only valid for the total series, so the old
      // isTotal-before-measure order mislabelled 100% of per-resident output.
      expect(row.valueDefinition).toContain("მცხოვრებ");
      expect(row.valueDefinition).not.toContain("გაზომვის საფუძველი");
    });

    it("does not describe a GEL total on a share value", () => {
      const result = queryMunicipal(snapshot, {
        entityIds: ["11"],
        seriesIds: ["municipal.total"],
        years: [2024],
        measure: "share_of_total_pct",
      });

      expect(data(result).observations[0]!.valueDefinition).not.toContain("გაზომვის საფუძველი");
    });
  });
});

describe("an observation cites only the originals that support it", () => {
  // Spec section 7.2 calls documentIds "the exact public originals supporting
  // the result". The municipality budget-history source archives one workbook
  // per municipality, so Tbilisi's workbook is not an original supporting
  // Khulo's education figure. resolveDocumentIds used to attach every document
  // of every cited source to every row: 75 ids on a single-municipality cell,
  // and 71% of the municipal publication's bytes.
  it("cites one municipality's own workbook, not all 64", () => {
    const result = queryMunicipal(snapshot, {
      entityIds: [KHULO],
      seriesIds: ["municipal.education"],
      years: [2020],
      measure: "amount_gel",
    });
    const documentIds = data(result).observations[0]!.documentIds;

    expect(documentIds).toContain(`source.mof.municipalities.2016_2025.budget_history_${KHULO}`);
    expect(documentIds).not.toContain("source.mof.municipalities.2016_2025.budget_history_04");
    expect(documentIds.length).toBeLessThanOrEqual(3);
  });

  it("keeps a cross-municipality workbook only for the years it covers", () => {
    const result = queryMunicipal(snapshot, {
      entityIds: [KHULO],
      seriesIds: ["municipal.education"],
      years: [2016, 2020],
      measure: "amount_gel",
    });

    // A workbook naming no municipality is narrowed by its own reviewed
    // `years` field rather than by a filename convention.
    for (const observation of data(result).observations) {
      const yearly = observation.documentIds.filter((id) => /\.\d{4}\.functional_classification$/.test(id));
      for (const id of yearly) {
        expect(id, `year ${observation.year} cited ${id}`).toContain(`.${observation.year}.`);
      }
    }
  });

  it("gives a region the workbooks of its own municipalities and no others", () => {
    const members = snapshot.municipal.municipalities
      .filter((municipality) => municipality.regionId === ADJARA)
      .map((municipality) => municipality.code);
    const outsider = snapshot.municipal.municipalities.find(
      (municipality) => municipality.regionId !== ADJARA,
    )!.code;
    expect(members.length).toBeGreaterThan(0);

    const result = queryMunicipal(snapshot, {
      entityIds: [ADJARA],
      seriesIds: ["municipal.education"],
      years: [2020],
      measure: "amount_gel",
    });
    const documentIds = data(result).observations[0]!.documentIds;

    expect(documentIds).not.toContain(`source.mof.municipalities.2016_2025.budget_history_${outsider}`);
    expect(documentIds.some((id) => members.some((code) => id.endsWith(`_${code}`)))).toBe(true);
  });

  it("country evidence covers every constituent in the observation year", () => {
    const municipalManifest = parse(readFileSync(path.resolve(process.cwd(), "../../data/methodology/source-archives/municipalities.csv"), "utf8"), { columns: true, bom: true }) as { source_id: string; year: string }[];
    const supportsYear = (coverage: string, year: number) => {
      const [first, last = first] = coverage.split("-").map(Number);
      return year >= first! && year <= last!;
    };
    // Independent reviewed manifest inventory: all 69 history books, the shared
    // portal/annual inputs, republican payments, and that year's transfer form.
    const history = municipalManifest.filter(row => /budget_history_\d{2}$/.test(row.source_id));
    expect(history).toHaveLength(69);
    const municipalIds = (year: number) => municipalManifest.filter(row =>
      !row.source_id.startsWith("source.adjara.") &&
      !row.source_id.endsWith("portal_functional_basic_types") && supportsYear(row.year, year),
    ).map(row => row.source_id).sort();
    const consolidatedIds = (year: number) => [...municipalIds(year),
      year === 2015 ? "source.adjara.republic.2015.actual_payments" : "source.adjara.republic.2016_2025.actual_payments",
      `source.mof.revenue.${year}.form_1`,
    ].sort();
    for (let year = 2015; year <= 2025; year++) {
      for (const measure of ["amount_gel", "share_of_total_pct"] as const) {
        const response = queryMunicipal(snapshot, { entityIds: [COUNTRY], seriesIds: [TOTAL, ...FUNCTION_SERIES], years: [year], measure });
        for (const observation of data(response).observations) {
          const expectedDocumentIds = observation.seriesId === TOTAL || measure === "share_of_total_pct"
            ? consolidatedIds(year)
            : municipalIds(year).filter(id => year >= 2020 || id.endsWith("portal_functionals"));
          const actualDocumentIds = [...observation.documentIds].sort();
          expect(actualDocumentIds, `${observation.observationId}`).toEqual(expectedDocumentIds);
        }
      }
      const adjara = queryMunicipal(snapshot, { entityIds: [ADJARA], seriesIds: [TOTAL, "municipal.education"], years: [year], measure: "share_of_total_pct" });
      const members = snapshot.municipal.municipalities.filter(row => row.regionId === ADJARA).map(row => row.code);
      const expectedAdjara = consolidatedIds(year).filter(id => !/budget_history_\d{2}$/.test(id) || members.some(code => id.endsWith(`_${code}`)));
      for (const observation of data(adjara).observations) {
        const expected = expectedAdjara.filter(id => observation.seriesId !== TOTAL || year === 2015 || !id.endsWith("portal_functionals"));
        expect([...observation.documentIds].sort(), observation.observationId).toEqual(expected);
      }
    }
  });

  it("territorial rows exclude unrelated and aggregate-only originals", () => {
    for (const entityId of [KHULO, ADJARA, "region.guria"]) {
      const response = queryMunicipal(snapshot, { entityIds: [entityId], seriesIds: [TOTAL, "municipal.education"], years: [2015, 2020], measure: "amount_gel" });
      const members = entityId === KHULO ? [KHULO] : snapshot.municipal.municipalities.filter(row => row.regionId === entityId).map(row => row.code);
      for (const observation of data(response).observations) {
        const actual = observation.documentIds.filter(id => /budget_history_\d{2}$/.test(id)).sort();
        const expected = observation.year === 2015 ? [] : members.map(code => `source.mof.municipalities.2016_2025.budget_history_${code}`).sort();
        expect(actual).toEqual(expected);
        for (const code of AGGREGATE_ONLY_MUNICIPAL_CODES) expect(observation.documentIds).not.toContain(`source.mof.municipalities.2016_2025.budget_history_${code}`);
      }
    }
  });
});
