import { loadServedHousingData } from "../data/housing/importHousing";
import { HOUSING_SOURCES, type HousingFact } from "../data/housing/types";
import { HOUSING_AREAS, HOUSING_REGIONS_HREF, housingAreaHref, housingAreaSeries, housingAreaSlug, housingMapId, type HousingArea } from "../explorer/housingAreas";
import { regionAreaFrame, type RegionAreaBody } from "./region-area-frame";

// Shared by the housing page modules: the Regions index and the area pages share the frame in region-area-frame.tsx.
// Only the six workbooks the values are read from are listed on a workbook's Sources sheet, not the files kept for
// reference (the spreadsheet default would drop Geostat's `.xls` files).

export const {
  areaPages: AREA_PAGES, areaStaticParams: housingAreaStaticParams, areaForSlug, indexPageMetadata: housingRegionsPageMetadata,
  areaPageMetadata: housingAreaPageMetadata, loadWorkbookSources: loadHousingWorkbookSources, renderFrame: renderHousingRegionsFrame,
} = regionAreaFrame<HousingArea, HousingFact>({
  hub: "housing", indexHref: HOUSING_REGIONS_HREF, indexKey: "regions",
  areas: HOUSING_AREAS, areaSlug: housingAreaSlug, areaHref: housingAreaHref, mapId: housingMapId,
  areaHeadingIds: area => housingAreaSeries(area).map(series => series.heading),
  load: loadServedHousingData, sourceIds: HOUSING_SOURCES,
});

export type HousingRegionsBody = RegionAreaBody<HousingArea, HousingFact>;
