import fs from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { describe, expect, test } from "vitest";
import { writeDemographyArtifacts } from "../../../lib/data/demography/prepareDemography";
import { cleanUpTempRoots, copyPreparationInputs } from "./helpers";

const FILES = {
  population: "data/imports/demography-population-annual.csv",
  structure: "data/imports/demography-structure-annual.csv",
  vital: "data/imports/demography-vital-annual.csv",
  migration: "data/imports/demography-migration-annual.csv",
  breaks: "data/imports/demography-series-breaks.csv",
  report: "data/reports/demography-validation.json",
};
const SHARED = ["series_id", "geography_id", "year"];
const TAIL = ["value", "unit", "estimate_basis", "status", "source_id", "source_locator", "last_reviewed_at"];

const readAll = async (root: string) =>
  Object.fromEntries(await Promise.all(Object.values(FILES).map(async (file) => [file, await fs.readFile(path.join(root, file))] as const)));
const rowsOf = async (root: string, file: string) =>
  parse(await fs.readFile(path.join(root, file), "utf8"), { bom: true, columns: true }) as Array<Record<string, string>>;

describe("preparing the demography files", () => {
  cleanUpTempRoots();

  test("writes the five canonical files and the report, and a second write is byte-identical", async () => {
    const root = await copyPreparationInputs();
    const report = await writeDemographyArtifacts(true, root);
    const first = await readAll(root);
    await writeDemographyArtifacts(true, root);
    const second = await readAll(root);

    for (const file of Object.values(FILES)) expect(second[file]!.equals(first[file]!), file).toBe(true);
    expect(JSON.parse(first[FILES.report]!.toString("utf8"))).toEqual(report);
    expect(first[FILES.report]!.toString("utf8").endsWith("}\n")).toBe(true);
    await expect(writeDemographyArtifacts(false, root)).resolves.toEqual(report);
  });

  test("writes UTF-8 with a BOM, each family's columns and the reviewed row counts", async () => {
    const root = await copyPreparationInputs();
    await writeDemographyArtifacts(true, root);
    const header = async (file: string) => (await fs.readFile(path.join(root, file), "utf8")).split("\n")[0]!.replace(/^﻿/, "").split(",");

    expect(await header(FILES.population)).toEqual([...SHARED, ...TAIL]);
    expect(await header(FILES.structure)).toEqual([...SHARED, "sex", "age_group", ...TAIL]);
    expect(await header(FILES.vital)).toEqual([...SHARED, ...TAIL]);
    expect(await header(FILES.migration)).toEqual([...SHARED, "sex", "citizenship_id", ...TAIL]);
    expect(await header(FILES.breaks)).toEqual(["break_id", "applies_to", "reference_date", "reason", "source_note"]);
    for (const file of Object.values(FILES)) expect((await fs.readFile(path.join(root, file))).subarray(0, 3).toString("hex"), file).toBe(file.endsWith(".json") ? "7b0a20" : "efbbbf");
    expect((await rowsOf(root, FILES.population)).length).toBe(923);
    expect((await rowsOf(root, FILES.structure)).length).toBe(1587);
    expect((await rowsOf(root, FILES.vital)).length).toBe(2595);
    expect((await rowsOf(root, FILES.migration)).length).toBe(1274);
    const breaks = await rowsOf(root, FILES.breaks);
    expect(breaks).toHaveLength(1);
    expect(breaks[0]).toMatchObject({ break_id: "census_recalculation_2025", reference_date: "2025-01-01" });
    expect(breaks[0]!.applies_to.split(";")).toHaveLength(9);
  });

  test("writes no row outside the coverage rules", async () => {
    const root = await copyPreparationInputs();
    await writeDemographyArtifacts(true, root);
    const start = { population: 2004, structure: 2004, vital: 2014, migration: 2012 };

    for (const family of ["population", "structure", "vital", "migration"] as const) {
      for (const row of await rowsOf(root, FILES[family])) {
        const georgia = row.geography_id === "country.georgia";
        expect(Number(row.year), `${family} ${row.series_id} ${row.geography_id}`).toBeGreaterThanOrEqual(georgia ? start[family] : 2015);
        if (family === "structure" || family === "migration") expect(georgia).toBe(true);
      }
    }
    const births = (await rowsOf(root, FILES.vital)).filter((row) => row.series_id === "demography.live_births");
    expect(Math.min(...births.filter((row) => row.geography_id === "country.georgia").map((row) => Number(row.year)))).toBe(2014);
    expect(Math.min(...births.filter((row) => row.geography_id !== "country.georgia").map((row) => Number(row.year)))).toBe(2015);
  });

  test("the check fails when a committed file is stale or missing", async () => {
    const root = await copyPreparationInputs();
    await writeDemographyArtifacts(true, root);
    const target = path.join(root, FILES.structure);
    const committed = await fs.readFile(target);
    await fs.writeFile(target, Buffer.concat([committed, Buffer.from("\n")]));

    await expect(writeDemographyArtifacts(false, root)).rejects.toThrow(/stale: data\/imports\/demography-structure-annual\.csv/);
    await fs.rm(path.join(root, FILES.report));
    await fs.writeFile(target, committed);
    await expect(writeDemographyArtifacts(false, root)).rejects.toThrow(/missing: data\/reports\/demography-validation\.json/);
  });

  test("stops, writing nothing, when a served source is not registered", async () => {
    const root = await copyPreparationInputs();
    const registry = path.join(root, "data/sources/source-documents.csv");
    const rows = (await fs.readFile(registry, "utf8")).split("\n");
    await fs.writeFile(registry, rows.filter((row) => !row.startsWith("source.geostat_demography_births,")).join("\n"));

    await expect(writeDemographyArtifacts(true, root)).rejects.toMatchObject({
      condition: "unregistered_source",
      message: expect.stringContaining("source.geostat_demography_births"),
    });
    await expect(fs.access(path.join(root, FILES.population))).rejects.toThrow();
  });

  test("a write never overwrites a changed historical value", async () => {
    const root = await copyPreparationInputs();
    await writeDemographyArtifacts(true, root);
    const target = path.join(root, FILES.vital);
    const text = await fs.readFile(target, "utf8");
    const changed = text.replace(/^(demography\.live_births,country\.georgia,2020,)\d+/m, (_match, prefix: string) => `${prefix}1`);
    expect(changed).not.toBe(text);
    await fs.writeFile(target, changed);

    await expect(writeDemographyArtifacts(true, root)).rejects.toMatchObject({ condition: "revision" });
    expect(await fs.readFile(target, "utf8")).toBe(changed);
  });
});
