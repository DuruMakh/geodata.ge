import { readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { beforeAll, describe, expect, test } from "vitest";
import { loadReviewedAnomalies } from "../../../lib/data/demography/anomalies";
import {
  loadDemographyGeography,
  readUnitRows,
  type DemographyGeography,
} from "../../../lib/data/demography/geography";
import { readStoredSheet } from "../../../lib/data/demography/readStoredSheet";
import { loadDemographySources } from "../../../lib/data/demography/sourceFiles";
import type { DemographySources } from "../../../lib/data/demography/types";
import { repositoryRoot } from "./helpers";

let geography: DemographyGeography;
let sources: DemographySources;
beforeAll(async () => {
  [geography, sources] = await Promise.all([loadDemographyGeography(repositoryRoot), loadDemographySources(repositoryRoot)]);
});

const unitSheet = (sourceId: string) => readStoredSheet(sources.get(sourceId).bytes, "1");
const csv = async (relative: string) =>
  parse(await readFile(path.join(repositoryRoot, relative), "utf8"), { bom: true, columns: true, skip_empty_lines: true }) as Record<string, string>[];

describe("demography geography", () => {
  test("holds exactly the existing 64 municipalities and 11 regions", async () => {
    const municipalities = await csv("data/imports/municipalities.csv");
    const regions = JSON.parse(await readFile(path.join(repositoryRoot, "data/taxonomy/municipal-regions.json"), "utf8")) as Array<{ id: string }>;

    expect(geography.municipalities.map((row) => row.code)).toEqual(municipalities.map((row) => row.municipality_code));
    expect(geography.regions.map((region) => region.id)).toEqual(regions.map((region) => region.id));
    expect(geography.municipalities).toHaveLength(64);
    expect(geography.regions).toHaveLength(11);
    for (const code of ["05", "42", "43", "46", "64"]) {
      expect(geography.municipalities.map((row) => row.code)).not.toContain(code);
    }
  });

  test("resolves every unit label of the population table", () => {
    const sheet = unitSheet("source.geostat_municipal_population");
    const kinds: Record<string, number> = {};
    for (const { label } of readUnitRows(sheet)) {
      const kind = geography.resolve(label, "population").kind;
      kinds[kind] = (kinds[kind] ?? 0) + 1;
    }

    expect(kinds).toEqual({ country: 1, region: 10, municipality: 64, city_component: 7, excluded: 6 });
  });

  test.each([
    ["source.geostat_demography_births"],
    ["source.geostat_demography_deaths"],
    ["source.geostat_demography_natural_increase"],
  ])("resolves every unit label of the event table %s", (sourceId) => {
    const kinds: Record<string, number> = {};
    for (const { label } of readUnitRows(unitSheet(sourceId))) {
      const kind = geography.resolve(label, "events").kind;
      kinds[kind] = (kinds[kind] ?? 0) + 1;
    }

    expect(kinds).toEqual({ country: 1, region: 10, municipality: 64, city_component: 7, excluded: 6 });
  });

  test("resolves every unit label of the 2024 census age table, which spells Adjara its own way", () => {
    const sheet = unitSheet("source.geostat_census2024_population_by_age_settlement");
    const ages = new Set(["0-4", "5-9", "10-14", "15-19", "20-24", "25-29", "30-34", "35-39", "40-44", "45-49", "50-54", "55-59", "60-64", "65-69", "70-74", "75-79", "80-84", "85+"]);
    const kinds: Record<string, number> = {};
    for (let row = 7; row <= sheet.lastRow; row += 1) {
      const label = sheet.label(sheet.ref("A", row));
      if (label === null) break;
      if (ages.has(label)) continue;
      const kind = geography.resolve(label, "census").kind;
      kinds[kind] = (kinds[kind] ?? 0) + 1;
    }

    expect(kinds).toEqual({ country: 1, region: 10, municipality: 64 });
    expect(geography.resolve("Adjara of Autonomous Republic", "census")).toEqual({ kind: "region", geographyId: "region.adjara" });
    expect(() => geography.resolve("Adjara of Autonomous Republic", "population")).toThrow(/Unreviewed geography label/);
    expect(() => geography.resolve("Adjara of Autonomous Republic", "events")).toThrow(/Unreviewed geography label/);
  });

  test("uses the existing identifiers: the country, region ids and two-digit municipality codes", () => {
    expect(geography.resolve("Georgia", "population")).toEqual({ kind: "country", geographyId: "country.georgia" });
    expect(geography.resolve("C. Tbilisi Municipality", "population")).toEqual({
      kind: "municipality",
      geographyId: "04",
      regionId: "region.tbilisi",
    });
    expect(geography.resolve("Kakheti ", "population")).toEqual({ kind: "region", geographyId: "region.kakheti" });
  });

  test("bridges a spelling variant only in the tables where it was reviewed", () => {
    expect(geography.resolve("Dedoplistskaro Municipality", "events")).toMatchObject({ kind: "municipality" });
    expect(geography.resolve("Sighnaghi Municipality", "census")).toMatchObject({ kind: "municipality" });
    expect(geography.resolve("C. Tbilisi", "census")).toMatchObject({ kind: "municipality", geographyId: "04" });

    expect(() => geography.resolve("Dedoplistskaro Municipality", "population")).toThrow(/Unreviewed geography label/);
    expect(() => geography.resolve("C. Tbilisi", "events")).toThrow(/Unreviewed geography label/);
  });

  test("refuses an invented label", () => {
    expect(() => geography.resolve("Atlantis Municipality", "events")).toThrow(/Unreviewed geography label in events: Atlantis Municipality/);
  });

  test("adds a starred city only for the years its row is published", () => {
    expect(geography.resolve("C. Telavi*", "population")).toEqual({
      kind: "city_component",
      geographyId: "15",
      startYear: 2015,
      endYear: 2017,
    });
    expect(geography.resolve("C. Telavi*", "events")).toEqual({
      kind: "city_component",
      geographyId: "15",
      startYear: 2014,
      endYear: 2016,
    });
    expect(geography.resolve("C. Gori*", "events")).toMatchObject({ geographyId: "41" });
  });

  test("marks the six units outside the 64 as excluded", () => {
    for (const label of [
      "Abkhazia A.R.",
      "Ajara Municipality",
      "Akhalgori Municipality",
      "Eredvi Municipality**",
      "Tighva Municipality**",
      "Kurta Municipality**",
    ]) {
      expect(geography.resolve(label, "events")).toEqual({ kind: "excluded", geographyId: null });
    }
  });

  test("reads the unit rows of an event table and refuses a moved header", () => {
    const rows = readUnitRows(unitSheet("source.geostat_demography_births"));

    expect(rows).toHaveLength(88);
    expect(rows[0]).toEqual({ row: 5, label: "Georgia" });
    expect(rows.at(-1)).toEqual({ row: 92, label: "Khashuri Municipality" });
    expect(() => readUnitRows(unitSheet("source.geostat_demography_life_expectancy"))).toThrow(/header/i);
  });
});

describe("reviewed source anomalies", () => {
  test("accepts only the reviewed stray zero in the natural increase table", async () => {
    const anomalies = await loadReviewedAnomalies(repositoryRoot);

    expect(anomalies.accepts("source.geostat_demography_natural_increase", "AB85", 0)).toBe(true);
    expect(anomalies.accepts("source.geostat_demography_natural_increase", "AB85", 5)).toBe(false);
    expect(anomalies.accepts("source.geostat_demography_natural_increase", "AB86", 0)).toBe(false);
    expect(anomalies.accepts("source.geostat_demography_births", "AB85", 0)).toBe(false);
  });
});
