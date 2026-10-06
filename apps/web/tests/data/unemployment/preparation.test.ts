import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, expect, test } from "vitest";
import { prepareUnemploymentData } from "../../../lib/data/unemployment/prepareUnemployment";
import { parse } from "csv-parse/sync";

const root = path.resolve(process.cwd(), "../..");
const research = "docs/Raw Data/Unemployment/geostat-labour-force-annual";
const fixtures: string[] = [];
afterAll(async () => { await Promise.all(fixtures.map(dir => rm(dir, { recursive: true, force: true }))); });

test("canonical files preserve every reviewed numeric token and source column byte for byte", async () => {
  for (const [original, canonical] of [
    ["unemployment-annual.csv", "unemployment-annual.csv"],
    ["education-annual.csv", "unemployment-education-annual.csv"],
    ["long-term-unemployment-annual.csv", "unemployment-long-term-annual.csv"],
  ]) {
    expect(await readFile(path.join(root, "data/imports", canonical)))
      .toEqual(await readFile(path.join(root, research, original)));
  }
  const content = await readFile(path.join(root, "data/imports/unemployment-employment-status-annual.csv"));
  expect(content.subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
  const rows = parse(content, { columns: true, bom: true });
  const original = parse(await readFile(path.join(root, research, "source-observations.csv")), { columns: true, bom: true }) as Record<string, string>[];
  expect(rows).toEqual(original.filter(row => (["national", "settlement"].includes(row.dimension) || row.dimension === "region" && row.role === "primary") && row.methodology_epoch === "ilo19_20" && ["hired", "self_employed"].includes(row.indicator_id)));
  expect(rows).toHaveLength(228);
  await expect(prepareUnemploymentData(root, "check")).resolves.toBeUndefined();
});

test("employment-status extraction refuses a source value that differs from its archived workbook cell", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "unemployment-status-"));
  fixtures.push(directory);
  await cp(path.join(root, research), path.join(directory, research), { recursive: true });
  const file = path.join(directory, research, "source-observations.csv");
  const content = await readFile(file, "utf8");
  await writeFile(file, content.replace(/(2010,annual,national,georgia,Georgia,hired,thousand_persons,)[^,]+/, "$11"));
  await expect(prepareUnemploymentData(directory, "write")).rejects.toThrow(/source cell mismatch/i);
});

test("regional employment-status extraction checks the original workbook cell before publishing", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "unemployment-region-status-"));
  fixtures.push(directory);
  await cp(path.join(root, research), path.join(directory, research), { recursive: true });
  const file = path.join(directory, research, "source-observations.csv");
  const content = await readFile(file, "utf8");
  await writeFile(file, content.replace("361.23065568749558,361.2", "361.33065568749558,361.3"));
  await expect(prepareUnemploymentData(directory, "write")).rejects.toThrow(/source cell mismatch/i);
});

test("preparation refuses altered original captures before producing serving data", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "unemployment-capture-"));
  fixtures.push(directory);
  await cp(path.join(root, research), path.join(directory, research), { recursive: true });
  await writeFile(path.join(directory, research, "official/01-labour-force-indicators.xlsx"), "changed source");
  await expect(prepareUnemploymentData(directory, "write")).rejects.toThrow(/source.*mismatch/i);
});
