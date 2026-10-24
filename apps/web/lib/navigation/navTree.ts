import { BUDGET_SECTIONS, BUDGET_SECTION_ORDER } from "../explorer/sections";
import { UNEMPLOYMENT_SECTIONS } from "../explorer/unemploymentSections";
import { LABOUR_SECTIONS } from "../explorer/labour";
import { WAGES_SECTIONS } from "../explorer/wages";
import { LIVING_STANDARDS_HUB_PATH, LIVING_STANDARDS_SECTIONS } from "../explorer/livingStandards";
import { HEALTH_HUB_PATH, HEALTH_SECTIONS } from "../explorer/health";
import { SOCIAL_SECTIONS } from "../explorer/social";
import { CRIME_HUB_PATH, CRIME_SECTIONS } from "../explorer/crime";
import { ENERGY_FOOD_HUB_PATH, ENERGY_FOOD_SECTIONS } from "../explorer/energyFood";
import { TRANSPORT_HUB_PATH, TRANSPORT_SECTIONS } from "../explorer/transport";
import { ENVIRONMENT_HUB_PATH, ENVIRONMENT_SECTIONS } from "../explorer/environment";
import { MONEY_BANKS_SECTIONS } from "../explorer/moneyBanks";
import { BUSINESS_HUB_PATH, BUSINESS_SECTIONS } from "../explorer/business";
import { HOUSING_HUB_PATH, HOUSING_SECTIONS } from "../explorer/housing";
import { EDUCATION_HUB_PATH, EDUCATION_SECTIONS } from "../explorer/education";
import { SCIENCE_CULTURE_HUB_PATH, SCIENCE_CULTURE_SECTIONS } from "../explorer/scienceCulture";
import { INTERNET_HUB_PATH, INTERNET_SECTIONS } from "../explorer/internet";
import { DEMOGRAPHY_HUB_PATH, LIVE_DEMOGRAPHY_PAGES } from "../explorer/demographyRoutes";

/** A page under a hub: its sidebar row. `labelKey` is a `common` message. */
export type NavSection = { href: `/${string}`; labelKey: string; testId?: string };

/**
 * A dataset hub: its sidebar row, its sub-pages, and the label the collapsed rail shows while it is open.
 * `spaced` keeps the 8px desktop gap above the rows that have always had it.
 */
export type NavHub = {
  href: `/${string}`;
  labelKey: string;
  railLabelKey: string;
  testId?: string;
  spaced?: boolean;
  sections: readonly NavSection[];
};

/** Budget's hub: the explorer's root, which holds every page no other hub does. */
export const BUDGET_HUB_PATH = "/explorer";

/** Rows for a topic's own section list, with test ids `{prefix}-{id}-link`. */
function sectionRows(sections: readonly { id: string; href: `/${string}`; labelKey: string }[], prefix: string): NavSection[] {
  return sections.map(({ id, href, labelKey }) => ({ href, labelKey, testId: `${prefix}-${id}-link` }));
}

/**
 * Every dataset hub and its pages, in sidebar order: the one navigation config. The sidebar renders it, and the
 * header menu, footer and 404 page list its hubs (`DATASET_HUBS`). Budget's sections come from
 * `lib/explorer/sections.ts`, which the sidebar renders through `SectionNav` with its coming-soon rows.
 */
