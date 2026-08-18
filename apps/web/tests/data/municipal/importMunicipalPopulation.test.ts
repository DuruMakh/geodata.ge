import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadMunicipalPopulationFacts } from "../../../lib/data/municipal/importMunicipalPopulation";
import { buildMunicipalPopulation2025Output } from "../../../lib/data/municipal/prepareMunicipalPopulation2025";

const HEADER = [
  "year",
  "municipality_code",
  "population_thousand",
  "population_persons",
  "reference_date",
  "source_id",
  "source_sheet",
  "source_cell",
  "source_unit",
  "transformation",
  "last_reviewed_at",
].join(",");

type Overrides = Partial<Record<
  | "year"
  | "code"
  | "thousand"
  | "persons"
  | "referenceDate"
  | "sourceId"
  | "sourceSheet"
  | "sourceCell"
  | "sourceUnit"
  | "transformation"
  | "lastReviewedAt",
  string
>>;

function row(overrides: Overrides = {}): string {
  return [
    overrides.year ?? "2025",
    overrides.code ?? "15",
    overrides.thousand ?? "57.2",
    overrides.persons ?? "57200",
    overrides.referenceDate ?? "2025-01-01",
    overrides.sourceId ?? "source.geostat_municipal_population",
    overrides.sourceSheet ?? "1",
    overrides.sourceCell ?? "L39",
    overrides.sourceUnit ?? "(thousands)",
    overrides.transformation ?? "Published thousands multiplied by 1000; no estimates.",
    overrides.lastReviewedAt ?? "2026-08-03",
  ].join(",");
}

async function fixture(rows: string[]): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), "municipal-population-"));
  const filePath = path.join(directory, "population.csv");
  await writeFile(filePath, `${HEADER}\n${rows.join("\n")}\n`, "utf8");
  return path.relative(process.cwd(), filePath).split(path.sep).join("/");
}

describe("municipal population loader", () => {
  it("loads an exact 2025 source-backed population row", async () => {
    const facts = await loadMunicipalPopulationFacts(await fixture([row()]));

    expect(facts).toEqual([
      {
        year: 2025,
        municipalityCode: "15",
        populationThousand: 57.2,
        populationPersons: 57_200,
        referenceDate: "2025-01-01",
        sourceId: "source.geostat_municipal_population",
        sourceSheet: "1",
        sourceCell: "L39",
        sourceUnit: "(thousands)",
        transformation: "Published thousands multiplied by 1000; no estimates.",
        lastReviewedAt: "2026-08-03",
      },
    ]);
  });

  it("rejects a year or reference date outside the approved 2025 boundary", async () => {
    await expect(
      loadMunicipalPopulationFacts(await fixture([row({ year: "2024" })])),
    ).rejects.toThrow(/2025/);
    await expect(
      loadMunicipalPopulationFacts(await fixture([row({ referenceDate: "2024-11-14" })])),
    ).rejects.toThrow(/2025-01-01/);
  });

  it("rejects a non-positive or non-integer persons denominator", async () => {
    await expect(
      loadMunicipalPopulationFacts(await fixture([row({ thousand: "0", persons: "0" })])),
    ).rejects.toThrow(/positive/);
    await expect(
      loadMunicipalPopulationFacts(await fixture([row({ persons: "57200.5" })])),
    ).rejects.toThrow(/integer/);
  });

  it("rejects a persons value that does not match published thousands", async () => {
    await expect(
      loadMunicipalPopulationFacts(await fixture([row({ persons: "57199" })])),
    ).rejects.toThrow(/conversion mismatch.*15/i);
  });

  it("rejects duplicate municipality keys", async () => {
    await expect(
      loadMunicipalPopulationFacts(await fixture([row(), row()])),
    ).rejects.toThrow(/duplicate.*2025:15/i);
  });

  it("rejects unexpected source metadata and blank provenance", async () => {
    await expect(
      loadMunicipalPopulationFacts(await fixture([row({ sourceId: "geostat_population_self_governed_units" })])),
    ).rejects.toThrow(/source\.geostat_municipal_population/);
    await expect(
      loadMunicipalPopulationFacts(await fixture([row({ transformation: "" })])),
    ).rejects.toThrow(/transformation/i);
  });
});

describe("municipal population 2025 preparation", () => {
  it("derives the exact 64-row 2025 panel from the reviewed package", async () => {
    const result = await buildMunicipalPopulation2025Output();

    expect(result.rows).toHaveLength(64);
    expect(result.rows.every((entry) => entry.year === 2025)).toBe(true);
    expect(result.rows.every((entry) => entry.referenceDate === "2025-01-01")).toBe(true);
    expect(result.rows.every((entry) => entry.sourceId === "source.geostat_municipal_population")).toBe(true);
    expect(result.rows.every((entry) => entry.transformation.length > 0)).toBe(true);
    expect(result.rows.find((entry) => entry.municipalityCode === "15")).toMatchObject({
      populationThousand: 57.2,
      populationPersons: 57_200,
    });
  });

  it("is byte-deterministic and ends with one newline", async () => {
    const first = await buildMunicipalPopulation2025Output();
    const second = await buildMunicipalPopulation2025Output();

    expect(second.csvText).toBe(first.csvText);
    expect(first.csvText.endsWith("\n")).toBe(true);
    expect(first.csvText.endsWith("\n\n")).toBe(false);
  });

  it("rejects a source panel missing a canonical municipality", async () => {
    const sourcePath = path.resolve(
      process.cwd(),
      "../../docs/Raw Data/Municipalities/geostat-population-regional-gdp/municipal-population-annual-2015-2025.csv",
    );
    const text = await readFile(sourcePath, "utf8");
    const withoutTelavi2025 = text
      .split(/\r?\n/)
      .filter((line) => !line.startsWith("2025,15,"))
      .join("\n");
    const directory = await mkdtemp(path.join(tmpdir(), "municipal-population-source-"));
    const fixturePath = path.join(directory, "population-source.csv");
    await writeFile(fixturePath, withoutTelavi2025, "utf8");

    await expect(
      buildMunicipalPopulation2025Output({ sourcePath: fixturePath }),
    ).rejects.toThrow(/missing.*15/i);
  });
});
