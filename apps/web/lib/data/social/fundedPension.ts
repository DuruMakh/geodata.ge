import Decimal from "decimal.js";
import {
  FUNDED_PENSION_SOURCES, SOCIAL_GEORGIA, SOCIAL_INDICATORS, socialFactKey, type SocialFact, type SocialIndicator,
} from "./types";

const PREFIX = "social.funded_pension.";
export const FUNDED_PENSION_FIRST_YEAR = 2019;
export const FUNDED_PENSION_LAST_YEAR = 2025;
/** The Pension Fund's statements print gains on securities and dividends from 2022; before it they have no line, and a gap is not a zero. */
const LATE_MEASURES = ["securities_gains", "dividends"];
/** Stocks on 31 December and cumulative counts are positions (1 month); flows and the return cover the year. */
const POSITIONS = ["savings", "net_assets", "members", "employers"];
const FUNDED_INDICATORS = SOCIAL_INDICATORS.filter(id => id.startsWith(PREFIX));
/** The audited IFRS statement that serves each year's money: the latest one that prints the year as text (the 2021 statement is a scanned image). */
const MONEY_SOURCES: Readonly<Record<number, string>> = {
  2019: "pension_fund_ifrs_2020", 2020: "pension_fund_ifrs_2020", 2021: "pension_fund_ifrs_2022", 2022: "pension_fund_ifrs_2023",
  2023: "pension_fund_ifrs_2024", 2024: "pension_fund_ifrs_2025", 2025: "pension_fund_ifrs_2025",
};
const COUNT_SOURCE = "pension_fund_report_2025";
/** The file each source is: a fact's workbook is its source's document, never another. */
const DOCUMENTS: Readonly<Record<string, string>> = {
  pension_fund_ifrs_2020: "2020-IFRS.pdf", pension_fund_ifrs_2022: "2022-IFRS-GE.pdf", pension_fund_ifrs_2023: "2023-IFRS-GE.pdf",
  pension_fund_ifrs_2024: "2024-IFRS-GE.pdf", pension_fund_ifrs_2025: "2025-IFRS.pdf", pension_fund_report_2025: "Annual_Rep_2025_geo.pdf",
};
/** Spec §4's anchors, as printed (money in GEL, the return in percent). */
const ANCHORS: readonly (readonly [indicatorId: SocialIndicator, year: number, value: string])[] = [
  [`${PREFIX}savings.amount`, 2025, "8237530000"], [`${PREFIX}savings.amount`, 2019, "508031000"], [`${PREFIX}net_assets.amount`, 2025, "8365433000"],
  [`${PREFIX}contributions.amount`, 2025, "1431780000"], [`${PREFIX}contributions_state.amount`, 2025, "370989000"],
  [`${PREFIX}securities_gains.amount`, 2022, "-31187000"], [`${PREFIX}members`, 2025, "1705365"], [`${PREFIX}members`, 2019, "958226"],
  [`${PREFIX}employers`, 2025, "145780"], [`${PREFIX}return`, 2025, "11.8"],
];

export const isFundedPension = (id: string): boolean => id.startsWith(PREFIX);
const measureOf = (id: string) => id.slice(PREFIX.length).replace(/\.amount$/, "");

export function fundedPensionUnit(id: string): SocialFact["unit"] {
  const measure = measureOf(id);
  if (id.endsWith(".amount")) return "gel";
  if (measure === "employers") return "employers";
  return measure === "return" ? "percent" : "persons";
}
export function fundedPensionMonths(id: string): 1 | 12 {
  return POSITIONS.includes(measureOf(id)) ? 1 : 12;
}
export function fundedPensionFirstYear(id: string): 2019 | 2022 {
  return LATE_MEASURES.includes(measureOf(id)) ? 2022 : 2019;
}
/** The statement that serves a fact: money by year, counts and the return from the 2025 annual report. */
function fundedPensionSource(id: string, year: number): string {
  return id.endsWith(".amount") ? MONEY_SOURCES[year] : COUNT_SOURCE;
}
/** The stored form of a value: whole GEL (negative only for gains on securities), whole counts, the return to one decimal; no leading zeros, no "-0". */
function validValue(id: string, value: string): boolean {
  if (id === `${PREFIX}return`) return /^(0|[1-9]\d*)\.\d$/.test(value);
  return (id === `${PREFIX}securities_gains.amount` ? /^(0|-?[1-9]\d*)$/ : /^(0|[1-9]\d*)$/).test(value);
}

