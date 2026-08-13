import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  assertGeneratedArtifactMatches,
  prepareNationalGdp,
  validateNationalGdpSeries,
} from "../../../lib/data/nationalGdp/prepareNationalGdp";

describe("prepareNationalGdp", () => {
  it("preserves the reviewed Geostat captures", async () => {
    const result = await prepareNationalGdp({ write: false });

    expect(result.validation.sourceHashesMatch).toBe(true);
    expect(result.validation.sourceBytes).toEqual({
      sna1993: 94_214,
      sna2008: 50_098,
    });
  });

  it("keeps the overlap in staging and selects one canonical row per year", async () => {
    const result = await prepareNationalGdp({ write: false });

    expect(result.sourceFacts.filter((row) => row.year === 2010)).toHaveLength(2);
    expect(result.canonicalFacts).toHaveLength(30);
    expect(result.canonicalFacts.map((row) => row.year)).toEqual(
      Array.from({ length: 30 }, (_, index) => 1996 + index),
    );
    expect(
      result.canonicalFacts
        .filter((row) => row.year <= 2009)
        .every((row) => row.accountingStandard === "sna_1993"),
    ).toBe(true);
    expect(
      result.canonicalFacts
        .filter((row) => row.year >= 2010)
        .every((row) => row.accountingStandard === "sna_2008"),
    ).toBe(true);
  });

  it("pins published market-price values and 2025 status", async () => {
    const result = await prepareNationalGdp({ write: false });
    const byYear = new Map(result.canonicalFacts.map((row) => [row.year, row]));

    expect(byYear.get(1996)?.gdpCurrentPricesGel).toBe(3_868_500_000);
    expect(byYear.get(2005)?.gdpCurrentPricesGel).toBe(11_620_900_000);
    expect(byYear.get(2009)?.gdpCurrentPricesGel).toBe(17_986_000_000);
    expect(byYear.get(2010)?.gdpCurrentPricesGel).toBe(22_148_700_000);
    expect(byYear.get(2024)?.gdpCurrentPricesGel).toBe(93_022_300_000);
    expect(byYear.get(2025)).toMatchObject({
      gdpCurrentPricesGel: 104_598_100_000,
      status: "preliminary",
    });
  });

  it("fails when a generated artifact differs byte-for-byte", async () => {
    const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "geodata-gdp-check-"));
    const artifactPath = path.join(tempDirectory, "artifact.csv");
    await fs.writeFile(artifactPath, "stale\n", "utf8");

    await expect(assertGeneratedArtifactMatches(artifactPath, "generated\n")).rejects.toThrow(
      "Generated national GDP artifact is stale",
    );
  });

  it("rejects duplicate and incomplete source coverage", async () => {
    const result = await prepareNationalGdp({ write: false });

    expect(() =>
      validateNationalGdpSeries(
        [...result.sourceFacts, result.sourceFacts[0]],
        result.canonicalFacts,
      ),
    ).toThrow("Duplicate GDP source year");
    expect(() =>
      validateNationalGdpSeries(result.sourceFacts.slice(1), result.canonicalFacts),
    ).toThrow("GDP source coverage must be");
  });

  it("rejects canonical gaps, wrong handoffs, and lost preliminary status", async () => {
    const result = await prepareNationalGdp({ write: false });

    expect(() =>
      validateNationalGdpSeries(result.sourceFacts, result.canonicalFacts.slice(1)),
    ).toThrow("Canonical GDP coverage");
    expect(() =>
      validateNationalGdpSeries(
        result.sourceFacts,
        result.canonicalFacts.map((row) =>
          row.year === 2010 ? { ...row, accountingStandard: "sna_1993" } : row,
        ),
      ),
    ).toThrow("accounting-standard handoff");
    expect(() =>
      validateNationalGdpSeries(
        result.sourceFacts,
        result.canonicalFacts.map((row) =>
          row.year === 2025 ? { ...row, status: "final_as_published" } : row,
        ),
      ),
    ).toThrow("status is invalid for 2025");
  });
});
