import { beforeAll, expect, test } from "vitest";
import { loadServedDemographyData } from "../../lib/data/demography/importDemography";
import { loadCpiFacts } from "../../lib/data/inflation/importInflation";
import type { Municipality, MunicipalRegion } from "../../lib/data/municipal/types";
import { loadNationalGdpFacts } from "../../lib/data/nationalGdp/importNationalGdp";
import { SERVED_DATA_FILES, loadServedMunicipalData } from "../../lib/data/servedData";
import { loadSocialBreaks, loadSocialFacts, toClientSocialFact } from "../../lib/data/social/importSocial";
import type { ClientSocialFact, SocialSeriesBreak } from "../../lib/data/social/types";
import { projectGdpFact, type ClientNationalGdpFact } from "../../lib/explorer/clientData";
import { INK } from "../../lib/explorer/colors";
import { placePageHref } from "../../lib/explorer/demographyPlaceRoutes";
import {
  SOCIAL_SECTIONS, atPrices, buildSocialModel, changeSocialSelection, changeSocialView, defaultSocialState, parseSocialHash, serializeSocialHash, sharePerHundred,
  socialAnnualCpi, socialCoverage, socialPaymentsViewFacts, socialPopulation, socialTopicSeries, type SocialPopulation, type SocialPriceIndex,
} from "../../lib/explorer/social";
import { buildSocialIndexModel } from "../../lib/explorer/socialIndex";
import {
  buildSocialPlaceModel, changeSocialPlaceSelection, parseSocialPlaceHash, socialPlaceBase, socialPlaceCoverage, socialPlaceDefaultSelection, socialPlaceFacts, socialPlaceSeries,
} from "../../lib/explorer/socialPlaces";

let facts: ClientSocialFact[];
let breaks: SocialSeriesBreak[];
let population: SocialPopulation;
let cpi: SocialPriceIndex;
let gdpFacts: ClientNationalGdpFact[];
let regions: MunicipalRegion[];
let municipalities: Municipality[];
beforeAll(async () => {
  const [served, loadedBreaks, demography, cpiFacts, gdp, municipal] = await Promise.all([
    loadSocialFacts(), loadSocialBreaks(), loadServedDemographyData(), loadCpiFacts(), loadNationalGdpFacts(SERVED_DATA_FILES.gdpFacts), loadServedMunicipalData(),
  ]);
  facts = served.map(toClientSocialFact);
  breaks = loadedBreaks;
  population = socialPopulation(demography.facts);
  cpi = socialAnnualCpi(cpiFacts);
  gdpFacts = gdp.map(projectGdpFact);
  ({ regions, municipalities } = municipal);
});
const span = (coverage: { min: number; max: number }) => [coverage.min, coverage.max];
const GEORGIA = "country.georgia";
const extras = () => ({ population, cpi });
const firstYear = (id: string, geographyId = GEORGIA) => Math.min(...facts.filter(f => f.indicatorId === id && f.geographyId === geographyId).map(f => f.year));
const value = (id: string, geographyId: string, year: number) => facts.find(f => f.indicatorId === id && f.geographyId === geographyId && f.year === year)!.value;

test("the four sections sit under the Health and social protection hub", () => {
  expect(SOCIAL_SECTIONS.map(s => [s.id, s.href, s.labelKey])).toEqual([
    ["social-payments", "/explorer/health/social-payments", "common.socialPayments"],
    ["pensions", "/explorer/health/pensions", "common.socialPensions"],
    ["subsistence-allowance", "/explorer/health/subsistence-allowance", "common.socialSubsistence"],
    ["social-package", "/explorer/health/social-package", "common.socialPackage"],
  ]);
  expect(socialPlaceBase("pensions")).toBe("/explorer/health/pensions");
  expect(socialPlaceBase("subsistence-allowance")).toBe("/explorer/health/subsistence-allowance");
});

