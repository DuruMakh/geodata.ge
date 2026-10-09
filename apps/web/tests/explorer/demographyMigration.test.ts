import { beforeAll, describe, expect, it } from "vitest";
import { loadServedDemographyData } from "../../lib/data/demography/importDemography";
import { projectMigrationObservation } from "../../lib/explorer/clientData";
import {
  buildMigrationIndicators,
  buildMigrationModel,
  DEFAULT_MIGRATION_STATE,
  MIGRATION_GROUPS,
  MIGRATION_SERIES,
  migrationCoverage,
  migrationSearchLabels,
  parseMigrationHash,
  serializeMigrationHash,
  type MigrationState,
} from "../../lib/explorer/demographyMigration";
import { getMessages } from "../../lib/i18n/messages.server";
import type { ClientMigrationFact } from "../../lib/servedRows";

let facts: ClientMigrationFact[];
beforeAll(async () => {
  const { facts: served } = await loadServedDemographyData();
  facts = served.filter((fact) => MIGRATION_SERIES.includes(fact.seriesId)).map(projectMigrationObservation);
});

const state = (patch: Partial<MigrationState> = {}): MigrationState => ({ ...DEFAULT_MIGRATION_STATE, ...patch });

describe("migration rows", () => {
  it("serves only the two group series and the net, 2012–2025", () => {
    expect(facts).toHaveLength(518);
    expect(migrationCoverage(facts)).toEqual({ min: 2012, max: 2025, years: Array.from({ length: 14 }, (_, i) => 2012 + i) });
    expect(Object.keys(facts[0]!).sort()).toEqual(["citizenshipId", "seriesId", "sex", "value", "year"]);
  });
});

describe("buildMigrationModel", () => {
  it("holds the published anchors with all six groups", () => {
    const model = buildMigrationModel(facts, state());
    expect(model.allSelected).toBe(true);
    expect([model.totals.arrivals[2012], model.totals.departures[2012], model.totals.net[2012]]).toEqual([69_063, 90_584, -21_521]);
    expect([model.totals.arrivals[2022], model.totals.departures[2022], model.totals.net[2022]]).toEqual([179_778, 125_269, 54_509]);
    expect([model.totals.arrivals[2023], model.totals.departures[2023], model.totals.net[2023]]).toEqual([205_857, 245_064, -39_207]);
    expect([model.totals.arrivals[2025], model.totals.departures[2025], model.totals.net[2025]]).toEqual([131_501, 114_374, 17_127]);
    expect(model.byDirection.arrivals["citizenship.russian_federation"][2022]).toBe(62_304);
    expect(model.byDirection.arrivals["citizenship.ukraine"][2022]).toBe(20_716);
  });

  it("equals Geostat's published net in every year when all groups are selected", () => {
    const model = buildMigrationModel(facts, state());
    for (const year of model.years) expect(model.totals.net[year], String(year)).toBe(model.publishedNet[year]);
  });

  it("adds men and women to both sexes for every group, year and direction", () => {
    const [total, male, female] = (["total", "male", "female"] as const).map((sex) => buildMigrationModel(facts, state({ sex })));
    for (const direction of ["arrivals", "departures"] as const) {
      for (const group of MIGRATION_GROUPS) {
        for (const year of total!.years) {
          expect(male!.byDirection[direction][group][year]! + female!.byDirection[direction][group][year]!, `${direction} ${group} ${year}`).toBe(
            total!.byDirection[direction][group][year],
          );
        }
      }
    }
    expect([male!.totals.net[2025], female!.totals.net[2025]]).toEqual([9_611, 7_516]);
  });

  it("nets the selected groups only, and empty selection gives no totals", () => {
    const withoutRussia = buildMigrationModel(facts, state({ selectedIds: MIGRATION_GROUPS.filter((id) => id !== "citizenship.russian_federation") }));
    expect(withoutRussia.allSelected).toBe(false);
    expect(withoutRussia.totals.net[2023]).toBe(-56_490);
    const none = buildMigrationModel(facts, state({ selectedIds: [] }));
    expect(none.totals.arrivals[2023]).toBeNull();
  });

  it("limits years to the range", () => {
    const model = buildMigrationModel(facts, state({ range: { kind: "manual", start: 2021, end: 2025 } }));
    expect(model.years).toEqual([2021, 2022, 2023, 2024, 2025]);
    expect(model.range).toMatchObject({ start: 2021, end: 2025, min: 2012, max: 2025 });
  });
});

describe("buildMigrationIndicators", () => {
  it("describes the range's end year for the chosen sex and all groups, whatever is selected", () => {
    const all = buildMigrationIndicators(facts, state({ selectedIds: ["citizenship.turkey"] }));
    expect(all).toMatchObject({ year: 2025, net: 17_127, cumulativeNet: -26_795, arrivals: 131_501, departures: 114_374 });
    expect(all.foreignShare).toBeCloseTo(0.52797, 4);
    expect(all.sparks.arrivals).toHaveLength(14);
    const range = buildMigrationIndicators(facts, state({ range: { kind: "manual", start: 2021, end: 2023 } }));
    expect(range).toMatchObject({ year: 2023, net: -39_207 });
    expect(range.foreignShare).toBeCloseTo(0.55359, 4);
    expect(buildMigrationIndicators(facts, state({ sex: "female" })).net).toBe(7_516);
  });
});

describe("migration hash", () => {
  it("round-trips and keeps the default address short", () => {
    expect(serializeMigrationHash(DEFAULT_MIGRATION_STATE)).toBe("view=line&range=all");
    const changed = state({ mode: "table", sex: "male", direction: "net", selectedIds: ["citizenship.georgia", "citizenship.ukraine"], range: { kind: "manual", start: 2015, end: 2020 } });
    expect(parseMigrationHash(`#${serializeMigrationHash(changed)}`, facts)).toEqual(changed);
  });

  it("rejects unknown values, removes duplicates, keeps an explicit empty selection and clamps the range", () => {
    expect(parseMigrationHash("#sex=child&dir=sideways&view=pie", facts)).toEqual(DEFAULT_MIGRATION_STATE);
    expect(parseMigrationHash("#sel=citizenship.ukraine,citizenship.ukraine,citizenship.mars", facts).selectedIds).toEqual(["citizenship.ukraine"]);
    expect(parseMigrationHash("#sel=", facts).selectedIds).toEqual([]);
    expect(parseMigrationHash("#start=1990&end=2018", facts).range).toEqual({ kind: "manual", start: 2012, end: 2018 });
  });

  it("lists each group's Georgian and English names for search", async () => {
    const labels = migrationSearchLabels(await getMessages("ka", ["demography"]), await getMessages("en", ["demography"]));
    expect(labels["citizenship.russian_federation"]).toEqual(["რუსეთი", "Russia"]);
    expect(labels["citizenship.all_other_computed"][1]).toBe("All other citizenships (computed)");
  });
});
