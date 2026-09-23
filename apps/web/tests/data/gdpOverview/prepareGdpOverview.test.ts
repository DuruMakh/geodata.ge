import { describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import {
  prepareGdpOverview,
  validateGdpObservations,
  GDP_SOURCE_ROOT,
} from "../../../lib/data/gdpOverview/prepareGdpOverview";

describe("GDP overview source integration", () => {
  it("reads the preliminary years from the manifest, not from a literal year", async () => {
    const { geostatPreliminaryYears } = await import(
      "../../../lib/data/gdpOverview/prepareGdpOverview"
    );

    expect([
      ...geostatPreliminaryYears({
        files: [
          {
            file: "sources/geostat_nominal_current.xlsx",
            sha256: "x",
            bytes: 1,
            preliminary_years: [2026],
          },
          {
            file: "sources/geostat_nominal_legacy.xlsx",
            sha256: "y",
            bytes: 1,
            preliminary_years: [],
          },
          { file: "sources/NY.GDP.MKTP.KD.json", sha256: "z", bytes: 1 },
        ],
      }),
    ]).toEqual([2026]);

    const { facts } = await prepareGdpOverview();
    const preliminary = [
      ...new Set(facts.filter((fact) => fact.status === "preliminary").map((fact) => fact.year)),
    ];
    expect(preliminary).toEqual([2025]);
    expect(facts.filter((fact) => fact.status === "preliminary")).toHaveLength(4);
  });

  it("rejects tampered bytes and a rehashed wrong-country response", async () => {
    const temp = await fs.mkdtemp(path.join(os.tmpdir(), "gdp-source-test-"));
    try {
      await fs.cp(GDP_SOURCE_ROOT, temp, { recursive: true });
      const filename = path.join(temp, "sources/NY.GDP.MKTP.KD.json");
      const original = await fs.readFile(filename, "utf8");
      await fs.writeFile(filename, original + " ");
      await expect(prepareGdpOverview(temp)).rejects.toThrow(/hash mismatch/);
      const response = JSON.parse(original);
      response[1][0].countryiso3code = "USA";
      const bytes = Buffer.from(JSON.stringify(response));
      await fs.writeFile(filename, bytes);
      const manifestPath = path.join(temp, "source-manifest.json");
      const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
      const entry = manifest.files.find(
        (f: { file: string }) => f.file === "sources/NY.GDP.MKTP.KD.json",
      );
      entry.bytes = bytes.length;
      entry.sha256 = createHash("sha256").update(bytes).digest("hex");
      await fs.writeFile(manifestPath, JSON.stringify(manifest));
      await expect(prepareGdpOverview(temp)).rejects.toThrow(
        /country\/indicator mismatch/,
      );
    } finally {
      await fs.rm(temp, { recursive: true, force: true });
    }
  });

  it("checks every observed World Bank growth year against its level series", async () => {
    const temp = await fs.mkdtemp(path.join(os.tmpdir(), "gdp-future-growth-test-"));
    try {
      await fs.cp(GDP_SOURCE_ROOT, temp, { recursive: true });
      const manifestPath = path.join(temp, "source-manifest.json");
      const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));

      for (const [filename, value] of [
        ["NY.GDP.MKTP.KD.json", null],
        ["NY.GDP.MKTP.KD.ZG.json", 100],
      ] as const) {
        const sourcePath = path.join(temp, `sources/${filename}`);
        const response = JSON.parse(await fs.readFile(sourcePath, "utf8"));
        const latest = response[1].find((row: { date: string }) => row.date === "2025");
        response[1].push({
          ...latest,
          date: "2026",
          value: value ?? latest.value,
        });
        const bytes = Buffer.from(JSON.stringify(response));
        await fs.writeFile(sourcePath, bytes);
        const entry = manifest.files.find(
          (candidate: { file: string }) => candidate.file === `sources/${filename}`,
        );
        entry.bytes = bytes.length;
        entry.sha256 = createHash("sha256").update(bytes).digest("hex");
      }

      await fs.writeFile(manifestPath, JSON.stringify(manifest));
      await expect(prepareGdpOverview(temp)).rejects.toThrow(/growth\/level mismatch/);
    } finally {
      await fs.rm(temp, { recursive: true, force: true });
    }
  });

  it("reproduces all six source series without rebasing or population estimates", async () => {
    const { facts, validation } = await prepareGdpOverview();
    expect(facts).toHaveLength(251);
    expect(validation.counts).toEqual({
      real_usd_2015: 66,
      real_growth_percent: 65,
      nominal_gel: 30,
      nominal_usd: 30,
      per_capita_gel: 30,
      per_capita_usd: 30,
    });
    expect(
      facts.find((f) => f.seriesId === "real_usd_2015" && f.year === 1960)
        ?.value,
    ).toBe("5243159135.67355");
    expect(
      facts.some(
        (f) => f.seriesId === "real_growth_percent" && f.year === 1960,
      ),
    ).toBe(false);
    expect(facts.filter((f) => f.status === "preliminary")).toHaveLength(4);
    expect(validation.budgetDenominatorUnchanged).toBe(true);
  });
  it("rejects missing, duplicate, invalid unit and nonfinite observations", async () => {
    const { facts } = await prepareGdpOverview();
    expect(() => validateGdpObservations(facts.slice(1))).toThrow(/coverage/i);
    expect(() => validateGdpObservations([...facts, facts[0]])).toThrow(
      /duplicate/i,
    );
    expect(() =>
      validateGdpObservations([
        { ...facts[0], unit: "percent" },
        ...facts.slice(1),
      ]),
    ).toThrow(/unit/i);
    expect(() =>
      validateGdpObservations([
        { ...facts[0], value: "NaN" },
        ...facts.slice(1),
      ]),
    ).toThrow(/finite/i);
  });
});
