import { notFound } from "next/navigation";
import { PopulationPlaceExplorer } from "../../components/demography/population-place-explorer";
import { VitalSection } from "../../components/demography/vital-section";
import { ExplorerPage } from "../../components/explorer-shell/explorer-page";
import { EntityMemberList } from "../../components/municipalities/entity-member-list";
import { BreadcrumbJsonLd } from "../../components/seo/breadcrumb-json-ld";
import { PageHeader } from "../../components/shell/page-header";
import { loadServedDemographyData } from "../data/demography/importDemography";
import { SOURCE_ID } from "../data/demography/series";
import { MUNICIPAL_COUNTRY_ID } from "../data/municipal/types";
import { loadServedMunicipalData } from "../data/servedData";
import { GEORGIA_PLACE_ID, TBILISI_PLACE_ID, placeLabel } from "../explorer/demographyAreas";
import {
  POPULATION_PATH,
  placeNeighbours,
  populationHrefById,
  populationMunicipalityCodeForSlug,
  populationMunicipalitySlugs,
  populationPlaceHref,
} from "../explorer/demographyPlaceRoutes";
import { buildPopulationHighlights, buildPopulationModel, placeYears } from "../explorer/demographyPopulation";
import { buildPopulationIndexModel } from "../explorer/demographyPopulationIndex";
import { BIRTHS_DEATHS_PATH, DEMOGRAPHY_HUB_PATH } from "../explorer/demographyRoutes";
import { vitalFactsForPlace } from "../explorer/demographyVital";
import { formatInUnit, UNIT_PERSONS } from "../explorer/format";
import { pickerGroupsFromRows } from "../explorer/municipalData";
import { municipalRankLabel } from "../explorer/municipalLabels";
import { message } from "../i18n/messages";
import { I18nProvider } from "../i18n/provider";
import { pageHref } from "../i18n/routes";
import type { Locale, TemplateValues } from "../i18n/types";
import { fiscalMetadata } from "../seo/metadata";
import { resolveSiteUrl } from "../siteUrl";
import { loadPopulationBasics, loadPopulationSources, loadTbilisiAreaLabel, populationSourceNote } from "./demography-population";

export type PopulationPlaceRoute = { kind: "country" } | { kind: "region"; id: string } | { kind: "municipality"; slug: string };

export async function populationRegionParams() {
  const { regions } = await loadServedMunicipalData();
  return regions.map((region) => ({ id: region.id.replace("region.", "") }));
}

export function populationMunicipalityParams() {
  return populationMunicipalitySlugs().map((slug) => ({ slug }));
}

/** The place a route names, or null: Georgia, `region.{id}`, or the municipality behind a slug (never Tbilisi's). */
function placeIdFor(route: PopulationPlaceRoute): string | null {
  if (route.kind === "country") return GEORGIA_PLACE_ID;
  if (route.kind === "region") return `region.${route.id}`;
  return populationMunicipalityCodeForSlug(route.slug);
}

function workbookScopeFor(route: PopulationPlaceRoute): string {
  if (route.kind === "country") return "georgia";
  return route.kind === "region" ? `region-${route.id}` : route.slug;
}

export async function populationPlaceMetadata(route: PopulationPlaceRoute, locale: Locale) {
  const { clientFacts, presentation, places } = await loadPopulationBasics(locale);
  const place = places.find((candidate) => candidate.id === placeIdFor(route));
  if (!place) notFound();
  const years = placeYears(clientFacts, place);
  const t = (key: string, values?: TemplateValues) => message(presentation.messages, `demography.${key}`, values);
  const name = placeLabel(place, locale);
  return fiscalMetadata({
    locale,
    path: populationPlaceHref(place.id),
    title: `${t("placeMetaTitle", { name })} | Fiscal.ge`,
    description: t("placeMetaDescription", { name, first: years[0]!, last: years.at(-1)! }),
  });
}