test("each page starts on its default series, with coverage from the facts", () => {
  expect(defaultSocialState("social-payments")).toEqual({ mode: "line", range: { kind: "all" }, view: "amount", selectedIds: ["social.payments.total.amount"] });
  expect(span(socialCoverage("social-payments", "amount", facts, gdpFacts, ["social.payments.total.amount"]))).toEqual([2013, 2025]);
  expect(defaultSocialState("social-package").selectedIds).toEqual(["social.social_package.total.recipients"]);
  expect(socialPlaceDefaultSelection("pensions")).toEqual(["social.pension.recipients"]);
  expect(socialPlaceDefaultSelection("subsistence-allowance")).toEqual(["social.subsistence.families"]);
  const pensions = socialPlaceFacts("pensions", GEORGIA, facts, extras());
  expect(span(socialPlaceCoverage("pensions", GEORGIA, pensions, ["social.pension.recipients"]))).toEqual([2013, 2025]);
  // The high-mountain supplement starts in 2016 and the employment-programme families in 2022: earlier years are gaps.
  expect(firstYear("social.pension_highmountain.recipients")).toBe(2016);
  const highMountain = buildSocialPlaceModel("pensions", GEORGIA, pensions, { mode: "line", range: { kind: "all" }, selectedIds: ["social.pension_highmountain.recipients"] }, breaks);
  expect(highMountain.selected[0].valuesByYear[2015]).toBeNull();
  expect(highMountain.selected[0].valuesByYear[2016]).toBe(value("social.pension_highmountain.recipients", GEORGIA, 2016));
  expect(firstYear("social.subsistence.employment_families")).toBe(2022);
  const subsistence = socialPlaceFacts("subsistence-allowance", GEORGIA, facts, extras());
  const employment = buildSocialPlaceModel("subsistence-allowance", GEORGIA, subsistence, { mode: "line", range: { kind: "all" }, selectedIds: ["social.subsistence.employment_families"] }, breaks);
  expect(employment.selected[0].valuesByYear[2021]).toBeNull();
  expect(employment.selected[0].valuesByYear[2022]).toBe(value("social.subsistence.employment_families", GEORGIA, 2022));
});

test("each page lists its rows under its headings", () => {
  const headings = (rows: readonly { heading: string }[]) => [...new Set(rows.map(row => row.heading))];
  const payments = socialTopicSeries("social-payments");
  expect(payments).toHaveLength(19);
  expect(headings(payments)).toEqual(["money"]);
  expect(payments[0]).toEqual({ id: "social.payments.total.amount", reference: true, heading: "money" });
  expect(payments.slice(1, 4).map(row => row.id)).toEqual(["social.payments.pension.amount", "social.payments.pension_highmountain.amount", "social.payments.social_package.amount"]);
  expect(payments.at(-1)!.id).toBe("social.payments.covid_vulnerable_compensation.amount");
  const pensions = socialPlaceSeries("pensions");
  expect(pensions.map(row => [row.heading, row.id])).toEqual([
    ["pensioners", "social.pension.recipients"], ["pensioners", "social.pension_idp.recipients"], ["pensioners", "social.pension_highmountain.recipients"],
    ["share", "social.pension.recipients#share"],
    ["money", "social.pension.amount"], ["money", "social.pension_idp.amount"], ["money", "social.pension_highmountain.amount"],
    ["average", "social.pension.avg_monthly"], ["average", "social.pension.avg_monthly#real"], ["average", "social.pension_highmountain.avg_monthly"],
  ]);
  expect(pensions.filter(row => row.calculated).map(row => [row.id, row.calculated])).toEqual([["social.pension.recipients#share", "share"], ["social.pension.avg_monthly#real", "real"]]);
  const subsistence = socialPlaceSeries("subsistence-allowance");
  expect(subsistence).toHaveLength(10);
  expect(headings(subsistence)).toEqual(["families", "people", "share", "money", "average"]);
  expect(subsistence.filter(row => row.heading === "share").map(row => row.id)).toEqual(["social.subsistence.persons#share", "social.subsistence.registered_persons#share"]);
  const socialPackage = socialTopicSeries("social-package");
  expect(socialPackage).toHaveLength(21);
  expect(headings(socialPackage)).toEqual(["recipients", "money", "average"]);
  expect(socialPackage.filter(row => row.heading === "recipients")).toHaveLength(10);
  expect(socialPackage.at(-1)).toEqual({ id: "social.social_package.total.avg_monthly", reference: false, heading: "average" });
  for (const rows of [payments, pensions, subsistence, socialPackage]) expect(rows.filter(row => row.reference)).toHaveLength(1);
});

