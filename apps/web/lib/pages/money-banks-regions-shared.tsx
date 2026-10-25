import { loadServedMoneyBanksData } from "../data/moneyBanks/importMoneyBanks";
import { MONEY_BANKS_LOAN_AREAS, type MoneyBanksFact } from "../data/moneyBanks/types";
import { MONEY_BANKS_REGIONS_HREF, moneyBanksAreaHref, moneyBanksAreaSlug, moneyBanksMapId, type MoneyBanksArea } from "../explorer/moneyBanksAreas";
import { regionAreaFrame, type RegionAreaBody } from "./region-area-frame";

// Shared by the Loans by region page modules: the index and the area pages share the frame in region-area-frame.tsx.
// Only NBG's loans by region workbook, which the values are read from, is listed on a workbook's Sources sheet.

export const {
  areaPages: AREA_PAGES, areaStaticParams: moneyBanksAreaStaticParams, areaForSlug, indexPageMetadata: moneyBanksRegionsPageMetadata,
  areaPageMetadata: moneyBanksAreaPageMetadata, loadWorkbookSources: loadMoneyBanksRegionsWorkbookSources, renderFrame: renderMoneyBanksRegionsFrame,
} = regionAreaFrame<MoneyBanksArea, MoneyBanksFact>({
  hub: "moneyBanks", indexHref: MONEY_BANKS_REGIONS_HREF, indexKey: "regions",
  areas: MONEY_BANKS_LOAN_AREAS, areaSlug: moneyBanksAreaSlug, areaHref: moneyBanksAreaHref, mapId: moneyBanksMapId,
  areaHeadingIds: () => ["area"],
  load: loadServedMoneyBanksData, sourceIds: ["nbg_loans_regions_lreg"],
});

export type MoneyBanksRegionsBody = RegionAreaBody<MoneyBanksArea, MoneyBanksFact>;
