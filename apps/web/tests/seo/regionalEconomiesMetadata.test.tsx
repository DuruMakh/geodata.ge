import { expect, test } from "vitest";
import {
  regionalEconomiesPageMetadata,
  regionalEconomyPageMetadata,
} from "../../lib/pages/regional-economy";

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
