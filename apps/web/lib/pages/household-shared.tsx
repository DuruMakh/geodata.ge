import type { ReactNode } from "react";
import { ExplorerPage } from "../../components/explorer-shell/explorer-page";
import { PageHeader } from "../../components/shell/page-header";
import { JsonLd } from "../../components/seo/json-ld";
import { BreadcrumbJsonLd } from "../../components/seo/breadcrumb-json-ld";
import { loadServedHouseholdData, toClientHouseholdFact } from "../data/household/importHousehold";
import type { ClientHouseholdFact, HouseholdArea } from "../data/household/types";
import { HOUSEHOLD_PAGE_AREAS, HOUSEHOLD_SECTIONS, householdCoverage, householdRegionHref, type HouseholdSectionId } from "../explorer/household";
import { householdAreaLabels, householdLabels, householdPageFilter } from "../explorer/householdPageData";
import { isHouseholdWorkbookSource } from "../explorer/householdWorkbook";
import { coverageLabel } from "../explorer/coverageLabel";
import { I18nProvider } from "../i18n/provider";
import { clientPresentation, getPresentation } from "../i18n/presentation.server";
import { getMessages } from "../i18n/messages.server";
import { message } from "../i18n/messages";
import { pageHref } from "../i18n/routes";
import type { Locale } from "../i18n/types";
import { loadSourcedWorkbookSources, type SourcedWorkbookPublicSource } from "../methodology/workbookSources";
import { fiscalMetadata } from "../seo/metadata";
import { explorerDatasetJsonLd } from "../seo/structuredData";
import { resolveSiteUrl } from "../siteUrl";
import { topicSection, ALL_DATA_PATH } from "../navigation/navTree";

// Shared by the household page modules. The index and the area pages are separate
// modules, so the index ships no explorer: keep explorer components out of this file.

export async function householdPageMetadata(locale: Locale, section: HouseholdSectionId) {
  const messages = await getMessages(locale, ["household"]);
  return fiscalMetadata({ locale, path: HOUSEHOLD_SECTIONS.find(item => item.id === section)!.href, title: message(messages, `household.page.${section}.metaTitle`), description: message(messages, `household.page.${section}.summary`) });
}

type HouseholdPageBody = {
  facts: ClientHouseholdFact[];
  labels: Record<string, string>;
  areaLabels: Record<HouseholdArea, string>;
  sources: SourcedWorkbookPublicSource[];
  origin: string;
};

/** A section's index page (household-index.tsx), or with regionId that area's page (household.tsx): the frame both share, around the page's own body. */
export async function renderHouseholdPage(locale: Locale, section: HouseholdSectionId, regionId: HouseholdArea | undefined, body: (page: HouseholdPageBody) => ReactNode) {
  const [data, presentation, sources] = await Promise.all([
    loadServedHouseholdData(), getPresentation(locale, ["household", "regionalEconomies", "format", "main", "workbook"], HOUSEHOLD_PAGE_AREAS, HOUSEHOLD_PAGE_AREAS),
    loadSourcedWorkbookSources("household-income", locale, isHouseholdWorkbookSource),
  ]);
  // Each page reads only its own section's observations, and an area page only its lines' (Georgia's include towns and villages).
  const onPage = householdPageFilter(section, regionId);
  const facts = data.facts.map(toClientHouseholdFact).filter(onPage);
  const years = householdCoverage(section, regionId ?? "georgia", "per_household", facts).years;
  const firstYear = years[0], lastYear = years.at(-1)!;
  const sectionHref = HOUSEHOLD_SECTIONS.find(item => item.id === section)!.href;
  const href = regionId ? householdRegionHref(section, regionId) : sectionHref;
  const t = (key: string, values?: Record<string, string>) => message(presentation.messages, `household.${key}`, values);
  // Line names; the towns and villages lines take their names from areaLabels.
  const labels = householdLabels(presentation, section);
  const areaLabels = householdAreaLabels(presentation);
  const regionName = regionId ? areaLabels[regionId] : "", sectionTitle = t(`page.${section}.title`);
  const title = regionId ? t(`page.${section}.regionTitle`, { region: regionName }) : sectionTitle;
  const description = regionId ? t(`page.${section}.regionSummary`, { region: regionName }) : t(`page.${section}.summary`), hubTitle = message(presentation.messages, "common.livingStandards");
  const lastReviewedAt = data.facts.filter(onPage).map(f => f.lastReviewedAt).sort().at(-1)!, origin = resolveSiteUrl();
  const crumbs = [{ label: message(presentation.messages, "common.home"), href: pageHref("/", locale) }, { label: message(presentation.messages, "common.data"), href: pageHref(ALL_DATA_PATH, locale) }, { label: hubTitle, href: pageHref(topicSection("living-standards").href, locale) }, ...(regionId ? [{ label: sectionTitle, href: pageHref(sectionHref, locale) }] : []), { label: regionId ? regionName : title }];
  return <I18nProvider {...clientPresentation(presentation)}>
    <JsonLd testId="explorer-dataset-json-ld" data={explorerDatasetJsonLd({
      locale, origin, path: href, datasetId: "household-income", name: title, description, firstYear, lastYear, dateModified: lastReviewedAt,
      // An area page is a slice of its section's dataset.
      ...(regionId ? { spatialCoverageName: regionName, withinGeorgia: regionId !== "georgia", partOf: { path: sectionHref, name: sectionTitle, description: t(`page.${section}.summary`) } } : {}),
      variableMeasured: Object.values(labels),
    })} />
    <BreadcrumbJsonLd items={[{ name: crumbs[0].label, path: pageHref("/", locale) }, { name: message(presentation.messages, "common.data"), path: pageHref(ALL_DATA_PATH, locale) }, { name: hubTitle, path: pageHref(topicSection("living-standards").path, locale) }, ...(regionId ? [{ name: sectionTitle, path: pageHref(sectionHref, locale) }] : []), { name: title, path: pageHref(href, locale) }]} />
    <ExplorerPage containerQueries={false}>
      <PageHeader locale={locale} messages={presentation.messages} crumbs={crumbs} coverage={coverageLabel(presentation.messages, locale, firstYear, lastYear, lastReviewedAt)} />
      {body({ facts, labels, areaLabels, sources, origin })}
    </ExplorerPage>
  </I18nProvider>;
}
