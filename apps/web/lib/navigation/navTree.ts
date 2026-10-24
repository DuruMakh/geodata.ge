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

/** The twenty topics: the hubs of `NAV_TREE`. A topic keeps its id and pages when a group page replaces its own hub page. */
export type TopicId =
  | "budget" | "economy" | "business" | "housing" | "inflation" | "money" | "unemployment" | "wages" | "living-standards" | "health"
  | "education" | "science-culture" | "crime" | "internet" | "trade" | "external" | "energy-food" | "environment" | "transport" | "demography";

/** The eight groups the topics are sorted into. */
export type GroupId = "budget" | "economy" | "prices" | "labour" | "living" | "external" | "demography" | "society";

/** A page under a hub: its sidebar row. `labelKey` is a `common` message. */
export type NavSection = { href: `/${string}`; labelKey: string; testId?: string };

/** A topic: its base address, its name and its pages, which the sidebar lists under the topic's group. */
export type NavHub = {
  id: TopicId;
  href: `/${string}`;
  labelKey: string;
  sections: readonly NavSection[];
};

/** Budget's hub: the explorer's root, which holds every page no other hub does. */
export const BUDGET_HUB_PATH = "/explorer";

/** Rows for a topic's own section list, with test ids `{prefix}-{id}-link`. */
function sectionRows(sections: readonly { id: string; href: `/${string}`; labelKey: string }[], prefix: string): NavSection[] {
  return sections.map(({ id, href, labelKey }) => ({ href, labelKey, testId: `${prefix}-${id}-link` }));
}

/**
 * Every topic and its pages, in sidebar order: the one navigation config. The sidebar lists them under their groups
 * (`NAV_GROUPS`), and the header menu, footer and 404 page list the groups (`DATASET_HUBS`). Budget's pages come from
 * `lib/explorer/sections.ts`; a section with no page yet has no row.
 */
