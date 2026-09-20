import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { GdpOverview } from "../../components/gdp/gdp-overview";
import { I18nProvider } from "../../lib/i18n/provider";
import { getMessages } from "../../lib/i18n/messages.server";
import { prepareGdpOverview } from "../../lib/data/gdpOverview/prepareGdpOverview";
it("renders centered four indicator controls and the existing chart", async () => {
  const facts = (await prepareGdpOverview()).facts.map((f) => ({
    ...f,
    value: Number(f.value),
  }));
  const messages = await getMessages("en", [
    "gdp",
    "common",
    "controls",
    "format",
    "main",
  ]);
  const html = renderToStaticMarkup(
    <I18nProvider locale="en" messages={messages}>
      <GdpOverview facts={facts} sources={[]} siteOrigin="https://fiscal.ge" />
    </I18nProvider>,
  );
  expect(html).toContain('data-testid="gdp-indicators"');
  expect(html).toContain("Real GDP");
  expect(html).toContain("Nominal GDP");
  expect(html).toContain("GDP growth");
  expect(html).toContain("GDP per capita");
  expect(html).not.toContain('data-testid="gdp-currency"');
  expect(html).not.toContain(">Display<");
  expect(html).not.toContain('data-testid="gdp-headline"');
  expect(html).toContain("bn · Constant 2015 USD");
  expect(html).toContain("rest on Geostat national accounts that are still preliminary");
});
