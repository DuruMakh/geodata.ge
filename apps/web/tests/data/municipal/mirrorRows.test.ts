import { afterEach, describe, expect, it } from "vitest";
import {
  loadGdpOverviewFactsFromMirror,
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

// Captured before any mutation. Deleting process.env.TZ does NOT restore the
// system zone on Node 24 — the last assigned value sticks — so restore by
// assignment, falling back to the resolved system zone when TZ was never set.
const ORIGINAL_TZ = process.env.TZ ?? Intl.DateTimeFormat().resolvedOptions().timeZone;

describe("municipal population mirror date conversion", () => {
  afterEach(() => {
    process.env.TZ = ORIGINAL_TZ;
  });

  it("keeps the calendar date when the driver returns local midnight in a UTC+ zone", async () => {
    process.env.TZ = "Asia/Tbilisi";

    await expect(
      loadMunicipalPopulationFactsFromMirror(
        mirrorWithPopulation({
          referenceDate: new Date(2025, 0, 1),
          lastReviewedAt: new Date(2026, 7, 3),
        }),
      ),
    ).resolves.toMatchObject([{ referenceDate: "2025-01-01", lastReviewedAt: "2026-08-03" }]);
  });
});

function mirrorWithGdpFact(lastReviewedAt: Date): MirrorClient {
  return {
    gdpOverviewFact: {
      findMany: async () => [
        {
          seriesId: "nominal_gel",
          year: 2025,
          value: 1,
          unit: "gel",
          status: "preliminary",
          accountingStandard: "sna_2008",
          sourceDocumentId: "source.geostat_national_gdp_sna_2008",
          sourceLocator: "GDP at curr pr!G54",
          lastReviewedAt,
        },
      ],
    },
  } as unknown as MirrorClient;
}

describe("GDP overview mirror date conversion", () => {
  afterEach(() => {
    process.env.TZ = ORIGINAL_TZ;
  });

  it("keeps the calendar date when the driver returns local midnight in a UTC+ zone", async () => {
    process.env.TZ = "Asia/Tbilisi";

    await expect(loadGdpOverviewFactsFromMirror(mirrorWithGdpFact(new Date(2026, 8, 11)))).resolves.toMatchObject([
      { lastReviewedAt: "2026-09-11" },
    ]);
  });
});
