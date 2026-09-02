// apps/web/tests/factQuery/agreement.test.ts
//
// The gate that proves an AI answer and a chart cannot disagree (spec section
// 14.2). It covers EVERY served base observation and every supported
// calculated total, not a sample: a mismatch on one cell out of ten thousand
// is still a published wrong number.
//
// If one of these fails, the query core disagrees with the reviewed data or
// with the website. Investigate the core. Do not relax an assertion.
import { beforeAll, describe, expect, it } from "vitest";
import {
  buildFactQuerySnapshot,
  queryMinistries,
  queryMunicipal,
  queryNational,
} from "../../lib/factQuery";
import { buildExplorerModel } from "../../lib/explorer/explorerData";
import { buildCountryTotalByYear } from "../../lib/explorer/municipalData";
import type { Observation } from "../../lib/factQuery";
import type { FactQueryResponse, FactQuerySnapshot } from "../../lib/factQuery";
import type { GlossaryEntry } from "../../lib/data/glossary";

let snapshot: FactQuerySnapshot;

beforeAll(async () => {
  snapshot = await buildFactQuerySnapshot({ releaseCommit: "test", generatedAt: "2026-08-28T00:00:00.000Z" });
});

/** Fails loudly on an error envelope rather than silently yielding no rows to compare. */
function observationsOf(result: FactQueryResponse): Observation[] {
  if (result.kind === "error") throw new Error(`expected observations, got error ${result.error.code}: ${result.error.messageEn}`);
  return (result.data as { observations: Observation[] }).observations;
}

/** Keyed on the same composite the query core uses, so a miss is a real miss. */
function valueMap(observations: Observation[], key: (o: Observation) => string) {
  return new Map(observations.map((o) => [key(o), o.value]));
}

/**
 * Labels never affect the arithmetic under test, so this is built from the
 * snapshot's own items rather than re-reading the taxonomy files: the point of
 * comparison is buildExplorerModel's totalRow values.
 */
function glossaryFromSnapshot(): Map<string, GlossaryEntry> {
  return new Map(
    snapshot.national.items.map((item) => [
      item.id,
      { id: item.id, kaLabel: item.kaLabel, enLabel: item.kaLabel, description: "", notes: "" },
    ]),
  );
}

describe("national", () => {
  it("returns the exact reviewed amount for every served fact", () => {
    for (const side of ["revenue", "expenditure"] as const) {
      const sideFacts = snapshot.national.facts.filter((f) => f.side === side);
      const years = [...new Set(sideFacts.map((f) => f.year))].sort((a, b) => a - b);
      const seriesIds = [...new Set(sideFacts.map((f) => f.itemId))];

      const result = queryNational(snapshot, { side, seriesIds, years, measure: "amount_gel" });
      expect(result.status).not.toBe("error");

      const returned = valueMap(observationsOf(result), (o) => `${o.seriesId}:${o.year}`);
      for (const fact of sideFacts) {
        expect(returned.get(`${fact.itemId}:${fact.year}`)).toBe(fact.amountGel);
      }
      expect(sideFacts.length).toBeGreaterThan(0);
    }
  });

  it("matches the explorer model's total for every year, on both sides", () => {
    const glossary = glossaryFromSnapshot();

    for (const side of ["revenue", "expenditure"] as const) {
      const sideFacts = snapshot.national.facts.filter((f) => f.side === side);
      const years = [...new Set(sideFacts.map((f) => f.year))].sort((a, b) => a - b);
      const totalId = `${side}.total`;

      const model = buildExplorerModel({
        facts: snapshot.national.facts,
        glossary,
        side,
        selectedItemIds: [totalId],
        startYear: years[0]!,
        endYear: years[years.length - 1]!,
        measure: "nominal",
      });

      const result = queryNational(snapshot, { side, seriesIds: [totalId], years, measure: "amount_gel" });
      const returned = valueMap(observationsOf(result), (o) => String(o.year));

      expect(model.totalRow).not.toBeNull();
      for (const year of years) {
        // The website's chart and the query core must read the same number.
        expect(returned.get(String(year))).toBeCloseTo(model.totalRow!.valuesByYear[year]!, 2);
      }
    }
  });

  it("computes each total as the sum of its non-overlapping components", () => {
    for (const side of ["revenue", "expenditure"] as const) {
      const sideFacts = snapshot.national.facts.filter((f) => f.side === side);
      const years = [...new Set(sideFacts.map((f) => f.year))].sort((a, b) => a - b);

      const result = queryNational(snapshot, { side, seriesIds: [`${side}.total`], years, measure: "amount_gel" });
      for (const observation of observationsOf(result)) {
        const expected = sideFacts
          .filter((f) => f.year === observation.year)
          .reduce((sum, f) => sum + f.amountGel, 0);
        expect(observation.value).toBeCloseTo(expected, 2);
      }
    }
  });

  it("reports 2004 receipts as the reviewed narrower total, with its caveat", () => {
    const result = queryNational(snapshot, {
      side: "revenue",
      seriesIds: ["revenue.total"],
      years: [2004],
      measure: "amount_gel",
    });

    expect(observationsOf(result)[0]?.value).toBe(2283035800);
    expect(result.meta.caveats.map((c) => c.code)).toContain("revenue_2004_total_scope");
  });
});

