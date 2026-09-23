import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, expect, test } from "vitest";
import { assertEconomicSectorParity, loadEconomicSectorFacts } from "../../../lib/data/economicSectors/importEconomicSectors";
import type { SectorObservation } from "../../../lib/data/economicSectors/types";

const temporaryDirectories: string[] = [];

async function writeCanonicalMutation(transform: (lines: string[]) => string[]): Promise<string> {
  const sourcePath = path.resolve(process.cwd(), "../../data/imports/economic-sectors-annual.csv");
  const directory = await mkdtemp(path.join(tmpdir(), "economic-sectors-import-"));
  temporaryDirectories.push(directory);
  const fixturePath = path.join(directory, "facts.csv");
  const lines = (await readFile(sourcePath, "utf8")).split("\n");
  await writeFile(fixturePath, transform(lines).join("\n"), "utf8");
  return fixturePath;
}

afterAll(async () => {
  await Promise.all(temporaryDirectories.map((directory) => rm(directory, { recursive: true, force: true })));
});

const reference: SectorObservation = {
  seriesId: "economy.gdp_total", year: 2025, measure: "real_growth", value: "7.46161492416432",
  unit: "percent", valuation: "market_prices", priceBasis: "volume_change",
  calculation: "index_to_growth", status: "preliminary", sourceId: "source.geostat_sector_growth",
  sourceLocator: "Real GDP Growth!BY26", lastReviewedAt: "2026-09-11",
};
const facts: SectorObservation[] = [reference, { ...reference, seriesId: "sector.a", valuation: "basic_prices", value: "-5.67461791842112", sourceLocator: "Real GDP Growth!BY3" }];

test("sector mirror parity ignores order and preserves exact decimals", () => {
  expect(() => assertEconomicSectorParity(facts, [...facts].reverse())).not.toThrow();
});
test.each([
  { value: "7.46161492416433" }, { status: "published" }, { unit: "gel" },
  { sourceLocator: "wrong" }, { sourceId: "another-source" }, { lastReviewedAt: "2026-09-12" },
  { calculation: "published" }, { valuation: "basic_prices" }, { priceBasis: "current_prices" },
])("rejects a changed mirror field: %j", (change) => {
  expect(() => assertEconomicSectorParity(facts, [{ ...reference, ...change } as SectorObservation, facts[1]])).toThrow();
});
test("rejects missing and duplicate mirror keys", () => {
  expect(() => assertEconomicSectorParity(facts, [reference])).toThrow();
  expect(() => assertEconomicSectorParity(facts, [...facts, reference])).toThrow();
});

test("loader rejects a sector whose newest-year observations are missing", async () => {
  const fixturePath = await writeCanonicalMutation((lines) =>
    lines.filter((line) => !line.startsWith("sector.a,2025,")),
  );

  await expect(loadEconomicSectorFacts(fixturePath)).rejects.toThrow(/complete sector coverage/i);
});

test("loader rejects an older preliminary year", async () => {
  const fixturePath = await writeCanonicalMutation((lines) =>
    lines.map((line) => {
      if (!line.startsWith("sector.a,2020,")) return line;
      const fields = line.split(",");
      fields[8] = "preliminary";
      return fields.join(",");
    }),
  );

  await expect(loadEconomicSectorFacts(fixturePath)).rejects.toThrow(/preliminary sector years/i);
});
