import { loadServedBusinessData, toClientBusinessFact } from "../../../data/business/importBusiness";
import { loadServedEnvironmentData, toClientEnvironmentFact } from "../../../data/environment/importEnvironment";
import { loadServedHousingData, toClientHousingFact } from "../../../data/housing/importHousing";
import { loadServedInternetData, toClientInternetFact } from "../../../data/internet/importInternet";
import { loadServedMoneyBanksData, toClientMoneyBanksFact } from "../../../data/moneyBanks/importMoneyBanks";
import { MONEY_BANKS_LOAN_AREAS, loansRegionIndicator } from "../../../data/moneyBanks/types";
import { loadServedScienceCultureData, toClientScienceCultureFact } from "../../../data/scienceCulture/importScienceCulture";
import { loadServedTransportData, toClientTransportFact } from "../../../data/transport/importTransport";
import { message } from "../../../i18n/messages";
import { getPresentation } from "../../../i18n/presentation.server";
import type { Locale } from "../../../i18n/types";
import { environmentLatest, environmentTranslate } from "../../../pages/environment-shared";
import { BUSINESS_AREAS, BUSINESS_REGIONS_HREF, businessAreaHref, businessAreaLatest, businessMapId } from "../../businessAreas";
import { GEORGIA_PLACE_ID } from "../../demographyAreas";
import { ENVIRONMENT_AREAS, environmentAreaIndexHref, environmentAreaRoutes, environmentAreaSeries, type EnvironmentAreaTopic } from "../../environmentAreas";
import { formatAmount, formatInUnit } from "../../format";
import { housingCount } from "../../housing";
import { HOUSING_AREAS, HOUSING_REGIONS_HREF, housingAreaHref, housingAreaLatest, housingMapId } from "../../housingAreas";
import { internetPercent } from "../../internet";
import { INTERNET_AREAS, INTERNET_HOMES_HREF, internetAreaHref, internetAreaLatest, internetMapId } from "../../internetAreas";
import { scienceCultureValueUnit } from "../../scienceCulture";
import { MONEY_BANKS_REGIONS_HREF, moneyBanksAreaHref, moneyBanksMapId } from "../../moneyBanksAreas";
import { MUSEUM_AREAS, MUSEUMS_HREF, museumAreaHref, museumAreaLatest, museumMapId } from "../../scienceCultureMuseums";
import { transportLatestValue } from "../../transport";
import { TRANSPORT_AREAS, TRANSPORT_REGIONS_HREF, transportAreaHref, transportAreaLatest, transportMapId } from "../../transportAreas";
import type { PlaceAdapter, PlaceEntry } from "../types";

type Latest = { value: string; number: number; year: number };

/**
 * Georgia's and the eleven regions' entries on one area-page family: each area's latest headline figure, as its page's line
 * states it. Areas are `georgia` and `region_<id>`; their map ids (`georgia`, `region.<id>`) are the place ids.
 */
function areaEntries<Area extends string>(page: string, areas: readonly Area[], href: (area: Area) => string, mapId: (area: Area) => string, latest: (area: Area) => Latest): PlaceEntry[] {
  return areas.map((area) => {
    const { value, number, year } = latest(area);
    const id = mapId(area);
    return { placeId: id === "georgia" ? GEORGIA_PLACE_ID : id, page, href: href(area), value, number, period: String(year) };
  });
}

async function business(locale: Locale): Promise<PlaceEntry[]> {
  const facts = (await loadServedBusinessData()).facts.map(toClientBusinessFact);
  return areaEntries(BUSINESS_REGIONS_HREF, BUSINESS_AREAS, businessAreaHref, businessMapId, (area) => {
    const fact = businessAreaLatest(area, facts);
    return { value: formatAmount(fact.value, locale), number: fact.value, year: fact.year };
  });
}

async function housing(): Promise<PlaceEntry[]> {
  const facts = (await loadServedHousingData()).facts.map(toClientHousingFact);
  return areaEntries(HOUSING_REGIONS_HREF, HOUSING_AREAS, housingAreaHref, housingMapId, (area) => {
    const fact = housingAreaLatest(area, facts);
    return { value: housingCount(fact.value), number: fact.value, year: fact.year };
  });
}

async function transport(locale: Locale): Promise<PlaceEntry[]> {
  const [{ facts: served }, { messages }] = await Promise.all([loadServedTransportData(), getPresentation(locale, ["transport"], [])]);
  const facts = served.map(toClientTransportFact);
  const t = (key: string, values?: Record<string, string | number>) => message(messages, `transport.${key}`, values);
  return areaEntries(TRANSPORT_REGIONS_HREF, TRANSPORT_AREAS, transportAreaHref, transportMapId, (area) => {
    const fact = transportAreaLatest(area, facts);
    return { value: transportLatestValue(fact.value, "thousand", t), number: fact.value, year: fact.year };
  });
}

async function internet(): Promise<PlaceEntry[]> {
  const facts = (await loadServedInternetData()).facts.map(toClientInternetFact);
  return areaEntries(INTERNET_HOMES_HREF, INTERNET_AREAS, internetAreaHref, internetMapId, (area) => {
    const fact = internetAreaLatest(area, facts);
    return { value: internetPercent(fact.value), number: fact.value, year: fact.year };
  });
}

/** Loans by region: each area's all loans, as its page's line states it. */
async function moneyBanks(locale: Locale): Promise<PlaceEntry[]> {
  const facts = (await loadServedMoneyBanksData()).facts.map(toClientMoneyBanksFact);
  return areaEntries(MONEY_BANKS_REGIONS_HREF, MONEY_BANKS_LOAN_AREAS, moneyBanksAreaHref, moneyBanksMapId, (area) => {
    const fact = facts.filter((f) => f.indicatorId === loansRegionIndicator(area, "total")).sort((a, b) => a.year - b.year).at(-1)!;
    return { value: formatAmount(fact.value, locale), number: fact.value, year: fact.year };
  });
}

async function museums(): Promise<PlaceEntry[]> {
  const facts = (await loadServedScienceCultureData()).facts.map(toClientScienceCultureFact);
  return areaEntries(MUSEUMS_HREF, MUSEUM_AREAS, museumAreaHref, museumMapId, (area) => {
    const fact = museumAreaLatest(area, facts);
    return { value: formatInUnit(fact.value, scienceCultureValueUnit(fact.unit)), number: fact.value, year: fact.year };
  });
}

/** Waste collected, and timber cut (Tbilisi, with no timber figure, leads with illegal logging): each area page's first row. */
async function environment(locale: Locale): Promise<PlaceEntry[]> {
  const [served, presentation] = await Promise.all([loadServedEnvironmentData(), getPresentation(locale, ["environment"], [])]);
  const facts = served.map(toClientEnvironmentFact);
  const t = environmentTranslate(presentation);
  return (["waste", "forests"] as const satisfies readonly EnvironmentAreaTopic[]).flatMap((topic) => {
    const { areaHref, mapId } = environmentAreaRoutes(topic);
    return areaEntries(environmentAreaIndexHref(topic), ENVIRONMENT_AREAS, areaHref, mapId, (area) => {
      const latest = environmentLatest(facts, environmentAreaSeries(topic, area, facts)[0].id, t);
      return { value: latest.value, number: latest.fact.value, year: latest.year };
    });
  });
}

/** Business, Housing, Transport and Internet regions, Loans by region, Museums, Waste and Forests. */
export const areaFamilyEntries: PlaceAdapter = async (locale) =>
  (await Promise.all([business(locale), housing(), transport(locale), internet(), moneyBanks(locale), museums(), environment(locale)])).flat();
