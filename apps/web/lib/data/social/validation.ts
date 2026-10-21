import Decimal from "decimal.js";
import {
  SOCIAL_AGE_BANDS, SOCIAL_GEORGIA, SOCIAL_INDICATORS, SOCIAL_MUNICIPALITIES, SOCIAL_PACKAGE_GROUPS, SOCIAL_PAYMENT_PROGRAMMES, SOCIAL_PUBLIC_SOURCES, SOCIAL_REGIONS, SOCIAL_UNITS,
  socialFactKey, type SocialFact, type SocialIndicator, type SocialPaymentProgramme,
} from "./types";

const D = Decimal.clone({ precision: 50, rounding: Decimal.ROUND_HALF_UP });
const range = (start: number, end: number) => Array.from({ length: end - start + 1 }, (_, i) => start + i);
export const SOCIAL_FIRST_YEAR = 2013;
export const SOCIAL_LAST_YEAR = 2025;
const PLACES = [SOCIAL_GEORGIA, ...SOCIAL_REGIONS, ...Object.values(SOCIAL_MUNICIPALITIES).flat(), ...Object.keys(SOCIAL_UNITS)];

/**
 * First served year of each series. Counts start at their first December; money starts at its first 12-month year
 * (prepare drops the partial years before it): the high-mountain pension supplement is paid from September 2016, the
 * employment-programme money is printed only in December 2022, the disability severity columns start in October 2017
 * and war participants in June 2019. Payments rows keep every year SSA published.
 */
const FIRST_YEARS: Partial<Record<SocialIndicator, number>> = {
  "social.pension.recipients": 2013, "social.pension.amount": 2013, "social.pension_idp.recipients": 2013, "social.pension_idp.amount": 2013,
  "social.pension_highmountain.recipients": 2016, "social.pension_highmountain.amount": 2017,
  "social.subsistence.families": 2013, "social.subsistence.employment_families": 2022, "social.subsistence.registered_families": 2013,
  "social.subsistence.persons": 2013, "social.subsistence.registered_persons": 2013, "social.subsistence.amount": 2013, "social.subsistence.employment_amount": 2023,
  ...Object.fromEntries(SOCIAL_AGE_BANDS.map(band => [`social.subsistence.persons_age_${band}`, 2013])),
};
const PACKAGE_FIRST_YEARS: Record<string, readonly [recipients: number, amount: number]> = {
  total: [2013, 2013], disability: [2013, 2013], disability_children: [2017, 2018], disability_severe: [2017, 2018], disability_significant: [2017, 2018],
  disability_moderate: [2017, 2018], survivors: [2013, 2013], war_participants: [2019, 2020], political_repression: [2013, 2013], other: [2013, 2013],
};
/** The years each programme's money is published, partial years included. */
const PAYMENT_YEARS: Record<SocialPaymentProgramme, readonly [number, number]> = {
  pension: [2013, 2025], pension_highmountain: [2016, 2025], social_package: [2013, 2025], social_package_highmountain: [2016, 2025],
  subsistence_allowance: [2013, 2025], idp_refugee_allowance: [2013, 2025], compensation_stipend: [2013, 2025], maternity: [2013, 2025],
  child_benefit_3rd_plus: [2014, 2025], child_benefit_highmountain: [2016, 2025], utility_subsidy: [2013, 2025], electricity_tariff_subsidy: [2015, 2025],
  highmountain_electricity: [2017, 2025], electricity_large_families: [2019, 2025], water_subsidy: [2021, 2025], highmountain_doctors_nurses: [2016, 2025],
  workplace_injury: [2013, 2025], covid_vulnerable_compensation: [2020, 2021],
};
/** Each average and the served money it divides: it exists exactly where that money is served and is not zero (0 ÷ 0 is a gap). */
export const SOCIAL_AVERAGES: Readonly<Record<string, SocialIndicator>> = {
  "social.pension.avg_monthly": "social.pension.amount",
  "social.pension_highmountain.avg_monthly": "social.pension_highmountain.amount",
  "social.subsistence.avg_monthly": "social.subsistence.amount",
  ...Object.fromEntries(SOCIAL_PACKAGE_GROUPS.map(group => [`social.social_package.${group}.avg_monthly`, `social.social_package.${group}.amount` as SocialIndicator])),
};
/**
 * The reviewed register of averages whose monthly counts miss a month the money has. Prepare withholds every such average
 * (blank is not zero, so money ÷ counts would overstate it), and validation holds this register equal to the data both
 * ways. A gap in a national row has its `source-findings.csv` row, checked by prepare. SSA's July 2022 national row leaves
 * the moderate-disability count blank (socpackage-01 July E85). Its October 2014 sheet leaves the Upper Abkhazia
 * subsistence count blank (tsa_allowance-01 October B86); that year's Upper Abkhazia money is 0, so no average was served.
 */
