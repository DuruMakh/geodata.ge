import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { renderEconomicSectorsPage } from "../../lib/pages/economic-sectors";
import { renderGdpPage } from "../../lib/pages/gdp";

test.each(["ka", "en"] as const)("GDP and sectors coverage lines say when the data was updated: %s", async (locale) => {
  const word = locale === "en" ? "Updated" : "განახლდა";
  for (const render of [renderGdpPage, renderEconomicSectorsPage]) {
    const html = renderToStaticMarkup(await render(locale));
    expect(html).toMatch(new RegExp(`\\d{4}–\\d{4} · ${word} `));
  }
});
