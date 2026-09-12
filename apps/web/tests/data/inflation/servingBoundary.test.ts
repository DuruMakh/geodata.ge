import { expect, it, vi } from "vitest";

vi.mock("../../../lib/data/inflation/prepareInflation", () => {
  throw new Error("Serving inflation must not load raw workbook preparation");
});
vi.mock("../../../lib/data/inflation/readGeostatCpi", () => {
  throw new Error("Serving inflation must not load the Geostat workbook reader");
});

import { loadServedInflationData } from "../../../lib/data/inflation/importInflation";

it("serves reviewed inflation data without importing raw-source preparation", async () => {
  const { facts, targets } = await loadServedInflationData();
  expect(facts.length).toBeGreaterThan(0);
  expect(targets.length).toBeGreaterThan(0);
});
