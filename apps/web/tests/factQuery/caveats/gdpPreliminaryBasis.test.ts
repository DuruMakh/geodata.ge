import { beforeAll, describe, expect, it } from "vitest";
import { buildFactQuerySnapshot } from "../../../lib/factQuery/buildSnapshot";
import { queryGdp } from "../../../lib/factQuery/queryGdp";
import type { FactQuerySnapshot } from "../../../lib/factQuery/types";

let snapshot: FactQuerySnapshot;
const CODE = "gdp_world_bank_preliminary_basis";

beforeAll(async () => {
  snapshot = await buildFactQuerySnapshot({
    releaseCommit: "test",
    generatedAt: "2026-09-05T00:00:00Z",
  });
});

const codes = (response: ReturnType<typeof queryGdp>) =>
  response.kind === "error" ? [] : response.meta.caveats.map((caveat) => caveat.code);

describe("World Bank preliminary basis", () => {
  it("fires on a real series year whose Geostat accounts are preliminary", () => {
    const response = queryGdp(snapshot, {
      seriesIds: ["real_growth_percent"],
      years: [2025],
    });
    expect(codes(response)).toContain(CODE);
    if (response.kind !== "error") {
      const caveat = response.meta.caveats.find((entry) => entry.code === CODE)!;
      expect(caveat.affects).toEqual(["real_growth_percent:2025"]);
      expect(caveat.severity).toBe("note");
    }
  });

  it("stays silent on a settled year and on Geostat series", () => {
    expect(
      codes(queryGdp(snapshot, { seriesIds: ["real_usd_2015"], years: [2019] })),
    ).not.toContain(CODE);
    expect(codes(queryGdp(snapshot, { seriesIds: ["nominal_gel"], years: [2025] }))).not.toContain(
      CODE,
    );
  });
});
