import { Children, isValidElement, type ReactElement } from "react";
import { expect, it } from "vitest";
import { GdpOverview, type GdpWorkbookSource } from "../../components/gdp/gdp-overview";
import { gdpSelectionSources } from "../../lib/explorer/gdpWorkbook";
import { renderGdpPage } from "../../lib/pages/gdp";

async function pageSources(locale: "ka" | "en"): Promise<GdpWorkbookSource[]> {
  const page = await renderGdpPage(locale) as ReactElement<{ children: unknown }>;
  const overview = Children.toArray(page.props.children as never).find(
    (child): child is ReactElement<{ sources: GdpWorkbookSource[] }> => isValidElement(child) && child.type === GdpOverview,
  );
  return overview!.props.sources;
}

const files = (sources: GdpWorkbookSource[]) => sources.map((source) => source.downloadHref.split("/").at(-1)).toSorted();

it.each(["ka", "en"] as const)("each GDP manifest row is one source under its own id: %s", async (locale) => {
  const sources = await pageSources(locale);
  const ids = sources.map((source) => source.sourceId);
  expect(new Set(ids).size).toBe(ids.length);
  expect(ids.toSorted()).toEqual([
    "source.geostat_national_gdp_sna_1993",
    "source.geostat_national_gdp_sna_2008",
    "source.wb_gdp_metadata",
    "source.wb_gdp_real_growth_percent",
    "source.wb_gdp_real_usd_2015",
  ]);
});

it("World Bank selections cite their file and the indicator metadata once each", async () => {
  const sources = await pageSources("en");
  expect(files(gdpSelectionSources(sources, ["source.wb_gdp_real_usd_2015"])))
    .toEqual(["ny.gdp.mktp.kd.json", "wb_indicator_metadata.json"]);
  expect(files(gdpSelectionSources(sources, ["source.wb_gdp_real_growth_percent"])))
    .toEqual(["ny.gdp.mktp.kd.zg.json", "wb_indicator_metadata.json"]);
});

it("Geostat selections cite only the Geostat files they rest on", async () => {
  const sources = await pageSources("en");
  expect(files(gdpSelectionSources(sources, ["source.geostat_national_gdp_sna_2008"])))
    .toEqual(["geostat_nominal_current.xlsx"]);
  expect(files(gdpSelectionSources(sources, ["source.geostat_national_gdp_sna_2008", "source.geostat_national_gdp_sna_1993"])))
    .toEqual(["geostat_nominal_current.xlsx", "geostat_nominal_legacy.xlsx"]);
});
