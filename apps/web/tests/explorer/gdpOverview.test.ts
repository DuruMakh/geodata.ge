import { expect, it } from "vitest";
import { prepareGdpOverview } from "../../lib/data/gdpOverview/prepareGdpOverview";
import {
  DEFAULT_GDP_STATE,
  changeGdpIndicator,
  buildGdpOverviewModel,
  parseGdpHash,
  serializeGdpHash,
} from "../../lib/explorer/gdpOverview";
it("preserves All, intersects manual periods and remembers currency", async () => {
  const facts = (await prepareGdpOverview()).facts.map((f) => ({
    ...f,
    value: Number(f.value),
  }));
  expect(changeGdpIndicator(DEFAULT_GDP_STATE, "nominal", facts).range).toEqual(
    { kind: "all" },
  );
  expect(
    changeGdpIndicator(
      {
        ...DEFAULT_GDP_STATE,
        range: { kind: "manual", start: 1980, end: 2000 },
      },
      "nominal",
      facts,
    ).range,
  ).toEqual({ kind: "manual", start: 1996, end: 2000 });
  expect(
    changeGdpIndicator(
      {
        ...DEFAULT_GDP_STATE,
        range: { kind: "manual", start: 1960, end: 1970 },
      },
      "nominal",
      facts,
    ).range,
  ).toEqual({ kind: "all" });
  const state = {
    ...DEFAULT_GDP_STATE,
    indicator: "growth" as const,
    currency: "usd" as const,
  };
  const m = buildGdpOverviewModel(facts, state);
  expect(m.years[0]).toBe(1961);
  expect(m.points.find((p) => p.year === 1992)!.value).toBeLessThan(0);
  expect(m.points.at(-1)!.value).toBeCloseTo(0.0746161504152039);
  expect(parseGdpHash(serializeGdpHash(state))).toEqual(state);
  expect(parseGdpHash("#indicator=bad&start=no&end=2025")).toEqual(
    DEFAULT_GDP_STATE,
  );
});
