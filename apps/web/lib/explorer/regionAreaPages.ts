import type { MunicipalRegion } from "../data/municipal/types";
import { REGIONAL_ECONOMY_REGIONS } from "../data/regionalEconomies/importRegionalEconomies";
import { publicLabel } from "../i18n/labels";
import { message } from "../i18n/messages";
import type { Presentation } from "../i18n/types";

/*
 * The areas of a hub whose Regions index opens one page for Georgia and each region (Business, Housing, Transport,
 * Internet, Loans by region) and their names. Shared by the pages (lib/pages/region-area-frame.tsx,
 * business-regions.tsx) and the MCP snapshot build (lib/factQuery/topics/), which cannot import the pages (they pull in
 * `server-only` and React).
 */

/** Georgia and the eleven regions, in the picker's and previous/next order; Georgia's English name is the catalogue's `georgia` label. */
export function regionAreaPages<Area extends string>(areas: readonly Area[], mapId: (area: Area) => string): readonly MunicipalRegion[] {
  return areas.map(area => area === "georgia" ? { id: area, kaLabel: "საქართველო", sortOrder: 0 } : REGIONAL_ECONOMY_REGIONS.find(region => region.id === mapId(area))!);
}

/** Names of Georgia (`<hub>.area.georgia`) and the regions, in the page's language; region names are the shared region labels. */
export function regionAreaLabels<Area extends string>(presentation: Presentation, hub: string, areas: readonly Area[], areaPages: readonly MunicipalRegion[]): Record<Area, string> {
  return Object.fromEntries(areas.map((area, index) => [area, area === "georgia" ? message(presentation.messages, `${hub}.area.georgia`)
    : publicLabel(presentation.locale, areaPages[index].id, areaPages[index].kaLabel, presentation.englishLabels)])) as Record<Area, string>;
}