export async function renderPopulationPlacePage(route: PopulationPlaceRoute, locale: Locale) {
  const [{ facts, clientFacts, municipal, presentation, places }, sources, served] = await Promise.all([
    loadPopulationBasics(locale),
    loadPopulationSources(locale),
    loadServedDemographyData(),
  ]);
  const place = places.find((candidate) => candidate.id === placeIdFor(route));
  if (!place) notFound();
  // Only the two Population originals go to the browser; the loader returns the whole demography manifest.
  const populationSources = sources.filter((source) => source.sourceId === SOURCE_ID.populationUnits || source.sourceId === SOURCE_ID.density);
  // The section's three originals; the population part keeps its own two.
  const vitalSources = sources.filter((source) =>
    source.sourceId === SOURCE_ID.births || source.sourceId === SOURCE_ID.deaths || source.sourceId === SOURCE_ID.naturalIncrease);
  // Only this place's births, deaths and natural increase go to the browser.
  const vitalFacts = vitalFactsForPlace(served.facts, place.id);
  const { messages } = presentation;
  const t = (key: string, values?: TemplateValues) => message(messages, `demography.${key}`, values);
  const years = placeYears(clientFacts, place);
  const [first, last] = [years[0]!, years.at(-1)!];
  const index = buildPopulationIndexModel({ facts, regions: municipal.regions, municipalities: municipal.municipalities });
  const model = buildPopulationModel({ facts: clientFacts, places, query: { selectedIds: [place.id], range: { kind: "all" } }, locale });
  const highlights = buildPopulationHighlights(model, clientFacts, places, place.id)!;
  const rank = (value: number | null) => municipalRankLabel(value ?? 0, locale);

  let metaLine: string;
  if (highlights.kind === "country") {
    metaLine = t("metaCountry", { regions: places.filter((candidate) => candidate.level === "region").length, municipalities: place.municipalityCount, first, last });
  } else if (highlights.kind === "region") {
    metaLine = t(place.municipalityCount === 1 ? "metaRegionOne" : "metaRegion", {
      members: place.municipalityCount, rank: rank(highlights.rank), count: highlights.ofRegions, year: highlights.year,
    });
  } else {
    metaLine = t("metaMunicipality", {
      region: highlights.region ? placeLabel(highlights.region, locale) : "", rank: rank(highlights.rank), count: highlights.ofMunicipalities, year: highlights.year,
    });
  }

  const populationTitle = t("populationTitle");
  const region = highlights.kind === "municipality" ? highlights.region : null;
  const crumbs = [
    { label: message(messages, "common.home"), href: pageHref("/", locale) },
    { label: message(messages, "common.data") },
    { label: t("title"), href: pageHref(DEMOGRAPHY_HUB_PATH, locale) },
    { label: populationTitle, href: pageHref(POPULATION_PATH, locale) },
    ...(region ? [{ label: placeLabel(region, locale), href: pageHref(populationPlaceHref(region.id), locale) }] : []),
    { label: placeLabel(place, locale) },
  ];
  const neighbours = placeNeighbours(place, places);
  const navigation = neighbours
    ? {
        prev: { label: placeLabel(neighbours.prev, locale), href: pageHref(populationPlaceHref(neighbours.prev.id), locale) },
        next: { label: placeLabel(neighbours.next, locale), href: pageHref(populationPlaceHref(neighbours.next.id), locale) },
      }
    : undefined;
  const georgia = places.find((candidate) => candidate.id === GEORGIA_PLACE_ID)!;
  // Georgia's page shows the densest region's density and a region's page its own; a municipality's page shows none.
  const showsDensity = place.level === "country" || place.level === "region";
  const densityNote = showsDensity
    ? t("densityNote", { area: await loadTbilisiAreaLabel(municipal.regions.map((candidate) => candidate.id)) })
    : undefined;
  const memberRows =
    place.level === "region" && place.id !== TBILISI_PLACE_ID
      ? index.municipalities
          .filter((row) => row.regionId === place.id)
          .map((row, position) => ({
            id: row.id,
            href: pageHref(populationPlaceHref(row.id), locale),
            rank: position + 1,
            label: placeLabel(places.find((candidate) => candidate.id === row.id)!, locale),
            value: formatInUnit(row.valueGel, UNIT_PERSONS),
          }))
      : [];

  return (
    <I18nProvider {...presentation}>
      <BreadcrumbJsonLd
        items={[
          { name: crumbs[0].label, path: pageHref("/", locale) },
          { name: crumbs[2].label, path: pageHref(DEMOGRAPHY_HUB_PATH, locale) },
          { name: populationTitle, path: pageHref(POPULATION_PATH, locale) },
          ...(region ? [{ name: placeLabel(region, locale), path: pageHref(populationPlaceHref(region.id), locale) }] : []),
          { name: placeLabel(place, locale), path: pageHref(populationPlaceHref(place.id), locale) },
        ]}
      />
      <ExplorerPage testId="explorer-shell">
        <PageHeader crumbs={crumbs} coverage={t("coverage", { first, last })} />
        <PopulationPlaceExplorer
          key={place.id}
          place={place}
          places={places}
          facts={clientFacts}
          title={t("placeHeading")}
          metaLine={metaLine}
          navigation={navigation}
          pickerCountry={{ id: MUNICIPAL_COUNTRY_ID, nameKa: "საქართველო", valueGel: index.country.valueGel, budgetCount: georgia.municipalityCount }}
          pickerGroups={pickerGroupsFromRows(index)}
          pickerOverrides={{
            hrefById: populationHrefById(places),
            valueFormat: "persons",
            countryDetail: `${formatInUnit(index.country.valueGel, UNIT_PERSONS)} · ${message(messages, "municipal.members", { count: georgia.municipalityCount })}`,
          }}
          sourceNote={populationSourceNote(presentation, first, last)}
          densityNote={densityNote}
          sources={populationSources}
          siteOrigin={resolveSiteUrl()}
          workbookScope={workbookScopeFor(route)}
          backHref={POPULATION_PATH}
        >
          {memberRows.length > 0 ? <EntityMemberList heading={message(messages, "municipal.regionMembers")} rows={memberRows} /> : null}
        </PopulationPlaceExplorer>
        <VitalSection
          place={place}
          facts={vitalFacts}
          sources={vitalSources}
          siteOrigin={resolveSiteUrl()}
          workbookScope={workbookScopeFor(route)}
          nationalHref={BIRTHS_DEATHS_PATH}
        />
      </ExplorerPage>
    </I18nProvider>
  );
}
