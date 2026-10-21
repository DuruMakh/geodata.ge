import ExcelJS from "exceljs";
import { beforeAll, expect, test } from "vitest";
import { loadServedDemographyData } from "../../lib/data/demography/importDemography";
import { loadCpiFacts } from "../../lib/data/inflation/importInflation";
import type { Municipality, MunicipalRegion } from "../../lib/data/municipal/types";
import { loadNationalGdpFacts } from "../../lib/data/nationalGdp/importNationalGdp";
import { SERVED_DATA_FILES, loadServedMunicipalData } from "../../lib/data/servedData";
import { loadSocialBreaks, loadSocialFacts, toClientSocialFact } from "../../lib/data/social/importSocial";
import { SOCIAL_AGE_BANDS, type ClientSocialFact, type SocialSeriesBreak } from "../../lib/data/social/types";
import { shareOfGdp } from "../../lib/explorer/debtExplorer";
import { projectGdpFact, type ClientNationalGdpFact } from "../../lib/explorer/clientData";
import { EDITORIAL_PALETTE, INK } from "../../lib/explorer/colors";
import { createWorkbookBuffer } from "../../lib/explorer/workbookWriter.client";
import { getMessages } from "../../lib/i18n/messages.server";
import type { Presentation } from "../../lib/i18n/types";
import { placePageHref } from "../../lib/explorer/demographyPlaceRoutes";
import {
  SOCIAL_SECTIONS, atPrices, buildSocialModel, changeSocialSelection, changeSocialView, defaultSocialState, parseSocialHash, serializeSocialHash, sharePerHundred,
  socialAnnualCpi, socialCoverage, socialPaymentsViewFacts, socialPopulation, socialSeriesColor, socialTopicFacts, socialTopicSeries, socialViews, type SocialPopulation, type SocialPriceIndex,
} from "../../lib/explorer/social";
import { buildSocialHubCards } from "../../lib/explorer/socialHubCards";
import { buildSocialIndexModel } from "../../lib/explorer/socialIndex";
import { buildSocialWorkbookExportModel } from "../../lib/explorer/socialWorkbook";
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

