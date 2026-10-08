import { beforeAll, expect, test, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { loadServedUnemploymentData, UNEMPLOYMENT_GROUPS } from "../../lib/data/unemployment/importUnemployment";
import type { ClientUnemploymentObservation } from "../../lib/data/unemployment/types";
import { buildUnemploymentRegionMapModel } from "../../lib/explorer/unemploymentRegionMap";
import { unemploymentRegionStaticParams, renderUnemploymentRegionPage, renderUnemploymentRegionsPage, unemploymentRegionPageMetadata } from "../../lib/pages/unemployment-regions";
import { parseUnemploymentHash, changeUnemploymentOverviewSelection, serializeUnemploymentHash } from "../../lib/explorer/unemploymentState";
import { buildUnemploymentModel } from "../../lib/explorer/unemployment";
import { buildUnemploymentWorkbookExportModel } from "../../lib/explorer/unemploymentWorkbook";
import { getPresentation } from "../../lib/i18n/presentation.server";

vi.mock("next/navigation", async original => ({ ...await original<typeof import("next/navigation")>(), notFound: () => { throw new Error("not found"); } }));
let facts: ClientUnemploymentObservation[];
beforeAll(async () => { facts = (await loadServedUnemploymentData()).facts; });

test("map ranks eleven modern regions by the latest official rate with separate occupied overlays", () => {
  const model = buildUnemploymentRegionMapModel(facts);
  expect(model.year).toBe(2025);
  expect(model.regions).toHaveLength(11);
  expect(model.regions[0]).toMatchObject({ regionId: "region.tbilisi", value: 17.45742771624716, rank: 1 });
  expect(model.regions.at(-1)).toMatchObject({ regionId: "region.samtskhe_javakheti", value: 6.9675016102576173 });
  expect(new Set(model.regions.map(region => region.pathD))).toHaveLength(11);
  expect(model.regions.every(region => region.bucket >= 0 && region.bucket <= 5)).toBe(true);
  expect(model.occupiedAreas).toHaveLength(2);
  expect(model.regions.some(region => /imereti_racha|javakheti_guria/.test(region.regionId))).toBe(false);
  expect(() => buildUnemploymentRegionMapModel(facts.filter(fact => !(fact.year === 2025 && fact.groupId === "region.guria")))).toThrow(/guria/);
});

test.each(["ka", "en"] as const)("regional %s index reuses the map and linked list with percentage labels", async locale => {
  const markup = renderToStaticMarkup(await renderUnemploymentRegionsPage(locale));
  expect(markup).toContain('data-testid="unemployment-region-map"');
  expect((markup.match(/data-region-map-target=""/g) ?? [])).toHaveLength(11);
  expect((markup.match(/data-testid="regional-list-row"/g) ?? [])).toHaveLength(11);
  expect(markup).toContain(`href="${locale === "en" ? "/en" : ""}/explorer/unemployment/regions/imereti"`);
  expect(markup).toContain("17.5%");
  expect(markup).toContain("geoBoundaries");
  expect(markup).not.toContain("₾");
  expect(markup).not.toContain('data-testid="unemployment-indicator"');
  expect(markup).not.toContain("data-municipality-code");
});

test.each([["tbilisi", 2010], ["imereti", 2019], ["guria", 2017]] as const)("%s detail keeps its own %i start and fixed region data", async (slug, firstYear) => {
  const state = parseUnemploymentHash("", facts, UNEMPLOYMENT_GROUPS, "regions", `region.${slug}`);
  expect(state.selectedIds).toEqual([`region.${slug}:unemployment_rate`]);
  const model = buildUnemploymentModel(facts, UNEMPLOYMENT_GROUPS, state);
  expect(model.range).toMatchObject({ start: firstYear, end: 2025 });
  expect(model.definitions).toHaveLength(9);
  expect(model.activeFacts.every(fact => fact.groupId === `region.${slug}` && fact.dimension === "region")).toBe(true);
  const markup = renderToStaticMarkup(await renderUnemploymentRegionPage(slug, "en"));
  const heading = /<h1\b[^>]*>(.*?)<\/h1>/.exec(markup)![1];
  expect(heading).toContain('data-testid="region-picker-trigger"');
  expect(heading).toContain("text-[var(--accent)]");
  expect(markup).toContain(`${firstYear}–2025`);
  expect(markup).not.toContain('data-testid="unemployment-indicator"');
  const dataset = JSON.parse(/data-testid="explorer-dataset-json-ld"[^>]*>(.*?)<\/script>/.exec(markup)![1]);
  expect(dataset.temporalCoverage).toBe(`${firstYear}/2025`);
  expect(dataset.spatialCoverage.name).not.toBe("Georgia");
});

test("regional employed children retain the parent history and gaps before their published coverage", () => {
  const initial = parseUnemploymentHash("sel=region.tbilisi:employed&range=all", facts, UNEMPLOYMENT_GROUPS, "regions", "region.tbilisi");
  const state = changeUnemploymentOverviewSelection(initial, [...initial.selectedIds, "region.tbilisi:hired", "region.tbilisi:self_employed"], facts, UNEMPLOYMENT_GROUPS);
  expect(state.selectedIds).toHaveLength(3);
  const model = buildUnemploymentModel(facts, UNEMPLOYMENT_GROUPS, state);
  expect(model.range).toMatchObject({ start: 2010, end: 2025 });
  expect(model.definitions.find(row => row.id === "region.tbilisi:hired")).toMatchObject({ parentId: "region.tbilisi:employed" });
  expect(model.definitions.find(row => row.id === "region.tbilisi:self_employed")).toMatchObject({ parentId: "region.tbilisi:employed" });
  expect(model.rows.find(row => row.itemId === "region.tbilisi:employed")?.valuesByYear[2019]).toBeTypeOf("number");
  expect(model.rows.find(row => row.itemId === "region.tbilisi:hired")?.valuesByYear[2019]).toBeNull();
  expect(model.rows.find(row => row.itemId === "region.tbilisi:hired")?.valuesByYear[2025]).toBe(361.23065568749558);
  expect(model.rows.find(row => row.itemId === "region.tbilisi:self_employed")?.valuesByYear[2025]).toBe(78.29143011189538);
  expect(parseUnemploymentHash(serializeUnemploymentHash(state), facts, UNEMPLOYMENT_GROUPS, "regions", "region.tbilisi")).toEqual(state);
  const childrenOnly = changeUnemploymentOverviewSelection(state, ["region.tbilisi:hired", "region.tbilisi:self_employed"], facts, UNEMPLOYMENT_GROUPS);
  expect(buildUnemploymentModel(facts, UNEMPLOYMENT_GROUPS, childrenOnly).range).toMatchObject({ start: 2020, end: 2025 });
});

test("regional comparison keeps Georgia and region parent histories when their children are added", async () => {
  const initial = parseUnemploymentHash("sel=georgia:employed,region.tbilisi:employed&range=all", facts, UNEMPLOYMENT_GROUPS, "regions");
  const state = changeUnemploymentOverviewSelection(initial, [...initial.selectedIds, "region.tbilisi:hired", "region.tbilisi:self_employed"], facts, UNEMPLOYMENT_GROUPS);
  const model = buildUnemploymentModel(facts, UNEMPLOYMENT_GROUPS, state);
  expect(model.range).toMatchObject({ start: 2010, end: 2025 });
  for (const id of ["georgia:employed", "region.tbilisi:employed"]) expect(model.rows.find(row => row.itemId === id)?.valuesByYear[2010]).toBeTypeOf("number");
  expect(model.rows.find(row => row.itemId === "region.tbilisi:hired")?.valuesByYear[2019]).toBeNull();
  const restored = parseUnemploymentHash(serializeUnemploymentHash(state), facts, UNEMPLOYMENT_GROUPS, "regions");
  expect(restored).toEqual(state);
  expect(buildUnemploymentModel(facts, UNEMPLOYMENT_GROUPS, restored).range).toMatchObject({ start: 2010, end: 2025 });
  const presentation = await getPresentation("en", ["unemployment", "workbook"], UNEMPLOYMENT_GROUPS.map(group => group.id));
  const workbook = buildUnemploymentWorkbookExportModel(facts, UNEMPLOYMENT_GROUPS, state, presentation, [], "https://fiscal.ge");
  expect(workbook.readable.years[0]).toBe(2010);
  const georgia = workbook.readable.rows.find(row => row.label.includes("Georgia") && row.label.includes("Employed"))!;
  const hired = workbook.readable.rows.find(row => row.label.includes("Tbilisi") && row.label.includes("Hired"))!;
  expect(georgia.valuesByYear[2010]).toBeTypeOf("number");
  expect(hired.valuesByYear[2019]).toBeNull();
  expect(hired.valuesByYear[2025]).toBe(361.23065568749558);
});

test.each(["ka", "en"] as const)("regional %s pages and workbooks expose the source categories without inventing earlier values", async locale => {
  const markup = renderToStaticMarkup(await renderUnemploymentRegionPage("tbilisi", locale));
  const dataset = JSON.parse(/data-testid="explorer-dataset-json-ld"[^>]*>(.*?)<\/script>/.exec(markup)![1]);
  expect(dataset.variableMeasured).toContain(locale === "en" ? "Hired employees" : "დაქირავებული");
  expect(markup).toContain("2020–2025");
  const state = parseUnemploymentHash("sel=region.tbilisi:employed,region.tbilisi:hired,region.tbilisi:self_employed&range=all", facts, UNEMPLOYMENT_GROUPS, "regions", "region.tbilisi");
  const presentation = await getPresentation(locale, ["unemployment", "workbook"], UNEMPLOYMENT_GROUPS.map(group => group.id));
  const workbook = buildUnemploymentWorkbookExportModel(facts, UNEMPLOYMENT_GROUPS, state, presentation, [], "https://fiscal.ge");
  expect(workbook.readable.years).toEqual(Array.from({ length: 16 }, (_, i) => 2010 + i));
  const hired = workbook.readable.rows.find(row => row.label === (locale === "en" ? "Hired employees" : "დაქირავებული"))!;
  expect(hired.valuesByYear[2019]).toBeNull();
  expect(hired.basisByYear?.[2019]).toBeNull();
  expect(hired.valuesByYear[2025]).toBe(361.23065568749558);
  expect(hired.basisByYear?.[2025]).toBe("actual");
});

test("region checkbox changes keep compatible indicators, reject other regions, and round-trip settings", () => {
  const state = parseUnemploymentHash("sel=region.tbilisi:unemployment_rate,region.imereti:unemployment_rate&start=2022&end=2025&view=table", facts, UNEMPLOYMENT_GROUPS, "regions", "region.tbilisi");
  expect(state.selectedIds).toEqual(["region.tbilisi:unemployment_rate"]);
  const people = changeUnemploymentOverviewSelection(state, [...state.selectedIds, "region.tbilisi:employed", "region.tbilisi:unemployed"], facts, UNEMPLOYMENT_GROUPS);
  expect(people.selectedIds).toEqual(["region.tbilisi:employed", "region.tbilisi:unemployed"]);
  expect(buildUnemploymentModel(facts, UNEMPLOYMENT_GROUPS, people).percent).toBe(false);
  expect(parseUnemploymentHash(serializeUnemploymentHash(people), facts, UNEMPLOYMENT_GROUPS, "regions", "region.tbilisi")).toEqual(people);
  expect(parseUnemploymentHash("sel=", facts, UNEMPLOYMENT_GROUPS, "regions", "region.tbilisi").selectedIds).toEqual([]);
});

test("regional workbooks identify the selected region and preserve official percentages", async () => {
  const state = parseUnemploymentHash("sel=region.tbilisi:unemployment_rate,region.tbilisi:participation_rate&start=2025&end=2025", facts, UNEMPLOYMENT_GROUPS, "regions", "region.tbilisi");
  const presentation = await getPresentation("en", ["unemployment", "workbook"], UNEMPLOYMENT_GROUPS.map(group => group.id));
  const workbook = buildUnemploymentWorkbookExportModel(facts, UNEMPLOYMENT_GROUPS, state, presentation, [], "https://fiscal.ge");
  expect(workbook.filename).toContain("tbilisi");
  expect(workbook.readable.title).toContain("Tbilisi");
  expect(workbook.readable.rows).toHaveLength(2);
  expect(workbook.readable.rows[0].valuesByYear[2025]).toBeCloseTo(0.1745742771624716, 12);
});

test("static routes and bilingual metadata cover only the eleven modern regions", async () => {
  expect(unemploymentRegionStaticParams()).toHaveLength(11);
  const metadata = await unemploymentRegionPageMetadata("imereti", "en");
  expect(metadata.alternates?.canonical).toEqual(expect.stringContaining("/en/explorer/unemployment/regions/imereti"));
  expect(metadata.alternates?.languages?.ka).toEqual(expect.stringContaining("/explorer/unemployment/regions/imereti"));
  expect(() => renderUnemploymentRegionPage("imereti_racha_lechkhumi_kvemo_svaneti", "en")).toThrow("not found");
});

test("zero unemployment stays valid and combined historical groups retain their own data", () => {
  const zeroFacts = facts.map(fact => fact.year === 2025 && fact.groupId === "region.guria" && fact.indicatorId === "unemployment_rate" ? { ...fact, value: 0 } : fact);
  expect(buildUnemploymentRegionMapModel(zeroFacts).legendMin).toBe(0);
  const state = parseUnemploymentHash("sel=region.imereti_racha_lechkhumi_kvemo_svaneti&start=2010&end=2025&view=table", facts, UNEMPLOYMENT_GROUPS, "regions");
  const model = buildUnemploymentModel(facts, UNEMPLOYMENT_GROUPS, state);
  expect(model.activeFacts.every(fact => fact.groupId === "region.imereti_racha_lechkhumi_kvemo_svaneti")).toBe(true);
  expect(model.rows[0].valuesByYear[2010]).toBeTypeOf("number");
  expect(model.rows[0].valuesByYear[2019]).toBeNull();
  const detail = parseUnemploymentHash("start=2010&end=2025", facts, UNEMPLOYMENT_GROUPS, "regions", "region.imereti");
  expect(buildUnemploymentModel(facts, UNEMPLOYMENT_GROUPS, detail).years[0]).toBe(2019);
});
