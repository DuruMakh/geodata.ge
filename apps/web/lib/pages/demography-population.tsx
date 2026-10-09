import path from "node:path";
import Link from "next/link";
import { MunicipalitiesIndex } from "../../components/municipalities/municipalities-index";
import { ExplorerHeading } from "../../components/explorer-shell/explorer-heading";
import { ExplorerPage } from "../../components/explorer-shell/explorer-page";
import { BreadcrumbJsonLd } from "../../components/seo/breadcrumb-json-ld";
import { PageHeader } from "../../components/shell/page-header";
import { loadDensityRows } from "../data/demography/densityRows";
import { loadServedDemographyData } from "../data/demography/importDemography";
import { SERIES } from "../data/demography/series";
import { loadServedMunicipalData } from "../data/servedData";
import { projectDemographyObservation } from "../explorer/clientData";
import { GEORGIA_PLACE_ID, TBILISI_PLACE_ID, buildDemographyPlaces } from "../explorer/demographyAreas";
import { POPULATION_PATH, populationHrefById } from "../explorer/demographyPlaceRoutes";
import { buildPopulationHighlights, buildPopulationModel } from "../explorer/demographyPopulation";
import { buildPopulationIndexModel } from "../explorer/demographyPopulationIndex";
import { buildPopulationKpis, populationIndexKpis } from "../explorer/demographyPopulationKpis";
import { DEMOGRAPHY_HUB_PATH } from "../explorer/demographyRoutes";
import { formatInUnit, UNIT_DENSITY, UNIT_PERSONS } from "../explorer/format";
import type { WorkbookPublicSource } from "../explorer/workbookModel";
import { loadEnglishCatalogue } from "../i18n/catalogue.server";
import { message } from "../i18n/messages";
import { getMessages } from "../i18n/messages.server";
import { getPresentation } from "../i18n/presentation.server";
import { I18nProvider } from "../i18n/provider";
import { pageHref } from "../i18n/routes";
import type { Locale, Presentation, TemplateValues } from "../i18n/types";
import { projectPublicSources } from "../methodology/publicSources";
import { loadReviewedSourceManifest } from "../methodology/sourceManifest";
import { fiscalMetadata } from "../seo/metadata";

export async function demographyPopulationPageMetadata(locale: Locale) {
  const p = await getPresentation(locale, ["demography"], []);
  return fiscalMetadata({
    locale,
    path: POPULATION_PATH,
    title: `${message(p.messages, "demography.populationMetaTitle")} | Fiscal.ge`,
    description: message(p.messages, "demography.populationDescription"),
  });
}

/** Everything the index and the place pages share: the served facts, the registries, the language and the place list. */
export async function loadPopulationBasics(locale: Locale) {
  const [{ facts }, municipal, georgian] = await Promise.all([
    loadServedDemographyData(),
    loadServedMunicipalData(),
    getMessages("ka", ["demography"]),
  ]);
  const ids = [GEORGIA_PLACE_ID, ...municipal.regions.map((region) => region.id), ...municipal.municipalities.map((m) => m.code)];
  // `municipal` is loaded for the map's legend text and the list's labels (tabs, search, boundaries).
  const presentation = await getPresentation(locale, ["demography", "common", "controls", "format", "main", "workbook", "municipal"], ids);
  const places = buildDemographyPlaces({
    regions: municipal.regions,
    municipalities: municipal.municipalities,
    englishLabels: presentation.englishLabels,
    georgiaNameKa: message(georgian, "demography.georgia"),
  });
  return { facts, clientFacts: facts.map(projectDemographyObservation), municipal, presentation, places };
}

/**
 * The source line of the index and of every place page: the source text for the years shown, then the link to the methodology page,
 * closed by a full stop so that the "Boundaries: ..." the index appends starts a new sentence. Inline content only.
 */
export function populationSourceNote({ locale, messages }: Presentation, start: number, end: number) {
  return (
    <>
      {message(messages, "demography.source", { start, end })}{" "}
      <Link href={pageHref("/methodology/demography", locale)} className="underline underline-offset-2">
        {message(messages, "common.methodology")}
      </Link>.
    </>
  );
}