test("the five sections sit under the Health and social protection hub", () => {
  expect(SOCIAL_SECTIONS.map(s => [s.id, s.href, s.labelKey])).toEqual([
    ["social-payments", "/explorer/health/social-payments", "common.socialPayments"],
    ["pensions", "/explorer/health/pensions", "common.socialPensions"],
    ["subsistence-allowance", "/explorer/health/subsistence-allowance", "common.socialSubsistence"],
    ["social-package", "/explorer/health/social-package", "common.socialPackage"],
    ["funded-pension", "/explorer/health/funded-pension", "common.socialFundedPension"],
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
  expect(subsistence).toHaveLength(18);
  expect(headings(subsistence)).toEqual(["families", "people", "share", "money", "average", "ages"]);
  // SSA's eight age bands of the people in receiving families: all listed, none the reference, none with a share row.
  expect(subsistence.filter(row => row.heading === "ages")).toEqual(SOCIAL_AGE_BANDS.map(band => ({ id: `social.subsistence.persons_age_${band}`, reference: false, heading: "ages" })));
  expect(subsistence.filter(row => row.heading === "share").map(row => row.id)).toEqual(["social.subsistence.persons#share", "social.subsistence.registered_persons#share"]);
  const socialPackage = socialTopicSeries("social-package");
  expect(socialPackage).toHaveLength(30);
  expect(headings(socialPackage)).toEqual(["recipients", "money", "average"]);
  expect(socialPackage.filter(row => row.heading === "recipients")).toHaveLength(10);
  // Average per month lists the total first, then the groups in the order of Recipients and Money.
  const groupsUnder = (heading: string) => socialPackage.filter(row => row.heading === heading).map(row => row.id.split(".")[2]);
  expect(groupsUnder("average")).toEqual(groupsUnder("recipients"));
  expect(groupsUnder("average")).toEqual(groupsUnder("money"));
  expect(socialPackage.find(row => row.heading === "average")).toEqual({ id: "social.social_package.total.avg_monthly", reference: false, heading: "average" });
  expect(socialPackage.at(-1)).toEqual({ id: "social.social_package.other.avg_monthly", reference: false, heading: "average" });
  for (const rows of [payments, pensions, subsistence, socialPackage]) expect(rows.filter(row => row.reference)).toHaveLength(1);
});

test("the age groups chart people, start in 2013, keep their own colours and cross the 2022 counting change", () => {
  const subsistence = socialPlaceFacts("subsistence-allowance", "region.imereti", facts, extras());
  const ids = ["social.subsistence.persons_age_0_6", "social.subsistence.persons_age_70_plus"];
  const model = buildSocialPlaceModel("subsistence-allowance", "region.imereti", subsistence, { mode: "line", range: { kind: "all" }, selectedIds: ids }, breaks);
  expect([model.heading, model.unit, model.range.start, model.range.end]).toEqual(["ages", "persons", 2013, 2025]);
  expect(model.selected.map(series => series.valuesByYear[2025])).toEqual(ids.map(id => value(id, "region.imereti", 2025)));
  expect(model.selected.every(series => series.decimals === 0 && !Object.keys(series.partialMonths).length)).toBe(true);
  // Each band is keyed by its place in SOCIAL_AGE_BANDS (palette 0–7), as Social package's groups are, never by its row on the page.
  const colors = model.series.filter(series => series.heading === "ages").map(series => series.color);
  expect(colors).toEqual(["#B3402A", "#1F6E56", "#3D5A98", "#A5822B", "#7A4E8C", "#4A707A", "#C26E4C", "#2F4B3A"]);
  expect(colors).toEqual(SOCIAL_AGE_BANDS.map((_, index) => EDITORIAL_PALETTE[index]));
  expect(model.breaks).toEqual([{ year: 2022, label: "newCounting" }]);
  // Ticking an age band after Families replaces the selection; the default stays Families alone.
  const ticked = changeSocialPlaceSelection({ mode: "line", range: { kind: "all" }, selectedIds: ["social.subsistence.families"] }, "subsistence-allowance", "region.imereti", ["social.subsistence.families", ids[0]], subsistence);
  expect(ticked.selectedIds).toEqual([ids[0]]);
  // No share of residents is calculated for an age band.
  expect(subsistence.some(f => f.indicatorId.startsWith("social.subsistence.persons_age_") && f.indicatorId.includes("#"))).toBe(false);
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
  expect(changeSocialView(manual, "social-payments", "gdp", facts, gdpFacts)).toEqual({ ...manual, view: "gdp" });
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
  // The Money total is the reference row of its heading too, so it is ink; the groups under it keep their colours.
  expect(colorOf("social.social_package.total.amount")).toBe(INK);
  expect(socialPackage.series.filter(s => s.heading === "money" && s.id !== "social.social_package.total.amount").map(s => s.color)).not.toContain(INK);
  // Under Average per month too: the total is ink and each group keeps its colour.
  expect(colorOf("social.social_package.total.avg_monthly")).toBe(INK);
  for (const group of ["disability", "disability_moderate", "survivors", "war_participants", "political_repression", "other"]) expect(colorOf(`social.social_package.${group}.avg_monthly`)).toBe(colorOf(`social.social_package.${group}.recipients`));
  expect(socialPackage.series.filter(s => s.heading === "average" && s.id !== "social.social_package.total.avg_monthly").map(s => s.color)).not.toContain(INK);
});

test("a social package group's average per month is its money ÷ its monthly people counts, in GEL to two decimals", () => {
  const value = (id: string, year: number) => facts.find(f => f.indicatorId === id && f.geographyId === GEORGIA && f.year === year)!.value;
  expect(value("social.social_package.war_participants.avg_monthly", 2025)).toBe(101.61);
  expect(value("social.social_package.survivors.avg_monthly", 2025)).toBe(102.9);
  const model = buildSocialModel("social-package", facts, { ...defaultSocialState("social-package"), selectedIds: ["social.social_package.total.avg_monthly", "social.social_package.war_participants.avg_monthly"] }, { breaks, gdpFacts: [] });
  const war = model.selected.find(s => s.id === "social.social_package.war_participants.avg_monthly")!;
  expect(war.valuesByYear[2019]).toBeNull();
  expect(war.valuesByYear[2025]).toBe(101.61);
});

// ---- Excel workbooks and hub cards ------------------------------------------------------------------------------------

const presentation = async (locale: "en" | "ka" = "en"): Promise<Presentation> => ({
  locale, englishLabels: {}, messages: { ...await getMessages(locale, ["workbook", "format", "common", "social"]) },
});
const sourceFor = (sourceId: string, years: number[]) => ({
  sourceId, years, title: sourceId, organization: "SSA", retrievedAt: "2026-10-20", downloadHref: `/downloads/methodology/social-protection/files/${sourceId}.html` as const,
});
const YEARS = Array.from({ length: 13 }, (_, i) => 2013 + i);
const SSA_SOURCES = ["ssa_pension_01", "ssa_pension_02", "ssa_pension_04", "ssa_tsa_allowance_01", "ssa_tsa_allowance_02", "ssa_tsa_allowance_03", "ssa_socpackage_01", "ssa_socpackage_02", "ssa_statistics", "ssa_other_04", "ssa_workinjury_03"].map(id => sourceFor(id, YEARS));
const GEOSTAT = {
  populationSources: [sourceFor("source.geostat_municipal_population", YEARS)],
  cpiSources: [sourceFor("source.geostat_cpi_index_2010", YEARS)],
  gdpSources: [sourceFor("source.geostat_national_gdp_sna_2008", YEARS)],
};
const labelsFor = (ids: readonly string[]) => Object.fromEntries(ids.map(id => [id, id]));
const HEADINGS = { money: "Money paid", pensioners: "Pensioners", share: "Share of residents", average: "Average a month", families: "Families", people: "People", recipients: "Recipients", ages: "Age groups" };
const placeWorkbook = async (set: "pensions" | "subsistence-allowance", placeId: string, scope: string, selectedIds: string[], start: number, end: number, locale: "en" | "ka" = "en") =>
  buildSocialWorkbookExportModel({
    set, placeId, scope, facts, extras: extras(), sources: SSA_SOURCES, ...GEOSTAT, siteOrigin: "https://fiscal.ge", labels: labelsFor(selectedIds), headingLabels: HEADINGS, title: "Title",
    state: { mode: "table", range: { kind: "manual", start, end }, selectedIds },
  }, await presentation(locale));
const topicWorkbook = async (section: "social-payments" | "social-package", view: "amount" | "gdp", selectedIds: string[], start: number, end: number) =>
  buildSocialWorkbookExportModel({
    section, gdpFacts, sources: SSA_SOURCES, ...GEOSTAT, facts, siteOrigin: "https://fiscal.ge", labels: labelsFor(selectedIds), headingLabels: HEADINGS, title: "Title",
    state: { mode: "table", range: { kind: "manual", start, end }, selectedIds, view },
  }, await presentation());
const loadWorkbook = async (model: Parameters<typeof createWorkbookBuffer>[0]) => { const excel = new ExcelJS.Workbook(); await excel.xlsx.load(await createWorkbookBuffer(model)); return excel; };

test("a Guria pensions money workbook is in million GEL to one decimal, marked calculated, and cites pension-01 alone", async () => {
  const model = await placeWorkbook("pensions", "region.guria", "region-guria", ["social.pension.amount"], 2013, 2025);
  expect(model.filename).toBe("fiscal-social-pensions-region-guria-2013-2025-en.xlsx");
  expect(model.readable.unitLabel).toBe("million GEL");
  expect(model.readable.numberFormat).toBe("#,##0.0");
  expect(model.readable.amountDecimals).toBe(1);
  expect(model.analysis.numericFormats).toEqual({ 3: "#,##0.0" });
  expect(model.analysis.headers).toEqual(["Year", "Category", "million GEL", "Status"]);
  // SSA's 12-month sums are calculated in the data, so they are marked so, but keep their served precision: the number format rounds for display.
  const guria2025 = value("social.pension.amount", "region.guria", 2025);
  expect(model.readable.rows[0].valuesByYear[2025]).toBe(guria2025);
  expect(model.readable.rows[0]).toMatchObject({ kind: "item", parentLabel: "Money paid" });
  expect(model.analysis.rows).toHaveLength(13);
  expect(model.analysis.rows.at(-1)).toEqual([2025, "Money paid — social.pension.amount", guria2025, "Calculated by Fiscal.ge"]);
  const excel = await loadWorkbook(model);
  const data = excel.getWorksheet(model.sheetNames[1])!;
  expect(data.getCell(14, 3).numFmt).toBe("#,##0.0");
  expect(data.getCell(14, 3).value).toBe(guria2025);
  expect(model.sources.map(source => source.title)).toEqual(["ssa_pension_01"]);
  expect(model.sources[0].absoluteUrl).toBe("https://fiscal.ge/downloads/methodology/social-protection/files/ssa_pension_01.html");
  // The Summary note shows because the exported sums are calculated; no row divides by Geostat, so no Geostat source.
  expect(model.readable.subtitle).toBe("2013–2025 · million GEL · “Calculated by Fiscal.ge” marks values calculated from Social Service Agency and Geostat data.");
  expect(model.readable.fitSubtitle).toBe(true);
});

test("SSA sums and averages are written at full served precision", async () => {
  const model = await placeWorkbook("pensions", GEORGIA, "georgia", ["social.pension.amount"], 2013, 2025);
  expect(model.readable.rows[0].valuesByYear[2025]).toBe(4262.30909);
  const data = (await loadWorkbook(model)).getWorksheet(model.sheetNames[1])!;
  expect(data.getCell(14, 3).value).toBe(4262.30909);
  expect(data.getCell(14, 3).numFmt).toBe("#,##0.0");
  const average = await placeWorkbook("pensions", GEORGIA, "georgia", ["social.pension.avg_monthly"], 2013, 2025);
  expect(average.readable.rows[0].valuesByYear[2013]).toBe(133.23);
});

test("a workbook lists only the SSA tables behind the exported series and years", async () => {
  const both = await placeWorkbook("pensions", GEORGIA, "georgia", ["social.pension.recipients", "social.pension_idp.recipients", "social.pension_highmountain.recipients"], 2013, 2025);
  expect(both.sources.map(source => source.title)).toEqual(["ssa_pension_01", "ssa_pension_02", "ssa_pension_04"]);
  // The high-mountain supplement starts in 2016, so its table supplies 2016 onward only.
  expect(both.sources.find(source => source.title === "ssa_pension_04")!.years).toEqual(YEARS.filter(year => year >= 2016));
  expect(both.readable.numberFormat).toBe("#,##0");
  expect(both.readable.unitLabel).toBe("persons");
  // A printed December count is official: no calculated mark and no note.
  const printed = facts.find(f => f.indicatorId === "social.pension.recipients" && f.geographyId === GEORGIA && f.year === 2025)!;
  expect(printed.valueStatus).toBe("official");
  expect(both.analysis.rows.find(row => row[0] === 2025 && String(row[1]).endsWith("social.pension.recipients"))![3]).toBe("Official");
  expect(both.readable.subtitle).toBe("2013–2025 · persons");
  expect(both.readable.fitSubtitle).toBeUndefined();
  const highMountain = both.readable.rows[2];
  expect(highMountain.valuesByYear[2015]).toBeNull();
  expect(highMountain.basisByYear[2015]).toBeNull();
  expect(highMountain.basisByYear[2016]).toBe("actual");
  expect(both.analysis.rows.find(row => row[0] === 2015 && String(row[1]).endsWith("social.pension_highmountain.recipients"))).toEqual([2015, "Pensioners — social.pension_highmountain.recipients", null, "Not available"]);
  const families = await placeWorkbook("subsistence-allowance", GEORGIA, "georgia", ["social.subsistence.families"], 2013, 2025);
  expect([families.readable.unitLabel, families.readable.numberFormat]).toEqual(["families", "#,##0"]);
  expect(families.sources.map(source => source.title)).toEqual(["ssa_tsa_allowance_01"]);
  // The age groups are persons, printed December counts, and cite the age-group table alone.
  const ages = await placeWorkbook("subsistence-allowance", "45", "45", ["social.subsistence.persons_age_0_6", "social.subsistence.persons_age_6_18"], 2013, 2025);
  expect([ages.readable.unitLabel, ages.readable.numberFormat, ages.readable.subtitle]).toEqual(["persons", "#,##0", "2013–2025 · persons"]);
  expect(ages.sources.map(source => source.title)).toEqual(["ssa_tsa_allowance_03"]);
  expect(ages.readable.rows.map(row => row.parentLabel)).toEqual(["Age groups", "Age groups"]);
  expect(ages.analysis.rows.find(row => row[0] === 2025 && String(row[1]).endsWith("persons_age_6_18"))).toEqual([2025, "Age groups — social.subsistence.persons_age_6_18", value("social.subsistence.persons_age_6_18", "45", 2025), "Official"]);
  // A missing public source is an error, never an uncited value.
  const ready = await presentation();
  expect(() => buildSocialWorkbookExportModel({
    set: "pensions", placeId: GEORGIA, scope: "georgia", facts, extras: extras(), sources: [], ...GEOSTAT, siteOrigin: "https://fiscal.ge", labels: labelsFor(["social.pension.recipients"]), headingLabels: HEADINGS, title: "Title",
    state: { mode: "table", range: { kind: "all" }, selectedIds: ["social.pension.recipients"] },
  }, ready)).toThrow(/ssa_pension_01/);
});

test("a Georgia average workbook with the 2025-prices row carries the calculated note and the CPI source", async () => {
  const model = await placeWorkbook("pensions", GEORGIA, "georgia", ["social.pension.avg_monthly", "social.pension.avg_monthly#real"], 2013, 2025);
  expect(model.filename).toBe("fiscal-social-pensions-georgia-2013-2025-en.xlsx");
  expect(model.readable.unitLabel).toBe("GEL a month");
  expect(model.readable.numberFormat).toBe("#,##0.00");
  expect(model.analysis.numericFormats).toEqual({ 3: "#,##0.00" });
  expect(model.readable.subtitle).toBe("2013–2025 · GEL a month · “Calculated by Fiscal.ge” marks values calculated from Social Service Agency and Geostat data.");
  expect(model.readable.fitSubtitle).toBe(true);
  expect(model.sources.map(source => source.title)).toEqual(["ssa_pension_01", "source.geostat_cpi_index_2010"]);
  const [nominal, real] = model.readable.rows;
  expect(nominal.valuesByYear[2013]).toBe(133.23);
  expect(real.valuesByYear[2013]).toBe(231.03);
  expect(real.valuesByYear[2025]).toBe(nominal.valuesByYear[2025]);
  const status = (id: string, year: number) => model.analysis.rows.find(row => row[0] === year && String(row[1]).endsWith(id))![3];
  expect(status("social.pension.avg_monthly", 2013)).toBe("Calculated by Fiscal.ge");
  expect(status("social.pension.avg_monthly#real", 2013)).toBe("Calculated by Fiscal.ge");
  // The note sits on the Summary sheet; the Data sheet has no identifier or cell-reference column.
  const excel = await loadWorkbook(model);
  expect(String(excel.getWorksheet(model.sheetNames[0])!.getCell("A2").value)).toContain("Calculated by Fiscal.ge");
  expect(excel.getWorksheet(model.sheetNames[1])!.getRow(1).values).toEqual([undefined, "Year", "Category", "GEL a month", "Status"]);
  // The nominal average is calculated from SSA's rows, so it carries the note, but it needs no CPI.
  const nominalOnly = await placeWorkbook("pensions", GEORGIA, "georgia", ["social.pension.avg_monthly"], 2013, 2025);
  expect(nominalOnly.readable.subtitle).toContain("Calculated by Fiscal.ge");
  expect(nominalOnly.sources.map(source => source.title)).toEqual(["ssa_pension_01"]);
});

test("a share of residents workbook cites the population file and rounds to the one decimal shown", async () => {
  const model = await placeWorkbook("pensions", GEORGIA, "georgia", ["social.pension.recipients#share"], 2014, 2025);
  expect([model.readable.unitLabel, model.readable.numberFormat]).toEqual(["% of residents", "#,##0.0"]);
  expect(model.readable.rows[0].valuesByYear[2025]).toBe(22.5);
  expect(model.readable.rows[0].valuesByYear[2013]).toBeUndefined();
  expect(model.readable.subtitle).toContain("Calculated by Fiscal.ge");
  expect(model.sources.map(source => source.title)).toEqual(["ssa_pension_01", "source.geostat_municipal_population"]);
  const ka = await placeWorkbook("pensions", GEORGIA, "georgia", ["social.pension.recipients#share"], 2014, 2025, "ka");
  expect(ka.filename).toBe("fiscal-social-pensions-georgia-2014-2025.xlsx");
});

test("Social payments workbooks: million GEL, or % of GDP calculated with the GDP source", async () => {
  const amount = await topicWorkbook("social-payments", "amount", ["social.payments.total.amount", "social.payments.pension.amount"], 2013, 2025);
  expect(amount.filename).toBe("fiscal-social-payments-2013-2025-en.xlsx");
  expect([amount.readable.unitLabel, amount.readable.numberFormat]).toEqual(["million GEL", "#,##0.0"]);
  expect(amount.readable.rows[0].valuesByYear[2025]).toBe(value("social.payments.total.amount", GEORGIA, 2025));
  expect(amount.readable.rows[0].kind).toBe("total");
  expect(amount.readable.subtitle).toContain("2013–2025 · million GEL · ");
  expect(amount.sources.map(source => source.title)).not.toContain("source.geostat_national_gdp_sna_2008");
  const gdp = await topicWorkbook("social-payments", "gdp", ["social.payments.total.amount"], 2013, 2025);
  expect(gdp.filename).toBe("fiscal-social-payments-2013-2025-en.xlsx");
  expect([gdp.readable.unitLabel, gdp.readable.numberFormat]).toEqual(["% of GDP", "#,##0.00"]);
  expect(gdp.readable.rows[0].valuesByYear[2025]).toBe(Number(socialPaymentsViewFacts("gdp", facts, gdpFacts).find(f => f.indicatorId === "social.payments.total.amount" && f.year === 2025)!.value.toFixed(2)));
  expect(gdp.readable.subtitle).toContain("Calculated by Fiscal.ge");
  expect(gdp.analysis.rows.at(-1)![3]).toBe("Calculated by Fiscal.ge");
  expect(gdp.sources.map(source => source.title)).toContain("source.geostat_national_gdp_sna_2008");
  const packageRecipients = await topicWorkbook("social-package", "amount", ["social.social_package.total.recipients"], 2013, 2025);
  expect([packageRecipients.readable.unitLabel, packageRecipients.readable.numberFormat]).toEqual(["persons", "#,##0"]);
  expect(packageRecipients.filename).toBe("fiscal-social-package-2013-2025-en.xlsx");
  expect(packageRecipients.sources.map(source => source.title)).toEqual(["ssa_socpackage_01"]);
});

test("a programme that ran part of a year is marked with its months on the Data sheet", async () => {
  const model = await topicWorkbook("social-payments", "amount", ["social.payments.covid_vulnerable_compensation.amount", "social.payments.workplace_injury.amount"], 2013, 2025);
  const row = (year: number, id: string) => model.analysis.rows.find(r => r[0] === year && String(r[1]).endsWith(id))!;
  expect(row(2020, "covid_vulnerable_compensation.amount")[3]).toBe("Calculated by Fiscal.ge · 6 months");
  expect(row(2021, "covid_vulnerable_compensation.amount")[3]).toBe("Calculated by Fiscal.ge · 6 months");
  expect(row(2013, "workplace_injury.amount")[3]).toBe("Calculated by Fiscal.ge · 9 months");
  // A full year, a year without a value and a December count carry no months.
  expect(row(2014, "workplace_injury.amount")[3]).toBe("Calculated by Fiscal.ge");
  expect(row(2019, "covid_vulnerable_compensation.amount")[3]).toBe("Not available");
  const counts = await placeWorkbook("pensions", GEORGIA, "georgia", ["social.pension.recipients"], 2013, 2025);
  expect(counts.analysis.rows.every(r => !String(r[3]).includes("months"))).toBe(true);
});

test("the hub has five cards: Georgia's headline series with their latest values and years", async () => {
  const cards = buildSocialHubCards(facts, await presentation());
  expect(cards.map(card => card.href)).toEqual(SOCIAL_SECTIONS.map(section => section.href));
  expect(cards.map(card => card.title)).toEqual(["Social payments", "Pensions", "Subsistence allowance", "Social package", "Funded pension"]);
  expect(cards.map(card => card.footer)).toEqual([
    "2025 · 6,166.1 million GEL · 2013–2025", "2025 · 888,518 · 2013–2025", "2025 · 129,506 · 2013–2025", "2025 · 187,764 · 2013–2025", "2025 · 8,237.5 million GEL · 2019–2025",
  ]);
  expect(cards.map(card => card.series?.length)).toEqual([13, 13, 13, 13, 7]);
  expect(cards[1].series!.at(-1)).toBe(888518);
  expect(cards.map(card => card.index)).toEqual(["04", "05", "06", "07", "08"]);
  expect(cards.every(card => card.seriesColor === INK && !card.comingSoon)).toBe(true);
});

// ---- Funded pension -------------------------------------------------------------------------------------------------

const FUNDED = "social.funded_pension.";
const FUNDED_MONEY_IDS = ["savings", "net_assets", "contributions", "contributions_private", "contributions_public", "contributions_state", "interest", "securities_gains", "dividends", "payouts"].map(m => `${FUNDED}${m}.amount`);
const fundedState = (selectedIds: string[], view: "amount" | "gdp" = "amount") => ({ ...defaultSocialState("funded-pension"), view, selectedIds });

test("funded pension opens on savings in members' accounts", () => {
  const state = defaultSocialState("funded-pension");
  expect(state.selectedIds).toEqual([`${FUNDED}savings.amount`]);
  expect(state.view).toBe("amount");
  expect(span(socialCoverage("funded-pension", "amount", facts, gdpFacts, state.selectedIds))).toEqual([2019, 2025]);
  const model = buildSocialModel("funded-pension", facts, state, { breaks, gdpFacts });
  expect(model).toMatchObject({ unit: "gel_million", heading: "savings" });
  expect(model.selected[0]).toMatchObject({ color: INK, decimals: 1 });
  expect(model.selected[0].valuesByYear[2025]).toBe(8237.53);
  expect(model.selected[0].partialMonths).toEqual({});
});

test("funded pension lists five headings in order", () => {
  const series = socialTopicSeries("funded-pension");
  const rows = (heading: string) => series.filter(s => s.heading === heading).map(s => s.id);
  expect([...new Set(series.map(s => s.heading))]).toEqual(["savings", "flows", "members", "employers", "return"]);
  expect(rows("savings")).toEqual([`${FUNDED}savings.amount`, `${FUNDED}net_assets.amount`]);
  expect(rows("flows")).toEqual(["contributions", "contributions_private", "contributions_public", "contributions_state", "interest", "securities_gains", "dividends", "payouts"].map(m => `${FUNDED}${m}.amount`));
  expect(rows("members")).toEqual([`${FUNDED}members`, `${FUNDED}left`, `${FUNDED}paid_persons`]);
  expect(rows("employers")).toEqual([`${FUNDED}employers`]);
  expect(rows("return")).toEqual([`${FUNDED}return`]);
  expect(series).toHaveLength(15);
  expect(series.find(s => s.id === `${FUNDED}savings.amount`)!.reference).toBe(true);
  expect(series.find(s => s.id === `${FUNDED}net_assets.amount`)!.reference).toBe(false);
  // Every listed row is served for Georgia.
  for (const { id } of series) expect(facts.some(f => f.indicatorId === id && f.geographyId === GEORGIA)).toBe(true);
});

test("funded pension colours: the first row of a heading is ink, the others take the palette by position in the scheme's lists", () => {
  const series = socialTopicSeries("funded-pension");
  const colorOf = (id: string) => socialSeriesColor(series.find(s => s.id === id)!, series.findIndex(s => s.id === id));
  for (const id of [`${FUNDED}savings.amount`, `${FUNDED}contributions.amount`, `${FUNDED}members`, `${FUNDED}employers`, `${FUNDED}return`]) expect(colorOf(id)).toBe(INK);
  // A row keeps its colour under any heading: net assets is position 1 of the money list, left position 1 of the counts.
  expect(colorOf(`${FUNDED}net_assets.amount`)).toBe(EDITORIAL_PALETTE[1]);
  expect(colorOf(`${FUNDED}payouts.amount`)).toBe(EDITORIAL_PALETTE[9]);
  expect(colorOf(`${FUNDED}left`)).toBe(EDITORIAL_PALETTE[1]);
  expect(colorOf(`${FUNDED}paid_persons`)).toBe(EDITORIAL_PALETTE[2]);
  const flows = series.filter(s => s.heading === "flows").map(s => colorOf(s.id));
  expect(new Set(flows).size).toBe(flows.length);
});

test("funded pension flows keep the heading's years; a measure the statements do not print is a gap, never zero", () => {
  const state = fundedState([`${FUNDED}dividends.amount`]);
  expect(span(socialCoverage("funded-pension", "amount", facts, gdpFacts, state.selectedIds))).toEqual([2019, 2025]);
  const model = buildSocialModel("funded-pension", facts, state, { breaks, gdpFacts });
  expect(model.heading).toBe("flows");
  expect(model.years).toEqual([2019, 2020, 2021, 2022, 2023, 2024, 2025]);
  expect([2019, 2020, 2021].map(year => model.selected[0].valuesByYear[year])).toEqual([null, null, null]);
  expect(model.selected[0].valuesByYear[2022]).toBe(3.543);
  const gains = buildSocialModel("funded-pension", facts, fundedState([`${FUNDED}securities_gains.amount`]), { breaks, gdpFacts });
  expect(gains.selected[0].valuesByYear[2022]).toBe(-31.187);
});

test("funded pension counts and the return are shown as they are, the return to one decimal", async () => {
  const options = { breaks, gdpFacts };
  const members = buildSocialModel("funded-pension", facts, fundedState([`${FUNDED}members`]), options);
  expect(members).toMatchObject({ unit: "persons", heading: "members" });
  expect(members.selected[0]).toMatchObject({ decimals: 0 });
  expect(members.selected[0].valuesByYear[2025]).toBe(1705365);
  const employers = buildSocialModel("funded-pension", facts, fundedState([`${FUNDED}employers`]), options);
  expect(employers).toMatchObject({ unit: "employers", heading: "employers" });
  expect(employers.selected[0]).toMatchObject({ decimals: 0 });
  expect(employers.selected[0].valuesByYear[2025]).toBe(145780);
  const rate = buildSocialModel("funded-pension", facts, fundedState([`${FUNDED}return`]), options);
  expect(rate).toMatchObject({ unit: "return", heading: "return" });
  expect(rate.selected[0]).toMatchObject({ decimals: 1 });
  expect(rate.selected[0].valuesByYear[2025]).toBe(11.8);
  // The unit label of the return is "%", not the "% of residents" of a share.
  expect((await getMessages("en", ["social"]))["social.unitReturn"]).toBe("%");
  expect((await getMessages("ka", ["social"]))["social.unitReturn"]).toBe("%");
});

test("a non-money funded pension heading resets the view to amount", () => {
  expect(socialViews("funded-pension")).toEqual(["amount", "gdp"]);
  expect(socialViews("funded-pension", "savings")).toEqual(["amount", "gdp"]);
  expect(socialViews("funded-pension", "flows")).toEqual(["amount", "gdp"]);
  for (const heading of ["members", "employers", "return"] as const) expect(socialViews("funded-pension", heading)).toEqual(["amount"]);
  expect(socialViews("funded-pension", "members")).toEqual(["amount"]);
  // The other sections ignore the heading.
  expect(socialViews("social-payments", "money")).toEqual(["amount", "gdp"]);
  expect(socialViews("social-package", "recipients")).toEqual(["amount"]);
  const fromGdp = fundedState([`${FUNDED}savings.amount`], "gdp");
  expect(changeSocialSelection(fromGdp, "funded-pension", [`${FUNDED}members`], facts, gdpFacts)).toMatchObject({ view: "amount", selectedIds: [`${FUNDED}members`] });
  expect(changeSocialSelection(fromGdp, "funded-pension", [`${FUNDED}contributions.amount`], facts, gdpFacts).view).toBe("gdp");
  expect(changeSocialSelection(fromGdp, "funded-pension", [], facts, gdpFacts).view).toBe("gdp");
  expect(parseSocialHash(`#tab=gdp&sel=${FUNDED}return`, "funded-pension", facts, gdpFacts)).toMatchObject({ view: "amount", selectedIds: [`${FUNDED}return`] });
  expect(parseSocialHash(`#tab=gdp&sel=${FUNDED}interest.amount`, "funded-pension", facts, gdpFacts).view).toBe("gdp");
});

test("funded pension as % of GDP divides the money rows by GDP and leaves the counts as they are", () => {
  const shown = socialTopicFacts("funded-pension", "gdp", facts, gdpFacts);
  const gdpByYear = new Map(gdpFacts.map(f => [f.year, f]));
  const savings2025 = shown.find(f => f.indicatorId === `${FUNDED}savings.amount` && f.year === 2025)!;
  expect(savings2025).toMatchObject({ valueStatus: "calculated", unit: "percent" });
  expect(savings2025.value).toBeCloseTo(shareOfGdp(8237530000, 2025, gdpByYear)! * 100, 10);
  const members2025 = shown.find(f => f.indicatorId === `${FUNDED}members` && f.year === 2025)!;
  expect(members2025).toMatchObject({ value: 1705365, valueStatus: "official", unit: "persons" });
  const rate = shown.find(f => f.indicatorId === `${FUNDED}return` && f.year === 2025)!;
  expect(rate).toMatchObject({ value: 11.8, valueStatus: "official", unit: "return" });
  // The amount view serves the same money in million GEL.
  expect(socialTopicFacts("funded-pension", "amount", facts, gdpFacts).find(f => f.indicatorId === `${FUNDED}savings.amount` && f.year === 2025)).toMatchObject({ value: 8237.53, unit: "gel_million", valueStatus: "official" });
  const model = buildSocialModel("funded-pension", facts, fundedState([`${FUNDED}savings.amount`], "gdp"), { breaks, gdpFacts });
  expect(model).toMatchObject({ unit: "percent", heading: "savings" });
  expect(model.selected[0]).toMatchObject({ decimals: 2 });
  // Every money row of the scheme is in the shown facts of the gdp view.
  for (const id of FUNDED_MONEY_IDS) expect(shown.some(f => f.indicatorId === id)).toBe(true);
  // A gap stays a gap in the gdp view too.
  expect(shown.some(f => f.indicatorId === `${FUNDED}dividends.amount` && f.year < 2022)).toBe(false);
  expect(changeSocialView(fundedState([`${FUNDED}savings.amount`]), "funded-pension", "gdp", facts, gdpFacts)).toMatchObject({ view: "gdp" });
});
