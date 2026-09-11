import { expect, it, vi } from "vitest";

vi.mock("../../../lib/data/gdpOverview/prepareGdpOverview", () => {
  throw new Error("Serving GDP must not load raw workbook preparation");
});

import { loadGdpOverviewFacts } from "../../../lib/data/gdpOverview/importGdpOverview";

it("loads and validates reviewed GDP without importing raw-source preparation", async () => {
  expect(await loadGdpOverviewFacts()).toHaveLength(251);
});
