import Link from "next/link";
import { notFound } from "next/navigation";
import { EducationPlaceExplorer, type EducationPlaceExplorerProps } from "../../components/education/education-place-explorer";
import { ExplorerHeading } from "../../components/explorer-shell/explorer-heading";
import { ExplorerPage } from "../../components/explorer-shell/explorer-page";
import { LatestFigure, LatestValueLine } from "../../components/explorer-shell/latest-value-line";
import { EntityMemberList } from "../../components/municipalities/entity-member-list";
import { MunicipalitiesIndex } from "../../components/municipalities/municipalities-index";
import { BreadcrumbJsonLd } from "../../components/seo/breadcrumb-json-ld";
import { PageHeader } from "../../components/shell/page-header";
import { loadServedEducationData, shownEducationFacts, toClientEducationFact } from "../data/education/importEducation";
import { EDUCATION_GEORGIA, educationIndicator, type ClientEducationFact } from "../data/education/types";
import { loadServedMunicipalData } from "../data/servedData";
import { coverageLabel } from "../explorer/coverageLabel";
import { GEORGIA_PLACE_ID, TBILISI_PLACE_ID, buildDemographyPlaces, placeLabel, type DemographyPlace } from "../explorer/demographyAreas";
import { placeHrefById, placeNeighbours, placePageHref, populationMunicipalityCodeForSlug, populationMunicipalitySlugs } from "../explorer/demographyPlaceRoutes";
import { EDUCATION_HUB_PATH, educationCountLabel, educationPeriodLabel, educationSeriesLabel } from "../explorer/education";
import { buildEducationIndexModel, educationPlaceBase, educationPlaceCoverage, educationPlaceDefaultSelection, educationPlaceSeries, type EducationPlaceSet } from "../explorer/educationPlaces";
import { formatInUnit, UNIT_PERSONS } from "../explorer/format";
import { buildPickerCountry, pickerGroupsFromRows } from "../explorer/municipalData";
import { Message } from "../i18n/message";
import { message } from "../i18n/messages";
import { getMessages } from "../i18n/messages.server";
import { clientPresentation, getPresentation } from "../i18n/presentation.server";
import { I18nProvider } from "../i18n/provider";
import { pageHref } from "../i18n/routes";
import type { Locale, Messages, TemplateValues } from "../i18n/types";
import { fiscalMetadata } from "../seo/metadata";
import { resolveSiteUrl } from "../siteUrl";
import type { PopulationPlaceRoute } from "./demography-population-place";

/** The same three kinds of place page as Population: Georgia, a region by id, a municipality by its Budget slug. */
export type EducationPlaceRoute = PopulationPlaceRoute;

export async function educationRegionParams() {
  const { regions } = await loadServedMunicipalData();
  return regions.map(region => ({ id: region.id.replace("region.", "") }));
}

export function educationMunicipalityParams() {
  return populationMunicipalitySlugs().map(slug => ({ slug }));
}

/** The place a route names, or null: Georgia, `region.{id}`, or the municipality behind a slug (never Tbilisi's). */
function placeIdFor(route: EducationPlaceRoute): string | null {
  if (route.kind === "country") return GEORGIA_PLACE_ID;
  if (route.kind === "region") return `region.${route.id}`;
  return populationMunicipalityCodeForSlug(route.slug);
}

function workbookScopeFor(route: EducationPlaceRoute): string {
  if (route.kind === "country") return "georgia";
  return route.kind === "region" ? route.id : route.slug;
}

