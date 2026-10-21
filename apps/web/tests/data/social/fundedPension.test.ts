import { describe, expect, test } from "vitest";
import {
  fundedPensionFirstYear, fundedPensionMonths, fundedPensionUnit, isFundedPension, validateFundedPensionFacts,
} from "../../../lib/data/social/fundedPension";
import {
  FUNDED_PENSION_COUNTS, FUNDED_PENSION_MONEY, FUNDED_PENSION_SOURCES, SOCIAL_GEORGIA, SOCIAL_INDICATORS, SOCIAL_PUBLIC_SOURCES, SOCIAL_SOURCES, type SocialFact, type SocialIndicator,
} from "../../../lib/data/social/types";
import { socialUnit, socialValueText, validateSocialFacts } from "../../../lib/data/social/validation";

const YEARS = [2019, 2020, 2021, 2022, 2023, 2024, 2025];
/** Money in thousand GEL as printed (stored x 1000); null where the statement prints no line. */
const MONEY: Record<(typeof FUNDED_PENSION_MONEY)[number], (number | null)[]> = {
  savings: [508031, 1164657, 1980291, 2947151, 4357160, 6060268, 8237530],
  net_assets: [547844, 1213129, 2048024, 3027208, 4484620, 6191340, 8365433],
  contributions: [548315, 571148, 658014, 802753, 996862, 1179226, 1431780],
  contributions_private: [294314, 319679, 375117, 469120, 587066, 692043, 843224],
  contributions_public: [88663, 85307, 94283, 108859, 137625, 175799, 217567],
  contributions_state: [165338, 166162, 188614, 224774, 272171, 311384, 370989],
  interest: [17038, 87026, 163741, 218227, 254614, 356201, 461555],
  securities_gains: [null, null, null, -31187, 168430, 197986, 319147],
  dividends: [null, null, null, 3543, 18598, 25485, 33223],
  payouts: [57322, 1548, 1988, 5787, 15014, 40110, 63609],
};
const COUNTS: Record<(typeof FUNDED_PENSION_COUNTS)[number] | "return", string[]> = {
  members: ["958226", "1105041", "1234732", "1359035", "1478720", "1581832", "1705365"],
  left: ["164198", "3098", "1605", "1218", "1165", "727", "540"],
  paid_persons: ["185", "466", "839", "1853", "3747", "8363", "11367"],
  employers: ["61173", "71600", "82801", "94994", "108047", "119966", "145780"],
  return: ["6.1", "12.9", "9.5", "7.3", "12.3", "11.5", "11.8"],
};
const IFRS_BY_YEAR: Record<number, [source: string, workbook: string]> = {
  2019: ["pension_fund_ifrs_2020", "2020-IFRS.pdf"], 2020: ["pension_fund_ifrs_2020", "2020-IFRS.pdf"], 2021: ["pension_fund_ifrs_2022", "2022-IFRS-GE.pdf"],
  2022: ["pension_fund_ifrs_2023", "2023-IFRS-GE.pdf"], 2023: ["pension_fund_ifrs_2024", "2024-IFRS-GE.pdf"], 2024: ["pension_fund_ifrs_2025", "2025-IFRS.pdf"],
  2025: ["pension_fund_ifrs_2025", "2025-IFRS.pdf"],
};

function fixture(): SocialFact[] {
  const facts: SocialFact[] = [];
  const base = { geographyId: SOCIAL_GEORGIA, basis: "actual", valueStatus: "official", sourceSheet: "12", lastReviewedAt: "2026-10-21" } as const;
  for (const measure of FUNDED_PENSION_MONEY) {
    MONEY[measure].forEach((thousand, i) => {
      if (thousand === null) return;
      const year = YEARS[i];
      const indicatorId = `social.funded_pension.${measure}.amount` as SocialIndicator;
      facts.push({ ...base, year, indicatorId, value: String(thousand * 1000), unit: "gel", months: fundedPensionMonths(indicatorId), sourceId: IFRS_BY_YEAR[year][0], sourceWorkbook: IFRS_BY_YEAR[year][1], sourceCell: `${measure} ${year}` });
    });
  }
  for (const [measure, values] of Object.entries(COUNTS)) {
    values.forEach((value, i) => {
      const indicatorId = `social.funded_pension.${measure}` as SocialIndicator;
      const unit = measure === "return" ? "percent" : measure === "employers" ? "employers" : "persons";
      facts.push({ ...base, year: YEARS[i], indicatorId, value, unit, months: ["members", "employers"].includes(measure) ? 1 : 12, sourceId: "pension_fund_report_2025", sourceWorkbook: "Annual_Rep_2025_geo.pdf", sourceCell: `${measure} ${YEARS[i]}` });
    });
  }
  return facts;
}
const get = (facts: SocialFact[], measure: string, year: number) => facts.find(f => f.indicatorId.replace(/\.amount$/, "") === `social.funded_pension.${measure}` && f.year === year)!;
const without = (facts: SocialFact[], measure: string, year: number) => facts.filter(f => f !== get(facts, measure, year));

