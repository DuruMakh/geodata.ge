import { expect, test, vi } from "vitest";
import { loadDemographyFactsFromMirror } from "../../../lib/db/mirrorRows";

const mirrorRow = (patch: Record<string, unknown> = {}) => ({
  seriesId: "demography.population_total",
  geographyId: "country.georgia",
  year: 2004,
  sex: "",
  ageGroup: "",
  citizenshipId: "",
  settlement: "",
  value: { toFixed: () => "3937716" },
  unit: "persons",
  estimateBasis: "retro_projection",
  status: "published",
  sourceLocator: "1!L5 [2004-01-01]",
  sourceDocumentId: "source.geostat_municipal_population",
  lastReviewedAt: new Date("2026-10-01T00:00:00.000Z"),
  ...patch,
});

test("demography mirror rows use the key ordering and drop empty dimensions", async () => {
  const findMany = vi.fn().mockResolvedValue([mirrorRow()]);

  const rows = await loadDemographyFactsFromMirror({ demographyFact: { findMany } } as never);

  expect(findMany).toHaveBeenCalledWith({
    orderBy: [
      { seriesId: "asc" },
      { geographyId: "asc" },
      { year: "asc" },
      { sex: "asc" },
      { ageGroup: "asc" },
      { citizenshipId: "asc" },
      { settlement: "asc" },
    ],
  });
  expect(rows).toEqual([{
    seriesId: "demography.population_total",
    geographyId: "country.georgia",
    year: 2004,
    value: "3937716",
    unit: "persons",
    estimateBasis: "retro_projection",
    status: "published",
    sourceId: "source.geostat_municipal_population",
    sourceLocator: "1!L5 [2004-01-01]",
    lastReviewedAt: "2026-10-01",
  }]);
});

test("demography mirror rows keep the dimensions a row has", async () => {
  const findMany = vi.fn().mockResolvedValue([
    mirrorRow({ sex: "female", ageGroup: "age_5_9", citizenshipId: "citizenship.turkey", settlement: "rural" }),
  ]);

  const [row] = await loadDemographyFactsFromMirror({ demographyFact: { findMany } } as never);

  expect(row).toMatchObject({ sex: "female", ageGroup: "age_5_9", citizenshipId: "citizenship.turkey", settlement: "rural" });
});