test("a selection keeps to one heading, from the hash and from a tick", () => {
  const pensions = socialPlaceFacts("pensions", GEORGIA, facts, extras());
  const parsed = parseSocialPlaceHash("#sel=social.pension.recipients,social.pension.amount", "pensions", GEORGIA, pensions);
  expect(parsed.selectedIds).toEqual(["social.pension.recipients"]);
  const ticked = changeSocialPlaceSelection(parsed, "pensions", GEORGIA, ["social.pension.recipients", "social.pension.amount"], pensions);
  expect(ticked.selectedIds).toEqual(["social.pension.amount"]);
  // The share heading starts in 2014, so a hash range from 2013 refits to it.
  expect(parseSocialPlaceHash("#sel=social.pension.recipients%23share&start=2013&end=2020", "pensions", GEORGIA, pensions).range).toEqual({ kind: "manual", start: 2014, end: 2020 });
  const share = { mode: "table" as const, range: { kind: "manual" as const, start: 2016, end: 2024 }, selectedIds: ["social.pension.recipients#share"] };
  expect(parseSocialPlaceHash(`#${serializeSocialHash({ ...share, view: "amount" }, "social-package")}`, "pensions", GEORGIA, pensions)).toEqual(share);
  // Social package: the same one-heading rule, and the hash round-trips.
  const start = defaultSocialState("social-package");
  const money = changeSocialSelection(start, "social-package", [...start.selectedIds, "social.social_package.total.amount"], facts, []);
  expect(money.selectedIds).toEqual(["social.social_package.total.amount"]);
  expect(parseSocialHash(`#${serializeSocialHash(money, "social-package")}`, "social-package", facts, [])).toEqual(money);
  expect(serializeSocialHash(money, "social-package")).not.toContain("tab=");
  const gdp = { ...defaultSocialState("social-payments"), view: "gdp" as const };
  expect(serializeSocialHash(gdp, "social-payments")).toContain("tab=gdp");
  expect(parseSocialHash(`#${serializeSocialHash(gdp, "social-payments")}`, "social-payments", facts, gdpFacts)).toEqual(gdp);
  expect(parseSocialHash("#sel=", "social-payments", facts, gdpFacts).selectedIds).toEqual([]);
});

test("pensioners per 100 residents use the next 1 January's population, from 2014, and only where it exists", () => {
  const georgia = sharePerHundred(facts, population, GEORGIA);
  const share = (rows: typeof georgia, id: string, year: number) => rows.find(f => f.indicatorId === id && f.year === year);
  const pension2025 = share(georgia, "social.pension.recipients#share", 2025)!;
  expect(Number(pension2025.value.toFixed(1))).toBe(Number((888518 / 3941103 * 100).toFixed(1)));
  expect(Number(pension2025.value.toFixed(1))).toBe(22.5);
  expect(pension2025).toMatchObject({ valueStatus: "calculated", geographyId: GEORGIA, unit: "percent" });
  expect(share(georgia, "social.pension.recipients#share", 2013)).toBeUndefined();
  expect(Math.min(...georgia.filter(f => f.indicatorId === "social.pension.recipients#share").map(f => f.year))).toBe(2014);
  expect(sharePerHundred(facts, population, "unit.akhalgori")).toEqual([]);
  const tbilisiPopulation = population.find(p => p.geographyId === "region.tbilisi" && p.year === 2026)!.persons;
  const tbilisi = share(sharePerHundred(facts, population, "region.tbilisi"), "social.pension.recipients#share", 2025)!;
  expect(tbilisi.value).toBeCloseTo(value("social.pension.recipients", "region.tbilisi", 2025) / tbilisiPopulation * 100, 10);
  expect(sharePerHundred(facts, population, "04")).toEqual(sharePerHundred(facts, population, "region.tbilisi"));
  // The subsistence share rows: people in receiving families and registered people.
  expect(new Set(sharePerHundred(facts, population, GEORGIA).map(f => f.indicatorId))).toEqual(new Set(["social.pension.recipients#share", "social.subsistence.persons#share", "social.subsistence.registered_persons#share"]));
});

