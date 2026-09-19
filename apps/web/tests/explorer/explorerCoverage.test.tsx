import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { renderEconomicSectorsPage } from "../../lib/pages/economic-sectors";
import { renderGdpPage } from "../../lib/pages/gdp";

test.each(["ka", "en"] as const)("GDP and sectors coverage lines say when the data was updated: %s", async (locale) => {
  // English spells the date out, as debt does; Georgian keeps the ISO date.
  const updated = locale === "en" ? "Updated \\d{1,2} [A-Z][a-z]+ \\d{4}" : "განახლდა \\d{4}-\\d{2}-\\d{2}";
  for (const render of [renderGdpPage, renderEconomicSectorsPage]) {
    const html = renderToStaticMarkup(await render(locale));
    expect(html).toMatch(new RegExp(`\\d{4}–\\d{4} · ${updated}<`));
  }
});