/** What the index and the place pages share: the shown facts, the registries, the language and the place list. */
async function loadEducationPlaceBasics(locale: Locale) {
  const [{ facts: served }, municipal, georgian] = await Promise.all([loadServedEducationData(), loadServedMunicipalData(), getMessages("ka", ["municipal"])]);
  const shown = shownEducationFacts(served);
  const ids = [GEORGIA_PLACE_ID, ...municipal.regions.map(region => region.id), ...municipal.municipalities.map(m => m.code)];
  // `municipal` is loaded for the map's and the picker's words (tabs, search, boundaries, member counts).
  const presentation = await getPresentation(locale, ["education", "format", "main", "workbook", "municipal"], ids, ids);
  const places = buildDemographyPlaces({
    regions: municipal.regions, municipalities: municipal.municipalities, englishLabels: presentation.englishLabels, georgiaNameKa: message(georgian, "municipal.georgia"),
  });
  const lastReviewedAt = shown.map(f => f.lastReviewedAt).sort().at(-1)!;
  return { facts: shown.map(toClientEducationFact), municipal, presentation, places, lastReviewedAt };
}

/** The latest fact of a place's series. */
function latestOf(facts: readonly ClientEducationFact[], indicatorId: string, placeId: string): ClientEducationFact {
  const latest = facts.filter(f => f.indicatorId === indicatorId && f.geographyId === placeId).sort((a, b) => a.year - b.year).at(-1);
  if (!latest) throw new Error(`No ${indicatorId} facts for ${placeId}`);
  return latest;
}

/** The figure a latest line or a Georgia row prints: Georgia's pupils in thousands, every other count whole. */
const countLabel = (messages: Messages, fact: ClientEducationFact) => educationCountLabel(fact, message(messages, "education.unitThousand"));

/** The source note's link to the methodology page. */
function methodologyLink(messages: Messages, locale: Locale) {
  return <Link href={pageHref("/methodology/education", locale)} prefetch={false} className="underline underline-offset-2">{message(messages, "education.methodology")}</Link>;
}

/** The years a place's list covers, in the set's labels. */
function placeCoverage(set: EducationPlaceSet, placeId: string, facts: readonly ClientEducationFact[]) {
  const { min, max } = educationPlaceCoverage(set, placeId, facts);
  const period = educationPeriodLabel(set);
  return { first: period(min), last: period(max) };
}

export async function educationIndexMetadata(locale: Locale, set: EducationPlaceSet) {
  const messages = await getMessages(locale, ["education"]);
  return fiscalMetadata({ locale, path: educationPlaceBase(set), title: message(messages, `education.page.${set}.metaTitle`), description: message(messages, `education.page.${set}.summary`) });
}

