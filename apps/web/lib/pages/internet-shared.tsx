import { loadServedInternetData } from "../data/internet/importInternet";
import { INTERNET_SOURCES, type InternetFact } from "../data/internet/types";
import { INTERNET_HUB_PATH } from "../explorer/internet";
import { INTERNET_AREAS, INTERNET_HOMES_HREF, internetAreaHref, internetAreaSeries, internetAreaSlug, internetMapId, type InternetArea } from "../explorer/internetAreas";
import { regionAreaFrame, type RegionAreaBody } from "./region-area-frame";

// Shared by the internet page modules: the Internet at home index and the area pages share the frame in
// region-area-frame.tsx. Only the ten tables the values are read from are listed on a workbook's Sources sheet.

export const {
  areaPages: AREA_PAGES, areaStaticParams: internetAreaStaticParams, areaForSlug, indexPageMetadata: internetHomesPageMetadata,
  areaPageMetadata: internetAreaPageMetadata, loadWorkbookSources: loadInternetWorkbookSources, renderFrame: renderInternetHomesFrame,
} = regionAreaFrame<InternetArea, InternetFact>({
  hub: "internet", hubPath: INTERNET_HUB_PATH, indexHref: INTERNET_HOMES_HREF, indexKey: "homes",
  areas: INTERNET_AREAS, areaSlug: internetAreaSlug, areaHref: internetAreaHref, mapId: internetMapId,
  areaHeadingIds: area => internetAreaSeries(area).map(series => series.heading),
  load: loadServedInternetData, sourceIds: INTERNET_SOURCES,
});

export type InternetHomesBody = RegionAreaBody<InternetArea, InternetFact>;
