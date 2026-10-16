import Decimal from "decimal.js";
import {
  BUSINESS_DEMOGRAPHY_REGIONS, BUSINESS_DEMOGRAPHY_SECTORS, BUSINESS_FIRM_COUNT_MEASURES, BUSINESS_INDICATORS, BUSINESS_REGIONS, BUSINESS_SECTOR_UNKNOWN,
  BUSINESS_SIZES, BUSINESS_SOURCES, BUSINESS_SURVEY_MEASURES, BUSINESS_SURVEY_SECTORS, businessFactKey, type BusinessFact, type BusinessMeasure,
} from "./types";

const D = Decimal.clone({ precision: 50, rounding: Decimal.ROUND_HALF_UP });
/** The research package computes rates with 28 significant digits, round-half-even, before rounding them for display. */
const CALC = Decimal.clone({ precision: 28, rounding: Decimal.ROUND_HALF_EVEN });
const range = (start: number, end: number) => Array.from({ length: end - start + 1 }, (_, i) => start + i);
const LAST_YEAR = 2025;
/** Survey years per measure; region columns start in 2006 (Remark_eng.pdf, item 5); firms run 2014–2024. */
const SURVEY_FIRST_YEAR: Record<(typeof BUSINESS_SURVEY_MEASURES)[number], number> = { turnover: 1999, employed: 1999, investment: 2006, profit: 2006, loss: 2006 };
const REGION_FIRST_YEAR = 2006;
const FIRM_YEARS = [2014, 2024] as const;
/** The 2016 and 2019 activity sheets print no death-rate column, so section death rates are unavailable then. */
const NO_SECTION_DEATH_RATE = [2016, 2019];
const UNITS: Record<BusinessMeasure, BusinessFact["unit"]> = {
  turnover: "gel_million", employed: "persons", investment: "gel_million", profit: "gel_million", loss: "gel_million",
  active: "enterprises", births: "enterprises", deaths: "enterprises", birth_rate: "percent", death_rate: "percent",
};
const SOURCES: Record<BusinessMeasure, string> = {
  turnover: "geostat_business_turnover", employed: "geostat_business_employed", investment: "geostat_business_investment",
  profit: "geostat_business_profit_loss", loss: "geostat_business_profit_loss", active: "geostat_business_demography",
  births: "geostat_business_demography", deaths: "geostat_business_demography", birth_rate: "geostat_business_demography", death_rate: "geostat_business_demography",
};
/** Parts may differ from the printed total by Geostat's rounding: amounts by 0.15 million GEL, persons by 2, firm counts not at all. */
const TOLERANCE: Record<BusinessFact["unit"], string> = { gel_million: "0.15", persons: "2", enterprises: "0", percent: "0" };
/**
 * The research package's `KNOWN_DIFFERENCES` (prepare.py): years whose printed parts minus the printed total differ by
 * exactly this amount, which must stay as recorded. Sizes and sectors from 2006: rounding of up to 15 printed values.
 * Sectors 1999–2005: the totals still include section K (Remark_eng.pdf, item 1). Regions: the 11 regions fall short of
 * Georgia and the workbooks say why nowhere. Every other year must add up within the tolerance.
 */
