import { MANIFEST_SIDE_FILE_NAMES } from "../data/publicDatasetExports";
import { buildAllPublications, catalogueData } from "../factQuery/publications";
import { SCHEMA_VERSION } from "../factQuery/types";
import { loadPackagedSnapshot } from "../mcp/snapshot";
import { TOOLS } from "../mcp/tools";
import type { CardLatest } from "../explorer/topicHub";
import { NAV_GROUPS } from "../navigation/navTree";
import { loadTopicHubs } from "../pages/topicHubs.server";

// /llms.txt (app/llms.txt/route.ts): the authored guide for AI assistants, answer-first. Each page line opens with the
// latest figure of that page's group-page card, so the guide states the numbers the site shows and follows each data
// release without anyone editing it. Links name https://fiscal.ge, as the published guide always has.

/** One list line: `href` is the site path (`/explorer/debt`), `text` what the page or file covers, in Markdown. */
export type LlmsLine = { href: string; name: string; text: string };

const SITE = "https://fiscal.ge";

const OPENING = `# Fiscal.ge

> Fiscal.ge is a Georgian and English guide to reviewed annual data on Georgia's state and municipal budgets, economy, money, jobs, living standards, society, environment, trade and population, and to Geostat's monthly consumer-price inflation.

**When to use Fiscal.ge:** Look up, compare and cite the latest and historical figures for any topic below.

There is no REST query API, no write access, no accounts, and no datasets beyond those listed here.

**How to answer from Fiscal.ge:** Give the number first: the figure, its year or month, its unit and the link to its page. Add at most one short caveat, only when it changes what the number means: a plan, a projection, a preliminary figure, or a series break in the years compared. Link the page's methodology instead of explaining it, unless asked. Each chart page's HTML has a year-by-year table of every series (the largest pages: their leading series; all in the Excel download), except product inflation and monthly category changes, which load after the page opens: use the inflation CSVs. Use the published figures as they are; do not invent values for years or places not covered.`;

/**
 * The three "Where the data is" lines. The bulk-file count is the manifest's (the publications built from the snapshot
 * plus the topic CSVs), and the MCP datasets are the catalogue's, so neither list drifts from what is published.
 */
let where: string | undefined;

function whereTheDataIs(): string {
  if (where !== undefined) return where;
  const snapshot = loadPackagedSnapshot();
  const bulkFiles = buildAllPublications(snapshot).filter((file) => file.fileName !== "manifest.json").length + MANIFEST_SIDE_FILE_NAMES.length;
  const datasets = catalogueData(snapshot).datasets.map((dataset) => dataset.labelEn);
  where = `**Where the data is:**
- Each chart page's line below opens with its latest figure, where it has one.
- Bulk files: \`${SITE}/downloads/data/manifest.json\` lists all ${bulkFiles} bulk files with their hashes.
- The read-only MCP connection at \`${SITE}/mcp\` serves ${datasets.slice(0, -1).join(", ")} and ${datasets.at(-1)}.`;
  return where;
}

