import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";

import { loadGeneralGovernmentBalanceFacts } from "../../../lib/data/generalGovernmentBalance/importGeneralGovernmentBalance";
import { loadServedGeneralGovernmentBalanceData } from "../../../lib/data/generalGovernmentBalance/importGeneralGovernmentBalance";

const temporaryDirectories: string[] = [];

async function writeCanonicalMutation(
  transform: (content: string) => string,
): Promise<string> {
  const sourcePath = path.resolve(
    process.cwd(),
    "../../data/imports/general-government-balance-annual-1995-2031.csv",
  );
  const directory = await mkdtemp(path.join(tmpdir(), "general-government-balance-"));
  temporaryDirectories.push(directory);
  const fixturePath = path.join(directory, "facts.csv");
  await writeFile(fixturePath, transform(await readFile(sourcePath, "utf8")), "utf8");
  return fixturePath;
}

afterAll(async () => {
  await Promise.all(
    temporaryDirectories.map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("loadGeneralGovernmentBalanceFacts", () => {
  it("accepts a later WEO edition and rejects a mixed or mis-ordered file", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "weo-"));
    temporaryDirectories.push(root);
    const header =
      "year,general_government_balance_pct_gdp,general_government_balance_gel,status,source_id,source_dataset,source_vintage,source_sheet,source_country_id,source_percent_series_code,source_nominal_series_code,source_unit,transformation,last_reviewed_at\n";
    const row = (
      year: number,
      status: string,
      vintage = "2026-10",
      sourceId = "source.imf_weo_october_2026_general_government_balance",
      sourceDataset = "IMF.RES:WEO(9.0.0)",
    ) =>
      `${year},-2.5,-1000000000,${status},${sourceId},${sourceDataset},${vintage},Countries,GEO,GEO.GGXCNL_NGDP.A,GEO.GGXCNL.A,billion GEL,"IMF billion GEL multiplied by 1,000,000,000; signed value preserved.",2026-11-02\n`;

    const write = async (name: string, body: string) => {
      await writeFile(path.join(root, name), header + body, "utf8");
      return path.relative(process.cwd(), path.join(root, name));
    };

    const good = await write(
      "good.csv",
      [2024, 2025, 2026, 2027]
        .map((year) => row(year, year <= 2026 ? "actual" : "projection"))
        .join(""),
    );
    await expect(loadGeneralGovernmentBalanceFacts(good)).resolves.toHaveLength(4);

    const mixed = await write(
      "mixed.csv",
      row(2024, "actual") +
        row(
          2025,
          "actual",
          "2026-04",
          "source.imf_weo_april_2026_general_government_balance",
        ) +
        row(2026, "projection"),
    );
    await expect(loadGeneralGovernmentBalanceFacts(mixed)).rejects.toThrow(/one WEO edition/i);

    const mixedDataset = await write(
      "mixed-dataset.csv",
      row(2024, "actual") +
        row(2025, "actual", "2026-10", "source.imf_weo_october_2026_general_government_balance", "IMF.RES:WEO(8.0.0)") +
        row(2026, "projection"),
    );
    await expect(loadGeneralGovernmentBalanceFacts(mixedDataset)).rejects.toThrow(/one WEO edition/i);

    const mismatchedIdAndVintage = await write(
      "mismatched-id-vintage.csv",
      [2024, 2025, 2026]
        .map((year) => row(year, year <= 2025 ? "actual" : "projection", "2026-10", "source.imf_weo_april_2026_general_government_balance"))
        .join(""),
    );
    await expect(loadGeneralGovernmentBalanceFacts(mismatchedIdAndVintage)).rejects.toThrow(/source ID.*vintage/i);

    const misordered = await write(
      "misordered.csv",
      row(2024, "projection") + row(2025, "actual") + row(2026, "projection"),
    );
    await expect(loadGeneralGovernmentBalanceFacts(misordered)).rejects.toThrow(
      /actual years must come first/i,
    );
  });

  it("loads exactly one fact for every 1995-2031 year", async () => {
    const rows = await loadGeneralGovernmentBalanceFacts(
      "../../data/imports/general-government-balance-annual-1995-2031.csv",
    );
    expect(rows).toHaveLength(37);
    expect(rows[0]?.year).toBe(1995);
    expect(rows.at(-1)?.year).toBe(2031);
    expect(rows.filter((row) => row.status === "actual")).toHaveLength(31);
    expect(rows.filter((row) => row.status === "projection")).toHaveLength(6);
  });

  it("rejects duplicate years", async () => {
    await expect(
      loadGeneralGovernmentBalanceFacts(
        "tests/fixtures/general-government-balance/duplicate-year.csv",
      ),
    ).rejects.toThrow("Duplicate general-government balance year");
  });

  it("rejects percentage and nominal values with different signs", async () => {
    await expect(
      loadGeneralGovernmentBalanceFacts(
        "tests/fixtures/general-government-balance/sign-mismatch.csv",
      ),
    ).rejects.toThrow("sign mismatch");
  });

  it("rejects a different source ID across an otherwise complete canonical file", async () => {
    const fixturePath = await writeCanonicalMutation((content) =>
      content.replaceAll(
        "source.imf_weo_april_2026_general_government_balance",
        "source.other_reviewed_dataset",
      ),
    );

    await expect(loadGeneralGovernmentBalanceFacts(fixturePath)).rejects.toThrow();
  });

  it("rejects changed transformation text across an otherwise complete canonical file", async () => {
    const fixturePath = await writeCanonicalMutation((content) =>
      content.replaceAll(
        "IMF billion GEL multiplied by 1,000,000,000; signed value preserved.",
        "Changed transformation.",
      ),
    );

    await expect(loadGeneralGovernmentBalanceFacts(fixturePath)).rejects.toThrow();
  });

  it("rejects an unexpected canonical CSV column", async () => {
    const fixturePath = await writeCanonicalMutation((content) =>
      content
        .split("\n")
        .map((line) => (line ? `${line},unexpected` : line))
        .join("\n"),
    );

    await expect(loadGeneralGovernmentBalanceFacts(fixturePath)).rejects.toThrow();
  });
});

describe("loadServedGeneralGovernmentBalanceData", () => {
  it("serves only the annual balance fields needed by the public page", async () => {
    delete process.env.GEODATA_DATA_SOURCE;
    const { facts } = await loadServedGeneralGovernmentBalanceData();

    expect(facts).toHaveLength(37);
    expect(Object.keys(facts[0]!).sort()).toEqual([
      "generalGovernmentBalanceGel",
      "generalGovernmentBalancePctGdp",
      "lastReviewedAt",
      "sourceId",
      "status",
      "year",
    ]);
    expect(facts.find((row) => row.year === 2025)).toMatchObject({
      generalGovernmentBalancePctGdp: -1.455,
      generalGovernmentBalanceGel: -1_526_000_000,
      status: "actual",
    });
    expect(facts.find((row) => row.year === 2026)?.status).toBe("projection");
  });
});
