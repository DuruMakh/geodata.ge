import { notFound } from "next/navigation";
import Link from "next/link";
import { ExplorerHeading } from "../../components/explorer-shell/explorer-heading";
import { ExplorerPage } from "../../components/explorer-shell/explorer-page";
import { LatestFigure, LatestValueLine } from "../../components/explorer-shell/latest-value-line";
import { EntityMemberList } from "../../components/municipalities/entity-member-list";
import { MunicipalitiesIndex } from "../../components/municipalities/municipalities-index";
import { BreadcrumbJsonLd } from "../../components/seo/breadcrumb-json-ld";
import { JsonLd } from "../../components/seo/json-ld";
import { PageHeader } from "../../components/shell/page-header";
import { SocialPlaceExplorer } from "../../components/social/social-place-explorer";
import { loadServedDemographyData } from "../data/demography/importDemography";
import { SOURCE_ID } from "../data/demography/series";
import { loadServedInflationData } from "../data/inflation/importInflation";
import { loadServedMunicipalData } from "../data/servedData";
import { loadServedSocialData, toClientSocialFact } from "../data/social/importSocial";
import { FUNDED_PENSION_SOURCES, SOCIAL_GEORGIA, SOCIAL_PUBLIC_SOURCES, socialArchiveSourceId, type ClientSocialFact } from "../data/social/types";
import { coverageLabel } from "../explorer/coverageLabel";
import { GEORGIA_PLACE_ID, TBILISI_PLACE_ID, buildDemographyPlaces, placeLabel, type DemographyPlace } from "../explorer/demographyAreas";
import { placeHrefById, placeIdForRoute, placeNeighbours, placePageHref, type PlaceRoute } from "../explorer/demographyPlaceRoutes";
import { formatInUnit, formatShare, UNIT_PERSONS } from "../explorer/format";
import { HEALTH_HUB_PATH } from "../explorer/health";
import { buildPickerCountry, pickerGroupsFromRows } from "../explorer/municipalData";
import { socialAnnualCpi, socialPopulation, type SocialPlaceSet } from "../explorer/social";
import { buildSocialIndexModel } from "../explorer/socialIndex";
import { socialPlaceBase, socialPlaceCoverage, socialPlaceDefaultSelection, socialPlaceFacts, socialPlaceSeries } from "../explorer/socialPlaces";
import type { WorkbookPublicSource } from "../explorer/workbookModel";
import { Message } from "../i18n/message";
import { message } from "../i18n/messages";
import { getMessages } from "../i18n/messages.server";
import { clientPresentation, getPresentation } from "../i18n/presentation.server";
import { I18nProvider } from "../i18n/provider";
import { pageHref } from "../i18n/routes";
import type { Locale, Messages, TemplateValues } from "../i18n/types";
import { loadSourcedWorkbookSources, type SourcedWorkbookPublicSource } from "../methodology/workbookSources";
import { fiscalMetadata } from "../seo/metadata";
import { explorerDatasetJsonLd } from "../seo/structuredData";
import { resolveSiteUrl } from "../siteUrl";
import { workbookScopeFor } from "./demography-population-place";

/** The same three kinds of place page as Population and Education, with the same 11 region ids and 63 municipality slugs. */
export type SocialPlaceRoute = PlaceRoute;
export { populationMunicipalityParams as socialMunicipalityParams, populationRegionParams as socialRegionParams } from "./demography-population-place";

/** The methodology page the source lines link to. */
const METHODOLOGY_PATH = "/methodology/social-protection";

/**
 * What the index and the place pages share: the served facts and counting changes, the population and price index the
 * calculated rows divide by, the registries, the language and the place list.
 */
async function loadSocialPlaceBasics(locale: Locale) {
  const [{ facts: served, breaks }, demography, inflation, municipal, georgian] = await Promise.all([
    loadServedSocialData(), loadServedDemographyData(), loadServedInflationData(), loadServedMunicipalData(), getMessages("ka", ["municipal"]),
  ]);
  const ids = [GEORGIA_PLACE_ID, ...municipal.regions.map(region => region.id), ...municipal.municipalities.map(m => m.code)];
  // `municipal` is loaded for the map's and the picker's words (tabs, search, boundaries, member counts).
  const presentation = await getPresentation(locale, ["social", "format", "main", "workbook", "municipal"], ids, ids);
  const places = buildDemographyPlaces({
    regions: municipal.regions, municipalities: municipal.municipalities, englishLabels: presentation.englishLabels, georgiaNameKa: message(georgian, "municipal.georgia"),
  });
  const lastReviewedAt = served.map(f => f.lastReviewedAt).sort().at(-1)!;
  return {
    facts: served.map(toClientSocialFact), breaks, population: socialPopulation(demography.facts), cpi: socialAnnualCpi(inflation.facts),
    municipal, presentation, places, lastReviewedAt,
  };
}

