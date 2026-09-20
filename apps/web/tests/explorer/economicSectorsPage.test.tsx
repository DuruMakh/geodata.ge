import { expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { renderEconomicSectorsPage, economicSectorsPageMetadata } from "../../lib/pages/economic-sectors";
test.each(["ka","en"] as const)("sector route renders one breadcrumb dataset and localized metadata: %s",async locale=>{
  const metadata=await economicSectorsPageMetadata(locale);
  const html=renderToStaticMarkup(await renderEconomicSectorsPage(locale));
  expect(html.match(/"@type":"BreadcrumbList"/g)).toHaveLength(1);
  expect(html.match(/data-testid="explorer-dataset-json-ld"/g)).toHaveLength(1);
  expect(html).toContain(locale==="en"?"Total GDP":"მთლიანი მშპ");
  expect(metadata.alternates?.canonical).toContain(`${locale==="en"?"/en":""}/explorer/economy/sectors`);
  expect(metadata.alternates?.languages).toHaveProperty("en");
  expect(metadata.alternates?.languages).toHaveProperty("ka");
});

test("the sectors status region starts silent", async () => {
  const html = renderToStaticMarkup(await renderEconomicSectorsPage("en"));
  expect(html).toContain('<p role="status" class="sr-only"></p>');
});
