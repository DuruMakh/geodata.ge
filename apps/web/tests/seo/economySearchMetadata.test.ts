import { expect, test } from "vitest";
import { gdpPageMetadata } from "../../lib/pages/gdp";
import { economicSectorsPageMetadata } from "../../lib/pages/economic-sectors";
import { getMethodologyContent } from "../../lib/methodology/catalog";

test.each(["ka", "en"] as const)("GDP search metadata identifies the country and measures independently of methodology: %s", async (locale) => {
  const metadata = await gdpPageMetadata(locale);
  const title = String(metadata.title);
  for (const term of locale === "en" ? ["Georgia", "GDP", "growth", "per capita"] : ["საქართველოს", "მშპ", "ზრდა", "ერთ სულ მოსახლეზე"]) {
    expect(title).toContain(term);
  }
  expect(metadata.description).toContain(locale === "en" ? "Compare" : "შეადარე");
  expect(metadata.description).toContain("Excel");
  expect(metadata.description).not.toBe(getMethodologyContent("gdp", locale).summary);
});

test.each(["ka", "en"] as const)("sector search metadata describes Georgia's sector comparison and download: %s", async (locale) => {
  const metadata = await economicSectorsPageMetadata(locale);
  const title = String(metadata.title);
  for (const term of locale === "en" ? ["Georgia", "GDP", "sector"] : ["საქართველოს", "მშპ", "სექტორ"]) {
    expect(title).toContain(term);
  }
  expect(metadata.description).toContain(locale === "en" ? "Compare" : "შეადარე");
  expect(metadata.description).toContain(locale === "en" ? "real growth" : "რეალური ზრდა");
  expect(metadata.description).toContain("Excel");
});