/**
 * The funded pension rows alone: exactly 2019–2025 for every measure (2022–2025 for gains on securities and dividends), Georgia only,
 * each value one printed figure of the year's statement, the three contribution parts adding up to the total, and Spec §4's anchors.
 */
export function validateFundedPensionFacts(facts: readonly SocialFact[]): void {
  const expected = new Set<string>();
  for (const indicatorId of FUNDED_INDICATORS) {
    for (let year = fundedPensionFirstYear(indicatorId); year <= FUNDED_PENSION_LAST_YEAR; year++) expected.add(socialFactKey({ indicatorId, geographyId: SOCIAL_GEORGIA, year }));
  }
  const byKey = new Map<string, SocialFact>();
  for (const fact of facts) {
    const key = socialFactKey(fact);
    if (!FUNDED_INDICATORS.includes(fact.indicatorId)) throw new Error(`Invalid funded pension identity: ${key}`);
    if (!Number.isInteger(fact.year) || fact.year < FUNDED_PENSION_FIRST_YEAR || fact.year > FUNDED_PENSION_LAST_YEAR || !expected.has(key)) throw new Error(`Funded pension observation outside the approved coverage: ${key}`);
    if (byKey.has(key)) throw new Error(`Duplicate funded pension observation: ${key}`);
    byKey.set(key, fact);
    if (fact.unit !== fundedPensionUnit(fact.indicatorId) || fact.months !== fundedPensionMonths(fact.indicatorId) || fact.basis !== "actual" || fact.valueStatus !== "official"
      || fact.sourceId !== fundedPensionSource(fact.indicatorId, fact.year) || fact.sourceWorkbook !== DOCUMENTS[fact.sourceId] || !fact.sourceSheet || !fact.sourceCell
      || !/^\d{4}-\d{2}-\d{2}$/.test(fact.lastReviewedAt)) throw new Error(`Invalid funded pension source contract: ${key}`);
    if (!validValue(fact.indicatorId, fact.value)) throw new Error(`Invalid funded pension value: ${key}`);
  }
  const missing = [...expected].filter(key => !byKey.has(key));
  if (missing.length) throw new Error(`Incomplete funded pension coverage: ${missing.length} missing, first ${missing[0]}`);
  for (let year = FUNDED_PENSION_FIRST_YEAR; year <= FUNDED_PENSION_LAST_YEAR; year++) {
    const value = (measure: string) => new Decimal(byKey.get(socialFactKey({ indicatorId: `${PREFIX}${measure}.amount` as SocialIndicator, geographyId: SOCIAL_GEORGIA, year }))!.value);
    const parts = value("contributions_private").plus(value("contributions_public")).plus(value("contributions_state"));
    if (!parts.eq(value("contributions"))) throw new Error(`The funded pension contribution parts do not add up to all contributions in ${year}: parts ${parts.toFixed()}, total ${value("contributions").toFixed()}`);
  }
  for (const [indicatorId, year, value] of ANCHORS) {
    if (byKey.get(socialFactKey({ indicatorId, geographyId: SOCIAL_GEORGIA, year }))?.value !== value) throw new Error(`Funded pension anchor value changed: ${indicatorId}:${SOCIAL_GEORGIA}:${year}`);
  }
  if (!FUNDED_PENSION_SOURCES.every(id => facts.some(f => f.sourceId === id))) throw new Error("Funded pension source missing from the serving file");
}