/**
 * The Excel Sources sheet's files, in the page's language: each SSA table the facts cite, as its archived topic page
 * (data/methodology/source-archives/social-protection.csv) under the table's own id, the Pension Fund's six documents (the funded
 * pension page's), and Geostat's population table (shares of residents) and price index (2025 prices) from the Population and
 * Inflation archives.
 */
export async function loadSocialWorkbookSources(locale: Locale): Promise<{ ssa: SourcedWorkbookPublicSource[]; pensionFund: SourcedWorkbookPublicSource[]; population: WorkbookPublicSource[]; cpi: WorkbookPublicSource[] }> {
  const cpiId = locale === "ka" ? "source.geostat_cpi_index_2010_ka" : "source.geostat_cpi_index_2010";
  const [pages, population, cpi] = await Promise.all([
    loadSourcedWorkbookSources("social-protection", locale, row => row.source_id.startsWith("ssa_") || row.source_id.startsWith("pension_fund_")),
    loadSourcedWorkbookSources("demography", locale, row => row.source_id === SOURCE_ID.populationUnits),
    loadSourcedWorkbookSources("inflation", locale, row => row.source_id === cpiId),
  ]);
  // Each SSA table is cited by its topic's archived page; a Pension Fund document is archived under its own id. The two lists stay apart so
  // an SSA workbook is never offered the Pension Fund's PDFs, and a funded pension workbook none of SSA's pages.
  const sourced = (sourceIds: readonly string[], what: string) => sourceIds.map(sourceId => {
    const page = pages.find(row => row.sourceId === socialArchiveSourceId(sourceId));
    if (!page) throw new Error(`No archived ${what} for ${sourceId}`);
    return { ...page, sourceId };
  });
  return {
    ssa: sourced(SOCIAL_PUBLIC_SOURCES.filter(sourceId => !FUNDED_PENSION_SOURCES.includes(sourceId)), "SSA page"),
    pensionFund: sourced(FUNDED_PENSION_SOURCES, "Pension Fund document"), population, cpi,
  };
}

/** The headings a set's pages list, named in the page's language: the measures the Dataset markup says the page shows. */
function headingNames(messages: Messages, set: SocialPlaceSet): string[] {
  return [...new Set(socialPlaceSeries(set).map(({ heading }) => message(messages, `social.heading.${heading}`)))];
}

/** The latest served fact of a place's series. */
function latestOf(facts: readonly ClientSocialFact[], indicatorId: string, placeId: string): ClientSocialFact {
  const latest = facts.filter(f => f.indicatorId === indicatorId && f.geographyId === placeId).sort((a, b) => a.year - b.year).at(-1);
  if (!latest) throw new Error(`No ${indicatorId} facts for ${placeId}`);
  return latest;
}

/** A count as the latest lines print it: whole persons or families. */
const countLabel = (fact: ClientSocialFact) => formatInUnit(fact.value, UNIT_PERSONS);
/** A share of residents as the map, the list and the picker print it: per 100, as a percent to one decimal. */
const shareLabel = (perHundred: number) => formatShare(perHundred / 100);

/** The source note's link to the methodology page. */
function methodologyLink(messages: Messages, locale: Locale) {
  return <Link href={pageHref(METHODOLOGY_PATH, locale)} prefetch={false} className="underline underline-offset-2">{message(messages, "social.methodology")}</Link>;
}

/** The breadcrumb trail down to a set's index: Home, Data, the Health and social protection hub. */
function hubCrumbs(messages: Messages, locale: Locale) {
  return [
    { label: message(messages, "common.home"), href: pageHref("/", locale) },
    { label: message(messages, "common.data") },
    { label: message(messages, "common.health"), href: pageHref(HEALTH_HUB_PATH, locale) },
  ];
}

export async function socialIndexMetadata(locale: Locale, set: SocialPlaceSet) {
  const messages = await getMessages(locale, ["social"]);
  return fiscalMetadata({ locale, path: socialPlaceBase(set), title: message(messages, `social.page.${set}.metaTitle`), description: message(messages, `social.page.${set}.summary`) });
}

