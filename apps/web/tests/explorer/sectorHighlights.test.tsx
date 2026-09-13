import { expect, test } from "vitest";
import { buildSectorHighlights } from "../../lib/explorer/sectorHighlights";
import registry from "../../../../data/taxonomy/economic-sectors.json";
import type { ServedSectorObservation } from "../../lib/data/economicSectors/types";
import { renderToStaticMarkup } from "react-dom/server";
import { SectorHighlights } from "../../components/economic-sectors/sector-highlights";
import { I18nProvider } from "../../lib/i18n/provider";
import { getMessages } from "../../lib/i18n/messages.server";

const fact = (seriesId: string, measure: ServedSectorObservation["measure"], value: number, year = 2025): ServedSectorObservation => ({
  seriesId, measure, value, year, unit: measure === "nominal" ? "gel" : "percent",
  valuation: "basic_prices", priceBasis: "current_prices", calculation: "published",
  status: "preliminary", sourceId: "test", sourceLocator: "A1", lastReviewedAt: "2026-09-12",
});
const facts = [fact("economy.gdp_total", "nominal", 1000), fact("economy.gdp_total", "real_growth", 100),
  ...["sector.a", "sector.b", "sector.c", "sector.d"].flatMap((id, i) => [
    fact(id, "nominal", [100, 300, 200, 50][i]), fact(id, "share_of_gdp", [10, 30, 20, 5][i]),
    fact(id, "real_growth", [4, -8, 12, 0][i]),
  ])];

test("ranks all activities, excludes GDP, and sums the top three GDP shares without renormalizing", () => {
  const model = buildSectorHighlights(facts, registry, 2025);
  expect(model.largest?.seriesId).toBe("sector.b");
  expect(model.largestShare).toBe(30);
  expect(model.fastest?.seriesId).toBe("sector.c");
  expect(model.slowest?.seriesId).toBe("sector.b");
  expect(model.topThree.map(f => f.seriesId)).toEqual(["sector.b", "sector.c", "sector.a"]);
  expect(model.topThreeShare).toBe(60);
  expect(model.preliminary).toBe(true);
});
test("uses the requested year and leaves unavailable annual growth missing", () => {
  const historical = facts.filter(f => f.measure !== "real_growth").map(f => ({ ...f, year: 2010, status: "published" as const }));
  const model = buildSectorHighlights([...facts, ...historical], registry, 2010);
  expect(model.fastest).toBeNull();
  expect(model.slowest).toBeNull();
  expect(model.topThreeShare).toBe(60);
  expect(model.preliminary).toBe(false);
  expect(model.growthFirstYear).toBe(2025);
});
test("preserves zero growth, ties, and unavailable shares", () => {
  const model = buildSectorHighlights([fact("sector.b", "real_growth", 0), fact("sector.a", "real_growth", 0), fact("sector.a", "nominal", 3)], registry, 2025);
  expect(model.fastest?.seriesId).toBe("sector.a");
  expect(model.slowest?.value).toBe(0);
  expect(model.largestShare).toBeNull();
  expect(model.topThreeShare).toBeNull();
});

test("changes growth labels when there is no decline or no growing sector", async () => {
  const messages = await getMessages("en", ["sectors", "format"]);
  const render = (values: number[]) => renderToStaticMarkup(
    <I18nProvider locale="en" messages={messages}>
      <SectorHighlights registry={registry} year={2025}
        facts={values.map((value, i) => fact(`sector.${String.fromCharCode(97 + i)}`, "real_growth", value))} />
    </I18nProvider>,
  );
  expect(render([1, 2, 3])).toContain("Slowest growth");
  expect(render([1, 2, 3])).not.toContain("Largest decline");
  expect(render([-1, -2, -3])).toContain("Smallest decline");
  expect(render([-1, -2, -3])).not.toContain("Fastest growing");
});

test("Georgian highlights explicitly identify GDP share and real annual growth", async () => {
  const messages = await getMessages("ka", ["sectors", "format"]);
  const html = renderToStaticMarkup(<I18nProvider locale="ka" messages={messages}>
    <SectorHighlights registry={registry} facts={facts} year={2025} />
  </I18nProvider>);
  expect(html).toContain("ტოპ 3-ის წილი მშპ-ში");
  expect(html).toContain("რეალური წლიური ზრდა");
});

test("trend marks follow the current winners, keep gaps, and sum the fixed top-three GDP shares", () => {
  const model = buildSectorHighlights([...facts,
    fact("sector.a", "share_of_gdp", 3, 2010), fact("sector.b", "share_of_gdp", 1, 2010),
    fact("sector.c", "share_of_gdp", 2, 2010), fact("sector.d", "share_of_gdp", 90, 2010),
    fact("sector.c", "real_growth", 3, 2011),
  ], registry, 2025);
  expect(model.trends.fastest).toHaveLength(16);
  expect(model.trends.fastest.slice(0, 3)).toEqual([null, 3, null]);
  expect(model.trends.fastest.at(-1)).toBe(12);
  expect(model.trends.topThree[0]).toBe(6);
  expect(model.trends.topThree[1]).toBeNull();
  expect(model.trends.topThree.at(-1)).toBe(60);
});