/** The page lines, grouped as the guide prints them: a blank line between groups. */
const CORE_DATA: LlmsLine[][] = [
  [
    { href: "/", name: "Fiscal.ge home", text: "scope and coverage." },
    { href: "/explorer", name: "All data", text: "every page A to Z." },
    { href: "/explorer/budget", name: "Budget", text: "" },
    { href: "/explorer/expenditure", name: "National expenditure", text: "state-budget expenditure." },
    { href: "/explorer/expenditure-types", name: "Spending by type", text: "by economic type, GEL or share of GDP." },
    { href: "/explorer/revenue", name: "National revenue", text: "consolidated-budget receipts." },
    { href: "/explorer/tax-breaks-refunds", name: "Tax breaks and refunds", text: "tax breaks, 2018–2024, and refunds, 2008–2025, GEL or share of GDP." },
    { href: "/explorer/analysis", name: "Annual analysis", text: "one-year budget analysis." },
    { href: "/explorer/municipalities", name: "Municipal budgets", text: "municipal expenditure." },
    { href: "/explorer/debt", name: "Government debt", text: "debt stock, debt service and interest rates." },
    { href: "/explorer/deficit", name: "Deficit", text: "IMF general-government balance, share of GDP or GEL." },
  ],
  [
    { href: "/explorer/economy", name: "Economy and business", text: "" },
    { href: "/explorer/economy#t-economy", name: "Economy", text: "" },
    { href: "/explorer/economy/gdp", name: "Economy overview", text: "real GDP in constant 2015 USD; nominal GDP in GEL and USD, real growth and GDP per person." },
    { href: "/explorer/economy/sectors", name: "Economic sectors", text: "20 national economic activities plus a Total GDP reference." },
    { href: "/explorer/economy/expenditure", name: "GDP by expenditure", text: "share of GDP; consumption, investment, exports and imports, 2010–2025." },
    { href: "/explorer/economy/regions", name: "Regional economies", text: "largest region's GDP; 11 regions' GDP and 20 activities, 2010–2024." },
    { href: "/explorer/economy#t-business", name: "Business", text: "sales, jobs, investment and profit, 1999–2025." },
    { href: "/explorer/business/sales", name: "Sales", text: "turnover in million GEL, 1999–2025." },
    { href: "/explorer/business/jobs", name: "Jobs", text: "persons employed in firms, 1999–2025." },
    { href: "/explorer/business/investment-profit", name: "Investment and profit", text: "investment, profit and loss, 2006–2025." },
    { href: "/explorer/business/firms", name: "Firms opened and closed", text: "active, new and closed, 2014–2024." },
    { href: "/explorer/business/regions", name: "Business by region", text: "11 regions." },
    { href: "/explorer/economy#t-housing", name: "Housing and construction", text: "permits and completed buildings, 2006–2025, and home prices." },
    { href: "/explorer/housing/permits", name: "Building permits", text: "by number and floor area, 2006–2025." },
    { href: "/explorer/housing/completed", name: "Completed buildings", text: "by number and floor area, 2006–2025." },
    { href: "/explorer/housing/prices", name: "Home prices", text: "index for all homes, flats and houses, 2020–2025; Tbilisi asking prices per m², ten districts, 2021–2025." },
    { href: "/explorer/housing/regions", name: "Housing by region", text: "11 regions, 2006–2025." },
    { href: "/explorer/prices", name: "Prices and money", text: "" },
    { href: "/explorer/prices#t-inflation", name: "Inflation", text: "" },
    { href: "/explorer/inflation/overview", name: "Inflation overview", text: "annual (year-on-year) CPI inflation by month, core inflation and the NBG target. The [inflation CSV](https://fiscal.ge/downloads/data/inflation-cpi-national.csv) has every value; 2.4 means 2.4%." },
    { href: "/explorer/inflation/categories", name: "Inflation categories", text: "largest contribution to annual inflation; 12 COICOP divisions and 43 subgroups, with weights." },
    { href: "/explorer/inflation/cities", name: "Inflation by city", text: "highest annual rate of six cities, from 2016." },
    { href: "/explorer/inflation/products", name: "Inflation by product", text: "annual price change of the fastest-rising current-basket product." },
    { href: "/explorer/prices#t-money", name: "Money and banks", text: "money, loans, deposits, rates and bank health, 1995–2025." },
    { href: "/explorer/money/supply", name: "Money supply", text: "M0–M3 in million GEL from 1995; all four as a share of GDP from 1996." },
    { href: "/explorer/money/loans-deposits", name: "Loans and deposits", text: "covers bank loans from 2002 and deposits from 1996, deposits of people from 2002 and of companies and organisations from 2015." },
    { href: "/explorer/money/borrowers", name: "Who borrows", text: "loans by borrower and industry from 2003, household borrowing from 2015, billion GEL." },
    { href: "/explorer/money/regions", name: "Loans by region", text: "11 regions, 2015–2025." },
    { href: "/explorer/money/interest-rates", name: "Interest rates", text: "the policy rate from 2008; rates on loans and on deposits from 1996." },
    { href: "/explorer/money/bank-health", name: "Bank health", text: "covers bad loans as a share of all loans from 2003, return on assets and on equity from 2001, the two capital ratios from 2014." },
    { href: "/explorer/labour", name: "Labour market", text: "" },
    { href: "/explorer/labour#t-unemployment", name: "Unemployment", text: "Labour Force Survey, 2010–2025. Bulk file: [Unemployment CSV](https://fiscal.ge/downloads/data/unemployment.csv)." },
    { href: "/explorer/unemployment/overview", name: "Unemployment overview", text: "unemployment rate; employment and participation rates." },
    { href: "/explorer/unemployment/regions", name: "Unemployment by region", text: "11 regions." },
    { href: "/explorer/unemployment/age", name: "Unemployment by age", text: "age groups." },
    { href: "/explorer/unemployment/gender", name: "Unemployment by gender", text: "women and men." },
    { href: "/explorer/unemployment/industries", name: "Jobs by industry", text: "2017–2025; women and men from 2020." },
    { href: "/explorer/unemployment/hours", name: "Hours worked", text: "usual weekly hours, 2020–2025." },
    { href: "/explorer/unemployment/informal", name: "Informal jobs", text: "informal share of non-farm jobs, 2020–2025." },
    { href: "/explorer/unemployment/young-people", name: "Young people not in work or study", text: "NEET shares, 2020–2025." },
    { href: "/explorer/labour#t-wages", name: "Wages", text: "gross monthly earnings in GEL. Bulk file: [Wages CSV](https://fiscal.ge/downloads/data/wages.csv)." },
    { href: "/explorer/wages/overview", name: "Wages overview", text: "average wage from 1995, median from 2018." },
    { href: "/explorer/wages/industries", name: "Wages by industry", text: "19 NACE sections." },
    { href: "/explorer/wages/regions", name: "Wages by region", text: "11 regions." },
    { href: "/explorer/living", name: "Living standards and health", text: "" },
    { href: "/explorer/living#t-living-standards", name: "Living standards", text: "household income and spending from 2002, poverty rates from 2004, inequality from 2006." },
    { href: "/explorer/living-standards/income", name: "Household income", text: "monthly household income by source." },
    { href: "/explorer/living-standards/spending", name: "Household spending", text: "monthly household spending by category." },
    { href: "/explorer/living-standards/poverty", name: "Poverty", text: "absolute poverty rate; national lines, 2004–2025; international lines, 2004–2024." },
    { href: "/explorer/living-standards/inequality", name: "Inequality", text: "six Gini coefficients, 2006–2025." },
    { href: "/explorer/living#t-health", name: "Health and social protection", text: "healthcare statistics, 2002–2025; deaths by cause for Georgia and its 11 regions, 2014–2025; pensions, allowance, social package and social payments, 2013–2025. Bulk file: [Social protection CSV](https://fiscal.ge/downloads/data/social-protection.csv)." },
    { href: "/explorer/health/doctors-hospitals", name: "Doctors and hospitals", text: "staff, hospitals, beds and visits, 2002–2025." },
    { href: "/explorer/health/illnesses", name: "Illnesses", text: "new cases by disease group, 2002–2025; diabetes and anaemia from 2016." },
    { href: "/explorer/health/causes-of-death", name: "Causes of death", text: "deaths by cause and death rate, 2014–2025." },
    { href: "/explorer/health/social-payments", name: "Social payments", text: "total of 18 programmes, 2013–2025; COVID-19 compensation in 2020 and 2021." },
    { href: "/explorer/health/pensions", name: "Pensions", text: "pensioners and pensions, 2013–2025." },
    { href: "/explorer/health/subsistence-allowance", name: "Subsistence allowance", text: "families, people and money paid, 2013–2025; employment programme (from 2022)." },
    { href: "/explorer/health/social-package", name: "Social package", text: "recipients and money paid, 2013–2025; four disability rows from 2017, war participants from 2019." },
    { href: "/explorer/health/funded-pension", name: "Funded pension", text: "savings, assets, members and return, 2019–2025; securities gains and dividends from 2022." },
    { href: "/explorer/society", name: "Society and environment", text: "" },
    { href: "/explorer/society#t-education", name: "Education", text: "schools (2000/01–2025/26), kindergartens (2017/18–2025/26), universities (2010/11–2025/26), vocational colleges (2013–2025)." },
    { href: "/explorer/education/schools", name: "Schools", text: "pupils, teachers and schools; Georgia from 2000/01." },
    { href: "/explorer/education/kindergartens", name: "Kindergartens", text: "children and staff, 2017/18–2025/26." },
    { href: "/explorer/education/universities", name: "Universities", text: "students (2011/12–2025/26), graduates (2010/11–2024/25)." },
    { href: "/explorer/education/vocational", name: "Vocational colleges", text: "admissions and graduates, 2013–2025." },
    { href: "/explorer/society#t-science-culture", name: "Science and culture", text: "research spending (2019–2024), patents and grants (2016–2025), museum visitors (2005–2025), theatres (2006–2025)." },
    { href: "/explorer/science-culture/research", name: "Research", text: "researchers and R&D spending, 2019–2024." },
    { href: "/explorer/science-culture/patents", name: "Patents", text: "applications and grants, 2016–2025." },
    { href: "/explorer/science-culture/museums", name: "Museums", text: "visitors and museums, 2005–2025; staff (2020–2025)." },
    { href: "/explorer/science-culture/theatres", name: "Theatres", text: "audience and shows, 2006–2025; events from 2021, staff from 2020." },
    { href: "/explorer/society#t-crime", name: "Crime and justice", text: "2001–2025, also per 100,000 people." },
    { href: "/explorer/crime/recorded", name: "Recorded crimes", text: "11 types of crime, 2015–2025." },
    { href: "/explorer/crime/convictions", name: "Convictions", text: "people convicted, 2001–2025." },
    { href: "/explorer/crime/prisons", name: "Prisons", text: "2001–2025; awaiting trial from 2010." },
    { href: "/explorer/crime/victims", name: "Victims", text: "victims of crime, 2007–2011 and 2015–2025." },
    { href: "/explorer/crime/road-accidents", name: "Road accidents", text: "accidents, killed and injured, 2001–2025." },
    { href: "/explorer/society#t-internet", name: "Internet and technology", text: "ICT survey, 2016–2026." },
    { href: "/explorer/internet/homes", name: "Internet at home", text: "share of homes with internet; also with a computer, 2016–2026." },
    { href: "/explorer/internet/users", name: "Internet users", text: "by group, 2016–2026." },
    { href: "/explorer/internet/online", name: "Shopping and services online", text: "online shopping and services, 2016–2026." },
    { href: "/explorer/internet/devices", name: "Phones and computers", text: "mobile phone, smartphone (from 2019) and computer use, 2016–2026." },
    { href: "/explorer/external", name: "External sector", text: "" },
    { href: "/explorer/external#t-trade", name: "Trade", text: "" },
    { href: "/explorer/trade/overview", name: "Trade overview", text: "total trade (exports plus imports); exports, imports and balance, 1995–2025." },
    { href: "/explorer/trade/partners", name: "Trading partners", text: "largest partner by total trade; 212 countries and five groups, 1995–2025." },
    { href: "/explorer/trade/products", name: "Products", text: "1,192 HS4 products, 2020–2025." },
    { href: "/explorer/trade/domestic-exports", name: "Domestic exports", text: "domestic exports (excluding re-exports); re-exports too, 2014–2025." },
    { href: "/explorer/trade/services", name: "Services trade", text: "total services trade (exports plus imports); 12 service types, 2020–2024." },
    { href: "/explorer/trade/composition", name: "Trade composition", text: "SITC and BEC groups, 2000–2025." },
    { href: "/explorer/external#t-external", name: "External flows", text: "" },
    { href: "/explorer/external/money-from-abroad", name: "Money from abroad", text: "money received from abroad; transfers received and sent, 2000–2025." },
    { href: "/explorer/external/foreign-investment", name: "Foreign investment", text: "FDI by country (1996–2025), sector (2016–2025) and region (2009–2025)." },
    { href: "/explorer/external/current-account", name: "Current account", text: "four parts, 2000–2025, USD or share of GDP." },
    { href: "/explorer/external/foreign-debt", name: "Foreign debt", text: "by debtor, 2006–2026, USD or share of GDP." },
    { href: "/explorer/external/reserves", name: "Reserves", text: "1995–2026, USD or share of GDP." },
    { href: "/explorer/society#t-energy-food", name: "Energy and food", text: "energy balance, 2013–2024; food self-sufficiency, 2014–2025; farming, 2006–2025." },
    { href: "/explorer/energy-food/energy-supply", name: "Energy supply", text: "supply by fuel, production and trade." },
    { href: "/explorer/energy-food/electricity", name: "Electricity", text: "electricity produced; production, trade and use." },
    { href: "/explorer/energy-food/energy-use", name: "Energy use", text: "final consumption by user and fuel." },
    { href: "/explorer/energy-food/food-self-sufficiency", name: "Food self-sufficiency", text: "twelve foods, percent." },
    { href: "/explorer/energy-food/farming", name: "Farming", text: "farm output from 2010, harvests and livestock, 2006–2025, prices from 2014." },
    { href: "/explorer/society#t-environment", name: "Environment and climate", text: "" },
    { href: "/explorer/environment/greenhouse-gases", name: "Greenhouse gases", text: "total, by sector and gas, 2000–2022." },
    { href: "/explorer/environment/air-pollution", name: "Air pollution", text: "eight pollutants, thousand tonnes, 2013–2024." },
    { href: "/explorer/environment/air-quality", name: "City air quality", text: "16 stations in nine cities, 2005–2025." },
    { href: "/explorer/environment/climate", name: "Temperature and rain", text: "1990, 1995 and from 2000 to 2024." },
    { href: "/explorer/environment/water", name: "Water", text: "million m³, 2015–2025." },
    { href: "/explorer/environment/waste", name: "Waste", text: "thousand tonnes, by region, 2015–2024." },
    { href: "/explorer/environment/forests", name: "Forests", text: "timber cut and illegal logging, m³, 2010–2024." },
    { href: "/explorer/society#t-transport", name: "Transport", text: "road vehicle fleet, 2000–2025." },
    { href: "/explorer/transport/vehicles", name: "Vehicles", text: "fleet by type, thousands, 2000–2025; by fuel from 2017." },
    { href: "/explorer/transport/vehicle-age", name: "Vehicle age", text: "by age, thousands, 2017–2025." },
    { href: "/explorer/transport/passengers", name: "Passengers", text: "passenger-km and passengers, 2000–2025." },
    { href: "/explorer/transport/freight", name: "Freight", text: "tonne-km and goods carried, 2000–2025." },
    { href: "/explorer/transport/regions", name: "Transport by region", text: "registered vehicles by region, 2017–2025; road length, 2011–2024." },
    { href: "/explorer/demography", name: "Demography", text: "" },
    { href: "/explorer/demography/population", name: "Population", text: "on 1 January: Georgia, 2004–2026; regions and municipalities, 2015–2026. Bulk file: [Population CSV](https://fiscal.ge/downloads/data/population.csv)." },
    { href: "/explorer/demography/migration", name: "Migration", text: "by sex and citizenship, 2012–2025." },
    { href: "/explorer/demography/births-deaths", name: "Births, deaths and fertility", text: "births and deaths, Georgia 2014–2025, regions and municipalities 2015–2025; fertility and life expectancy." },
    { href: "/explorer/demography/marriages-divorces", name: "Marriages and divorces", text: "counts or per 1,000 residents, Georgia 1994–2025, regions and municipalities 2009–2025." },
    { href: "/explorer/demography/age-sex", name: "Age and sex", text: "population pyramid, 2004–2026." },
  ],
];

