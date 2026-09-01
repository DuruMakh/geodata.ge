// apps/web/tests/factQuery/queryMinistries.test.ts
import { beforeAll, describe, expect, it } from "vitest";
import { buildFactQuerySnapshot } from "../../lib/factQuery/buildSnapshot";
import { queryMinistries } from "../../lib/factQuery/queryMinistries";
import { envelopeSchema, observationSchema } from "../../lib/factQuery/schemas";
import type { FactQuerySnapshot } from "../../lib/factQuery/types";

let snapshot: FactQuerySnapshot;

beforeAll(async () => {
  snapshot = await buildFactQuerySnapshot({ releaseCommit: "test", generatedAt: "2026-08-29T00:00:00.000Z" });
});

type ObservationRow = {
  observationId: string;
  datasetId: string;
  budgetScope: string;
  entityId: string;
  entityType: string;
  entityLabelKa: string;
  entitySlug: string | null;
  seriesId: string;
  seriesLabelKa: string;
  level: string;
  parentSeriesId: string | null;
  year: number;
  measure: string;
  unit: string;
  value: number | null;
  availability: string;
  missingReason: string | null;
  basis: string | null;
  valueDefinition: string;
  sourceIds: string[];
  documentIds: string[];
  caveatIds: string[];
};

type ObservationsData = {
  observations: ObservationRow[];
  coverage: {
    requestedYears: number[];
    availableYears: number[];
    returnedYears: number[];
    missingCells: { entityId: string; seriesId: string; year: number; reason: string }[];
    excludedEntities: { entityId: string; reason: string }[];
    returnedCount: number;
    expectedCount: number;
  };
};

const data = (result: ReturnType<typeof queryMinistries>) => (result as { data: ObservationsData }).data;
const errorOf = (result: ReturnType<typeof queryMinistries>) =>
  (result as { error: { code: string; validChoices?: string[] } }).error;

const servedYearsOf = (seriesId: string) =>
  snapshot.ministries.facts
    .filter((f) => f.itemId === seriesId)
    .map((f) => f.year)
    .sort((a, b) => a - b);

const joinedYearsOf = (seriesId: string) =>
  snapshot.ministries.historicalJoinSeriesYears
    .filter((cell) => cell.startsWith(`${seriesId}:`))
    .map((cell) => Number(cell.slice(cell.lastIndexOf(":") + 1)))
    .sort((a, b) => a - b);

/**
 * A joined program series together with one year it serves THROUGH the join and one it
 * serves natively under its own official code, plus a program carrying no join at all
 * that is served in that native year. The joined/native split is the whole point: a
 * joined series is joined for only some of its years.
 */
function joinedSeriesWithNativeYear(): { joined: string; unjoined: string; joinedYear: number; nativeYear: number } {
  const joinedIds = Array.from(
    new Set(snapshot.ministries.historicalJoinSeriesYears.map((cell) => cell.slice(0, cell.lastIndexOf(":")))),
  ).sort();

  for (const seriesId of joinedIds) {
    const joinedYears = joinedYearsOf(seriesId);
    const nativeYears = servedYearsOf(seriesId).filter((year) => !joinedYears.includes(year));
    if (joinedYears.length === 0 || nativeYears.length === 0) continue;

    const nativeYear = nativeYears[nativeYears.length - 1] as number;
    const unjoined = Array.from(
      new Set(
        snapshot.ministries.facts
          .filter((f) => f.level === "major_program" && f.year === nativeYear)
          .map((f) => f.itemId),
      ),
    )
      .sort()
      .find((id) => joinedYearsOf(id).length === 0);
    if (unjoined === undefined) continue;

    return { joined: seriesId, unjoined, joinedYear: joinedYears[0] as number, nativeYear };
  }

  throw new Error("no joined program series with both a joined and a native served year");
}