/** A set's index: the one latest line, then the municipality map and the ranked list whose rows open the place pages. */
export async function renderEducationIndexPage(locale: Locale, set: EducationPlaceSet) {
  const { facts, municipal, presentation, places, lastReviewedAt } = await loadEducationPlaceBasics(locale);
  const { messages } = presentation;
  const t = (key: string, values?: TemplateValues) => message(messages, `education.${key}`, values);
  const index = buildEducationIndexModel(set, facts, municipal.regions, municipal.municipalities);
  const period = educationPeriodLabel(set);
  const base = educationPlaceBase(set);
  const georgia = places.find(candidate => candidate.id === GEORGIA_PLACE_ID)!;
  // Georgia's headline (national pupils, or kindergarten children) and the institutions counted in the same year.
  const headline = latestOf(facts, educationPlaceDefaultSelection(set, EDUCATION_GEORGIA)[0], EDUCATION_GEORGIA);
  const institutions = facts.find(f => f.indicatorId === educationIndicator(set === "schools" ? "schools" : "kindergartens", "total") && f.geographyId === EDUCATION_GEORGIA && f.year === headline.year);
  if (!institutions) throw new Error(`No ${headline.year} ${set} count for Georgia`);
  const figures = set === "schools" ? { pupils: headline, schools: institutions } : { children: headline, kindergartens: institutions };
  const country = facts.find(f => f.indicatorId === headline.indicatorId && f.geographyId === EDUCATION_GEORGIA && f.year === index.year)!;
  const { first, last } = placeCoverage(set, EDUCATION_GEORGIA, facts);
  const title = t(`page.${set}.title`);
  const measure = t(`heading.${educationPlaceSeries(set, EDUCATION_GEORGIA)[0].heading}`);
  const crumbs = [
    { label: message(messages, "common.home"), href: pageHref("/", locale) },
    { label: message(messages, "common.data") },
    { label: t("title"), href: pageHref(EDUCATION_HUB_PATH, locale) },
    { label: title },
  ];
  return (
    <I18nProvider {...clientPresentation(presentation)}>
      <BreadcrumbJsonLd items={[
        { name: crumbs[0].label, path: pageHref("/", locale) },
        { name: crumbs[2].label, path: pageHref(EDUCATION_HUB_PATH, locale) },
        { name: title, path: pageHref(base, locale) },
      ]} />
      <ExplorerPage testId="explorer-shell">
        <PageHeader locale={locale} messages={messages} crumbs={crumbs} coverage={coverageLabel(messages, locale, first, last, lastReviewedAt)} />
        <ExplorerHeading>{title}</ExplorerHeading>
        <LatestValueLine testId="education-latest" sentence={<Message messages={messages} id={`education.latest.${set}`} values={{
          period: period(headline.year),
          ...Object.fromEntries(Object.entries(figures).map(([key, fact]) => [key, <LatestFigure key={key} value={countLabel(messages, fact)} />])),
        }} />} />
        <section data-testid={`education-index-${set}`} className="mt-4">
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
            kpis={[]}
            sourceNote={<>{t(`sourceNote.${set}`)} · {period(index.year)} · {methodologyLink(messages, locale)}.</>}
            overrides={{
              hrefById: placeHrefById(base, places),
              valueFormat: "persons",
              valueLabelById: { [GEORGIA_PLACE_ID]: countLabel(messages, country) },
              countrySubtitle: message(messages, "municipal.members", { count: georgia.municipalityCount }),
              unitLabel: t("unitPersons"),
              mapWording: { groupAria: t("mapAria", { measure, year: period(index.year) }), legendCaption: t(`mapLegend.${set}`, { year: period(index.year) }) },
            }}
          />
        </section>
      </ExplorerPage>
    </I18nProvider>
  );
}

export async function educationPlaceMetadata(route: EducationPlaceRoute, locale: Locale, set: EducationPlaceSet) {
  const { presentation, places } = await loadEducationPlaceBasics(locale);
  const place = places.find(candidate => candidate.id === placeIdFor(route));
  if (!place) notFound();
  const values = { section: message(presentation.messages, `education.page.${set}.title`), place: placeLabel(place, locale) };
  return fiscalMetadata({
    locale,
    path: placePageHref(educationPlaceBase(set), place.id),
    title: message(presentation.messages, "education.place.metaTitle", values),
    description: message(presentation.messages, "education.place.metaDescription", values),
  });
}