const METHODOLOGY: LlmsLine[][] = [
  [
    { href: "/methodology", name: "Methodology hub", text: "" },
    { href: "/methodology/expenditure", name: "Expenditure", text: "" },
    { href: "/methodology/expenditure-types", name: "Spending by type", text: "" },
    { href: "/methodology/revenue", name: "Revenue", text: "" },
    { href: "/methodology/tax-breaks-refunds", name: "Tax breaks and refunds", text: "" },
    { href: "/methodology/municipalities", name: "Municipal budgets", text: "" },
    { href: "/methodology/debt", name: "Government debt", text: "" },
  ],
  [
    { href: "/methodology/gdp", name: "GDP", text: "" },
    { href: "/methodology/economic-sectors", name: "Economic sectors", text: "" },
    { href: "/methodology/gdp-expenditure", name: "GDP by expenditure", text: "" },
    { href: "/methodology/regional-economies", name: "Regional economies", text: "" },
    { href: "/methodology/business", name: "Business", text: "" },
    { href: "/methodology/housing", name: "Housing", text: "" },
    { href: "/methodology/inflation", name: "Inflation", text: "" },
    { href: "/methodology/money", name: "Money and banks", text: "" },
    { href: "/methodology/unemployment", name: "Unemployment", text: "" },
    { href: "/methodology/wages", name: "Wages", text: "" },
    { href: "/methodology/household-income", name: "Household income and spending", text: "" },
    { href: "/methodology/poverty", name: "Poverty", text: "" },
    { href: "/methodology/health", name: "Health", text: "" },
    { href: "/methodology/education", name: "Education", text: "" },
    { href: "/methodology/social-protection", name: "Social protection", text: "" },
    { href: "/methodology/science-culture", name: "Science and culture", text: "" },
    { href: "/methodology/crime", name: "Crime and justice", text: "" },
    { href: "/methodology/internet", name: "Internet and technology", text: "" },
    { href: "/methodology/trade", name: "Trade", text: "" },
    { href: "/methodology/external-flows", name: "External flows", text: "" },
    { href: "/methodology/energy-food", name: "Energy and food", text: "" },
    { href: "/methodology/environment", name: "Environment and climate", text: "" },
    { href: "/methodology/transport", name: "Transport", text: "" },
    { href: "/methodology/demography", name: "Demography", text: "" },
  ],
];