export const SOCIAL_AVERAGE_GAPS: readonly { indicatorId: SocialIndicator; geographyId: string; year: number; finding?: { table: string; column: string } }[] = [
  { indicatorId: "social.subsistence.avg_monthly", geographyId: "unit.upper_abkhazia", year: 2014 },
  { indicatorId: "social.social_package.disability_moderate.avg_monthly", geographyId: SOCIAL_GEORGIA, year: 2022, finding: { table: "socpackage-01", column: "E" } },
];
/** The partition check of the social package groups' month-count sums, which only the average inputs hold. */
const COUNT_PARTITION = "social.social_package.count_months_sum groups";
/** The national programme value each payments row repeats. */
const PAYMENT_PROGRAMME_FACTS: Partial<Record<SocialPaymentProgramme, SocialIndicator>> = {
  pension: "social.pension.amount", pension_highmountain: "social.pension_highmountain.amount",
  social_package: "social.social_package.total.amount", subsistence_allowance: "social.subsistence.amount",
};
const PAYMENT_SOURCES: Record<SocialPaymentProgramme, string> = {
  pension: "ssa_pension_01", pension_highmountain: "ssa_pension_04", social_package: "ssa_socpackage_02", social_package_highmountain: "ssa_socpackage_10",
  subsistence_allowance: "ssa_tsa_allowance_02", idp_refugee_allowance: "ssa_idp_refugee_02", compensation_stipend: "ssa_compensation_04", maternity: "ssa_maternity_01",
  child_benefit_3rd_plus: "ssa_demography_02", child_benefit_highmountain: "ssa_demography_04", utility_subsidy: "ssa_utilitysubsidy_02",
  electricity_tariff_subsidy: "ssa_other_01", highmountain_electricity: "ssa_highmountain_03", electricity_large_families: "ssa_other_02", water_subsidy: "ssa_other_03",
  highmountain_doctors_nurses: "ssa_highmountain_01", workplace_injury: "ssa_workinjury_03", covid_vulnerable_compensation: "ssa_other_04",
};
/**
 * SSA's printed subtotals that differ from their own parts, with the source finding that shows the same difference in
 * the national total (`source-findings.csv`, checked by prepare). `difference` is the parts less the printed total. The
 * May 2022 social package money total (socpackage-02 L85) is 56 GEL less than its group columns, a reviewed finding of
 * the research package README; the May 2021 people total (socpackage-01 M91) is 1 more than its group columns, so the
 * groups' 2021 month-count sums add up to 1 less than the total's.
 */
export const SOCIAL_KNOWN_DIFFERENCES: readonly { check: string; year: number; difference: string; finding?: { table: string; column: string } }[] = [
  { check: "social.pension_idp.amount region.shida_kartli", year: 2015, difference: "404686", finding: { table: "pension-02", column: "D" } },
  { check: "social.subsistence.amount region.kvemo_kartli", year: 2013, difference: "-126", finding: { table: "tsa_allowance-02", column: "J" } },
  { check: "social.social_package.amount groups", year: 2022, difference: "56" },
  { check: COUNT_PARTITION, year: 2021, difference: "-1", finding: { table: "socpackage-01", column: "M" } },
];
/** Spec §8's anchors, as published or calculated. */
const ANCHORS: readonly (readonly [SocialIndicator, number, string])[] = [
  ["social.pension.recipients", 2025, "888518"], ["social.pension.amount", 2025, "4262309090"],
  ["social.pension.avg_monthly", 2025, "405.13"], ["social.pension.avg_monthly", 2013, "133.23"],
  ["social.subsistence.families", 2025, "129506"], ["social.subsistence.persons", 2025, "463122"],
  ["social.subsistence.employment_families", 2025, "54842"], ["social.subsistence.registered_families", 2025, "397144"],
  ["social.subsistence.amount", 2025, "855291818"], ["social.social_package.total.recipients", 2025, "187764"],
  ["social.social_package.total.amount", 2025, "544241359"], ["social.payments.total.amount", 2025, "6166123811"],
];
const PACKAGE_MEMBERS = ["disability", "survivors", "war_participants", "political_repression", "other"];
const DISABILITY_PARTS = ["disability_children", "disability_severe", "disability_significant", "disability_moderate"];

