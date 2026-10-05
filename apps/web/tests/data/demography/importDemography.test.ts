import { beforeAll, describe, expect, test } from "vitest";
import { parseCanonicalDemographyRows } from "../../../lib/data/demography/canonicalRows";
import {
  assertDemographyParity,
  loadDemographyFacts,
  SERVED_DEMOGRAPHY_FILES,
} from "../../../lib/data/demography/importDemography";
import { populationEstimateBasis, SERIES } from "../../../lib/data/demography/series";
import type { DemographyObservation } from "../../../lib/data/demography/types";
import { SERVED_DATA_FILES } from "../../../lib/data/servedData";
import { loadSourceDocuments } from "../../../lib/data/sources";

let facts: DemographyObservation[];
const population = () => facts.filter((row) => row.seriesId === SERIES.populationTotal);
const valueOf = (geographyId: string, year: number, seriesId: string = SERIES.populationTotal) =>
  facts.find((row) => row.seriesId === seriesId && row.geographyId === geographyId && row.year === year)?.value;

beforeAll(async () => {
  facts = await loadDemographyFacts();
});

describe("demography loader", () => {
  test("serves the two files SERVED_DATA_FILES names", () => {
    expect([...SERVED_DEMOGRAPHY_FILES]).toEqual([
      SERVED_DATA_FILES.demographyPopulationFacts,
      SERVED_DATA_FILES.demographyDensityFacts,
    ]);
  });

  test("loads every canonical row of both files", () => {
    expect(population()).toHaveLength(923);
    expect(facts.filter((row) => row.seriesId === SERIES.populationDensity)).toHaveLength(145);
  });

  test("reads the anchor values from the CSVs", () => {
    expect(valueOf("country.georgia", 2024)).toBe("3694608");
    expect(valueOf("country.georgia", 2025)).toBe("3930428");
    expect(valueOf("country.georgia", 2026)).toBe("3941103");
    expect(valueOf("region.tbilisi", 2026)).toBe("1369356");
    expect(valueOf("11", 2024)).toBe("28250"); // Khulo before the re-base
    expect(valueOf("11", 2025)).toBe("16307");
    expect(valueOf("06", 2024)).toBe("183181"); // Batumi
    expect(valueOf("06", 2025)).toBe("236845");
    expect(valueOf("country.georgia", 2024, SERIES.populationDensity)).toBe("64.6");
    expect(valueOf("region.tbilisi", 2024, SERIES.populationDensity)).toBe("2495.9");
    expect(valueOf("region.racha_lechkhumi_kvemo_svaneti", 2024, SERIES.populationDensity)).toBe("5.7");
  });

  test("normalises decimal text so the mirror can match it", () => {
    expect(valueOf("country.georgia", 2014, SERIES.populationDensity)).toBe("65");
  });

  test("every row's basis is the lineage of its year", () => {
    expect(facts.every((row) => row.estimateBasis === populationEstimateBasis(row.year))).toBe(true);
  });

  test("the 11 regions and, separately, the 64 municipalities sum to Georgia in every year they cover", () => {
    const rows = population();
    const years = [...new Set(rows.map((row) => row.year))];
    for (const year of years) {
      const georgia = Number(valueOf("country.georgia", year));
      for (const part of [/^region\./, /^\d{2}$/]) {
        const members = rows.filter((row) => row.year === year && part.test(row.geographyId));
        if (members.length === 0) continue;
        expect(members.reduce((sum, row) => sum + Number(row.value), 0), `${year} ${part}`).toBe(georgia);
      }
    }
    expect(rows.filter((row) => /^\d{2}$/.test(row.geographyId) && row.year === 2026)).toHaveLength(64);
    expect(rows.filter((row) => /^region\./.test(row.geographyId) && row.year === 2026)).toHaveLength(11);
  });

  test("Tbilisi is the same number as a region and as municipality 04", () => {
    for (const year of [2015, 2024, 2025, 2026]) {
      expect(valueOf("04", year)).toBe(valueOf("region.tbilisi", year));
    }
  });

  test("registers every source id the rows cite", async () => {
    const sources = await loadSourceDocuments("../../data/sources/source-documents.csv");
    const registered = new Set(sources.map((source) => source.sourceId));
    expect([...new Set(facts.map((row) => row.sourceId))].sort()).toEqual([
      "source.geostat_demography_density",
      "source.geostat_municipal_population",
    ]);
    expect(facts.every((row) => registered.has(row.sourceId))).toBe(true);
  });

  test("an invalid canonical row names its file and line", () => {
    const header = "series_id,geography_id,year,value,unit,estimate_basis,status,source_id,source_locator,last_reviewed_at";
    const text = `${header}\nx,country.georgia,2004,1,persons,pre_census,draft,s,l,2026-10-01\n`;
    expect(() => parseCanonicalDemographyRows(text, "demo.csv")).toThrow(/demo\.csv row 2 is invalid/);
  });
});

describe("demography parity", () => {
  test("ignores row order but preserves exact decimal text", () => {
    expect(() => assertDemographyParity(facts, [...facts].reverse())).not.toThrow();
    const changed = structuredClone(facts);
    changed[0].value = `${changed[0].value}1`;
    expect(() => assertDemographyParity(facts, changed)).toThrow(/Demography parity failed/);
  });

  test.each([
    { unit: "thousands" },
    { sourceLocator: "wrong" },
    { sourceId: "source.unknown" },
    { lastReviewedAt: "2026-09-01" },
    { status: "draft" },
  ])("rejects a changed mirror field %j", (patch) => {
    const changed = structuredClone(facts);
    changed[0] = { ...changed[0], ...patch } as DemographyObservation;
    expect(() => assertDemographyParity(facts, changed)).toThrow();
  });

  test("rejects a basis that disagrees with the year, a missing row and a duplicate row", () => {
    const wrongBasis = structuredClone(facts);
    wrongBasis[0] = { ...wrongBasis[0], estimateBasis: "census_based" };
    expect(() => assertDemographyParity(facts, wrongBasis)).toThrow(/lineage/);
    expect(() => assertDemographyParity(facts, facts.slice(1))).toThrow(/Demography parity failed/);
    expect(() => assertDemographyParity(facts, [...facts, facts[0]])).toThrow();
  });
});