const BULK_FILES: LlmsLine[][] = [
  [
    { href: "/downloads/data/gdp-overview.json", name: "GDP overview", text: "also as the [GDP CSV](https://fiscal.ge/downloads/data/gdp-overview.csv). 7.5 means 7.5%." },
    { href: "/downloads/data/economic-sectors.json", name: "Economic sectors JSON", text: "also as the [economic sectors CSV](https://fiscal.ge/downloads/data/economic-sectors.csv). Nominal GEL and GDP shares cover 2010–2025; real growth covers 2011–2025, with 2010 explicitly missing." },
    { href: "/downloads/data/regional-economies.json", name: "Regional economies JSON", text: "also as the [regional economies CSV](https://fiscal.ge/downloads/data/regional-economies.csv)." },
    { href: "/downloads/data/inflation-national.json", name: "Inflation, national", text: "monthly CPI and NBG target; 2.4 means 2.4%." },
    { href: "/downloads/data/inflation-categories.csv", name: "Inflation categories CSV", text: "with [its metadata](https://fiscal.ge/downloads/data/inflation-categories.json): group changes and contributions." },
    { href: "/downloads/data/inflation-cities.csv", name: "Inflation cities CSV", text: "with [its metadata](https://fiscal.ge/downloads/data/inflation-cities.json)." },
    { href: "/downloads/data/inflation-products.csv", name: "Inflation products CSV", text: "with [its metadata](https://fiscal.ge/downloads/data/inflation-products.json): price indices (base 100)." },
    { href: "/downloads/data/manifest.json", name: "Data manifest", text: "" },
    { href: "/downloads/data/government-debt.json", name: "Government debt", text: "debt stock and service, GEL." },
    { href: "/downloads/data/general-government-balance.json", name: "General government balance", text: "share of GDP; negative is a deficit." },
    { href: "/downloads/data/catalogue.json", name: "Capability catalogue", text: "datasets, entities and series." },
    { href: "/downloads/data/sources.json", name: "Source resolution", text: "every source and its originals." },
  ],
];

