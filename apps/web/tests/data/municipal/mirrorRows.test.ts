import { describe, expect, it } from "vitest";
import {
  loadMunicipalAdjaraBudgetAdjustmentsFromMirror,
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

describe("Adjara budget adjustment mirror reader", () => {
  it("rejects a stored scope other than region.adjara", async () => {
    await expect(
      loadMunicipalAdjaraBudgetAdjustmentsFromMirror(mirrorWithScope("country.georgia")),
    ).rejects.toThrow(/scopeId=region\.adjara/);
  });
});
