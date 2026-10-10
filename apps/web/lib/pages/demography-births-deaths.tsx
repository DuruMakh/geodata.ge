import Link from "next/link";
import { NationalVitalCharts } from "../../components/demography/national-vital-charts";
import { ExplorerHeading } from "../../components/explorer-shell/explorer-heading";
import { ExplorerPage } from "../../components/explorer-shell/explorer-page";
import { MunicipalitiesIndex } from "../../components/municipalities/municipalities-index";
import { BreadcrumbJsonLd } from "../../components/seo/breadcrumb-json-ld";
import { PageHeader } from "../../components/shell/page-header";
import { loadServedDemographyData } from "../data/demography/importDemography";
import { SERIES, SOURCE_ID } from "../data/demography/series";
import { projectNationalObservation } from "../explorer/clientData";
import { populationHrefById } from "../explorer/demographyPlaceRoutes";
import { BIRTHS_DEATHS_PATH, DEMOGRAPHY_HUB_PATH } from "../explorer/demographyRoutes";
import { NATIONAL_SERIES, nationalYears } from "../explorer/demographyNational";
import { buildVitalIndexModel } from "../explorer/demographyVitalIndex";
import { formatInUnit, UNIT_PERSONS } from "../explorer/format";
import { message } from "../i18n/messages";
import { getPresentation } from "../i18n/presentation.server";
import { I18nProvider } from "../i18n/provider";
import { pageHref } from "../i18n/routes";
import type { Locale, TemplateValues } from "../i18n/types";
import { fiscalMetadata } from "../seo/metadata";
import { resolveSiteUrl } from "../siteUrl";
import { loadPopulationBasics, loadPopulationSources } from "./demography-population";

export async function demographyBirthsDeathsPageMetadata(locale: Locale) {
  const p = await getPresentation(locale, ["demography"], []);
  return fiscalMetadata({
    locale,
    path: BIRTHS_DEATHS_PATH,
    title: `${message(p.messages, "demography.birthsMetaTitle")} | Fiscal.ge`,
    description: message(p.messages, "demography.birthsDeathsDescription"),
  });
}

const ANCHOR = "#births-deaths";

export async function renderDemographyBirthsDeathsPage(locale: Locale) {
  // The population basics bring the place list, the municipal registry and a presentation that already loads `municipal` (the map's words).
  const [{ facts: served }, { municipal, presentation, places }, sources] = await Promise.all([
    loadServedDemographyData(),
    loadPopulationBasics(locale),
    loadPopulationSources(locale),
  ]);
  const { messages } = presentation;
  const t = (key: string, values?: TemplateValues) => message(messages, `demography.${key}`, values);
  const index = buildVitalIndexModel({ facts: served, regions: municipal.regions, municipalities: municipal.municipalities });
  // Only the national series go to the browser (132 rows); the places block is drawn from server-built rows.
  const nationalFacts = served.filter((fact) => NATIONAL_SERIES.includes(fact.seriesId)).map(projectNationalObservation);
  const nationalSources = sources.filter((source) => source.sourceId === SOURCE_ID.fertility || source.sourceId === SOURCE_ID.lifeExpectancy);
  const birthYears = served.filter((fact) => fact.seriesId === SERIES.liveBirths).map((fact) => fact.year);
  const [first, last] = [Math.min(...birthYears), Math.max(...birthYears)];
  const national = nationalYears(nationalFacts);
  // The header's coverage is the births span; the national series must cover the same years or the header would mislead.
  if (national[0] !== first || national.at(-1) !== last) throw new Error(`National series cover ${national[0]}–${national.at(-1)}, births ${first}–${last}`);
  const georgia = index.countsById["country.georgia"]!;
  const hrefById = Object.fromEntries(Object.entries(populationHrefById(places)).map(([id, href]) => [id, `${href}${ANCHOR}`]));
  const title = message(messages, "demography.birthsDeathsTitle");
  const crumbs = [
    { label: message(messages, "common.home"), href: pageHref("/", locale) },
    { label: message(messages, "common.data") },
    { label: t("title"), href: pageHref(DEMOGRAPHY_HUB_PATH, locale) },
    { label: title },
  ];
  const methodology = (
    <Link href={pageHref("/methodology/demography", locale)} className="underline underline-offset-2">
      {message(messages, "common.methodology")}
    </Link>
  );
  return (
    <I18nProvider {...presentation}>
      <BreadcrumbJsonLd
        items={[
          { name: crumbs[0].label, path: pageHref("/", locale) },
          { name: crumbs[2].label, path: pageHref(DEMOGRAPHY_HUB_PATH, locale) },
          { name: title, path: pageHref(BIRTHS_DEATHS_PATH, locale) },
        ]}
      />
      <ExplorerPage testId="explorer-shell">
        <PageHeader crumbs={crumbs} coverage={t("birthsCoverage", { first, last })} />
        <ExplorerHeading>{title}</ExplorerHeading>
        <p className="mb-[30px] max-w-[800px] text-[13px] leading-relaxed text-[var(--body)]">{t("birthsLead")}</p>
        <MunicipalitiesIndex
          viewBox={index.map.viewBox}
          shapes={index.map.shapes}
          markers={index.map.markers}
          occupiedAreas={index.map.occupiedAreas}
          touchTargets={index.map.touchTargets}
          legendMin={formatInUnit(index.map.legendMinPerResidentGel, UNIT_PERSONS)}
          legendMax={formatInUnit(index.map.legendMaxPerResidentGel, UNIT_PERSONS)}
          municipalities={index.municipalities}
          regions={index.regions}
          country={index.country}
          kpis={[
            { label: t("kpiBirths", { year: index.year }), value: formatInUnit(georgia.births, UNIT_PERSONS), detail: "" },
            { label: t("kpiDeaths", { year: index.year }), value: formatInUnit(georgia.deaths, UNIT_PERSONS), detail: "" },
            { label: t("kpiRatio"), value: formatInUnit(index.country.valueGel, UNIT_PERSONS), detail: t("kpiDetailYear", { year: index.year }) },
            { label: t("kpiDeathsAhead"), value: t("kpiOf", { count: index.deathsAhead, total: index.municipalityCount }), detail: t("kpiDetailYear", { year: index.year }) },
          ]}
          sourceNote={<>{t("birthsSource", { first, last })} {methodology}.</>}
          overrides={{
            hrefById,
            valueFormat: "persons",
            secondaryById: Object.fromEntries(
              Object.entries(index.countsById).map(([id, counts]) => [
                id,
                t("ratioCounts", { births: formatInUnit(counts.births, UNIT_PERSONS), deaths: formatInUnit(counts.deaths, UNIT_PERSONS) }),
              ]),
            ),
            countrySubtitle: message(messages, "municipal.members", { count: index.municipalityCount }),
            unitLabel: t("ratioUnit"),
            mapWording: { groupAria: t("ratioMapAria", { year: index.year }), legendCaption: t("ratioLegend", { year: index.year }) },
            mapNote: <p data-testid="ratio-map-note" className="mt-2 text-[11px] leading-relaxed text-[var(--muted)]">{t("ratioMapNote")}</p>,
          }}
        />
        <NationalVitalCharts facts={nationalFacts} sources={nationalSources} siteOrigin={resolveSiteUrl()} />
      </ExplorerPage>
    </I18nProvider>
  );
}
