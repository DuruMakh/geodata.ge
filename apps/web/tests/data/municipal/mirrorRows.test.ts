import { describe, expect, it } from "vitest";
import {
  loadMunicipalAdjaraBudgetAdjustmentsFromMirror,
  loadMunicipalPopulationFactsFromMirror,
  type MirrorClient,
} from "../../../lib/db/mirrorRows";

function mirrorWithScope(scopeId: string): MirrorClient {
  return {
    municipalAdjaraBudgetAdjustment: {
      findMany: async () => [
        {
          id: "2025:region.adjara",
          year: 2025,
          scopeId,
          republicPaymentsGel: "702000000.00",
          municipalTransfersGel: "203554780.00",
          netRepublicPaymentsGel: "498445220.00",
          basis: "actual",
          republicSourceId: "source.adjara_republic_budget_actual",
          transferSourceId: "source.treasury_consolidated_revenue_actual",
        },
      ],
    },
  } as unknown as MirrorClient;
}

function mirrorWithPopulation(overrides: Record<string, unknown> = {}): MirrorClient {
  return {
    municipalPopulationFact: {
      findMany: async () => [
        {
          id: "2025:15",
          year: 2025,
          municipalityCode: "15",
          populationThousand: "57.2",
          populationPersons: 57200,
          referenceDate: new Date("2025-01-01T00:00:00.000Z"),
          sourceDocumentId: "source.geostat_municipal_population",
          sourceSheet: "1",
          sourceCell: "AG39",
          sourceUnit: "(thousands)",
          transformation: "Source sheet 1 cell AG39; no estimates.",
          lastReviewedAt: new Date("2026-08-03T00:00:00.000Z"),
          importRunId: null,
          ...overrides,
        },
      ],
    },
  } as unknown as MirrorClient;
}

describe("Adjara budget adjustment mirror reader", () => {
  it("rejects a stored scope other than region.adjara", async () => {
    await expect(
      loadMunicipalAdjaraBudgetAdjustmentsFromMirror(mirrorWithScope("country.georgia")),
    ).rejects.toThrow(/scopeId=region\.adjara/);
  });
});

describe("municipal population mirror reader", () => {
  it("maps the database row to the exact served population shape", async () => {
    await expect(loadMunicipalPopulationFactsFromMirror(mirrorWithPopulation())).resolves.toEqual([
      {
        year: 2025,
        municipalityCode: "15",
        populationThousand: 57.2,
        populationPersons: 57200,
        referenceDate: "2025-01-01",
        sourceId: "source.geostat_municipal_population",
        sourceSheet: "1",
        sourceCell: "AG39",
        sourceUnit: "(thousands)",
        transformation: "Source sheet 1 cell AG39; no estimates.",
        lastReviewedAt: "2026-08-03",
      },
    ]);
  });

  it("rejects a stored row outside the approved year, source, or reference date", async () => {
    await expect(
      loadMunicipalPopulationFactsFromMirror(mirrorWithPopulation({ year: 2024 })),
    ).rejects.toThrow(/year=2025/);
    await expect(
      loadMunicipalPopulationFactsFromMirror(
        mirrorWithPopulation({ sourceDocumentId: "source.other" }),
      ),
    ).rejects.toThrow(/source\.geostat_municipal_population/);
    await expect(
      loadMunicipalPopulationFactsFromMirror(
        mirrorWithPopulation({ referenceDate: new Date("2024-11-14T00:00:00.000Z") }),
      ),
    ).rejects.toThrow(/2025-01-01/);
  });
});
