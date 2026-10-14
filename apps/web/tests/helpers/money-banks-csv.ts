import { readCsvRecords } from "../../lib/data/csv";
import { moneyBanksDisplayDecimals } from "../../lib/data/moneyBanks/validation";
import { SERVED_DATA_FILES } from "../../lib/data/servedData";
import { formatBn, formatInUnit } from "../../lib/explorer/format";

/**
 * The reviewed Money and banks CSV and the national GDP its % of GDP view divides by, so the unit
 * and browser tests read their expected figures from the data instead of pinning an NBG release.
 */
export async function loadMoneyBanksCsv() {
  const [money, gdp] = await Promise.all([readCsvRecords("../../data/imports/money-banks-annual.csv"), readCsvRecords(SERVED_DATA_FILES.gdpFacts)]);
  const row = (id: string, year: number) => {
    const found = money.find(entry => entry.indicator_id === id && Number(entry.year) === year);
    if (!found) throw new Error(`No money and banks row for ${id} in ${year}`);
    return found;
  };
  const published = (id: string, year: number) => Number(row(id, year).published_value);
  /** Every year any of the series has a value, ascending. */
  const yearsOf = (ids: readonly string[]) => [...new Set(money.filter(entry => ids.includes(entry.indicator_id)).map(entry => Number(entry.year)))].sort((a, b) => a - b);
  const gdpRow = (year: number) => gdp.find(entry => Number(entry.year) === year);
  const gdpYears = gdp.map(entry => Number(entry.year));
  return {
    published,
    yearsOf,
    /** The years the series can be shown against GDP: those with both a value and a GDP. */
    gdpYearsOf: (ids: readonly string[]) => yearsOf(ids).filter(year => gdpYears.includes(year)),
    latestYear: (id: string) => yearsOf([id]).at(-1)!,
    /** A December amount as a percent of the year's nominal GDP, both in million lari. */
    shareOfGdp: (id: string, year: number) => published(id, year) / Number(gdpRow(year)!.gdp_current_prices_million_gel) * 100,
    isPreliminaryGdp: (year: number) => gdpRow(year)?.status === "preliminary",
    /** A million-lari amount as the pages print it in billions, through the site's formatter: `57.7`. */
    billions: (id: string, year: number) => formatBn(published(id, year) * 1_000_000),
    /** A percent series value at the page's precision, with a true minus sign, through the site's formatter: `−2.5`. */
    percent: (id: string, year: number) => formatInUnit(published(id, year), { divisor: 1, label: "", decimals: moneyBanksDisplayDecimals(id) }),
    sourceYears: (sourceId: string) => [...new Set(money.filter(entry => entry.source_id === sourceId).map(entry => Number(entry.year)))].sort((a, b) => a - b),
  };
}

/** `1995–2025`, the way the year-range strip and hub cards print a span. */
export const yearSpan = (years: readonly number[]) => `${years[0]}–${years.at(-1)}`;
