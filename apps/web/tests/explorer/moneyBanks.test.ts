import { beforeAll, expect, test } from "vitest";
import { loadMoneyBanksFacts, toClientMoneyBanksFact } from "../../lib/data/moneyBanks/importMoneyBanks";
import type { ClientMoneyBanksFact } from "../../lib/data/moneyBanks/types";
import { INK } from "../../lib/explorer/colors";
import {
  MONEY_BANKS_SECTIONS, buildMoneyBanksModel, changeMoneyBanksView, defaultMoneyBanksState, moneyBanksCoverage, moneyBanksViewSeries, moneyBanksViews,
  parseMoneyBanksHash, serializeMoneyBanksHash,
} from "../../lib/explorer/moneyBanks";

let facts: ClientMoneyBanksFact[];
beforeAll(async () => { facts = (await loadMoneyBanksFacts()).map(toClientMoneyBanksFact); });

test("the four sections and their tabs", () => {
  expect(MONEY_BANKS_SECTIONS.map(s => [s.id, s.href, s.labelKey])).toEqual([
    ["supply", "/explorer/money/supply", "common.moneySupply"],
    ["loans-deposits", "/explorer/money/loans-deposits", "common.moneyLoansDeposits"],
    ["interest-rates", "/explorer/money/interest-rates", "common.moneyInterestRates"],
    ["bank-health", "/explorer/money/bank-health", "common.moneyBankHealth"],
  ]);
  expect(moneyBanksViews("supply")).toEqual(["amount", "gdp"]);
  expect(moneyBanksViews("loans-deposits")).toEqual(["loans", "deposits", "fx_share"]);
  expect(moneyBanksViews("interest-rates")).toEqual(["main"]);
  expect(moneyBanksViews("bank-health")).toEqual(["npl", "profits", "capital"]);
});

test("each page starts with only its first series selected and coverage taken from the facts", () => {
  expect(defaultMoneyBanksState("supply")).toEqual({ mode: "line", range: { kind: "all" }, view: "amount", selectedIds: ["money.m3"] });
  expect(defaultMoneyBanksState("interest-rates")).toEqual({ mode: "line", range: { kind: "all" }, view: "main", selectedIds: ["rates.policy"] });
  expect(defaultMoneyBanksState("bank-health")).toEqual({ mode: "line", range: { kind: "all" }, view: "npl", selectedIds: ["banks.npl_ratio"] });
  expect(moneyBanksCoverage("supply", "amount", facts)).toMatchObject({ min: 1995, max: 2025 });
  expect(moneyBanksCoverage("interest-rates", "main", facts)).toMatchObject({ min: 1996, max: 2025 });
  expect(moneyBanksCoverage("bank-health", "npl", facts)).toMatchObject({ min: 2003, max: 2025 });
  expect(moneyBanksCoverage("bank-health", "capital", facts)).toMatchObject({ min: 2014, max: 2025 });
  expect(moneyBanksCoverage("loans-deposits", "fx_share", facts)).toMatchObject({ min: 1996, max: 2025 });
});

test("totals nest their lari and foreign-currency rows", () => {
  const shape = (section: Parameters<typeof moneyBanksViewSeries>[0], view: Parameters<typeof moneyBanksViewSeries>[1]) =>
    moneyBanksViewSeries(section, view).map(s => [s.id, s.reference, s.parentId]);
  expect(shape("supply", "amount").map(r => r[0])).toEqual(["money.m3", "money.m2", "money.m1", "money.m0"]);
  expect(shape("supply", "gdp").map(r => r[0])).toEqual(["money.m3_to_gdp", "money.m2_to_gdp"]);
  expect(shape("loans-deposits", "loans")).toEqual([
    ["loans.total", true, undefined], ["loans.gel", false, "loans.total"], ["loans.fx", false, "loans.total"],
  ]);
  expect(shape("loans-deposits", "deposits")).toEqual([
    ["deposits.total", true, undefined], ["deposits.gel", false, "deposits.total"], ["deposits.fx", false, "deposits.total"],
    ["deposits.individuals", false, undefined], ["deposits.legal_entities", false, undefined],
  ]);
  expect(shape("loans-deposits", "fx_share").map(r => r[0])).toEqual(["loans.fx_share", "deposits.fx_share"]);
  expect(shape("interest-rates", "main")).toEqual([
    ["rates.policy", true, undefined],
    ["rates.loans_total", false, undefined], ["rates.loans_gel", false, "rates.loans_total"], ["rates.loans_fx", false, "rates.loans_total"],
    ["rates.deposits_total", false, undefined], ["rates.deposits_gel", false, "rates.deposits_total"], ["rates.deposits_fx", false, "rates.deposits_total"],
  ]);
  expect(shape("bank-health", "npl").map(r => r[0])).toEqual(["banks.npl_ratio"]);
  expect(shape("bank-health", "profits").map(r => r[0])).toEqual(["banks.roe", "banks.roa"]);
  expect(shape("bank-health", "capital").map(r => r[0])).toEqual(["banks.capital_ratio", "banks.tier1_ratio"]);
});

