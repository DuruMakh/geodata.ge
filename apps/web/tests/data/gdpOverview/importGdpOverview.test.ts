import { expect, it } from "vitest";
import { prepareGdpOverview } from "../../../lib/data/gdpOverview/prepareGdpOverview";
import { assertGdpParity } from "../../../lib/data/gdpOverview/importGdpOverview";
it("rejects changed value and provenance in the mirror", async () => {
  const { facts } = await prepareGdpOverview();
  expect(() => assertGdpParity(facts, facts)).not.toThrow();
  expect(() =>
    assertGdpParity(facts, [{ ...facts[0], value: "1" }, ...facts.slice(1)]),
  ).toThrow();
  expect(() =>
    assertGdpParity(facts, [
      { ...facts[0], sourceLocator: "wrong" },
      ...facts.slice(1),
    ]),
  ).toThrow();
});
