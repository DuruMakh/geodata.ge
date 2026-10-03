import { beforeAll, describe, expect, test } from "vitest";
import { buildBreakRegister, UNAFFECTED_BY_CENSUS } from "../../../lib/data/demography/breaks";
import { readStoredSheet } from "../../../lib/data/demography/readStoredSheet";
import { SERIES } from "../../../lib/data/demography/series";
import { loadDemographySources } from "../../../lib/data/demography/sourceFiles";
import type { DemographySources } from "../../../lib/data/demography/types";
import { repositoryRoot } from "./helpers";

let sources: DemographySources;
beforeAll(async () => {
  sources = await loadDemographySources(repositoryRoot);
});

const GEOSTAT_NOTE =
  "Based on the results of the 2024 population census, the population size and related data as of January 1, 2025 were recalculated.";

describe("break register", () => {
  test("holds one entry, the census recalculation of 1 January 2025", () => {
    const register = buildBreakRegister();

    expect(register).toHaveLength(1);
    expect(register[0]).toMatchObject({ breakId: "census_recalculation_2025", referenceDate: "2025-01-01" });
    expect(register[0]!.reason).toContain("225,922");
  });

  test("applies to population stock, structure, density and every rate with a population denominator", () => {
    expect(buildBreakRegister()[0]!.appliesTo).toEqual([
      SERIES.populationTotal,
      SERIES.populationByAgeSex,
      SERIES.populationAgeBand,
      SERIES.crudeBirthRate,
      SERIES.crudeDeathRate,
      SERIES.totalFertilityRate,
      SERIES.lifeExpectancyTotal,
      SERIES.lifeExpectancyMale,
      SERIES.lifeExpectancyFemale,
      SERIES.populationDensity,
    ]);
  });

  test("leaves out event counts, the infant mortality rate, migration and its citizenship groups", () => {
    expect(UNAFFECTED_BY_CENSUS).toEqual([
      SERIES.liveBirths,
      SERIES.deaths,
      SERIES.naturalIncrease,
      SERIES.infantMortalityRate,
      SERIES.immigrants,
      SERIES.emigrants,
      SERIES.netMigration,
      SERIES.immigrantsByCitizenshipGroup,
      SERIES.emigrantsByCitizenshipGroup,
    ]);
  });

  test("accounts for every served series exactly once, so a new series needs a decision", () => {
    const listed = [...buildBreakRegister()[0]!.appliesTo, ...UNAFFECTED_BY_CENSUS];

    expect(new Set(listed).size).toBe(listed.length);
    expect([...listed].sort()).toEqual(Object.values(SERIES).sort());
  });

  test("quotes Geostat's footnote exactly as the archived tables print it", () => {
    const note = buildBreakRegister()[0]!.sourceNote;
    const tables = [
      "source.geostat_municipal_population",
      "source.geostat_demography_population_age_sex",
      "source.geostat_demography_population_single_age",
      "source.geostat_demography_median_age",
      "source.geostat_demography_share_65_plus",
      "source.geostat_demography_age_dependency",
    ];

    expect(note).toContain(`"${GEOSTAT_NOTE}"`);
    for (const sourceId of tables) {
      const sheet = readStoredSheet(sources.get(sourceId).bytes, "1");
      const printed = Array.from({ length: sheet.lastRow }, (_, index) => sheet.label(sheet.ref("A", index + 1)));
      expect(printed, sourceId).toContain(`Note: ${GEOSTAT_NOTE}`);
    }
  });
});