describe("funded pension indicators", () => {
  test("are appended to the social indicators and sources", () => {
    expect(fundedPensionFirstYear("social.funded_pension.dividends.amount")).toBe(2022);
    expect(fundedPensionFirstYear("social.funded_pension.savings.amount")).toBe(2019);
    expect(FUNDED_PENSION_SOURCES).toHaveLength(6);
    expect(FUNDED_PENSION_SOURCES.every(id => SOCIAL_SOURCES.includes(id) && SOCIAL_PUBLIC_SOURCES.includes(id))).toBe(true);
    expect(SOCIAL_INDICATORS.filter(isFundedPension)).toHaveLength(15);
    expect(fixture()).toHaveLength(99);
    expect(fixture().every(f => (SOCIAL_INDICATORS as readonly string[]).includes(f.indicatorId))).toBe(true);
  });

  test("units and months follow the measure", () => {
    expect(["savings", "payouts"].map(m => socialUnit(`social.funded_pension.${m}.amount` as SocialIndicator))).toEqual(["gel", "gel"]);
    expect(fundedPensionUnit("social.funded_pension.members")).toBe("persons");
    expect(fundedPensionUnit("social.funded_pension.employers")).toBe("employers");
    expect(socialUnit("social.funded_pension.return")).toBe("percent");
    const id = (m: string) => (["members", "left", "paid_persons", "employers", "return"].includes(m) ? `social.funded_pension.${m}` : `social.funded_pension.${m}.amount`);
    expect(["savings", "net_assets", "members", "employers"].map(m => fundedPensionMonths(id(m)))).toEqual([1, 1, 1, 1]);
    expect(["contributions", "payouts", "left", "paid_persons", "return"].map(m => fundedPensionMonths(id(m)))).toEqual([12, 12, 12, 12, 12]);
  });
});

describe("funded pension validation", () => {
  test("the fixture passes", () => {
    expect(() => validateFundedPensionFacts(fixture())).not.toThrow();
  });

  test("validateSocialFacts runs it on the funded rows", () => {
    expect(() => validateSocialFacts(without(fixture(), "savings", 2021))).toThrow(/Incomplete funded pension coverage/);
  });

  test("negative and decimal values", () => {
    expect(socialValueText("social.funded_pension.securities_gains.amount", "-31187000.000000000000")).toBe("-31187000");
    expect(socialValueText("social.funded_pension.return", "11.800000000000")).toBe("11.8");
    expect(socialValueText("social.funded_pension.return", "11.85")).toBe("11.85");
    expect(socialValueText("social.funded_pension.members", "1705365.000")).toBe("1705365");
  });

  test.each<[string, (facts: SocialFact[]) => SocialFact[], RegExp]>([
    ["a missing year", facts => without(facts, "savings", 2021), /Incomplete funded pension coverage/],
    ["a 2018 row", facts => [...facts, { ...get(facts, "savings", 2019), year: 2018 }], /outside the approved coverage/],
    ["a dividends row for 2021, which prints no line", facts => [...facts, { ...get(facts, "dividends", 2022), year: 2021, value: "1000" }], /outside the approved coverage/],
    ["a zero where none is printed", facts => [...facts, { ...get(facts, "securities_gains", 2022), year: 2020, value: "0" }], /outside the approved coverage/],
    ["a duplicate", facts => [...facts, { ...get(facts, "savings", 2021) }], /Duplicate funded pension observation/],
    ["months 12 on savings", facts => facts.map(f => (f === get(facts, "savings", 2021) ? { ...f, months: 12 } : f)), /source contract/],
    ["months 1 on payouts", facts => facts.map(f => (f === get(facts, "payouts", 2021) ? { ...f, months: 1 } : f)), /source contract/],
    ["a return with two decimals", facts => facts.map(f => (f === get(facts, "return", 2021) ? { ...f, value: "9.50" } : f)), /Invalid funded pension value/],
    ["a negative count", facts => facts.map(f => (f === get(facts, "left", 2021) ? { ...f, value: "-1605" } : f)), /Invalid funded pension value/],
    ["a negative savings value", facts => facts.map(f => (f === get(facts, "payouts", 2021) ? { ...f, value: "-1988000" } : f)), /Invalid funded pension value/],
    ["a changed anchor", facts => facts.map(f => (f === get(facts, "savings", 2025) ? { ...f, value: "8237531000" } : f)), /anchor value changed/],
    ["a changed return anchor", facts => facts.map(f => (f === get(facts, "return", 2025) ? { ...f, value: "11.9" } : f)), /anchor value changed/],
    ["a changed gains anchor", facts => facts.map(f => (f === get(facts, "securities_gains", 2022) ? { ...f, value: "31187000" } : f)), /anchor value changed/],
    ["parts that differ from the total", facts => facts.map(f => (f === get(facts, "contributions_private", 2023) ? { ...f, value: "587067000" } : f)), /do not add up/],
    ["a calculated value", facts => facts.map(f => (f === get(facts, "interest", 2021) ? { ...f, valueStatus: "calculated" } : f)), /source contract/],
    ["a wrong source for a year", facts => facts.map(f => (f === get(facts, "savings", 2021) ? { ...f, sourceId: "pension_fund_ifrs_2025" } : f)), /source contract/],
    ["counts from an IFRS statement", facts => facts.map(f => (f === get(facts, "members", 2021) ? { ...f, sourceId: "pension_fund_ifrs_2022" } : f)), /source contract/],
    ["a wrong unit", facts => facts.map(f => (f === get(facts, "employers", 2021) ? { ...f, unit: "persons" } : f)), /source contract/],
    ["another place", facts => facts.map(f => (f === get(facts, "savings", 2021) ? { ...f, geographyId: "region.tbilisi" } : f)), /outside the approved coverage/],
    ["an empty source cell", facts => facts.map(f => (f === get(facts, "savings", 2021) ? { ...f, sourceCell: "" } : f)), /source contract/],
    ["an unknown funded pension indicator", facts => [...facts, { ...get(facts, "savings", 2021), indicatorId: "social.funded_pension.other.amount" as SocialIndicator }], /Invalid funded pension identity/],
  ])("rejects %s", (_name, change, message) => {
    expect(() => validateFundedPensionFacts(change(fixture()))).toThrow(message);
  });
});
