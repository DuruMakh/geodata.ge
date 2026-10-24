import Link from "next/link";
import { MarriageExplorer } from "../../components/demography/marriage-explorer";
import { ExplorerPage } from "../../components/explorer-shell/explorer-page";
import { MunicipalitiesIndex } from "../../components/municipalities/municipalities-index";
import { BreadcrumbJsonLd } from "../../components/seo/breadcrumb-json-ld";
import { PageHeader } from "../../components/shell/page-header";
import { loadServedDemographyData } from "../data/demography/importDemography";
import { SERIES, SOURCE_ID } from "../data/demography/series";
import { GEORGIA_PLACE_ID } from "../explorer/demographyAreas";
import { MARRIAGE_SERIES, marriageFactsForPlace, marriageSourceId } from "../explorer/demographyMarriage";
import { buildMarriageIndexModel } from "../explorer/demographyMarriageIndex";
import { populationHrefById } from "../explorer/demographyPlaceRoutes";
import { DEMOGRAPHY_HUB_PATH, MARRIAGES_DIVORCES_ANCHOR, MARRIAGES_DIVORCES_PATH } from "../explorer/demographyRoutes";
import { formatInUnit, UNIT_DENSITY, UNIT_PERSONS } from "../explorer/format";
import { message } from "../i18n/messages";
import { clientPresentation, getPresentation } from "../i18n/presentation.server";
import { I18nProvider } from "../i18n/provider";
import { pageHref } from "../i18n/routes";
import type { Locale, TemplateValues } from "../i18n/types";
import { fiscalMetadata } from "../seo/metadata";
import { resolveSiteUrl } from "../siteUrl";
import { loadPopulationBasics, loadPopulationSources } from "./demography-population";

/** Georgia's marriage years: the page header's and the description's span. */
const marriageYears = (facts: readonly { seriesId: string; geographyId: string; year: number }[]) => {
  const years = facts.filter((fact) => fact.seriesId === SERIES.marriages && fact.geographyId === GEORGIA_PLACE_ID).map((fact) => fact.year);
  return { first: Math.min(...years), last: Math.max(...years) };
};

export async function demographyMarriagesDivorcesPageMetadata(locale: Locale) {
  const [{ facts }, p] = await Promise.all([loadServedDemographyData(), getPresentation(locale, ["demography"], [])]);
  return fiscalMetadata({
    locale,
    path: MARRIAGES_DIVORCES_PATH,
    title: message(p.messages, "demography.marriagesMetaTitle"),
    description: message(p.messages, "demography.marriagesMetaDescription", marriageYears(facts)),
  });
}

export async function renderDemographyMarriagesDivorcesPage(locale: Locale) {
  // The population basics bring the place list, the municipal registry and a presentation that already loads `municipal` (the map's words).
  const [{ facts: served }, { municipal, presentation, places }, sources] = await Promise.all([
    loadServedDemographyData(),
    loadPopulationBasics(locale),
    loadPopulationSources(locale),
  ]);
  const { messages } = presentation;
  const t = (key: string, values?: TemplateValues) => message(messages, `demography.${key}`, values);
  const ids = MARRIAGE_SERIES.map((series) => series.id);
  // Only Georgia's nine series and its mid-year population go to the browser; the places block is drawn from server-built rows.
  const georgia = marriageFactsForPlace(served, GEORGIA_PLACE_ID, ids);
  const index = buildMarriageIndexModel({ facts: served, regions: municipal.regions, municipalities: municipal.municipalities });
  const cited = new Set<string>([...ids.map(marriageSourceId), SOURCE_ID.midYear]);
  const marriageSources = sources.filter((source) => cited.has(source.sourceId));
  const lastReviewedAt = served
    .filter((fact) => cited.has(fact.sourceId))
    .map((fact) => fact.lastReviewedAt)
    .sort()
    .at(-1)!;
  const { first, last } = marriageYears(served);
  const placeYears = served.filter((fact) => fact.seriesId === SERIES.marriages && fact.geographyId !== GEORGIA_PLACE_ID).map((fact) => fact.year);
  const hrefById = Object.fromEntries(Object.entries(populationHrefById(places)).map(([id, href]) => [id, `${href}${MARRIAGES_DIVORCES_ANCHOR}`]));
  const title = t("marriagesTitle");
  const crumbs = [
    { label: message(messages, "common.home"), href: pageHref("/", locale) },
    { label: message(messages, "common.data") },
    { label: t("title"), href: pageHref(DEMOGRAPHY_HUB_PATH, locale) },
    { label: title },
  ];
  const methodology = (
    <Link href={pageHref("/methodology/demography", locale)} prefetch={false} className="underline underline-offset-2">
      {message(messages, "common.methodology")}
    </Link>
  );
  const rate = (value: number) => formatInUnit(value, UNIT_DENSITY);
  return (
    <I18nProvider {...clientPresentation(presentation)}>
      <BreadcrumbJsonLd
        items={[
          { name: crumbs[0].label, path: pageHref("/", locale) },
          { name: crumbs[2].label, path: pageHref(DEMOGRAPHY_HUB_PATH, locale) },
          { name: title, path: pageHref(MARRIAGES_DIVORCES_PATH, locale) },
        ]}
      />
      <ExplorerPage testId="explorer-shell">
        <PageHeader locale={locale} messages={presentation.messages} crumbs={crumbs} coverage={t("marriagesCoverage", { first, last })} />
        <MarriageExplorer
          place={georgia}
          labels={Object.fromEntries(ids.map((id) => [id, t(`marriageSeries.${id}`)]))}
          listLabels={Object.fromEntries(ids.map((id) => [id, t(`marriageList.${id}`)]))}
          sources={marriageSources}
          lastReviewedAt={lastReviewedAt}
          siteOrigin={resolveSiteUrl()}
        />
        <div className="mt-16">
          <MunicipalitiesIndex
            viewBox={index.map.viewBox}
            shapes={index.map.shapes}
            markers={index.map.markers}
            occupiedAreas={index.map.occupiedAreas}
            touchTargets={index.map.touchTargets}
            legendMin={rate(index.map.legendMinPerResidentGel)}
            legendMax={rate(index.map.legendMaxPerResidentGel)}
            municipalities={index.municipalities}
            regions={index.regions}
            country={index.country}
            kpis={[]}
            sourceNote={<>{t("marriageIndexSource", { first: Math.min(...placeYears), last: Math.max(...placeYears) })} {methodology}.</>}
            overrides={{
              hrefById,
              valueFormat: "persons",
              valueLabelById: Object.fromEntries([...index.municipalities, ...index.regions, index.country].map((row) => [row.id, rate(row.valueGel)])),
              secondaryById: Object.fromEntries(
                Object.entries(index.countsById).map(([id, counts]) => [
                  id,
                  t("marriageCounts", { marriages: formatInUnit(counts.marriages, UNIT_PERSONS), divorces: formatInUnit(counts.divorces, UNIT_PERSONS) }),
                ]),
              ),
              countrySubtitle: message(messages, "municipal.members", { count: municipal.municipalities.length }),
              unitLabel: t("marriageRateUnit"),
              mapWording: { groupAria: t("marriageMapAria", { year: index.year }), legendCaption: t("marriageLegend", { year: index.year }) },
              headings: { map: t("marriageMapAria", { year: index.year }), list: t("marriageListTitle", { year: index.year }) },
            }}
          />
        </div>
      </ExplorerPage>
    </I18nProvider>
  );
}
