import { beforeAll, expect, test } from "vitest";
import { loadEnvironmentFacts, toClientEnvironmentFact } from "../../lib/data/environment/importEnvironment";
import type { ClientEnvironmentFact } from "../../lib/data/environment/types";
import { INK } from "../../lib/explorer/colors";
import {
  ENVIRONMENT_AREAS, buildEnvironmentAreaModel, environmentAreaDefaultSelection, environmentAreaRoutes, environmentAreaSelectionHash, environmentAreaSeries,
  parseEnvironmentAreaHash,
} from "../../lib/explorer/environmentAreas";
import { buildEnvironmentRegionMapModel } from "../../lib/explorer/environmentRegionMap";

let facts: ClientEnvironmentFact[];
beforeAll(async () => { facts = (await loadEnvironmentFacts()).map(toClientEnvironmentFact); });

test("area pages sit under each map page, on the shared slugs", () => {
  const forests = environmentAreaRoutes("forests");
  expect(ENVIRONMENT_AREAS).toHaveLength(12);
  expect(forests.areaHref("georgia")).toBe("/explorer/environment/forests/georgia");
  expect(environmentAreaRoutes("waste").areaHref("region_kvemo_kartli")).toBe("/explorer/environment/waste/kvemo_kartli");
  expect(forests.regionHref("region.tbilisi")).toBe("/explorer/environment/forests/tbilisi");
});

test("the Forests map ranks ten regions and draws Tbilisi without a value", () => {
  const map = buildEnvironmentRegionMapModel("forests", facts);
  expect(map.year).toBe(2024);
  expect(map.regions).toHaveLength(10);
  expect(map.regions.map(r => r.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  expect(map.withoutValue?.map(r => r.regionId)).toEqual(["region.tbilisi"]);
  expect(map.withoutValue![0].pathD).toMatch(/^M/);
  // The ten regions and the protected areas add up to Georgia, within Geostat's 2 m³ rounding.
  const value = (id: string) => facts.find(f => f.indicatorId === id && f.year === 2024)!.value;
  const sum = map.regions.reduce((total, region) => total + region.value, value("environment.forest.timber_cut.protected_areas"));
  expect(Math.abs(sum - value("environment.forest.timber_cut.georgia"))).toBeLessThanOrEqual(2);
});

test("the Waste map's year is 2024, Tbilisi collects most, and every region has a value", () => {
  const map = buildEnvironmentRegionMapModel("waste", facts);
  expect(map.year).toBe(2024);
  expect(map.regions).toHaveLength(11);
  expect(map.regions[0].regionId).toBe("region.tbilisi");
  expect(map.withoutValue).toBeUndefined();
});

test("Georgia's Forests page lists six rows under four headings, Tbilisi's illegal logging only", () => {
  const georgia = environmentAreaSeries("forests", "georgia", facts);
  expect(georgia).toHaveLength(6);
  expect([...new Set(georgia.map(s => s.heading))]).toEqual(["timber", "protected", "fires", "burntArea"]);
  expect(environmentAreaSeries("forests", "region_tbilisi", facts).map(s => s.id)).toEqual(["environment.forest.illegal_logging.region_tbilisi"]);
  expect(environmentAreaDefaultSelection("forests", "region_tbilisi", facts)).toEqual(["environment.forest.illegal_logging.region_tbilisi"]);
  expect(environmentAreaSeries("forests", "region_kakheti", facts).map(s => s.id)).toEqual(["environment.forest.timber_cut.region_kakheti", "environment.forest.illegal_logging.region_kakheti"]);
  expect(environmentAreaSeries("waste", "georgia", facts).map(s => s.id)).toEqual(["environment.waste.collected.georgia", "environment.waste.per_person"]);
  expect(environmentAreaSeries("waste", "region_imereti", facts).map(s => s.id)).toEqual(["environment.waste.collected.region_imereti"]);
});

test("a selection moves to another area, dropping Georgia-only rows", () => {
  expect(environmentAreaSelectionHash("waste", ["environment.waste.collected.georgia"], "region_imereti")).toBe("");
  expect(environmentAreaSelectionHash("waste", ["environment.waste.per_person"], "region_imereti")).toBe("");
  expect(environmentAreaSelectionHash("forests", ["environment.forest.illegal_logging.georgia", "environment.forest.fires"], "region_guria"))
    .toBe(`#${new URLSearchParams({ sel: "environment.forest.illegal_logging.region_guria" })}`);
  expect(environmentAreaSelectionHash("forests", ["environment.forest.timber_cut.region_guria"], "georgia")).toBe("");
  // Tbilisi has no timber cut, so a carried timber selection falls back to its default there.
  const hash = environmentAreaSelectionHash("forests", ["environment.forest.timber_cut.region_guria", "environment.forest.illegal_logging.region_guria"], "region_tbilisi");
  expect(parseEnvironmentAreaHash(hash, "forests", "region_tbilisi", facts).selectedIds).toEqual(["environment.forest.illegal_logging.region_tbilisi"]);
});

test("an area model draws its total in ink and keeps the published values", () => {
  const model = buildEnvironmentAreaModel("waste", "georgia", facts, parseEnvironmentAreaHash("", "waste", "georgia", facts));
  expect(model.selected[0]).toMatchObject({ id: "environment.waste.collected.georgia", color: INK });
  expect(model.selected[0].valuesByYear[2024]).toBe(1184);
  expect(model.unit).toBe("thousand_tonnes");
});