describe("ministries", () => {
  it("returns the exact reviewed amount for all 852 facts", () => {
    const facts = snapshot.ministries.facts;
    expect(facts.length).toBe(852);

    for (const level of ["admin_category", "major_program"] as const) {
      const levelFacts = facts.filter((f) => f.level === level);
      const years = [...new Set(levelFacts.map((f) => f.year))].sort((a, b) => a - b);
      const seriesIds = [...new Set(levelFacts.map((f) => f.itemId))];

      const result = queryMinistries(snapshot, { level, seriesIds, years, measure: "amount_gel" });
      expect(result.status).not.toBe("error");

      const returned = valueMap(observationsOf(result), (o) => `${o.seriesId}:${o.year}`);
      for (const fact of levelFacts) {
        expect(returned.get(`${fact.itemId}:${fact.year}`)).toBe(fact.amountGel);
      }
    }
  });

  it("computes the administrative total from category rows only, never programs", () => {
    const categoryFacts = snapshot.ministries.facts.filter((f) => f.level === "admin_category");
    const years = [...new Set(categoryFacts.map((f) => f.year))].sort((a, b) => a - b);

    const result = queryMinistries(snapshot, {
      level: "admin_category",
      seriesIds: ["admin_spending.total"],
      years,
      measure: "amount_gel",
    });

    const totals = observationsOf(result);
    expect(totals.length).toBeGreaterThan(0);

    for (const observation of totals) {
      const expected = categoryFacts
        .filter((f) => f.year === observation.year)
        .reduce((sum, f) => sum + f.amountGel, 0);
      expect(observation.value).toBeCloseTo(expected, 2);

      // Explicitly NOT the sum of all 852 rows — but only assertable in a year
      // that actually has program rows. The earliest is 2006, so in 2004 and
      // 2005 the two sums are legitimately identical.
      const programsThisYear = snapshot.ministries.facts.filter(
        (f) => f.year === observation.year && f.level === "major_program",
      );
      if (programsThisYear.length > 0) {
        const withPrograms = snapshot.ministries.facts
          .filter((f) => f.year === observation.year)
          .reduce((sum, f) => sum + f.amountGel, 0);
        expect(observation.value).not.toBeCloseTo(withPrograms, 2);
      }
    }
  });
});

describe("municipal", () => {
  it("returns the exact reviewed amount for all 704 municipality totals", () => {
    const totals = snapshot.municipal.totalFacts;
    expect(totals.length).toBe(704);

    const years = [...new Set(totals.map((f) => f.year))].sort((a, b) => a - b);
    const entityIds = [...new Set(totals.map((f) => f.municipalityCode))];

    const result = queryMunicipal(snapshot, {
      entityIds,
      seriesIds: ["municipal.total"],
      years,
      measure: "amount_gel",
    });
    expect(result.status).not.toBe("error");

    const returned = valueMap(observationsOf(result), (o) => `${o.entityId}:${o.year}`);
    for (const fact of totals) {
      expect(returned.get(`${fact.municipalityCode}:${fact.year}`)).toBe(fact.publicTotalGel);
    }
  });

  it("returns the exact reviewed amount for all 7,040 function facts", () => {
    const facts = snapshot.municipal.functionFacts;
    expect(facts.length).toBe(7040);

    const years = [...new Set(facts.map((f) => f.year))].sort((a, b) => a - b);
    const entityIds = [...new Set(facts.map((f) => f.municipalityCode))];
    const seriesIds = [...new Set(facts.map((f) => f.categoryId))];

    const result = queryMunicipal(snapshot, { entityIds, seriesIds, years, measure: "amount_gel" });
    expect(result.status).not.toBe("error");

    const returned = valueMap(observationsOf(result), (o) => `${o.entityId}:${o.seriesId}:${o.year}`);
    for (const fact of facts) {
      expect(returned.get(`${fact.municipalityCode}:${fact.categoryId}:${fact.year}`)).toBe(fact.amountGel);
    }
  });

  it("matches the served consolidated country total for every year", () => {
    const byYear = buildCountryTotalByYear(snapshot.municipal.countryTotalFacts);
    const years = Object.keys(byYear).map(Number).sort((a, b) => a - b);
    // Without this the loop below never runs on an empty panel and the test
    // passes green while proving nothing.
    expect(years.length).toBeGreaterThan(0);

    const result = queryMunicipal(snapshot, {
      entityIds: ["country.georgia"],
      seriesIds: ["municipal.total"],
      years,
      measure: "amount_gel",
    });

    const returned = valueMap(observationsOf(result), (o) => String(o.year));
    for (const year of years) {
      expect(returned.get(String(year))).toBe(byYear[year]);
    }
  });

  it("never returns a row for an excluded municipality, at any year", () => {
    const years = [...new Set(snapshot.municipal.totalFacts.map((f) => f.year))].sort((a, b) => a - b);
    const result = queryMunicipal(snapshot, {
      entityIds: ["05", "42", "43", "46", "64"],
      seriesIds: ["municipal.total"],
      years,
      measure: "amount_gel",
    });

    expect(observationsOf(result).length).toBe(0);
    expect(result.kind).toBe("observations");
  });
});