const SITE_NAVIGATION: LlmsLine[][] = [
  [
    { href: "/en", name: "English home", text: "scope and coverage." },
    { href: "/en/explorer", name: "English All data", text: "" },
    { href: "/en/methodology/expenditure", name: "English methodology", text: "" },
  ],
  [
    { href: "/about", name: "Mission — Fiscal.ge", text: "purpose and data boundaries." },
    { href: "/sitemap.xml", name: "Sitemap", text: "all public HTML pages." },
  ],
];

const AI_CONNECTION = `\`${SITE}/mcp\` is a read-only, unauthenticated MCP server. Call describe_coverage first with one keyword: it returns the ids, measures and year or month ranges. Its current read-only tools are ${TOOLS.map((tool) => tool.name).join(", ")}; tools/list is authoritative. Clients must accept additive fields and data schema ${SCHEMA_VERSION}. Setup: [Connect an AI assistant](${SITE}/connect), [in English](${SITE}/en/connect).`;

/**
 * `latest: <figure> (<period>). `: the card's figure as its footer prints it. A caption that starts in lower case
 * completes the value (`−1.5% of GDP`); any other names it (`Refunds: 2.7 bn GEL`). A card's headline caption, a name
 * whose line already says the rest, replaces its caption (`Türkiye: 3.11 billion USD`, not `Türkiye, largest: …`). A
 * dated point's `2026 (Jun)` reads `Jun 2026`, and a preliminary figure says so after its period.
 */
