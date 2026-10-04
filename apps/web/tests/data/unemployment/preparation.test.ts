import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterAll, expect, test } from "vitest";
import { prepareUnemploymentData } from "../../../lib/data/unemployment/prepareUnemployment";

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
  await expect(prepareUnemploymentData(root, "check")).resolves.toBeUndefined();
});

test("preparation refuses altered original captures before producing serving data", async () => {
  const directory = await mkdtemp(path.join(root, ".tmp/unemployment-capture-"));
  fixtures.push(directory);
  await cp(path.join(root, research), path.join(directory, research), { recursive: true });
  await writeFile(path.join(directory, research, "official/01-labour-force-indicators.xlsx"), "changed source");
  await expect(prepareUnemploymentData(directory, "write")).rejects.toThrow(/source.*mismatch/i);
});