test("switching to Capital clamps a range starting 2005 to 2014, and switching back keeps it", () => {
  const start = { ...defaultMoneyBanksState("bank-health"), range: { kind: "manual" as const, start: 2005, end: 2025 } };
  const capital = changeMoneyBanksView(start, "bank-health", "capital", facts);
  expect(capital).toMatchObject({ view: "capital", range: { kind: "manual", start: 2014, end: 2025 }, selectedIds: ["banks.capital_ratio"] });
  const back = changeMoneyBanksView(capital, "bank-health", "npl", facts);
  expect(back).toMatchObject({ view: "npl", range: { kind: "manual", start: 2014, end: 2025 }, selectedIds: ["banks.npl_ratio"] });
});

test("the hash round-trips, drops another tab's series and keeps an explicit empty selection", () => {
  const state = { mode: "table" as const, view: "deposits" as const, range: { kind: "manual" as const, start: 2005, end: 2020 }, selectedIds: ["deposits.total", "deposits.fx"] };
  const hash = serializeMoneyBanksHash(state, "loans-deposits");
  expect(parseMoneyBanksHash(`#${hash}`, "loans-deposits", facts)).toEqual(state);
  expect(parseMoneyBanksHash("#tab=npl&sel=", "bank-health", facts).selectedIds).toEqual([]);
  expect(parseMoneyBanksHash("#tab=capital&sel=banks.roe", "bank-health", facts).selectedIds).toEqual([]);
  expect(parseMoneyBanksHash("#tab=unknown", "bank-health", facts)).toMatchObject({ view: "npl", selectedIds: ["banks.npl_ratio"] });
  const rates = serializeMoneyBanksHash(defaultMoneyBanksState("interest-rates"), "interest-rates");
  expect(rates).not.toContain("tab=");
  expect(parseMoneyBanksHash(`#${rates}`, "interest-rates", facts)).toEqual(defaultMoneyBanksState("interest-rates"));
});

test("the model carries lari amounts, gaps, signed values and per-series precision", () => {
  const supply = buildMoneyBanksModel("supply", facts, defaultMoneyBanksState("supply"));
  expect(supply.unit).toBe("gel");
  expect(supply.selected[0].endValue).toBe(57680200000);
  expect(supply.years).toEqual(Array.from({ length: 31 }, (_, i) => 1995 + i));
  expect(supply.series[0].color).toBe(INK);
  expect(supply.series[1].color).not.toBe(INK);

  const profits = buildMoneyBanksModel("bank-health", facts, { ...defaultMoneyBanksState("bank-health"), view: "profits" });
  expect(profits.unit).toBe("percent");
  expect(profits.series.find(s => s.id === "banks.roa")!.valuesByYear[2008]!).toBeLessThan(0);

  const deposits = buildMoneyBanksModel("loans-deposits", facts, { ...defaultMoneyBanksState("loans-deposits"), view: "deposits" });
  expect(deposits.series.find(s => s.id === "deposits.legal_entities")!.valuesByYear[2014]).toBeNull();

  const rates = buildMoneyBanksModel("interest-rates", facts, defaultMoneyBanksState("interest-rates"));
  expect(rates.series.find(s => s.id === "rates.policy")!.decimals).toBe(2);
  expect(rates.series.find(s => s.id === "rates.loans_total")!.decimals).toBe(1);
});