test("the average pension at 2025 prices uses the yearly average headline index", () => {
  const avg2013 = facts.filter(f => f.indicatorId === "social.pension.avg_monthly" && f.geographyId === GEORGIA && f.year === 2013);
  expect(avg2013[0].value).toBe(133.23);
  expect(cpi.find(row => row.year === 2013)!.index).toBeCloseTo(106.9681, 10);
  expect(cpi.find(row => row.year === 2025)!.index).toBeCloseTo(185.49279166666668, 10);
  const [real] = atPrices(avg2013, cpi);
  // The brief wrote 231.04; the formula gives 231.0334…, so the computed constant is asserted.
  const expected = 133.23 * 185.49279166666668 / 106.9681;
  expect(Number(expected.toFixed(2))).toBe(231.03);
  expect(real).toMatchObject({ indicatorId: "social.pension.avg_monthly#real", valueStatus: "calculated", year: 2013, unit: "gel" });
  expect(real.value).toBeCloseTo(expected, 9);
  expect(Number(real.value.toFixed(2))).toBe(231.03);
  const model = buildSocialPlaceModel("pensions", GEORGIA, socialPlaceFacts("pensions", GEORGIA, facts, extras()), { mode: "line", range: { kind: "all" }, selectedIds: ["social.pension.avg_monthly", "social.pension.avg_monthly#real"] }, breaks);
  expect(model).toMatchObject({ heading: "average", unit: "gel" });
  expect(model.selected.map(s => s.decimals)).toEqual([2, 2]);
  expect(model.selected[1].valuesByYear[2013]).toBeCloseTo(expected, 9);
  // In the base year the two are the same.
  expect(model.selected[1].valuesByYear[2025]).toBeCloseTo(model.selected[0].valuesByYear[2025]!, 9);
});

test("Social payments as % of GDP divides each year's money by the served nominal GDP", () => {
  const total2025 = value("social.payments.total.amount", GEORGIA, 2025);
  const gdp2025 = gdpFacts.find(f => f.year === 2025)!.gdpCurrentPricesGel;
  const shown = socialPaymentsViewFacts("gdp", facts, gdpFacts);
  expect(shown.find(f => f.indicatorId === "social.payments.total.amount" && f.year === 2025)).toMatchObject({ valueStatus: "calculated", unit: "percent" });
  const model = buildSocialModel("social-payments", facts, { ...defaultSocialState("social-payments"), view: "gdp" }, { breaks, gdpFacts });
  expect(model).toMatchObject({ unit: "percent", heading: "money" });
  expect(model.selected[0].valuesByYear[2025]).toBeCloseTo(total2025 * 1e6 / gdp2025 * 100, 10);
  expect(socialPaymentsViewFacts("amount", facts, gdpFacts).find(f => f.indicatorId === "social.payments.total.amount" && f.year === 2025)!.value).toBe(total2025);
  // The % of GDP view needs the GDP facts: none is an error, never a silently empty page.
  expect(() => socialPaymentsViewFacts("gdp", facts, [])).toThrow(/No GDP facts/);
  // Switching view keeps the selection and the years.
  const manual = { ...defaultSocialState("social-payments"), range: { kind: "manual" as const, start: 2015, end: 2020 }, selectedIds: ["social.payments.pension.amount"] };
  expect(changeSocialView(manual, "gdp", facts, gdpFacts)).toEqual({ ...manual, view: "gdp" });
  const amount = buildSocialModel("social-payments", facts, defaultSocialState("social-payments"), { breaks, gdpFacts });
  expect(amount).toMatchObject({ unit: "gel_million", heading: "money" });
  expect(amount.selected[0]).toMatchObject({ color: INK, decimals: 1 });
  expect(amount.selected[0].valuesByYear[2025]).toBe(total2025);
});

