import { notFound } from "next/navigation";
import { HouseholdExplorer } from "../../components/household/household-explorer";
import { packFacts } from "../data/packedFacts";
import type { HouseholdArea } from "../data/household/types";
import type { MunicipalRegion } from "../data/municipal/types";
import { REGIONAL_ECONOMY_REGIONS } from "../data/regionalEconomies/importRegionalEconomies";
import { HOUSEHOLD_PAGE_AREAS, householdRegionHref, type HouseholdSectionId } from "../explorer/household";
import { getPresentation } from "../i18n/presentation.server";
import { message } from "../i18n/messages";
import { publicLabel } from "../i18n/labels";
import type { Locale } from "../i18n/types";
import { fiscalMetadata } from "../seo/metadata";
import { renderHouseholdPage } from "./household-shared";

/** Georgia and the eleven regions, in the picker's and previous/next order; Georgia's English name is the catalogue's `georgia` label. */
const AREA_PAGES: readonly MunicipalRegion[] = HOUSEHOLD_PAGE_AREAS.map(id => id === "georgia" ? { id, kaLabel: "საქართველო", sortOrder: 0 } : REGIONAL_ECONOMY_REGIONS.find(region => region.id === id)!);
export const householdRegionStaticParams = () => HOUSEHOLD_PAGE_AREAS.map(id => ({ id: id.replace(/^region\./, "") }));
function regionForSlug(slug: string) {
  const area = AREA_PAGES.find(item => item.id === (slug === "georgia" ? slug : `region.${slug}`));
  if (!area) notFound();
  return area;
}
export async function householdRegionPageMetadata(section: HouseholdSectionId, slug: string, locale: Locale) {
  const region = regionForSlug(slug), presentation = await getPresentation(locale, ["household"], [region.id]);
  const name = publicLabel(locale, region.id, region.kaLabel, presentation.englishLabels);
  return fiscalMetadata({ locale, path: householdRegionHref(section, region.id), title: message(presentation.messages, `household.page.${section}.regionTitle`, { region: name }), description: message(presentation.messages, `household.page.${section}.regionSummary`, { region: name }) });
}
export function renderHouseholdRegionPage(section: HouseholdSectionId, slug: string, locale: Locale) {
  const area = regionForSlug(slug).id as HouseholdArea;
  return renderHouseholdPage(locale, section, area, ({ facts, labels, areaLabels, sources, origin }) =>
    <HouseholdExplorer key={area} section={section} facts={packFacts(facts)} labels={labels} areaLabels={areaLabels} sources={sources} siteOrigin={origin} area={area} areas={AREA_PAGES} />);
}
