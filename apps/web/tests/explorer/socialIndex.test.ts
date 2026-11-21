import { beforeAll, describe, expect, it } from "vitest";
import { loadServedDemographyData } from "../../lib/data/demography/importDemography";
import { loadServedMunicipalData } from "../../lib/data/servedData";
import { loadSocialFacts, toClientSocialFact } from "../../lib/data/social/importSocial";
import { socialPopulation } from "../../lib/explorer/social";
import { buildSocialIndexModel, type SocialIndexModel } from "../../lib/explorer/socialIndex";

let pensions: SocialIndexModel;
beforeAll(async () => {
  const [facts, demography, municipal] = await Promise.all([loadSocialFacts(), loadServedDemographyData(), loadServedMunicipalData()]);
  pensions = buildSocialIndexModel("pensions", facts.map(toClientSocialFact), socialPopulation(demography.facts), municipal.regions, municipal.municipalities);
});

describe("social index history", () => {
  it("carries the count and the share per 100 residents", () => {
    expect(pensions.history.figures.map((figure) => figure.id)).toEqual(["count", "share"]);
    const [count, share] = pensions.history.figures;
    expect(count!.valueAt("country.georgia", 2025)).toBe(888518);
    expect(count!.valueAt("11", 2013)).toBe(4612);
    expect(share!.valueAt("country.georgia", pensions.year)).toBe(pensions.country.valueGel);
    expect(pensions.history.years[0]).toBe(2013);
  });

  it("matches the list in the map's year", () => {
    const [, share] = pensions.history.figures;
    for (const row of pensions.municipalities) expect(share!.valueAt(row.id, pensions.year)).toBe(row.valueGel);
  });
});