test("counting changes mark the rows they touch", () => {
  const subsistence = socialPlaceFacts("subsistence-allowance", GEORGIA, facts, extras());
  const state = (selectedIds: string[]) => ({ mode: "line" as const, range: { kind: "all" as const }, selectedIds });
  expect(buildSocialPlaceModel("subsistence-allowance", GEORGIA, subsistence, state(["social.subsistence.families"]), breaks).breaks).toEqual([{ year: 2022, label: "newCounting" }]);
  // The share of people in receiving families inherits its count's break; registered families have none.
  // A share also crosses the census recalculation of 1 January 2025, which first reaches the 2024 share (its divisor is 1 January 2025).
  const breakYears = (set: "pensions" | "subsistence-allowance", selectedIds: string[]) =>
    buildSocialPlaceModel(set, GEORGIA, socialPlaceFacts(set, GEORGIA, facts, extras()), state(selectedIds), breaks).breaks.map(item => item.year);
  expect(breakYears("subsistence-allowance", ["social.subsistence.persons#share"])).toEqual([2022, 2024]);
  expect(breakYears("pensions", ["social.pension.recipients#share"])).toEqual([2024]);
  expect(breakYears("pensions", ["social.pension.recipients"])).toEqual([]);
  expect(breakYears("subsistence-allowance", ["social.subsistence.persons"])).toEqual([2022]);
  expect(buildSocialPlaceModel("subsistence-allowance", GEORGIA, subsistence, state(["social.subsistence.registered_families"]), breaks).breaks).toEqual([]);
  // A range that starts at the break year has nothing to cross.
  expect(buildSocialPlaceModel("subsistence-allowance", GEORGIA, subsistence, { ...state(["social.subsistence.families"]), range: { kind: "manual", start: 2022, end: 2025 } }, breaks).breaks).toEqual([]);
  const other = buildSocialModel("social-package", facts, { ...defaultSocialState("social-package"), selectedIds: ["social.social_package.other.recipients"] }, { breaks, gdpFacts: [] });
  expect(other.breaks).toEqual([{ year: 2025, label: "newCounting" }]);
  expect(buildSocialModel("social-package", facts, defaultSocialState("social-package"), { breaks, gdpFacts: [] }).breaks).toEqual([]);
});

test("a programme that ran part of a year shows its published months", () => {
  const model = buildSocialModel("social-payments", facts, { ...defaultSocialState("social-payments"), selectedIds: ["social.payments.covid_vulnerable_compensation.amount"] }, { breaks, gdpFacts: [] });
  const covid = model.series.find(s => s.id === "social.payments.covid_vulnerable_compensation.amount")!;
  expect(covid.partialMonths).toEqual({ 2020: 6, 2021: 6 });
  expect(covid.valuesByYear[2019]).toBeNull();
  expect(model.series.find(s => s.id === "social.payments.workplace_injury.amount")!.partialMonths[2013]).toBe(9);
  expect(model.series[0].partialMonths).toEqual({});
  // The % of GDP view keeps the months; a December count never reads as partial.
  const gdp = buildSocialModel("social-payments", facts, { ...defaultSocialState("social-payments"), view: "gdp" }, { breaks, gdpFacts });
  expect(gdp.series.find(s => s.id === "social.payments.covid_vulnerable_compensation.amount")!.partialMonths).toEqual({ 2020: 6, 2021: 6 });
  const pensions = buildSocialPlaceModel("pensions", GEORGIA, socialPlaceFacts("pensions", GEORGIA, facts, extras()), { mode: "line", range: { kind: "all" }, selectedIds: ["social.pension.recipients"] }, breaks);
  expect(pensions.series[0].partialMonths).toEqual({});
});

