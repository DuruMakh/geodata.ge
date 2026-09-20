import { describe, expect, it } from "vitest";
import { loadGdpOverviewFacts } from "../../../lib/data/gdpOverview/importGdpOverview";
import { validateGdpObservations } from "../../../lib/data/gdpOverview/validation";
import type { GdpObservation } from "../../../lib/data/gdpOverview/types";

const facts = await loadGdpOverviewFacts();
const edit = (
  match: (fact: GdpObservation) => boolean,
  patch: Partial<GdpObservation>,
): GdpObservation[] => facts.map((fact) => (match(fact) ? { ...fact, ...patch } : fact));

describe("GDP observation invariants", () => {
  it("accepts the canonical file", () => {
    expect(() => validateGdpObservations(facts)).not.toThrow();
  });

  it("rejects a preliminary year that is not the newest", () => {
    const rows = edit(
      (fact) => !fact.seriesId.startsWith("real_") && fact.year === 2020,
      { status: "preliminary" },
    );
    expect(() => validateGdpObservations(rows)).toThrow(/newest/i);
  });

  it("rejects Geostat series that disagree about which years are preliminary", () => {
    const rows = edit(
      (fact) => fact.seriesId === "nominal_usd" && fact.year === 2025,
      { status: "published" },
    );
    expect(() => validateGdpObservations(rows)).toThrow(/preliminary years differ/i);
  });

  it("rejects a preliminary World Bank observation", () => {
    const rows = edit(
      (fact) => fact.seriesId === "real_growth_percent" && fact.year === 2025,
      { status: "preliminary" },
    );
    expect(() => validateGdpObservations(rows)).toThrow(/status/i);
  });

  it("rejects a Geostat series that ends a year after its siblings", () => {
    const last = facts.filter((fact) => fact.seriesId === "nominal_gel").at(-1)!;
    expect(() => validateGdpObservations([...facts, { ...last, year: last.year + 1 }])).toThrow(
      /coverage/i,
    );
  });
});