export const NAV_TREE: readonly NavHub[] = [
  {
    id: "budget",
    href: BUDGET_HUB_PATH,
    labelKey: "common.budget",
    sections: BUDGET_SECTION_ORDER.flatMap((id) => {
      const { href } = BUDGET_SECTIONS[id];
      return href === null ? [] : [{ href: href as `/${string}`, labelKey: `common.${id}`, testId: `section-link-${href.split("/").at(-1)}` }];
    }),
  },
  {
    id: "economy",
    href: "/explorer/economy",
    labelKey: "common.economy",
    sections: sectionRows([
      { id: "gdp", href: "/explorer/economy/gdp", labelKey: "common.gdpOverview" },
      { id: "sectors", href: "/explorer/economy/sectors", labelKey: "common.economicSectors" },
      { id: "expenditure", href: "/explorer/economy/expenditure", labelKey: "common.gdpExpenditure" },
      { id: "regions", href: "/explorer/economy/regions", labelKey: "common.regionalEconomies" },
    ], "economy"),
  },
  {
    id: "business",
    href: BUSINESS_HUB_PATH,
    labelKey: "common.business",
    sections: sectionRows(BUSINESS_SECTIONS, "business"),
  },
  {
    id: "housing",
    href: HOUSING_HUB_PATH,
    labelKey: "common.housing",
    sections: sectionRows(HOUSING_SECTIONS, "housing"),
  },
  {
    id: "inflation",
    href: "/explorer/inflation",
    labelKey: "common.inflation",
    sections: sectionRows([
      { id: "overview", href: "/explorer/inflation/overview", labelKey: "common.inflationOverview" },
      { id: "categories", href: "/explorer/inflation/categories", labelKey: "common.inflationCategories" },
      { id: "products", href: "/explorer/inflation/products", labelKey: "common.inflationProducts" },
      { id: "cities", href: "/explorer/inflation/cities", labelKey: "common.inflationCities" },
    ], "inflation"),
  },
  {
    id: "money",
    href: "/explorer/money",
    labelKey: "common.moneyBanks",
    sections: sectionRows(MONEY_BANKS_SECTIONS, "money"),
  },
  {
    id: "unemployment",
    href: "/explorer/unemployment",
    labelKey: "common.unemployment",
    sections: sectionRows([...UNEMPLOYMENT_SECTIONS, ...LABOUR_SECTIONS], "unemployment"),
  },
  {
    id: "wages",
    href: "/explorer/wages",
    labelKey: "common.wages",
    sections: sectionRows(WAGES_SECTIONS, "wages"),
  },
  {
    id: "living-standards",
    href: LIVING_STANDARDS_HUB_PATH,
    labelKey: "common.livingStandards",
    sections: sectionRows(LIVING_STANDARDS_SECTIONS, "living-standards"),
  },
  {
    id: "health",
    href: HEALTH_HUB_PATH,
    labelKey: "common.health",
    sections: sectionRows([...HEALTH_SECTIONS, ...SOCIAL_SECTIONS], "health"),
  },
  {
    id: "education",
    href: EDUCATION_HUB_PATH,
    labelKey: "common.education",
    sections: sectionRows(EDUCATION_SECTIONS, "education"),
  },
  {
    id: "science-culture",
    href: SCIENCE_CULTURE_HUB_PATH,
    labelKey: "common.scienceCulture",
    sections: sectionRows(SCIENCE_CULTURE_SECTIONS, "science-culture"),
  },
  {
    id: "crime",
    href: CRIME_HUB_PATH,
    labelKey: "common.crime",
    sections: sectionRows(CRIME_SECTIONS, "crime"),
  },
  {
    id: "internet",
    href: INTERNET_HUB_PATH,
    labelKey: "common.internet",
    sections: sectionRows(INTERNET_SECTIONS, "internet"),
  },
  {
    id: "trade",
    href: "/explorer/trade",
    labelKey: "common.trade",
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
    id: "external",
    href: "/explorer/external",
    labelKey: "common.external",
    sections: [
      { href: "/explorer/external/money-from-abroad", labelKey: "common.moneyFromAbroad", testId: "money-from-abroad-link" },
      { href: "/explorer/external/foreign-investment", labelKey: "common.foreignInvestment", testId: "foreign-investment-link" },
      { href: "/explorer/external/current-account", labelKey: "common.currentAccount", testId: "current-account-link" },
      { href: "/explorer/external/foreign-debt", labelKey: "common.foreignDebt", testId: "foreign-debt-link" },
      { href: "/explorer/external/reserves", labelKey: "common.reserves", testId: "reserves-link" },
    ],
  },
  {
    id: "energy-food",
    href: ENERGY_FOOD_HUB_PATH,
    labelKey: "common.energyFood",
    sections: sectionRows(ENERGY_FOOD_SECTIONS, "energy-food"),
  },
  {
    id: "environment",
    href: ENVIRONMENT_HUB_PATH,
    labelKey: "common.environment",
    sections: sectionRows(ENVIRONMENT_SECTIONS, "environment"),
  },
  {
    id: "transport",
    href: TRANSPORT_HUB_PATH,
    labelKey: "common.transport",
    sections: sectionRows(TRANSPORT_SECTIONS, "transport"),
  },
  {
    id: "demography",
    href: DEMOGRAPHY_HUB_PATH,
    labelKey: "common.demography",
    sections: sectionRows(LIVE_DEMOGRAPHY_PAGES.map(({ id, path, labelKey }) => ({ id, href: path, labelKey })), "demography"),
  },
];

/** A group: its own page, its sidebar name (`labelKey` is a `common` message) and the topics it holds, in order. */
export type NavGroup = { id: GroupId; href: `/explorer/${string}`; labelKey: string; topics: readonly TopicId[] };

/** The All data page, which lists every page and searches them; the explorer's root. */
export const ALL_DATA_PATH = "/explorer";

