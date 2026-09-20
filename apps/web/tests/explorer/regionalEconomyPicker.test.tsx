import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import regions from "../../../../data/taxonomy/municipal-regions.json";
import { I18nProvider } from "../../lib/i18n/provider";
import { RegionPicker } from "../../components/regional-economies/region-picker";

const englishLabels = Object.fromEntries(regions.map((region) => [region.id, region.id.split(".")[1]]));
const messages = {
  "regionalEconomies.pickerTitle": "Choose a region",
  "regionalEconomies.pickerPlaceholder": "Search regions",
  "regionalEconomies.pickerSearch": "Search regions",
  "regionalEconomies.pickerResults": "Region results",
  "regionalEconomies.pickerHint": "Use arrow keys and Enter",
  "regionalEconomies.allRegions": "All regions",
  "regionalEconomies.empty": "No regions found",
  "regionalEconomies.clearSearch": "Clear search",
};

test("open region picker contains All Regions and exactly eleven regional routes", () => {
  const html = renderToStaticMarkup(
    <I18nProvider locale="en" messages={messages} englishLabels={englishLabels}>
      <RegionPicker open onClose={() => {}} regions={regions} activeRegionId="region.imereti" />
    </I18nProvider>,
  );
  expect(html).toContain('role="combobox"');
  expect(html).toContain('role="listbox"');
  expect(html).toContain('href="/en/explorer/economy/regions"');
  expect((html.match(/data-testid="region-picker-option"/g) ?? [])).toHaveLength(11);
  expect(html).toContain('href="/en/explorer/economy/regions/imereti"');
  expect(html).toContain('aria-current="page"');
});

test("closed region picker renders nothing", () => {
  const html = renderToStaticMarkup(
    <I18nProvider locale="en" messages={messages} englishLabels={englishLabels}>
      <RegionPicker open={false} onClose={() => {}} regions={regions} activeRegionId="region.imereti" />
    </I18nProvider>,
  );
  expect(html).toBe("");
});