export const NAV_TREE: readonly NavHub[] = [
  {
    href: BUDGET_HUB_PATH,
    labelKey: "common.budget",
    railLabelKey: "common.dataBudget",
    sections: BUDGET_SECTION_ORDER.flatMap((id) => {
      const { href } = BUDGET_SECTIONS[id];
      return href === null ? [] : [{ href: href as `/${string}`, labelKey: `common.${id}`, testId: `section-link-${id}` }];
    }),
  },
  {
    href: "/explorer/economy",
    labelKey: "common.economy",
    railLabelKey: "common.dataEconomy",
    testId: "economy-link",
    sections: sectionRows([
      { id: "gdp", href: "/explorer/economy/gdp", labelKey: "common.gdpOverview" },
      { id: "sectors", href: "/explorer/economy/sectors", labelKey: "common.economicSectors" },
      { id: "expenditure", href: "/explorer/economy/expenditure", labelKey: "common.gdpExpenditure" },
      { id: "regions", href: "/explorer/economy/regions", labelKey: "common.regionalEconomies" },
    ], "economy"),
  },
  {
    href: BUSINESS_HUB_PATH,
    labelKey: "common.business",
    railLabelKey: "common.dataBusiness",
    testId: "business-link",
    sections: sectionRows(BUSINESS_SECTIONS, "business"),
  },
  {
    href: HOUSING_HUB_PATH,
    labelKey: "common.housing",
    railLabelKey: "common.dataHousing",
    testId: "housing-link",
    sections: sectionRows(HOUSING_SECTIONS, "housing"),
  },
  {
    href: "/explorer/inflation",
    labelKey: "common.inflation",
    railLabelKey: "common.dataInflation",
    testId: "inflation-link",
    sections: sectionRows([
      { id: "overview", href: "/explorer/inflation/overview", labelKey: "common.inflationOverview" },
      { id: "categories", href: "/explorer/inflation/categories", labelKey: "common.inflationCategories" },
      { id: "products", href: "/explorer/inflation/products", labelKey: "common.inflationProducts" },
      { id: "cities", href: "/explorer/inflation/cities", labelKey: "common.inflationCities" },
    ], "inflation"),
  },
  {
    href: "/explorer/money",
    labelKey: "common.moneyBanks",
    railLabelKey: "common.dataMoneyBanks",
    testId: "money-link",
    spaced: true,
    sections: sectionRows(MONEY_BANKS_SECTIONS, "money"),
  },
  {
    href: "/explorer/unemployment",
    labelKey: "common.unemployment",
    railLabelKey: "common.dataUnemployment",
    testId: "unemployment-link",
    spaced: true,
    sections: sectionRows([...UNEMPLOYMENT_SECTIONS, ...LABOUR_SECTIONS], "unemployment"),
  },
  {
    href: "/explorer/wages",
    labelKey: "common.wages",
    railLabelKey: "common.dataWages",
    testId: "wages-link",
    spaced: true,
    sections: sectionRows(WAGES_SECTIONS, "wages"),
  },
  {
    href: LIVING_STANDARDS_HUB_PATH,
    labelKey: "common.livingStandards",
    railLabelKey: "common.dataLivingStandards",
    testId: "living-standards-link",
    spaced: true,
    sections: sectionRows(LIVING_STANDARDS_SECTIONS, "living-standards"),
  },
  {
    href: HEALTH_HUB_PATH,
    labelKey: "common.health",
    railLabelKey: "common.dataHealth",
    testId: "health-link",
    spaced: true,
    sections: sectionRows([...HEALTH_SECTIONS, ...SOCIAL_SECTIONS], "health"),
  },
  {
    href: EDUCATION_HUB_PATH,
    labelKey: "common.education",
    railLabelKey: "common.dataEducation",
    testId: "education-link",
    spaced: true,
    sections: sectionRows(EDUCATION_SECTIONS, "education"),
  },
  {
    href: SCIENCE_CULTURE_HUB_PATH,
    labelKey: "common.scienceCulture",
    railLabelKey: "common.dataScienceCulture",
    testId: "science-culture-link",
    spaced: true,
    sections: sectionRows(SCIENCE_CULTURE_SECTIONS, "science-culture"),
  },
  {
    href: CRIME_HUB_PATH,
    labelKey: "common.crime",
    railLabelKey: "common.dataCrime",
    testId: "crime-link",
    spaced: true,
    sections: sectionRows(CRIME_SECTIONS, "crime"),
  },
  {
    href: INTERNET_HUB_PATH,
    labelKey: "common.internet",
    railLabelKey: "common.dataInternet",
    testId: "internet-link",
    spaced: true,
    sections: sectionRows(INTERNET_SECTIONS, "internet"),
  },
  {
    href: "/explorer/trade",
    labelKey: "common.trade",
    railLabelKey: "common.dataTrade",
    testId: "trade-link",
    spaced: true,
    sections: sectionRows([
      { id: "overview", href: "/explorer/trade/overview", labelKey: "common.tradeOverview" },
      { id: "partners", href: "/explorer/trade/partners", labelKey: "common.tradePartners" },
      { id: "products", href: "/explorer/trade/products", labelKey: "common.tradeProducts" },
      { id: "domestic", href: "/explorer/trade/domestic-exports", labelKey: "common.tradeDomestic" },
      { id: "services", href: "/explorer/trade/services", labelKey: "common.tradeServices" },
      { id: "composition", href: "/explorer/trade/composition", labelKey: "common.tradeComposition" },
    ], "trade"),
  },
  {
    href: "/explorer/external",
    labelKey: "common.external",
    railLabelKey: "common.dataExternal",
    testId: "external-link",
    spaced: true,
    sections: [
      { href: "/explorer/external/money-from-abroad", labelKey: "common.moneyFromAbroad", testId: "money-from-abroad-link" },
      { href: "/explorer/external/foreign-investment", labelKey: "common.foreignInvestment", testId: "foreign-investment-link" },
      { href: "/explorer/external/current-account", labelKey: "common.currentAccount", testId: "current-account-link" },
      { href: "/explorer/external/foreign-debt", labelKey: "common.foreignDebt", testId: "foreign-debt-link" },
      { href: "/explorer/external/reserves", labelKey: "common.reserves", testId: "reserves-link" },
    ],
  },
  {
    href: ENERGY_FOOD_HUB_PATH,
    labelKey: "common.energyFood",
    railLabelKey: "common.dataEnergyFood",
    testId: "energy-food-link",
    spaced: true,
    sections: sectionRows(ENERGY_FOOD_SECTIONS, "energy-food"),
  },
  {
    href: ENVIRONMENT_HUB_PATH,
    labelKey: "common.environment",
    railLabelKey: "common.dataEnvironment",
    testId: "environment-link",
    spaced: true,
    sections: sectionRows(ENVIRONMENT_SECTIONS, "environment"),
  },
  {
    href: TRANSPORT_HUB_PATH,
    labelKey: "common.transport",
    railLabelKey: "common.dataTransport",
    testId: "transport-link",
    sections: sectionRows(TRANSPORT_SECTIONS, "transport"),
  },
  {
    href: DEMOGRAPHY_HUB_PATH,
    labelKey: "common.demography",
    railLabelKey: "common.dataDemography",
    testId: "demography-link",
    spaced: true,
    sections: sectionRows(LIVE_DEMOGRAPHY_PAGES.map(({ id, path, labelKey }) => ({ id, href: path, labelKey })), "demography"),
  },
];