describe("queryMinistries", () => {
  it("returns a conforming observations envelope with per-observation schema validity", () => {
    const result = queryMinistries(snapshot, {
      level: "admin_category",
      seriesIds: ["admin_spending.defence"],
      years: [2020],
      measure: "amount_gel",
    });

    expect(envelopeSchema.parse(result)).toBeTruthy();
    expect(result.kind).toBe("observations");
    expect(data(result).observations.length).toBe(1);

    for (const observation of data(result).observations) {
      expect(observationSchema.parse(observation)).toBeTruthy();
      expect(observation.datasetId).toBe("ministries");
      expect(observation.entityId).toBe("country.georgia");
      expect(observation.entityType).toBe("country");
      expect(observation.budgetScope.length).toBeGreaterThan(0);
    }
  });

  it("serves an admin_category figure at the snapshot's exact fact amount", () => {
    const fact = snapshot.ministries.facts.find(
      (f) => f.level === "admin_category" && f.itemId === "admin_spending.defence" && f.year === 2020,
    );
    expect(fact).toBeDefined();

    const result = queryMinistries(snapshot, {
      level: "admin_category",
      seriesIds: ["admin_spending.defence"],
      years: [2020],
      measure: "amount_gel",
    });
    const observation = data(result).observations[0];

    expect(observation?.value).toBe(fact?.amountGel);
    expect(observation?.availability).toBe("available");
    expect(observation?.level).toBe("admin_category");
    expect(observation?.unit).toBe("GEL");
    expect(observation?.basis).toBe("actual");
  });

  it("serves a major_program figure at the snapshot's exact fact amount", () => {
    const fact = snapshot.ministries.facts.find((f) => f.level === "major_program" && f.year === 2020);
    expect(fact).toBeDefined();

    const result = queryMinistries(snapshot, {
      level: "major_program",
      seriesIds: [fact!.itemId],
      years: [2020],
      measure: "amount_gel",
    });
    const observation = data(result).observations[0];

    expect(observation?.value).toBe(fact?.amountGel);
    expect(observation?.availability).toBe("available");
    expect(observation?.level).toBe("major_program");
  });

  it("marks every program observation with its parent and every category observation with none", () => {
    const programFacts2020 = snapshot.ministries.facts.filter((f) => f.level === "major_program" && f.year === 2020);
    expect(programFacts2020.length).toBeGreaterThan(1);

    const programs = queryMinistries(snapshot, {
      level: "major_program",
      seriesIds: programFacts2020.map((f) => f.itemId),
      years: [2020],
      measure: "amount_gel",
    });
    for (const observation of data(programs).observations) {
      expect(observation.parentSeriesId).not.toBeNull();
      const fact = programFacts2020.find((f) => f.itemId === observation.seriesId);
      expect(observation.parentSeriesId).toBe(fact?.parentItemId);
    }

    const categories = queryMinistries(snapshot, {
      level: "admin_category",
      seriesIds: ["admin_spending.defence", "admin_spending.culture", "admin_spending.total"],
      years: [2020],
      measure: "amount_gel",
    });
    for (const observation of data(categories).observations) {
      expect(observation.parentSeriesId).toBeNull();
    }
  });

  it("calculates admin_spending.total from admin_category rows only, never from all 852 facts", () => {
    const year = 2020;
    const categorySum = snapshot.ministries.facts
      .filter((f) => f.level === "admin_category" && f.year === year)
      .reduce((sum, f) => sum + f.amountGel, 0);
    const allRowsSum = snapshot.ministries.facts.filter((f) => f.year === year).reduce((sum, f) => sum + f.amountGel, 0);
    expect(allRowsSum).toBeGreaterThan(categorySum);

    const result = queryMinistries(snapshot, {
      level: "admin_category",
      seriesIds: ["admin_spending.total"],
      years: [year],
      measure: "amount_gel",
    });
    const observation = data(result).observations[0];

    expect(observation?.availability).toBe("available");
    expect(observation?.value).toBeCloseTo(categorySum, 2);
    expect(observation?.value).not.toBeCloseTo(allRowsSum, 2);
    expect(observation?.parentSeriesId).toBeNull();
  });

  it("rejects admin_spending.total at major_program level: the admin total is not a program", () => {
    const result = queryMinistries(snapshot, {
      level: "major_program",
      seriesIds: ["admin_spending.total"],
      years: [2020],
      measure: "amount_gel",
    });

    expect(envelopeSchema.parse(result)).toBeTruthy();
    expect(result.kind).toBe("error");
    expect(errorOf(result).code).toBe("unknown_series");
    expect("data" in result).toBe(false);
  });

  it("keeps the two levels distinct: a category is unknown at major_program, a program unknown at admin_category", () => {
    const programId = snapshot.ministries.facts.find((f) => f.level === "major_program")?.itemId;
    expect(programId).toBeDefined();

    const categoryAtProgramLevel = queryMinistries(snapshot, {
      level: "major_program",
      seriesIds: ["admin_spending.defence"],
      years: [2020],
      measure: "amount_gel",
    });
    const programAtCategoryLevel = queryMinistries(snapshot, {
      level: "admin_category",
      seriesIds: [programId as string],
      years: [2020],
      measure: "amount_gel",
    });

    expect(errorOf(categoryAtProgramLevel).code).toBe("unknown_series");
    expect(errorOf(programAtCategoryLevel).code).toBe("unknown_series");
  });

  it("divides share_of_total_pct by the full administrative total, not by the parent ministry", () => {
    const year = 2020;
    const program = snapshot.ministries.facts.find(
      (f) => f.level === "major_program" && f.year === year && f.parentItemId !== null,
    );
    expect(program).toBeDefined();
    const parent = snapshot.ministries.facts.find((f) => f.itemId === program!.parentItemId && f.year === year);
    expect(parent).toBeDefined();

    const adminTotal = snapshot.ministries.facts
      .filter((f) => f.level === "admin_category" && f.year === year)
      .reduce((sum, f) => sum + f.amountGel, 0);

    const result = queryMinistries(snapshot, {
      level: "major_program",
      seriesIds: [program!.itemId],
      years: [year],
      measure: "share_of_total_pct",
    });
    const observation = data(result).observations[0];

    const shareOfAdminTotal = (program!.amountGel / adminTotal) * 100;
    const shareOfParent = (program!.amountGel / parent!.amountGel) * 100;
    expect(shareOfParent).not.toBeCloseTo(shareOfAdminTotal, 5);

    expect(observation?.value).toBeCloseTo(shareOfAdminTotal, 9);
    expect(observation?.value).not.toBeCloseTo(shareOfParent, 5);
    expect(observation?.unit).toBe("percent");
  });

  it("does not let selection change the share_of_total_pct denominator", () => {
    const year = 2020;
    const alone = queryMinistries(snapshot, {
      level: "admin_category",
      seriesIds: ["admin_spending.defence"],
      years: [year],
      measure: "share_of_total_pct",
    });
    const together = queryMinistries(snapshot, {
      level: "admin_category",
      seriesIds: ["admin_spending.defence", "admin_spending.culture"],
      years: [year],
      measure: "share_of_total_pct",
    });

    const defenceAlone = data(alone).observations.find((o) => o.seriesId === "admin_spending.defence");
    const defenceTogether = data(together).observations.find((o) => o.seriesId === "admin_spending.defence");
    const cultureTogether = data(together).observations.find((o) => o.seriesId === "admin_spending.culture");

    expect(defenceAlone?.value).toBe(defenceTogether?.value);
    expect((defenceTogether!.value as number) + (cultureTogether!.value as number)).not.toBeCloseTo(100, 5);
  });

  it("returns 2004 major programs as missing cells, never fabricated zeros", () => {
    expect(snapshot.ministries.facts.some((f) => f.level === "major_program" && f.year === 2004)).toBe(false);
    const programId = snapshot.ministries.facts.find((f) => f.level === "major_program")?.itemId;
    expect(programId).toBeDefined();

    const result = queryMinistries(snapshot, {
      level: "major_program",
      seriesIds: [programId as string],
      years: [2004],
      measure: "amount_gel",
    });

    expect(result.kind).toBe("observations");
    expect(result.status).toBe("empty");
    const observation = data(result).observations[0];
    expect(observation?.availability).toBe("missing");
    expect(observation?.value).toBeNull();
    expect(observation?.value).not.toBe(0);
    expect(observation?.missingReason).toBeTruthy();
    expect(observation?.basis).toBeNull();
    expect(data(result).coverage.returnedYears).toEqual([]);
  });

  it("reports a ragged program series' real years and returns its gap year as null, not zero", () => {
    const seriesId = "admin_program.30_06.99ee9b0c";
    const servedYears = snapshot.ministries.facts
      .filter((f) => f.itemId === seriesId)
      .map((f) => f.year)
      .sort((a, b) => a - b);
    expect(servedYears.length).toBeGreaterThan(0);

    const first = servedYears[0] as number;
    const last = servedYears[servedYears.length - 1] as number;
    const requested = Array.from({ length: last - first + 1 }, (_, index) => first + index);
    const gapYears = requested.filter((year) => !servedYears.includes(year));
    expect(gapYears.length).toBeGreaterThan(0);

    const result = queryMinistries(snapshot, {
      level: "major_program",
      seriesIds: [seriesId],
      years: requested,
      measure: "amount_gel",
    });
    const coverage = data(result).coverage;

    expect(result.status).toBe("partial");
    expect(coverage.returnedYears).toEqual(servedYears);
    expect(coverage.expectedCount).toBe(requested.length);
    expect(coverage.returnedCount).toBe(servedYears.length);

    for (const year of gapYears) {
      const observation = data(result).observations.find((o) => o.year === year);
      expect(observation?.value).toBeNull();
      expect(observation?.value).not.toBe(0);
      expect(observation?.availability).toBe("missing");
      expect(coverage.missingCells.some((cell) => cell.seriesId === seriesId && cell.year === year)).toBe(true);
    }

    for (const year of servedYears) {
      const observation = data(result).observations.find((o) => o.year === year);
      expect(observation?.availability).toBe("available");
    }
  });

  it("pins program_historical_join to the joined years of a series, not to its native years", () => {
    const { joined, joinedYear, nativeYear } = joinedSeriesWithNativeYear();

    const result = queryMinistries(snapshot, {
      level: "major_program",
      seriesIds: [joined],
      years: [joinedYear, nativeYear],
      measure: "amount_gel",
    });

    // The disclosure still belongs to the request as a whole.
    expect(result.meta.caveats.map((c) => c.code)).toContain("program_historical_join");

    const observations = data(result).observations;
    const joinedCell = observations.find((o) => o.year === joinedYear);
    const nativeCell = observations.find((o) => o.year === nativeYear);

    expect(joinedCell?.caveatIds).toContain("program_historical_join");
    // The whole point: this year came from the program's own official code, so the
    // "uses an approved historical succession join" note is not true of it.
    expect(nativeCell?.caveatIds).not.toContain("program_historical_join");
  });

  it("does not attach program_historical_join to an unjoined series in the same request", () => {
    const { joined, unjoined, joinedYear, nativeYear } = joinedSeriesWithNativeYear();
    const years = [joinedYear, nativeYear].sort((a, b) => a - b);

    const result = queryMinistries(snapshot, {
      level: "major_program",
      seriesIds: [joined, unjoined],
      years,
      measure: "amount_gel",
    });

    for (const observation of data(result).observations) {
      if (observation.seriesId === unjoined) {
        expect(observation.caveatIds).not.toContain("program_historical_join");
      }
    }

    const unjoinedOnly = queryMinistries(snapshot, {
      level: "major_program",
      seriesIds: [unjoined],
      years,
      measure: "amount_gel",
    });
    expect(unjoinedOnly.meta.caveats.map((c) => c.code)).not.toContain("program_historical_join");
  });

  it("never attaches program_historical_join to a missing cell", () => {
    const { joined } = joinedSeriesWithNativeYear();
    const served = new Set(servedYearsOf(joined));
    const missingYear = [2004, 2005].find((year) => !served.has(year));
    expect(missingYear).toBeDefined();

    const result = queryMinistries(snapshot, {
      level: "major_program",
      seriesIds: [joined],
      years: [missingYear as number],
      measure: "amount_gel",
    });

    const observation = data(result).observations.find((o) => o.year === missingYear);
    expect(observation?.value).toBeNull();
    expect(observation?.availability).toBe("missing");
    // A row with no value cannot have "its scope and original label preserved".
    expect(observation?.caveatIds).not.toContain("program_historical_join");
  });

  it("keeps the current reviewed Georgian series name and surfaces the original historical label", () => {
    const seriesId = "admin_program.27_02.56e31b26";
    const facts = snapshot.ministries.facts.filter((f) => f.itemId === seriesId).sort((a, b) => a.year - b.year);
    expect(facts.length).toBeGreaterThan(1);

    const currentLabel = facts[facts.length - 1]?.officialLabelKa;
    const historical = facts.find((f) => f.officialLabelKa !== null && f.officialLabelKa !== currentLabel);
    expect(currentLabel).toBeTruthy();
    expect(historical).toBeDefined();

    const result = queryMinistries(snapshot, {
      level: "major_program",
      seriesIds: [seriesId],
      years: [historical!.year],
      measure: "amount_gel",
    });
    const observation = data(result).observations[0];

    expect(observation?.seriesLabelKa).toBe(currentLabel);
    expect(observation?.valueDefinition).toContain(historical!.officialLabelKa as string);
    expect(JSON.stringify(observation)).not.toContain("labelEn");
  });

  it("returns non-empty, fully resolvable sources for a served figure", () => {
    const result = queryMinistries(snapshot, {
      level: "admin_category",
      seriesIds: ["admin_spending.total", "admin_spending.defence"],
      years: [2020],
      measure: "amount_gel",
    });

    expect(result.meta.sources.length).toBeGreaterThan(0);
    const resolvedIds = new Set(result.meta.sources.map((s) => s.sourceId));

    for (const observation of data(result).observations) {
      expect(observation.sourceIds.length).toBeGreaterThan(0);
      for (const sourceId of observation.sourceIds) {
        expect(resolvedIds.has(sourceId)).toBe(true);
      }
      expect(observation.documentIds.length).toBeGreaterThan(0);
    }
  });

  it("rejects a year outside dataset coverage without clamping", () => {
    const years = snapshot.ministries.facts.map((f) => f.year);
    const beyond = Math.max(...years) + 1;

    for (const year of [1999, beyond]) {
      const result = queryMinistries(snapshot, {
        level: "admin_category",
        seriesIds: ["admin_spending.defence"],
        years: [year],
        measure: "amount_gel",
      });

      expect(envelopeSchema.parse(result)).toBeTruthy();
      expect(result.kind).toBe("error");
      expect(errorOf(result).code).toBe("year_out_of_range");
      expect("data" in result).toBe(false);
    }
  });

  it("rejects gel_per_resident at parse time: administrative data has no per-resident measure", () => {
    const result = queryMinistries(snapshot, {
      level: "admin_category",
      seriesIds: ["admin_spending.defence"],
      years: [2020],
      measure: "gel_per_resident",
    });

    expect(result.kind).toBe("error");
    expect(errorOf(result).code).toBe("invalid_parameters");
  });

  it("rejects a stale expectedDataVersion", () => {
    const result = queryMinistries(snapshot, {
      level: "admin_category",
      seriesIds: ["admin_spending.defence"],
      years: [2020],
      measure: "amount_gel",
      expectedDataVersion: "0".repeat(64),
    });

    expect(result.kind).toBe("error");
    expect(errorOf(result).code).toBe("data_version_changed");
  });
});
