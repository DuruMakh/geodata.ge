import { loadServedTransportData } from "../data/transport/importTransport";
import { TRANSPORT_SOURCES, type TransportFact } from "../data/transport/types";
import { TRANSPORT_HUB_PATH } from "../explorer/transport";
import { TRANSPORT_AREAS, TRANSPORT_REGIONS_HREF, transportAreaHref, transportAreaSeries, transportAreaSlug, transportMapId, type TransportArea } from "../explorer/transportAreas";
import { regionAreaFrame, type RegionAreaBody } from "./region-area-frame";

// Shared by the transport page modules: the Regions index and the area pages share the frame in region-area-frame.tsx.
// Only the thirteen workbooks the values are read from are listed on a workbook's Sources sheet, not the files kept for
// reference (the spreadsheet default would drop Geostat's `.xls` files).

export const {
  areaPages: AREA_PAGES, areaStaticParams: transportAreaStaticParams, areaForSlug, indexPageMetadata: transportRegionsPageMetadata,
  areaPageMetadata: transportAreaPageMetadata, loadWorkbookSources: loadTransportWorkbookSources, renderFrame: renderTransportRegionsFrame,
} = regionAreaFrame<TransportArea, TransportFact>({
  hub: "transport", hubPath: TRANSPORT_HUB_PATH, indexHref: TRANSPORT_REGIONS_HREF, indexKey: "regions",
  areas: TRANSPORT_AREAS, areaSlug: transportAreaSlug, areaHref: transportAreaHref, mapId: transportMapId,
  areaHeadingIds: area => transportAreaSeries(area).map(series => series.heading),
  load: loadServedTransportData, sourceIds: TRANSPORT_SOURCES,
});

export type TransportRegionsBody = RegionAreaBody<TransportArea, TransportFact>;
