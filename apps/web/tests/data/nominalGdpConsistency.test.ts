import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { checkNominalGdpConsistency } from "../../lib/data/nominalGdpConsistency";

const roots: string[] = [];

afterAll(async () => {
  for (const root of roots) await rm(root, { recursive: true, force: true });
});

type Overrides = {
  sectorGdp?: string;
  nationalMillions?: string;
  nationalSha?: string;
};

async function fixtureRoot(overrides: Overrides = {}): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "nominal-gdp-"));
  roots.push(root);
  const write = async (relative: string, body: string) => {
    await mkdir(path.join(root, path.dirname(relative)), { recursive: true });
    await writeFile(path.join(root, relative), body, "utf8");
  };

  await write(
    "data/imports/gdp-overview-annual.csv",
    "series_id,year,value\nnominal_gel,2024,93022275315.70538\nnominal_gel,2025,104598139883.332\n",
  );
  await write(
    "data/imports/economic-sectors-annual.csv",
    "series_id,year,measure,value\n" +
      "economy.gdp_total,2024,nominal,93022275315.70538\n" +
      `economy.gdp_total,2025,nominal,${overrides.sectorGdp ?? "104598139883.332"}\n` +
      "sector.a,2025,nominal,7000000000\n",
  );
  await write(
    "data/imports/national-gdp-annual-1996-2025.csv",
    "year,gdp_current_prices_million_gel\n2024,93022.3\n" +
      `2025,${overrides.nationalMillions ?? "104598.1"}\n`,
  );
  await write(
    "docs/Raw Data/Economy/gdp-overview/source-manifest.json",
    JSON.stringify({
      files: [{ file: "sources/geostat_nominal_current.xlsx", sha256: "21a576c9", bytes: 50098 }],
    }),
  );
  await write(
    "docs/Raw Data/GDP/national-nominal-gdp/source-manifest.csv",
    "source_id,local_file,sha256,bytes\n" +
      `source.geostat_national_gdp_sna_2008,official/03_GDP-at-Current-Prices.xlsx,${overrides.nationalSha ?? "21A576C9"},50098\n`,
  );
  return root;
}

describe("nominal GDP consistency", () => {
  it("accepts artifacts that agree", async () => {
    const report = await checkNominalGdpConsistency(await fixtureRoot());
    expect(report.years).toEqual([2024, 2025]);
    expect(report.comparisons).toBeGreaterThan(0);
  });

  it("accepts source precision noise below the fifth decimal place of one GEL", async () => {
    const report = await checkNominalGdpConsistency(
      await fixtureRoot({ sectorGdp: "104598139883.332001" }),
    );
    expect(report.years).toEqual([2024, 2025]);
  });

  it("rejects a sector GDP total that differs by one unit", async () => {
    const root = await fixtureRoot({ sectorGdp: "104598139883.333" });
    await expect(checkNominalGdpConsistency(root)).rejects.toThrow(/economy\.gdp_total 2025/);
  });

  it("rejects a budget denominator that differs by 0.1 mln GEL", async () => {
    const root = await fixtureRoot({ nationalMillions: "104598.2" });
    await expect(checkNominalGdpConsistency(root)).rejects.toThrow(/national GDP 2025/);
  });

  it("rejects two archived copies of the workbook with different hashes", async () => {
    const root = await fixtureRoot({ nationalSha: "DEADBEEF" });
    await expect(checkNominalGdpConsistency(root)).rejects.toThrow(/archived copies/);
  });
});