/** The eight groups in sidebar order, over the twenty topics. Each topic is in exactly one group. */
export const NAV_GROUPS: readonly NavGroup[] = [
  { id: "budget", href: "/explorer/budget", labelKey: "common.group.budget", topics: ["budget"] },
  { id: "economy", href: "/explorer/economy", labelKey: "common.group.economy", topics: ["economy", "business", "housing"] },
  { id: "prices", href: "/explorer/prices", labelKey: "common.group.prices", topics: ["inflation", "money"] },
  { id: "labour", href: "/explorer/labour", labelKey: "common.group.labour", topics: ["unemployment", "wages"] },
  { id: "living", href: "/explorer/living", labelKey: "common.group.living", topics: ["living-standards", "health"] },
  { id: "external", href: "/explorer/external", labelKey: "common.group.external", topics: ["trade", "external"] },
  { id: "demography", href: "/explorer/demography", labelKey: "common.group.demography", topics: ["demography"] },
  { id: "society", href: "/explorer/society", labelKey: "common.group.society", topics: ["education", "science-culture", "crime", "internet", "energy-food", "environment", "transport"] },
];

/** The topic's hub: its base address, sections and labels. */
export function topicHub(id: TopicId): NavHub {
  return NAV_TREE.find((hub) => hub.id === id)!;
}

export function groupOfTopic(id: TopicId): NavGroup {
  return NAV_GROUPS.find((group) => group.topics.includes(id))!;
}

export function navGroup(id: GroupId): NavGroup {
  return NAV_GROUPS.find((group) => group.id === id)!;
}

/**
 * Where a link to a topic goes now that its own hub page forwards: `href`, its section on its group page, for a link or
 * a visible breadcrumb; `path`, the group page itself, for breadcrumb structured data.
 */
export function topicSection(id: TopicId): { href: `/${string}`; path: `/${string}` } {
  const { href } = groupOfTopic(id);
  return { href: `${href}#t-${id}`, path: href };
}

/** The pages of a group: its topics' sections, in order. */
export function groupPages(group: NavGroup): NavSection[] {
  return group.topics.flatMap((id) => topicHub(id).sections);
}

/** Every page in the navigation tree. */
export const PAGE_COUNT = NAV_TREE.reduce((total, hub) => total + hub.sections.length, 0);

/** The one active rule: a row is active on its own page and on every page below it (a region or place page). */
export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** The hub whose rows are open: the longest hub address the page sits under; Budget (`/explorer`) holds the rest. */
export function openHub(pathname: string): NavHub {
  return NAV_TREE.reduce((open, hub) => (isActivePath(pathname, hub.href) && hub.href.length > open.href.length ? hub : open));
}

/** The group a page belongs to: a group's own page, else the group of the open hub; none on All data. */
export function currentGroup(pathname: string): NavGroup | null {
  if (pathname === ALL_DATA_PATH) return null;
  return NAV_GROUPS.find((group) => group.href === pathname) ?? groupOfTopic(openHub(pathname).id);
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

/** Old topic addresses and where they forward: the group page, carrying the topic as `?topic=` (spec §3.1). */
export const LEGACY_TOPIC_FORWARDS: readonly { topic: TopicId; from: string; to: string }[] = NAV_TREE.flatMap(({ id, href }) => {
  const group = groupOfTopic(id);
  return id === "budget" || href === group.href ? [] : [{ topic: id, from: href, to: `${group.href}?topic=${id}` }];
});

/** Footer source notes that belong to one page only. */
const PAGE_SOURCE_NOTES: Readonly<Record<string, string>> = {
  [ALL_DATA_PATH]: "common.sourceNote.allData",
  ...Object.fromEntries(NAV_GROUPS.map((group) => [group.href, `common.sourceNote.group.${group.id}`])),
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
  "/explorer/external/foreign-investment": "common.geostatSourceNote",
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