test("the Pensions and Subsistence allowance indexes shade the latest year's share, Georgia first and unranked", () => {
  const pensions = buildSocialIndexModel("pensions", facts, population, regions, municipalities);
  expect(pensions.year).toBe(2025);
  const georgiaShare = sharePerHundred(facts, population, GEORGIA).find(f => f.indicatorId === "social.pension.recipients#share" && f.year === 2025)!.value;
  expect(pensions.country).toMatchObject({ id: "country.georgia", rank: null, valueGel: georgiaShare });
  expect(pensions.regions).toHaveLength(11);
  expect(pensions.municipalities).toHaveLength(64);
  const tbilisi = pensions.municipalities.find(row => row.id === "04")!;
  expect(tbilisi.valueGel).toBe(pensions.regions.find(row => row.id === "region.tbilisi")!.valueGel);
  expect([pensions.map.shapes.length, pensions.map.markers.length]).toEqual([60, 5]);
  expect(placePageHref(socialPlaceBase("pensions"), tbilisi.id)).toBe("/explorer/health/pensions/region/tbilisi");
  const subsistence = buildSocialIndexModel("subsistence-allowance", facts, population, regions, municipalities);
  expect(subsistence.year).toBe(2025);
  expect(subsistence.country.valueGel).toBe(sharePerHundred(facts, population, GEORGIA).find(f => f.indicatorId === "social.subsistence.persons#share" && f.year === 2025)!.value);
});

test("no list repeats a colour within a heading, and a Social package group keeps its colour across headings", () => {
  const colors = (rows: ReturnType<typeof socialTopicSeries>, model: { series: { id: string; heading: string; color: string }[] }) =>
    [...new Set(rows.map(row => row.heading))].map(heading => model.series.filter(s => s.heading === heading).map(s => s.color));
  const line = { mode: "line" as const, range: { kind: "all" as const } };
  const payments = buildSocialModel("social-payments", facts, defaultSocialState("social-payments"), { breaks, gdpFacts });
  const socialPackage = buildSocialModel("social-package", facts, defaultSocialState("social-package"), { breaks, gdpFacts: [] });
  const pensions = buildSocialPlaceModel("pensions", GEORGIA, socialPlaceFacts("pensions", GEORGIA, facts, extras()), { ...line, selectedIds: [] }, breaks);
  const subsistence = buildSocialPlaceModel("subsistence-allowance", GEORGIA, socialPlaceFacts("subsistence-allowance", GEORGIA, facts, extras()), { ...line, selectedIds: [] }, breaks);
  for (const [rows, model] of [[socialTopicSeries("social-payments"), payments], [socialTopicSeries("social-package"), socialPackage], [socialPlaceSeries("pensions"), pensions], [socialPlaceSeries("subsistence-allowance"), subsistence]] as const) {
    for (const heading of colors(rows, model)) expect(new Set(heading).size, heading.join()).toBe(heading.length);
  }
  expect(payments.series[0].color).toBe(INK);
  expect(payments.series.slice(1).map(s => s.color)).not.toContain(INK);
  // A group wears one colour under Recipients and Money; the reference total is ink under Recipients.
  const colorOf = (id: string) => socialPackage.series.find(s => s.id === id)!.color;
  for (const group of ["disability", "survivors", "war_participants", "other"]) expect(colorOf(`social.social_package.${group}.amount`)).toBe(colorOf(`social.social_package.${group}.recipients`));
  expect(colorOf("social.social_package.total.recipients")).toBe(INK);
});