const KNOWN_DIFFERENCES: Record<string, Record<number, string>> = {
  "turnover.size": { 2011: "-0.2" },
  "turnover.sector": { 1999: "-1.4", 2000: "-2.9", 2001: "-2.4", 2002: "-1.7", 2003: "-2.2", 2004: "-5.4", 2005: "-19.1", 2009: "-0.2", 2025: "-0.2" },
  "employed.sector": { 1999: "-240", 2000: "-252", 2001: "-322", 2002: "-255", 2003: "-244", 2004: "-271", 2005: "-449" },
  "investment.sector": { 2009: "0.2", 2014: "-0.2", 2017: "0.2" },
  "profit.sector": { 2017: "-0.2" },
  "loss.sector": { 2012: "0.2", 2013: "0.2", 2020: "-0.2", 2021: "-0.2", 2025: "-0.2" },
  "turnover.region": {
    2006: "-29.8", 2007: "-41.5", 2008: "-45.2", 2009: "-42.0", 2010: "-59.5", 2011: "-45.3", 2012: "-44.1", 2013: "-50.0", 2014: "-61.8", 2015: "-53.5",
    2016: "-61.5", 2017: "-79.0", 2018: "-105.1", 2019: "-90.1", 2020: "-50.9", 2021: "-116.3", 2022: "-129.5", 2023: "-116.1", 2024: "-126.3", 2025: "-170.1",
  },
  "employed.region": {
    2006: "-901", 2007: "-950", 2008: "-973", 2009: "-1052", 2010: "-1100", 2011: "-1073", 2012: "-1110", 2013: "-1152", 2014: "-1130", 2015: "-1175",
    2016: "-1182", 2017: "-1208", 2018: "-1178", 2019: "-1285", 2020: "-1206", 2021: "-1305", 2022: "-1413", 2023: "-1407", 2024: "-1391", 2025: "-1361",
  },
  "investment.region": {
    2006: "-60.2", 2007: "-36.9", 2008: "-4.0", 2009: "-10.3", 2010: "-28.8", 2011: "-10.2", 2012: "-1.1", 2013: "-26.9", 2014: "-29.6", 2015: "-1.5",
    2016: "-55.7", 2017: "-24.4", 2018: "-17.2", 2019: "-14.5", 2020: "-8.4", 2021: "-86.7", 2022: "-72.9", 2023: "-28.5", 2024: "-3.8", 2025: "-6.6",
  },
  "profit.region": {
    2006: "-0.9", 2009: "-0.8", 2010: "-14.1", 2011: "-2.2", 2012: "-1.5", 2013: "-0.3", 2014: "-10.9", 2016: "-0.2", 2017: "-5.9",
    2018: "-26.3", 2019: "-15.1", 2020: "-0.7", 2021: "-43.6", 2022: "-62.1", 2023: "-0.9", 2024: "-3.8", 2025: "-7.4",
  },
  "loss.region": {
    2007: "-2.3", 2008: "-9.5", 2009: "-1.5", 2011: "-1.5", 2012: "-1.6", 2013: "-2.8", 2015: "-13.4", 2016: "-7.1", 2017: "-9.5",
    2018: "-0.2", 2019: "-8.3", 2020: "-59.3", 2021: "-1.3", 2022: "-4.2", 2023: "-9.0", 2025: "-1.0",
  },
};
/** What Geostat prints, as published. */
const ANCHORS: readonly (readonly [string, number, string])[] = [
  ["business.turnover.total", 2025, "253725.5"], ["business.turnover.size_large", 2025, "173004.5"], ["business.turnover.region_tbilisi", 2025, "200837.9"],
  ["business.employed.total", 2025, "899026"], ["business.investment.total", 2025, "8021.8"], ["business.profit.total", 2025, "27936.1"],
  ["business.loss.total", 2025, "7152.9"], ["business.active.total", 2024, "249236"], ["business.births.total", 2024, "56259"],
  ["business.deaths.total", 2024, "29634"], ["business.birth_rate.total", 2024, "22.6"],
];
const RATES = { birth_rate: "births", death_rate: "deaths" } as const;
const parts = (indicatorId: string) => indicatorId.split(".") as [string, BusinessMeasure, string];
const isSurvey = (measure: BusinessMeasure) => (BUSINESS_SURVEY_MEASURES as readonly string[]).includes(measure);

/** The years an indicator is served, as the research package's coverage.csv lists them (without unavailable years). */
function servedYears(measure: BusinessMeasure, group: string): number[] {
  if (isSurvey(measure)) {
    const first = SURVEY_FIRST_YEAR[measure as keyof typeof SURVEY_FIRST_YEAR];
    return range(group.startsWith("region_") ? Math.max(first, REGION_FIRST_YEAR) : first, LAST_YEAR);
  }
  return range(...FIRM_YEARS).filter(year => !(measure === "death_rate" && group !== "total" && NO_SECTION_DEATH_RATE.includes(year)));
}

/** Every key the serving package must contain, exactly once. */
export function expectedBusinessKeys(): Set<string> {
  const keys = new Set<string>();
  for (const indicatorId of BUSINESS_INDICATORS) {
    const [, measure, group] = parts(indicatorId);
    for (const year of servedYears(measure, group)) keys.add(`${indicatorId}:${year}`);
  }
  return keys;
}

/** Amounts and rates are shown with one decimal, persons and firms as whole numbers. */
export function businessDisplayDecimals(indicatorId: string): 0 | 1 {
  return ["gel_million", "percent"].includes(UNITS[parts(indicatorId)[1]]) ? 1 : 0;
}

