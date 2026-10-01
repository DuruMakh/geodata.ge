import { beforeAll, describe, expect, test } from "vitest";
import { loadCitizenships, type CitizenshipMap } from "../../../lib/data/demography/citizenship";
import { findYearBlocks, readStoredSheet } from "../../../lib/data/demography/readStoredSheet";
import { loadDemographySources } from "../../../lib/data/demography/sourceFiles";
import { repositoryRoot } from "./helpers";

let citizenships: CitizenshipMap;
let labels: string[];
beforeAll(async () => {
  citizenships = await loadCitizenships(repositoryRoot);
  const sources = await loadDemographySources(repositoryRoot);
  const sheet = readStoredSheet(sources.get("source.geostat_demography_migration_citizenship").bytes, "1");
  const seen = new Set<string>();
  for (const block of findYearBlocks(sheet)) {
    for (let row = block.firstRow; row <= block.lastRow; row += 1) {
      const label = sheet.label(sheet.ref("A", row));
      if (label && sheet.number(sheet.ref("B", row)) !== null) seen.add(label);
    }
  }
  labels = [...seen];
});

describe("migration citizenship identity", () => {
  test("resolves all 22 labels Geostat prints in any year", () => {
    expect(labels).toHaveLength(22);
    for (const label of labels) expect(() => citizenships.resolve(label), label).not.toThrow();
  });

  test("gives every label its own stable lower-case ASCII id", () => {
    const ids = labels.map((label) => citizenships.resolve(label));

    expect(new Set(ids).size).toBe(22);
    for (const id of ids) expect(id).toMatch(/^citizenship\.[a-z_]+$/);
    expect(citizenships.resolve("Total")).toBe("citizenship.total");
    expect(citizenships.resolve("Other")).toBe("citizenship.other");
    expect(citizenships.resolve("Not stated")).toBe("citizenship.not_stated");
    expect(citizenships.resolve("Iran, Islamic Republic of")).toBe("citizenship.iran");
  });

  test("refuses a label nobody reviewed", () => {
    expect(() => citizenships.resolve("Atlantis")).toThrow(/Unreviewed citizenship label: Atlantis/);
  });
});
