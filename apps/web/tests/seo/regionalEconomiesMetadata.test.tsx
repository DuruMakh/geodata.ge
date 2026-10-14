import { afterEach, expect, test, vi } from "vitest";
import type { ServedRegionalEconomyObservation } from "../../lib/data/regionalEconomies/types";
import { REGIONAL_GDP_TOTAL } from "../../lib/data/regionalEconomies/types";
import {
  regionalEconomiesPageMetadata,
  regionalEconomyPageMetadata,
  renderRegionalEconomiesPage,
} from "../../lib/pages/regional-economy";
import { renderPageMarkup } from "../helpers/render-localized";

// Lets a test narrow the loaded facts, so copy that quotes coverage must follow
// the data rather than a year range or count written into the message files.
const reshape = vi.hoisted(() => ({
  facts: null as null | ((facts: ServedRegionalEconomyObservation[]) => ServedRegionalEconomyObservation[]),
}));
vi.mock("../../lib/data/regionalEconomies/importRegionalEconomies", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/data/regionalEconomies/importRegionalEconomies")>();
  return {
    ...actual,
    loadServedRegionalEconomyData: async () => {
      const data = await actual.loadServedRegionalEconomyData();
      return reshape.facts ? { facts: reshape.facts(data.facts) } : data;
    },
  };
});
afterEach(() => { reshape.facts = null; });

test.each(["ka", "en"] as const)("regional index metadata has canonical and reciprocal languages: %s", async (locale) => {
  const metadata = await regionalEconomiesPageMetadata(locale);
  expect(metadata.alternates?.canonical).toContain(`${locale === "en" ? "/en" : ""}/explorer/economy/regions`);
  expect(metadata.alternates?.languages).toHaveProperty("ka");
  expect(metadata.alternates?.languages).toHaveProperty("en");
  expect(metadata.description).toContain(locale === "en" ? "2010–2024" : "2010–2024");
});

test.each(["ka", "en"] as const)("region metadata keeps the region address and current-price meaning: %s", async (locale) => {
  const metadata = await regionalEconomyPageMetadata("imereti", locale);
  expect(metadata.alternates?.canonical).toContain(`${locale === "en" ? "/en" : ""}/explorer/economy/regions/imereti`);
  expect(String(metadata.title)).toContain(locale === "en" ? "Imereti" : "იმერეთი");
  expect(metadata.description).toContain(locale === "en" ? "current prices" : "მიმდინარე ფასებში");
});

function narrowed(facts: ServedRegionalEconomyObservation[]) {
  const droppedSector = facts.find((fact) => fact.seriesId !== REGIONAL_GDP_TOTAL)!.seriesId;
  return facts
    .filter((fact) => fact.year >= 2012 && fact.year <= 2023)
    .filter((fact) => fact.regionId !== "region.tbilisi" && fact.seriesId !== droppedSector)
    .map((fact) => ({ ...fact, lastReviewedAt: "2026-10-01" }));
}

test.each(["ka", "en"] as const)("regional titles and descriptions quote the loaded coverage, not fixed text: %s", async (locale) => {
  reshape.facts = narrowed;
  const index = await regionalEconomiesPageMetadata(locale);
  const detail = await regionalEconomyPageMetadata("imereti", locale);
  for (const text of [index.title, index.description, detail.title, detail.description]) {
    expect(String(text)).toMatch(/2012(–| through )2023/);
    expect(String(text)).not.toContain("2010");
  }
  expect(index.description).toContain(locale === "en" ? "Georgia’s 10 published regions" : "საქართველოს 10 გამოქვეყნებული");
  expect(detail.description).toContain(locale === "en" ? "19 economic activities" : "19 ეკონომიკურ საქმიანობას");
});

test.each(["ka", "en"] as const)("the regional source note quotes the loaded review date: %s", async (locale) => {
  reshape.facts = (facts) => facts.map((fact) => ({ ...fact, lastReviewedAt: "2026-10-01" }));
  const html = renderPageMarkup(locale, await renderRegionalEconomiesPage(locale));
  expect(html).toContain(locale === "en" ? "reviewed 1 October 2026" : "გადამოწმებულია 2026-10-01");
  expect(html).not.toContain("13 September");
  expect(html).not.toContain("13 სექტემბერს");
});