export function validateBusinessFacts(facts: readonly BusinessFact[]): void {
  const expected = expectedBusinessKeys();
  const values = new Map<string, Decimal>();
  const shown = new Map<string, Decimal>();
  for (const fact of facts) {
    const key = businessFactKey(fact);
    if (!BUSINESS_INDICATORS.includes(fact.indicatorId)) throw new Error(`Invalid business identity: ${key}`);
    const [, measure, group] = parts(fact.indicatorId);
    if (fact.year > LAST_YEAR) throw new Error(`Business observation after 2025: ${key}`);
    if (isSurvey(measure) && group.startsWith("region_") && fact.year < REGION_FIRST_YEAR) throw new Error(`Business survey region before 2006: ${key}`);
    if (!expected.has(key)) throw new Error(`Business observation outside the approved coverage: ${key}`);
    if (values.has(key)) throw new Error(`Duplicate business observation: ${key}`);
    if (fact.unit !== UNITS[measure] || fact.basis !== "actual" || fact.valueStatus !== "official" || fact.sourceId !== SOURCES[measure]
      || !fact.sourceSheet || !/^[A-Z]+\d+$/.test(fact.sourceCell) || !/^\d{4}-\d{2}-\d{2}$/.test(fact.lastReviewedAt)) throw new Error(`Invalid business source contract: ${key}`);
    let value: Decimal;
    try { value = new D(fact.value); } catch { throw new Error(`Invalid business value: ${key}`); }
    // Loss is printed as a positive amount; a rate may pass 100 (Geostat prints 628.2% for firms of unknown activity in 2020).
    if (!value.isFinite() || value.lt(0) || value.decimalPlaces() > 30) throw new Error(`Business value outside its range or database precision: ${key}`);
    // Round half-up from the value as Excel displays it (15 significant digits).
    if (fact.publishedValue !== value.toSignificantDigits(15).toFixed(businessDisplayDecimals(fact.indicatorId))) throw new Error(`Business published value does not match its stored value: ${key}`);
    values.set(key, value);
    shown.set(key, new D(fact.publishedValue));
  }
  const missing = [...expected].filter(key => !values.has(key));
  if (missing.length) throw new Error(`Incomplete business coverage: ${missing.length} missing, first ${missing[0]}`);
  for (const [indicatorId, year, published] of ANCHORS) if (facts.find(f => f.indicatorId === indicatorId && f.year === year)!.publishedValue !== published) throw new Error(`Business anchor value changed: ${indicatorId}:${year}`);

  const addsUp = (measure: BusinessMeasure, kind: string, groups: readonly string[], years: readonly number[]) => {
    const unit = UNITS[measure], known = KNOWN_DIFFERENCES[`${measure}.${kind}`] ?? {}, places = unit === "persons" || unit === "enterprises" ? 0 : 1;
    const sum = (map: Map<string, Decimal>, year: number) => groups.reduce((total, group) => total.plus(map.get(`business.${measure}.${group}:${year}`)!), new D(0));
    for (const year of years) {
      const total = `business.${measure}.total:${year}`;
      const failed = year in known
        ? sum(shown, year).minus(shown.get(total)!).toFixed(places) !== known[year]
        : sum(values, year).minus(values.get(total)!).abs().gt(TOLERANCE[unit]);
      if (failed) throw new Error(`The business ${measure} ${kind}s do not add up to the total in ${year} as recorded`);
    }
  };
  for (const measure of BUSINESS_SURVEY_MEASURES) {
    const years = range(SURVEY_FIRST_YEAR[measure], LAST_YEAR);
    addsUp(measure, "size", BUSINESS_SIZES, years);
    addsUp(measure, "sector", BUSINESS_SURVEY_SECTORS, years);
    addsUp(measure, "region", BUSINESS_REGIONS, range(REGION_FIRST_YEAR, LAST_YEAR));
  }
  for (const measure of BUSINESS_FIRM_COUNT_MEASURES) {
    addsUp(measure, "region", BUSINESS_DEMOGRAPHY_REGIONS, range(...FIRM_YEARS));
    addsUp(measure, "section", [...BUSINESS_DEMOGRAPHY_SECTORS, BUSINESS_SECTOR_UNKNOWN], range(...FIRM_YEARS));
  }
  for (const [key, value] of values) {
    const [indicatorId, year] = key.split(":");
    const [, measure, group] = parts(indicatorId);
    if (!(measure in RATES)) continue;
    const counts = RATES[measure as keyof typeof RATES];
    const ratio = new CALC(values.get(`business.${counts}.${group}:${year}`)!).times(100).div(values.get(`business.active.${group}:${year}`)!);
    if (ratio.toSignificantDigits(15, Decimal.ROUND_HALF_UP).toFixed(1, Decimal.ROUND_HALF_UP) !== value.toSignificantDigits(15).toFixed(1)) {
      throw new Error(`The business ${measure} is not ${counts} per 100 active firms: ${key}`);
    }
  }
  if (!BUSINESS_SOURCES.every(id => facts.some(f => f.sourceId === id))) throw new Error("Business source missing from the serving package");
}