/** The reviewed originals the workbook and the source note name, in the page's language. */
export async function loadPopulationSources(locale: Locale): Promise<(WorkbookPublicSource & { sourceId: string })[]> {
  const repositoryRoot = path.resolve(/* turbopackIgnore: true */ process.cwd(), "../..");
  const [manifest, catalogue] = await Promise.all([loadReviewedSourceManifest(repositoryRoot, "demography"), loadEnglishCatalogue(repositoryRoot)]);
  const publicSources = projectPublicSources(manifest, locale, catalogue.documents);
  return manifest.map((source) => {
    const translated = publicSources.find((candidate) => candidate.source_id === source.source_id)!;
    return {
      sourceId: source.source_id,
      years: source.years,
      title: translated.title,
      organization: translated.publisher,
      downloadHref: source.downloadHref,
      retrievedAt: source.retrieved_at,
    };
  });
}

/** Tbilisi's area in km² as the reviewed density mapping records it, for the note every page that shows a density carries. */
export async function loadTbilisiAreaLabel(regionIds: readonly string[]): Promise<string> {
  const repositoryRoot = path.resolve(/* turbopackIgnore: true */ process.cwd(), "../..");
  const densityRows = await loadDensityRows(repositoryRoot, regionIds);
  return densityRows.areaOf(TBILISI_PLACE_ID).toFixed(2);
}

export async function renderDemographyPopulationPage(locale: Locale) {
  const { facts, clientFacts, municipal, presentation, places } = await loadPopulationBasics(locale);
  const { messages } = presentation;
  const t = (key: string, values?: TemplateValues) => message(messages, `demography.${key}`, values);
  const index = buildPopulationIndexModel({ facts, regions: municipal.regions, municipalities: municipal.municipalities });
  const georgiaModel = buildPopulationModel({
    facts: clientFacts,
    places,
    query: { selectedIds: [GEORGIA_PLACE_ID], range: { kind: "all" } },
    locale,
  });
  const kpis = populationIndexKpis(
    buildPopulationKpis(buildPopulationHighlights(georgiaModel, clientFacts, places, GEORGIA_PLACE_ID)!, messages, locale),
    t("densityUnitLong"),
  );
  // The density note names Tbilisi's area as the reviewed mapping records it, not as a typed number.
  const tbilisiArea = await loadTbilisiAreaLabel(municipal.regions.map((region) => region.id));
  const years = facts.filter((fact) => fact.seriesId === SERIES.populationTotal).map((fact) => fact.year);
  const [start, end] = [Math.min(...years), Math.max(...years)];
  const georgia = places.find((place) => place.id === GEORGIA_PLACE_ID)!;
  const title = t("populationTitle");
  const crumbs = [
    { label: message(messages, "common.home"), href: pageHref("/", locale) },
    { label: message(messages, "common.data") },
    { label: t("title"), href: pageHref(DEMOGRAPHY_HUB_PATH, locale) },
    { label: title },
  ];
  return (
    <I18nProvider {...presentation}>
      <BreadcrumbJsonLd
        items={[
          { name: crumbs[0].label, path: pageHref("/", locale) },
          { name: crumbs[2].label, path: pageHref(DEMOGRAPHY_HUB_PATH, locale) },
          { name: title, path: pageHref(POPULATION_PATH, locale) },
        ]}
      />
      <ExplorerPage testId="explorer-shell">
        <PageHeader crumbs={crumbs} coverage={t("coverage", { first: start, last: end })} />
        <ExplorerHeading>{title}</ExplorerHeading>
        <p className="mb-[30px] text-[13px] text-[var(--body)]">{t("unitLine")}</p>
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
          kpis={kpis}
          sourceNote={populationSourceNote(presentation, start, end)}
          overrides={{
            hrefById: populationHrefById(places),
            valueFormat: "persons",
            secondaryById: Object.fromEntries(
              Object.entries(index.densityByPlace).map(([id, value]) => [id, `${formatInUnit(value, UNIT_DENSITY)}${t("densityUnit")}`]),
            ),
            countrySubtitle: message(messages, "municipal.members", { count: georgia.municipalityCount }),
            unitLabel: t("unitShort"),
            mapWording: {
              groupAria: t("mapAria", { measure: t("measurePopulation"), year: index.year }),
              legendCaption: t("mapLegendPopulation", { year: index.year }),
            },
            mapNote: (
              <div className="mt-2 space-y-1">
                <p data-testid="population-map-note" className="text-[11px] leading-relaxed text-[var(--muted)]">{t("mapCensusNote")}</p>
                <p data-testid="population-density-note" className="text-[11px] leading-relaxed text-[var(--muted)]">{t("densityNote", { area: tbilisiArea })}</p>
              </div>
            ),
          }}
        />
      </ExplorerPage>
    </I18nProvider>
  );
}