const isAverage = (indicatorId: string) => indicatorId.endsWith(".avg_monthly");
export const isMoney = (indicatorId: string) => /\.(amount|employment_amount)$/.test(indicatorId);
const isPayment = (indicatorId: string) => indicatorId.startsWith("social.payments.");

export function socialUnit(indicatorId: SocialIndicator): SocialFact["unit"] {
  if (isMoney(indicatorId) || isAverage(indicatorId)) return "gel";
  return /\.(families|employment_families|registered_families)$/.test(indicatorId) ? "families" : "persons";
}

/**
 * A stored value as the file writes it: whole units, or two decimals for an average. The database drops trailing zeros (`150.5`) and
 * the mirror pads them back; a value with more decimals than its indicator allows is left as it is, so validation rejects it.
 */
export function socialValueText(indicatorId: string, value: string): string {
  const places = isAverage(indicatorId) ? 2 : 0;
  const decimal = new D(value);
  return decimal.decimalPlaces() <= places ? decimal.toFixed(places) : decimal.toFixed();
}

/** An average in GEL: the year's money ÷ the sum of its monthly counts, rounded half-up to two decimals (50 significant digits before rounding). */
export function socialAverage(amount: string, count: string): string {
  return new D(amount).div(count).toFixed(2);
}

/** The source a fact must cite. Averages cite their money's table; the Social payments total cites SSA's statistics page. */
function expectedSource(indicatorId: SocialIndicator, year: number): string {
  const [, programme, group, measure] = indicatorId.split(".");
  if (programme === "payments") {
    if (group === "total") return "ssa_statistics";
    return group === "maternity" && year === 2013 ? "ssa_maternity_03" : PAYMENT_SOURCES[group as SocialPaymentProgramme];
  }
  if (programme === "pension") return "ssa_pension_01";
  if (programme === "pension_idp") return "ssa_pension_02";
  if (programme === "pension_highmountain") return "ssa_pension_04";
  if (programme === "social_package") return measure === "recipients" ? "ssa_socpackage_01" : "ssa_socpackage_02";
  if (group === "registered_families" || group === "registered_persons") return "ssa_tsa_db_01";
  if (group?.startsWith("persons_age_")) return "ssa_tsa_allowance_03";
  return isMoney(indicatorId) || isAverage(indicatorId) ? "ssa_tsa_allowance_02" : "ssa_tsa_allowance_01";
}

/** Every key the serving file must contain except the averages, whose keys follow the served money (`SOCIAL_AVERAGES`). */
export function expectedSocialKeys(): Set<string> {
  const keys = new Set<string>();
  const add = (indicatorId: string, geographies: readonly string[], first: number, last = SOCIAL_LAST_YEAR) => {
    for (const geographyId of geographies) for (const year of range(first, last)) keys.add(`${indicatorId}:${geographyId}:${year}`);
  };
  for (const [indicatorId, first] of Object.entries(FIRST_YEARS)) add(indicatorId, PLACES, first);
  for (const [group, [recipients, amount]] of Object.entries(PACKAGE_FIRST_YEARS)) {
    add(`social.social_package.${group}.recipients`, [SOCIAL_GEORGIA], recipients);
    add(`social.social_package.${group}.amount`, [SOCIAL_GEORGIA], amount);
  }
  for (const [programme, [first, last]] of Object.entries(PAYMENT_YEARS)) add(`social.payments.${programme}.amount`, [SOCIAL_GEORGIA], first, last);
  add("social.payments.total.amount", [SOCIAL_GEORGIA], SOCIAL_FIRST_YEAR);
  return keys;
}