/** A place's page: the heading with the picker and its latest line, the chart workspace and, on a region's page, its municipalities. */
export async function renderEducationPlacePage(route: EducationPlaceRoute, locale: Locale, set: EducationPlaceSet) {
  const { facts, municipal, presentation, places, lastReviewedAt } = await loadEducationPlaceBasics(locale);
  const place = places.find(candidate => candidate.id === placeIdFor(route));
  if (!place) notFound();
  const { messages } = presentation;
  const t = (key: string, values?: TemplateValues) => message(messages, `education.${key}`, values);
  const base = educationPlaceBase(set);
  const period = educationPeriodLabel(set);
  const href = (target: DemographyPlace) => pageHref(placePageHref(base, target.id), locale);
  const index = buildEducationIndexModel(set, facts, municipal.regions, municipal.municipalities);
  const series = educationPlaceSeries(set, place.id);
  const headline = latestOf(facts, series[0].id, place.id);
  const name = placeLabel(place, locale);
  const { first, last } = placeCoverage(set, place.id, facts);
  // The Excel Sources sheet lists the archived Geostat workbooks once the education methodology publishes them; until then it lists none.
  const sources: EducationPlaceExplorerProps["sources"] = [];
  const sectionTitle = t(`page.${set}.title`);
  const region = place.regionId === null ? null : places.find(candidate => candidate.id === place.regionId)!;
  const crumbs = [
    { label: message(messages, "common.home"), href: pageHref("/", locale) },
    { label: message(messages, "common.data") },
    { label: t("title"), href: pageHref(EDUCATION_HUB_PATH, locale) },
    { label: sectionTitle, href: pageHref(base, locale) },
    ...(region ? [{ label: placeLabel(region, locale), href: href(region) }] : []),
    { label: name },
  ];
  const neighbours = placeNeighbours(place, places);
  const navigation = neighbours
    ? {
        prev: { id: neighbours.prev.id, label: placeLabel(neighbours.prev, locale), href: href(neighbours.prev) },
        next: { id: neighbours.next.id, label: placeLabel(neighbours.next, locale), href: href(neighbours.next) },
      }
    : undefined;
  const georgia = places.find(candidate => candidate.id === GEORGIA_PLACE_ID)!;
  const country = facts.find(f => f.indicatorId === educationPlaceDefaultSelection(set, EDUCATION_GEORGIA)[0] && f.geographyId === EDUCATION_GEORGIA && f.year === index.year)!;
  // A region lists its municipalities ranked by the index's measure; Tbilisi is its own one municipality and lists none.
  const memberRows = place.level === "region" && place.id !== TBILISI_PLACE_ID
    ? index.municipalities.filter(row => row.regionId === place.id).map((row, position) => ({
        id: row.id, href: href(places.find(candidate => candidate.id === row.id)!), rank: position + 1,
        label: placeLabel(places.find(candidate => candidate.id === row.id)!, locale), value: formatInUnit(row.valueGel, UNIT_PERSONS),
      }))
    : [];
  return (
    <I18nProvider {...clientPresentation(presentation)}>
      <BreadcrumbJsonLd items={[
        { name: crumbs[0].label, path: pageHref("/", locale) },
        { name: crumbs[2].label, path: pageHref(EDUCATION_HUB_PATH, locale) },
        { name: sectionTitle, path: pageHref(base, locale) },
        ...(region ? [{ name: placeLabel(region, locale), path: href(region) }] : []),
        { name, path: href(place) },
      ]} />
      <ExplorerPage testId="explorer-shell">
        <PageHeader locale={locale} messages={messages} crumbs={crumbs} coverage={coverageLabel(messages, locale, first, last, lastReviewedAt)} />
        <EducationPlaceExplorer
          key={place.id}
          set={set}
          place={place}
          facts={facts.filter(f => f.geographyId === place.id)}
          labels={Object.fromEntries(series.map(({ id }) => [id, educationSeriesLabel(messages, id)]))}
          headingLabels={Object.fromEntries(series.map(({ heading }) => [heading, t(`heading.${heading}`)]))}
          title={t(`place.headingLead.${set}`)}
          metaLine={<Message messages={messages} id={`education.latest.place.${set}`} values={{ period: period(headline.year), value: <LatestFigure value={countLabel(messages, headline)} />, place: name }} />}
          navigation={navigation}
          pickerCountry={buildPickerCountry(index.country.valueGel, georgia.municipalityCount)}
          pickerGroups={pickerGroupsFromRows(index)}
          pickerOverrides={{
            hrefById: placeHrefById(base, places),
            valueFormat: "persons",
            countryDetail: `${countLabel(messages, country)} · ${message(messages, "municipal.members", { count: georgia.municipalityCount })}`,
          }}
          sources={sources}
          siteOrigin={resolveSiteUrl()}
          workbookScope={workbookScopeFor(route)}
          lastReviewedAt={lastReviewedAt}
        >
          {memberRows.length > 0 ? <EntityMemberList heading={message(messages, "municipal.regionMembers")} rows={memberRows} /> : null}
        </EducationPlaceExplorer>
      </ExplorerPage>
    </I18nProvider>
  );
}