/** A set's index: the one latest line, then the municipality map and the ranked list whose rows open the place pages. */
export async function renderSocialIndexPage(locale: Locale, set: SocialPlaceSet) {
  const { facts, population, cpi, municipal, presentation, places, lastReviewedAt } = await loadSocialPlaceBasics(locale);
  const { messages } = presentation;
  const t = (key: string, values?: TemplateValues) => message(messages, `social.${key}`, values);
  const index = buildSocialIndexModel(set, facts, population, municipal.regions, municipal.municipalities);
  const base = socialPlaceBase(set);
  const georgia = places.find(candidate => candidate.id === GEORGIA_PLACE_ID)!;
  const headline = latestOf(facts, socialPlaceDefaultSelection(set)[0], SOCIAL_GEORGIA);
  const { min, max } = socialPlaceCoverage(set, SOCIAL_GEORGIA, socialPlaceFacts(set, SOCIAL_GEORGIA, facts, { population, cpi }));
  const title = t(`page.${set}.title`);
  // The map's measure is the set's first share of residents.
  const measure = t(`series.${socialPlaceSeries(set).find(series => series.calculated === "share")!.id}`);
  const crumbs = [...hubCrumbs(messages, locale), { label: title }];
  return (
    <I18nProvider {...clientPresentation(presentation)}>
      {/* The index is the set's dataset; each place page is a slice of it. */}
      <JsonLd testId="explorer-dataset-json-ld" data={explorerDatasetJsonLd({
        locale, origin: resolveSiteUrl(), path: base, datasetId: "social-protection", name: title, description: t(`page.${set}.summary`),
        firstYear: min, lastYear: max, dateModified: lastReviewedAt, variableMeasured: headingNames(messages, set),
      })} />
      <BreadcrumbJsonLd items={[
        { name: crumbs[0].label, path: pageHref("/", locale) },
        { name: crumbs[2].label, path: pageHref(HEALTH_HUB_PATH, locale) },
        { name: title, path: pageHref(base, locale) },
      ]} />
      <ExplorerPage testId="explorer-shell">
        <PageHeader locale={locale} messages={messages} crumbs={crumbs} coverage={coverageLabel(messages, locale, min, max, lastReviewedAt)} />
        <ExplorerHeading>{title}</ExplorerHeading>
        <LatestValueLine testId="social-latest" sentence={<Message messages={messages} id={`social.latest.${set}`} values={{ period: headline.year, value: <LatestFigure value={countLabel(headline)} /> }} />} />
        <section data-testid={`social-index-${set}`} className="mt-4">
          <MunicipalitiesIndex
            share={{ title, caption: t(`mapLegend.${set}`, { year: index.year }), source: t(`sourceNote.${set}`), period: String(index.year) }}
            viewBox={index.map.viewBox}
            shapes={index.map.shapes}
            markers={index.map.markers}
            occupiedAreas={index.map.occupiedAreas}
            touchTargets={index.map.touchTargets}
            legendMin={shareLabel(index.map.legendMinPerResidentGel)}
            legendMax={shareLabel(index.map.legendMaxPerResidentGel)}
            municipalities={index.municipalities}
            regions={index.regions}
            country={index.country}
            kpis={[]}
            sourceNote={<>{t(`sourceNote.${set}`)} · {index.year} · {methodologyLink(messages, locale)}.</>}
            overrides={{
              hrefById: placeHrefById(base, places),
              valueFormat: "percent",
              countrySubtitle: message(messages, "municipal.members", { count: georgia.municipalityCount }),
              unitLabel: t("unitPercent"),
              mapWording: { groupAria: t("mapAria", { measure, year: index.year }), legendCaption: t(`mapLegend.${set}`, { year: index.year }) },
            }}
          />
        </section>
      </ExplorerPage>
    </I18nProvider>
  );
}

export async function socialPlaceMetadata(route: SocialPlaceRoute, locale: Locale, set: SocialPlaceSet) {
  const { presentation, places } = await loadSocialPlaceBasics(locale);
  const place = places.find(candidate => candidate.id === placeIdForRoute(route));
  if (!place) notFound();
  const values = { section: message(presentation.messages, `social.page.${set}.title`), place: placeLabel(place, locale) };
  return fiscalMetadata({
    locale,
    path: placePageHref(socialPlaceBase(set), place.id),
    title: message(presentation.messages, "social.place.metaTitle", values),
    description: message(presentation.messages, "social.place.metaDescription", values),
  });
}