/**
 * Money and count inputs of each average, by the average's key: the package's money (regular money for the subsistence
 * allowance) and month-count sum, with the months each covers.
 */
export type SocialAverageInputs = ReadonlyMap<string, { amount: string; count: string; amountMonths: number; countMonths: number }>;
type Mismatch = { check: string; year: number; difference: string };

/**
 * `averageInputs` holds the package's month-count sums, which are not served. With them every average is recalculated;
 * without them (a caller that only holds facts) that one check is skipped and everything else is checked.
 */
export function validateSocialFacts(facts: readonly SocialFact[], averageInputs?: SocialAverageInputs): void {
  const expected = expectedSocialKeys();
  const byKey = new Map<string, SocialFact>();
  for (const fact of facts) {
    const key = socialFactKey(fact);
    if (!(SOCIAL_INDICATORS as readonly string[]).includes(fact.indicatorId)) throw new Error(`Invalid social identity: ${key}`);
    if (!Number.isInteger(fact.year) || fact.year < SOCIAL_FIRST_YEAR || fact.year > SOCIAL_LAST_YEAR) throw new Error(`Social observation outside 2013–2025: ${key}`);
    if (byKey.has(key)) throw new Error(`Duplicate social observation: ${key}`);
    byKey.set(key, fact);
  }
  const amountOf = (fact: SocialFact) => byKey.get(socialFactKey({ ...fact, indicatorId: SOCIAL_AVERAGES[fact.indicatorId] }));
  for (const fact of facts) {
    const key = socialFactKey(fact);
    const average = isAverage(fact.indicatorId);
    const money = average ? amountOf(fact) : undefined;
    if (average ? !money || /^0+$/.test(money.value) : !expected.has(key)) throw new Error(`Social observation outside the approved coverage: ${key}`);
    const calculated = average || fact.indicatorId === "social.payments.total.amount";
    const months = isMoney(fact.indicatorId) ? Number.isInteger(fact.months) && fact.months >= 1 && fact.months <= 12 : average ? fact.months === money!.months : fact.months === 1;
    if (fact.unit !== socialUnit(fact.indicatorId) || fact.basis !== "actual" || !["official", "calculated"].includes(fact.valueStatus) || (calculated && fact.valueStatus !== "calculated")
      || !months || fact.sourceId !== expectedSource(fact.indicatorId, fact.year) || !fact.sourceWorkbook || !fact.sourceSheet || !fact.sourceCell
      || !/^\d{4}-\d{2}-\d{2}$/.test(fact.lastReviewedAt)) throw new Error(`Invalid social source contract: ${key}`);
    if (!(average ? /^\d+\.\d{2}$/ : /^\d+$/).test(fact.value)) throw new Error(`Invalid social value: ${key}`);
  }
  const missing = [...expected].filter(key => !byKey.has(key));
  if (missing.length) throw new Error(`Incomplete social coverage: ${missing.length} missing, first ${missing[0]}`);
  const recordedGap = (key: string) => SOCIAL_AVERAGE_GAPS.some(gap => socialFactKey(gap) === key);
  for (const [average, amount] of Object.entries(SOCIAL_AVERAGES)) {
    const gap = facts.find(f => f.indicatorId === amount && !/^0+$/.test(f.value) && !byKey.has(socialFactKey({ ...f, indicatorId: average as SocialIndicator }))
      && !recordedGap(socialFactKey({ ...f, indicatorId: average as SocialIndicator })));
    if (gap) throw new Error(`Incomplete social coverage: no ${average} for ${socialFactKey(gap)}`);
  }
  const servedGap = SOCIAL_AVERAGE_GAPS.find(gap => byKey.has(socialFactKey(gap)));
  if (servedGap) throw new Error(`Social recorded average gap is served: ${socialFactKey(servedGap)}`);

  const indexed = new Map<string, Map<number, SocialFact>>();
  for (const fact of facts) {
    const key = `${fact.indicatorId}|${fact.geographyId}`;
    if (!indexed.has(key)) indexed.set(key, new Map());
    indexed.get(key)!.set(fact.year, fact);
  }
  // A money or average series on a place page or the Social package starts in its first 12-month year.
  for (const [key, series] of indexed) {
    const first = series.get(Math.min(...series.keys()))!;
    if ((isMoney(first.indicatorId) || isAverage(first.indicatorId)) && !isPayment(first.indicatorId) && first.months !== 12) throw new Error(`Social money series has a partial first year: ${key.replace("|", ":")}:${first.year}`);
  }
  const series = (indicatorId: string, geographyId: string = SOCIAL_GEORGIA): ReadonlyMap<number, Decimal> =>
    new Map([...(indexed.get(`${indicatorId}|${geographyId}`) ?? new Map<number, SocialFact>())].map(([year, fact]) => [year, new D(fact.value)]));

  if (averageInputs) {
    for (const fact of facts.filter(f => isAverage(f.indicatorId))) {
      const input = averageInputs.get(socialFactKey(fact));
      if (!input) throw new Error(`Social average has no money and count inputs: ${socialFactKey(fact)}`);
      if (fact.indicatorId !== "social.subsistence.avg_monthly" && input.amount !== amountOf(fact)!.value) throw new Error(`Social average input money differs from the served money: ${socialFactKey(fact)}`);
      if (socialAverage(input.amount, input.count) !== fact.value) throw new Error(`Social average does not equal its money ÷ month-count sum: ${socialFactKey(fact)}`);
    }
    // The register and the data agree both ways: every average whose counts cover other months than its money is recorded
    // (and, above, not served), and every recorded gap still has them.
    for (const [key, input] of averageInputs) {
      if (input.countMonths !== input.amountMonths && !recordedGap(key)) throw new Error(`Social average counts cover ${input.countMonths} months and its money ${input.amountMonths}, and no gap is recorded: ${key}`);
    }
    for (const gap of SOCIAL_AVERAGE_GAPS) {
      const input = averageInputs.get(socialFactKey(gap));
      if (!input || input.countMonths === input.amountMonths) throw new Error(`Social recorded average gap no longer has counts missing a month: ${socialFactKey(gap)}`);
    }
  }

  const found: Mismatch[] = [];
  /** Money is summed to whole GEL member by member, so a sum of n parts may differ from its total by up to (n + 1) / 2 GEL. */
  const compare = (check: string, addends: readonly ReadonlyMap<number, Decimal>[], total: ReadonlyMap<number, Decimal>, money: boolean, skip: (year: number) => boolean = () => false) => {
    const tolerance = money ? new D(addends.length + 1).div(2) : new D(0);
    for (const [year, value] of [...total].sort((a, b) => a[0] - b[0])) {
      if (skip(year)) continue;
      const difference = addends.reduce((sum, part) => sum.plus(part.get(year) ?? 0), new D(0)).minus(value);
      if (difference.abs().gt(tolerance)) found.push({ check, year, difference: difference.toFixed() });
    }
  };
  const placeIndicators = Object.keys(FIRST_YEARS);
  for (const indicatorId of placeIndicators) {
    const money = isMoney(indicatorId);
    for (const region of SOCIAL_REGIONS) {
      const members = [...(SOCIAL_MUNICIPALITIES[region] ?? []), ...Object.keys(SOCIAL_UNITS).filter(id => SOCIAL_UNITS[id] === region)];
      const parts = members.map(id => series(indicatorId, id));
      if (members.length) compare(`${indicatorId} ${region}`, parts, series(indicatorId, region), money, year => parts.some(part => !part.has(year)));
    }
    const parts = [...SOCIAL_REGIONS, ...Object.keys(SOCIAL_UNITS).filter(id => SOCIAL_UNITS[id] === null)].map(id => series(indicatorId, id));
    compare(`${indicatorId} georgia`, parts, series(indicatorId), money, year => parts.some(part => !part.has(year)));
  }
  // The age bands (tsa_allowance-03) add up to the people in receiving families (tsa_allowance-01) in every place and year.
  for (const place of PLACES) {
    compare(`social.subsistence.persons age groups ${place}`, SOCIAL_AGE_BANDS.map(band => series(`social.subsistence.persons_age_${band}`, place)), series("social.subsistence.persons", place), false);
  }
  for (const measure of ["recipients", "amount"] as const) {
    const group = (name: string) => series(`social.social_package.${name}.${measure}`);
    const recipients = (name: string) => series(`social.social_package.${name}.recipients`);
    // A group that joined during a year has that year's December count but no full-year money: its partition is checked from the next year.
    compare(`social.social_package.${measure} groups`, PACKAGE_MEMBERS.map(group), group("total"), measure === "amount",
      year => PACKAGE_MEMBERS.some(name => !group(name).has(year) && recipients(name).has(year)));
    const parts = DISABILITY_PARTS.map(group);
    compare(`social.social_package.${measure} disability`, parts, new Map([...group("disability")].filter(([year]) => parts.every(part => part.has(year)))), measure === "amount");
  }
  if (averageInputs) {
    // The groups' monthly people counts summed over the year partition the total's, as their December counts do.
    const counts = (name: string): ReadonlyMap<number, Decimal> => new Map(range(SOCIAL_FIRST_YEAR, SOCIAL_LAST_YEAR).flatMap(year => {
      const input = averageInputs.get(socialFactKey({ indicatorId: `social.social_package.${name}.avg_monthly` as SocialIndicator, geographyId: SOCIAL_GEORGIA, year }));
      return input ? [[year, new D(input.count)] as const] : [];
    }));
    compare(COUNT_PARTITION, PACKAGE_MEMBERS.map(counts), counts("total"), false);
  }
  const unrecorded = found.find(f => !SOCIAL_KNOWN_DIFFERENCES.some(k => k.check === f.check && k.year === f.year && k.difference === f.difference));
  if (unrecorded) throw new Error(`The ${unrecorded.check} parts do not add up to the total as recorded in ${unrecorded.year}: unrecorded difference found ${unrecorded.difference}`);
  const gone = SOCIAL_KNOWN_DIFFERENCES.find(k => (averageInputs || k.check !== COUNT_PARTITION) && !found.some(f => f.check === k.check && f.year === k.year && f.difference === k.difference));
  if (gone) throw new Error(`The ${gone.check} parts add up differently from the recorded SSA difference in ${gone.year}: recorded difference no longer occurs, expected ${gone.difference}, found ${found.find(f => f.check === gone.check && f.year === gone.year)?.difference ?? "none"}`);

  for (const [programme, indicatorId] of Object.entries(PAYMENT_PROGRAMME_FACTS)) {
    for (const [year, payment] of indexed.get(`social.payments.${programme}.amount|${SOCIAL_GEORGIA}`) ?? []) {
      const own = byKey.get(socialFactKey({ indicatorId, geographyId: SOCIAL_GEORGIA, year }));
      if (own && (["value", "months", "valueStatus", "sourceId", "sourceWorkbook", "sourceSheet", "sourceCell"] as const).some(field => own[field] !== payment[field])) {
        throw new Error(`Social payments row differs from its programme's value: social.payments.${programme}.amount:${year}`);
      }
    }
  }
  for (const [year, total] of indexed.get(`social.payments.total.amount|${SOCIAL_GEORGIA}`) ?? []) {
    const rows = SOCIAL_PAYMENT_PROGRAMMES.map(programme => byKey.get(socialFactKey({ indicatorId: `social.payments.${programme}.amount`, geographyId: SOCIAL_GEORGIA, year }))).filter(f => f !== undefined);
    const sum = rows.reduce((acc, f) => acc.plus(f.value), new D(0));
    if (!sum.eq(total.value) || total.months !== 12 || total.sourceCell !== rows.map(f => f.indicatorId).join("+")) throw new Error(`Social payments total differs from the sum of its rows in ${year}: rows ${sum.toFixed()}, total ${total.value}`);
  }
  for (const [indicatorId, year, value] of ANCHORS) {
    if (byKey.get(socialFactKey({ indicatorId, geographyId: SOCIAL_GEORGIA, year }))?.value !== value) throw new Error(`Social anchor value changed: ${indicatorId}:${SOCIAL_GEORGIA}:${year}`);
  }
  if (!SOCIAL_PUBLIC_SOURCES.every(id => facts.some(f => f.sourceId === id))) throw new Error("Social source missing from the serving file");
}
