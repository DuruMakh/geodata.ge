import { expect, test, type APIRequestContext } from "@playwright/test";

// Platform review X1-13, U03-06, U05-01, U18-02, U19-02, U28-01 (Task 30): a route ships only
// its own client code. A route's first-load JavaScript is the module scripts its HTML names
// (the noModule polyfill aside, which modern browsers never download); these checks read
// them and look for test ids that only one component renders.

async function firstLoadScripts(request: APIRequestContext, path: string): Promise<string> {
  const html = await (await request.get(path)).text();
  const sources = [...html.matchAll(/<script\b([^>]*)>/g)]
    .map(([, attributes]) => attributes)
    .filter((attributes) => !/\bnoModule\b/i.test(attributes))
    .flatMap((attributes) => /\bsrc="([^"]+)"/.exec(attributes)?.[1] ?? []);
  expect(sources.length, `${path} names its scripts`).toBeGreaterThan(0);
  return (await Promise.all(sources.map(async (source) => (await request.get(source)).text()))).join("\n");
}

/** Which of `testIds` the scripts of `path` carry. */
async function testIdsShipped(request: APIRequestContext, path: string, testIds: readonly string[]): Promise<string[]> {
  const scripts = await firstLoadScripts(request, path);
  return testIds.filter((testId) => scripts.includes(`"${testId}"`));
}

const INFLATION_EXPLORERS = {
  overview: "inflation-tabs",
  categories: "inflation-category-tabs",
  cities: "inflation-city-central-prices",
  products: "product-cumulative-toggle",
} as const;

test("the inflation hub loads no explorer chunk", async ({ request }) => {
  const testIds = Object.values(INFLATION_EXPLORERS);
  expect(await testIdsShipped(request, "/explorer/inflation", testIds)).toEqual([]);
  for (const [section, testId] of Object.entries(INFLATION_EXPLORERS)) {
    expect(await testIdsShipped(request, `/explorer/inflation/${section}`, testIds), section).toEqual([testId]);
  }
});

// Every explorer renders a chart panel; no hub does.
test("no topic hub loads explorer code", async ({ request }) => {
  expect(await testIdsShipped(request, "/explorer/wages/overview", ["chart-panel"])).toEqual(["chart-panel"]);
  for (const hub of ["trade", "wages", "unemployment", "external", "money", "energy-food", "economy", "demography", "living-standards", "health", "crime", "housing", "science-culture", "environment", "transport", "internet"]) {
    expect(await testIdsShipped(request, `/explorer/${hub}`, ["chart-panel"]), hub).toEqual([]);
  }
});

test("expenditure and revenue load no analysis view, and the analysis no multi-year explorer", async ({ request }) => {
  const testIds = ["series-excel", "budget-radar"];
  for (const path of ["/explorer/expenditure", "/explorer/revenue"]) {
    expect(await testIdsShipped(request, path, testIds), path).toEqual(["series-excel"]);
  }
  expect(await testIdsShipped(request, "/explorer/analysis", testIds)).toEqual(["budget-radar"]);
});

test("the wages, household, causes-of-death, housing, museums, transport and internet map indexes load no explorer, and their pages no map index", async ({ request }) => {
  const wages = ["wages-region-map", "wages-excel-download"];
  expect(await testIdsShipped(request, "/explorer/wages/regions", wages)).toEqual(["wages-region-map"]);
  expect(await testIdsShipped(request, "/explorer/wages/regions/imereti", wages)).toEqual(["wages-excel-download"]);
  const household = ["household-region-map", "household-excel-download"];
  expect(await testIdsShipped(request, "/explorer/living-standards/income", household)).toEqual(["household-region-map"]);
  expect(await testIdsShipped(request, "/explorer/living-standards/income/regions/georgia", household)).toEqual(["household-excel-download"]);
  const health = ["health-region-map", "health-excel-download"];
  expect(await testIdsShipped(request, "/explorer/health/causes-of-death", health)).toEqual(["health-region-map"]);
  expect(await testIdsShipped(request, "/explorer/health/causes-of-death/regions/georgia", health)).toEqual(["health-excel-download"]);
  const housing = ["housing-region-map", "housing-excel-download"];
  expect(await testIdsShipped(request, "/explorer/housing/regions", housing)).toEqual(["housing-region-map"]);
  expect(await testIdsShipped(request, "/explorer/housing/regions/guria", housing)).toEqual(["housing-excel-download"]);
  const museums = ["science-culture-region-map", "science-culture-excel-download"];
  expect(await testIdsShipped(request, "/explorer/science-culture/museums", museums)).toEqual(["science-culture-region-map"]);
  expect(await testIdsShipped(request, "/explorer/science-culture/museums/guria", museums)).toEqual(["science-culture-excel-download"]);
  const internet = ["internet-region-map", "internet-excel-download"];
  expect(await testIdsShipped(request, "/explorer/internet/homes", internet)).toEqual(["internet-region-map"]);
  expect(await testIdsShipped(request, "/explorer/internet/homes/guria", internet)).toEqual(["internet-excel-download"]);
  const transport = ["transport-region-map", "transport-excel-download"];
  expect(await testIdsShipped(request, "/explorer/transport/regions", transport)).toEqual(["transport-region-map"]);
  expect(await testIdsShipped(request, "/explorer/transport/regions/guria", transport)).toEqual(["transport-excel-download"]);
});