/** A place's page: the heading with the picker and its latest line, the chart workspace and, on a region's page, its municipalities. */
export async function renderSocialPlacePage(route: SocialPlaceRoute, locale: Locale, set: SocialPlaceSet) {
  const [{ facts, breaks, population, cpi, municipal, presentation, places, lastReviewedAt }, sources] = await Promise.all([loadSocialPlaceBasics(locale), loadSocialWorkbookSources(locale)]);
  const place = places.find(candidate => candidate.id === placeIdForRoute(route));
  if (!place) notFound();
  const { messages } = presentation;
  const t = (key: string, values?: TemplateValues) => message(messages, `social.${key}`, values);
  const base = socialPlaceBase(set);
  const href = (target: DemographyPlace) => pageHref(placePageHref(base, target.id), locale);
  const index = buildSocialIndexModel(set, facts, population, municipal.regions, municipal.municipalities);
  const series = socialPlaceSeries(set);
  const placeFacts = facts.filter(f => f.geographyId === place.id && series.some(({ id }) => id === f.indicatorId));
  const placePopulation = population.filter(row => row.geographyId === place.id);
  const headline = latestOf(placeFacts, socialPlaceDefaultSelection(set)[0], place.id);
  const name = placeLabel(place, locale);
  const { min, max } = socialPlaceCoverage(set, place.id, socialPlaceFacts(set, place.id, placeFacts, { population: placePopulation, cpi }));
  const sectionTitle = t(`page.${set}.title`);
  const region = place.regionId === null ? null : places.find(candidate => candidate.id === place.regionId)!;
  const crumbs = [
    ...hubCrumbs(messages, locale),
    { label: sectionTitle, href: pageHref(base, locale) },
    ...(region ? [{ label: placeLabel(region, locale), href: href(region) }] : []),
    { label: name },
  ];
  const neighbours = placeNeighbours(place, places);
  const navigation = neighbours
    ? {
        prev: { label: placeLabel(neighbours.prev, locale), href: href(neighbours.prev) },
        next: { label: placeLabel(neighbours.next, locale), href: href(neighbours.next) },
      }
    : undefined;
  const georgia = places.find(candidate => candidate.id === GEORGIA_PLACE_ID)!;
  // A region lists its municipalities ranked by the index's share of residents; Tbilisi is its own one municipality and lists none.
  const memberRows = place.level === "region" && place.id !== TBILISI_PLACE_ID
    ? index.municipalities.filter(row => row.regionId === place.id).map((row, position) => {
        const member = places.find(candidate => candidate.id === row.id)!;
        return { id: row.id, href: href(member), rank: position + 1, label: placeLabel(member, locale), value: shareLabel(row.valueGel) };
      })
    : [];
  const pageValues = { section: sectionTitle, place: name };
  return (
    <I18nProvider {...clientPresentation(presentation)}>
      <JsonLd testId="explorer-dataset-json-ld" data={explorerDatasetJsonLd({
        locale, origin: resolveSiteUrl(), path: placePageHref(base, place.id), datasetId: "social-protection",
        name: t("place.metaTitle", pageValues), description: t("place.metaDescription", pageValues),
        firstYear: min, lastYear: max, dateModified: lastReviewedAt, variableMeasured: headingNames(messages, set),
        spatialCoverageName: name, withinGeorgia: place.id !== GEORGIA_PLACE_ID, partOf: { path: base, name: sectionTitle, description: t(`page.${set}.summary`) },
      })} />
      <BreadcrumbJsonLd items={[
        { name: crumbs[0].label, path: pageHref("/", locale) },
        { name: crumbs[2].label, path: pageHref(HEALTH_HUB_PATH, locale) },
        { name: sectionTitle, path: pageHref(base, locale) },
        ...(region ? [{ name: placeLabel(region, locale), path: href(region) }] : []),
        { name, path: href(place) },
      ]} />
      <ExplorerPage testId="explorer-shell">
        <PageHeader locale={locale} messages={messages} crumbs={crumbs} coverage={coverageLabel(messages, locale, min, max, lastReviewedAt)} />
        <SocialPlaceExplorer
          key={place.id}
          set={set}
          place={place}
          facts={placeFacts}
          population={placePopulation}
          cpi={cpi}
          breaks={breaks}
          labels={Object.fromEntries(series.map(({ id }) => [id, t(`series.${id}`)]))}
          headingLabels={Object.fromEntries(series.map(({ heading }) => [heading, t(`heading.${heading}`)]))}
          title={t(`place.headingLead.${set}`)}
          metaLine={<Message messages={messages} id={`social.latest.place.${set}`} values={{ period: headline.year, value: <LatestFigure value={countLabel(headline)} /> }} />}
          navigation={navigation}
          pickerCountry={buildPickerCountry(index.country.valueGel, georgia.municipalityCount)}
          pickerGroups={pickerGroupsFromRows(index)}
          pickerOverrides={{
            hrefById: placeHrefById(base, places),
            valueFormat: "percent",
            countryDetail: `${shareLabel(index.country.valueGel)} · ${message(messages, "municipal.members", { count: georgia.municipalityCount })}`,
          }}
          sources={sources.ssa}
          populationSources={sources.population}
          cpiSources={sources.cpi}
          siteOrigin={resolveSiteUrl()}
          workbookScope={workbookScopeFor(route)}
          lastReviewedAt={lastReviewedAt}
        >
          {memberRows.length > 0 ? <EntityMemberList heading={message(messages, "municipal.regionMembers")} rows={memberRows} /> : null}
        </SocialPlaceExplorer>
      </ExplorerPage>
    </I18nProvider>
  );
}