/** The one active rule: a row is active on its own page and on every page below it (a region or place page). */
export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** The hub whose rows are open: the longest hub address the page sits under; Budget (`/explorer`) holds the rest. */
export function openHub(pathname: string): NavHub {
  return NAV_TREE.reduce((open, hub) => (isActivePath(pathname, hub.href) && hub.href.length > open.href.length ? hub : open));
}

/**
 * The address of the one sidebar row marked current (`aria-current`) on a page: the open hub on its own page, else
 * the open hub's row the page sits on or under. A page outside every row has none.
 */
export function currentEntry(pathname: string): string | undefined {
  const hub = openHub(pathname);
  if (pathname === hub.href) return hub.href;
  return hub.sections.find((section) => isActivePath(pathname, section.href))?.href;
}

/** Footer source notes that belong to one page only. */
const PAGE_SOURCE_NOTES: Readonly<Record<string, string>> = {
  "/explorer": "common.budgetHubSourceNote",
  "/explorer/expenditure": "common.budgetStatisticsSourceNote",
  "/explorer/expenditure-types": "common.budgetStatisticsSourceNote",
  "/explorer/revenue": "common.budgetStatisticsSourceNote",
  "/explorer/tax-breaks-refunds": "common.taxBreaksRefundsSourceNote",
  "/explorer/debt": "common.budgetStatisticsSourceNote",
  "/explorer/municipalities": "common.budgetStatisticsSourceNote",
  "/explorer/deficit": "common.deficitSourceNote",
  "/explorer/economy/sectors": "common.geostatSourceNote",
  "/explorer/economy/expenditure": "common.geostatSourceNote",
  "/explorer/inflation/categories": "common.geostatSourceNote",
  "/explorer/inflation/products": "common.geostatSourceNote",
  "/explorer/external": "common.externalHubSourceNote",
  "/explorer/external/foreign-investment": "common.geostatSourceNote",
  // The hub lists Geostat's health pages, the Social Service Agency's pages and the Pension Fund's page.
  [HEALTH_HUB_PATH]: "common.socialHubSourceNote",
  // The funded pension page reads the Pension Fund's statements, with Geostat's GDP for its % of GDP view.
  [`${HEALTH_HUB_PATH}/funded-pension`]: "common.fundedPensionSourceNote",
};

/** Footer source notes for an address and every page below it; the longest address wins. */
const TREE_SOURCE_NOTES: Readonly<Record<string, string>> = {
  "/explorer": "common.budgetSourceNote",
  "/explorer/economy": "common.economySourceNote",
  "/explorer/economy/regions": "common.geostatSourceNote",
  "/explorer/inflation": "common.inflationSourceNote",
  [BUSINESS_HUB_PATH]: "common.geostatSourceNote",
  [HOUSING_HUB_PATH]: "common.geostatSourceNote",
  "/explorer/money": "common.nbgSourceNote",
  "/explorer/unemployment": "common.geostatSourceNote",
  "/explorer/wages": "common.geostatSourceNote",
  [LIVING_STANDARDS_HUB_PATH]: "common.geostatSourceNote",
  [HEALTH_HUB_PATH]: "common.geostatSourceNote",
  ...Object.fromEntries(SOCIAL_SECTIONS.map(section => [section.href, "common.socialSourceNote"])),
  [EDUCATION_HUB_PATH]: "common.geostatSourceNote",
  [SCIENCE_CULTURE_HUB_PATH]: "common.geostatSourceNote",
  [CRIME_HUB_PATH]: "common.geostatSourceNote",
  [INTERNET_HUB_PATH]: "common.geostatSourceNote",
  "/explorer/trade": "common.geostatSourceNote",
  "/explorer/external": "common.nbgSourceNote",
  [ENERGY_FOOD_HUB_PATH]: "common.geostatSourceNote",
  [TRANSPORT_HUB_PATH]: "common.geostatSourceNote",
  [DEMOGRAPHY_HUB_PATH]: "common.geostatSourceNote",
};

/** The `common` key of the explorer footer's source note for a page (its address without the language prefix). */
export function sourceNoteKey(pathname: string): string {
  const page = PAGE_SOURCE_NOTES[pathname];
  if (page) return page;
  const address = Object.keys(TREE_SOURCE_NOTES)
    .filter((href) => isActivePath(pathname, href))
    .reduce((longest, href) => (href.length > longest.length ? href : longest), "/explorer");
  return TREE_SOURCE_NOTES[address];
}
