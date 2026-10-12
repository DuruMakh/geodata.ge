import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CPI_CITY_IDS } from "../../lib/data/inflation/types";
import { CITIES_PATH, cityPageHref, citySlug } from "../../lib/explorer/inflationCityRoutes";
import { I18nProvider } from "../../lib/i18n/provider";
import { filterPickerOptions, PickerDialog, type PickerOption } from "../../components/regional-economies/region-picker";

// The city heading's configuration of the shared picker dialog (Georgia first, as the "all" row).
const labels: Record<string, string> = { "city.tbilisi": "Tbilisi", "city.kutaisi": "Kutaisi", "city.batumi": "Batumi", "city.gori": "Gori", "city.telavi": "Telavi", "city.zugdidi": "Zugdidi" };
const cityOptions: PickerOption[] = CPI_CITY_IDS.map((id) => ({ id, label: labels[id], href: `/en${cityPageHref(id)}`, searchTerms: [labels[id], citySlug(id)] }));
const text = { title: "Choose a city", placeholder: "Search cities", search: "Search cities", results: "City results", empty: "No cities found", clear: "Clear search", hint: "Use arrow keys and Enter" };

function render(current: boolean) {
  return renderToStaticMarkup(
    <I18nProvider locale="en" messages={{}} englishLabels={{}}>
      <PickerDialog
        open
        onClose={() => {}}
        options={cityOptions}
        activeId="city.gori"
        allOption={{ label: "Georgia", href: `/en${CITIES_PATH}`, searchTerms: ["Georgia", "georgia"], testId: "city-picker-georgia-option", current }}
        text={text}
        testIdPrefix="city-picker"
      />
    </I18nProvider>,
  );
}

describe("city picker dialog", () => {
  it("lists Georgia first and the six cities", () => {
    const html = render(false);
    expect(html.match(/data-testid="city-picker-option"/g) ?? []).toHaveLength(6);
    expect(html.match(/data-testid="city-picker-georgia-option"/g) ?? []).toHaveLength(1);
    expect(html.indexOf("city-picker-georgia-option")).toBeLessThan(html.indexOf("city-picker-option"));
    expect(html).toContain('href="/en/explorer/inflation/cities/gori"');
  });

  it("marks the Georgia row as the current page on the Georgia page", () => {
    const georgiaRow = render(true).match(/<a[^>]*city-picker-georgia-option[^>]*>/)![0];
    expect(georgiaRow).toContain('aria-current="page"');
    expect(render(false).match(/<a[^>]*city-picker-georgia-option[^>]*>/)![0]).not.toContain("aria-current");
  });

  it("carries no region picker ids", () => {
    expect(render(false)).not.toContain("region-picker");
  });

  it("finds a city by its English slug", () => {
    expect(filterPickerOptions(cityOptions, "batumi").map((option) => option.id)).toEqual(["city.batumi"]);
  });
});