export function latestText(latest: CardLatest): string {
  const { value } = latest;
  const caption = latest.headlineCaption ?? latest.caption;
  const figure = !caption ? value : /^\p{Ll}/u.test(caption) ? `${value} ${caption}` : `${caption}: ${value}`;
  const period = latest.period.replace(/^(\d{4}) \((.+)\)$/, "$2 $1");
  return `latest: ${figure} (${latest.status === "preliminary" ? `${period}, preliminary` : period}). `;
}

/** A card's figure, or, for a card without one, the years it covers. */
type CardSummary = { latest?: CardLatest | null; years?: string };

/** A line whose card has a figure opens with it; one whose card has none opens with the card's years unless its text states them. */
function renderLines(groups: LlmsLine[][], cards: Map<string, CardSummary> = new Map()): string {
  return groups.map((lines) => lines.map(({ href, name, text }) => {
    const card = cards.get(href);
    const lead = card?.latest ? latestText(card.latest) : card?.years && !text.includes(card.years) ? `${card.years}. ` : "";
    const description = lead ? `${lead}${text.charAt(0).toUpperCase()}${text.slice(1)}` : text;
    return `- [${name}](${SITE}${href})${description ? ` — ${description}` : ""}`;
  }).join("\n")).join("\n\n");
}

/** The guide served at /llms.txt, with each page's latest figure from its group-page card (English). */
export async function llmsText(): Promise<string> {
  const hubs = await loadTopicHubs("en", NAV_GROUPS.flatMap((group) => group.topics));
  const cards = new Map<string, CardSummary>();
  for (const card of hubs.flatMap((hub) => hub.cards)) {
    if (card.href !== null) cards.set(card.href, card);
  }
  return `${OPENING}

${whereTheDataIs()}

## Core data

${renderLines(CORE_DATA, cards)}

## Methodology and sources

${renderLines(METHODOLOGY)}

## Bulk data files

${renderLines(BULK_FILES)}

## AI connection

${AI_CONNECTION}

## Site navigation

${renderLines(SITE_NAVIGATION)}
`;
}
