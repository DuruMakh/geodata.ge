import type { ClientCurrentAccountFact } from "../data/externalFlows/importCurrentAccount";
import type { ClientForeignInvestmentData } from "../data/externalFlows/importForeignInvestment";
import type { ClientMoneyTransfersData } from "../data/externalFlows/importMoneyTransfers";
import type { ClientExternalPositionFact } from "../data/externalPosition/types";
import { FOREIGN_INVESTMENT_TOTAL_ID, MONEY_TRANSFER_TOTAL_ID } from "../data/externalFlows/types";
import type { Presentation } from "../i18n/types";
import { message } from "../i18n/messages";
import { INK } from "./colors";
import { coverageRange } from "./coverageLabel";
import { buildCurrentAccountModel } from "./currentAccount";
import { DEFAULT_CURRENT_ACCOUNT_STATE } from "./currentAccountState";
import { externalPositionLatestLabel, externalPositionLatestMonth, externalPositionSeries } from "./externalPosition";
import { buildForeignInvestmentModel } from "./foreignInvestment";
import { DEFAULT_FOREIGN_INVESTMENT_STATE } from "./foreignInvestmentState";
import { formatInUnit, unitFor, type ValueUnit } from "./format";
import type { HubCardModel } from "./hubCards";
import { buildMoneyTransfersModel } from "./moneyTransfers";
import type { CardLatest } from "./topicHub";
import { DEFAULT_MONEY_TRANSFERS_STATE, moneyTransfersCoverage } from "./moneyTransfersState";

/** With `withLatest`, each card also carries its page's latest figure: the total at the page's end year, in the page's unit. */
export function buildExternalHubCards(money: ClientMoneyTransfersData, investment: ClientForeignInvestmentData, account: readonly ClientCurrentAccountFact[], position: readonly ClientExternalPositionFact[], presentation: Presentation, withLatest = false): HubCardModel[] {
  const t = (key: string) => message(presentation.messages, `external.${key}`);
  const card = (index: string, key: string, href: string, values: Map<number, number | null>, min: number, max: number, latestMonth = "", figure: () => CardLatest | null = () => null): HubCardModel => {
    const years = Array.from({ length: max - min + 1 }, (_, i) => min + i);
    return { index, title: t(`${key}.title`), description: t(`${key}.summary`), href, comingSoon: false, series: years.map(year => values.get(year) ?? null), seriesColor: INK, footer: `${min}–${max}${latestMonth} · ${t("annual")}`, latest: withLatest ? figure() : null, years: coverageRange(min, max) };
  };
  const amount = (value: number | null | undefined, unit: ValueUnit, period: number): CardLatest | null => value == null ? null : { value: `${formatInUnit(value, unit)} ${unit.label}`, period: String(period) };
  const { min, max } = moneyTransfersCoverage(money);
  const received = new Map(money.facts.filter(f => f.entityId === MONEY_TRANSFER_TOTAL_ID && f.measure === "received").map(f => [f.year, f.valueUsd]));
  const total = new Map(investment.facts.filter(f => f.entityId === FOREIGN_INVESTMENT_TOTAL_ID).map(f => [f.year, f.valueUsd]));
  const totalYears = [...total.keys()].sort((a, b) => a - b);
  const balance = new Map(account.filter(f => f.seriesId === "ca.balance" && f.flow === "net").map(f => [f.year, f.valueUsd]));
  const balanceYears = [...balance.keys()].sort((a, b) => a - b);
  // Foreign debt and Reserves follow their page's total; the 2026 point is a mid-year amount, so the footer names its month.
  // Their latest line: the point in billion USD, on the scale whose decimals the page reads from all of its series.
  const totalOf = (indicatorId: string, section: "foreign-debt" | "reserves") => {
    const points = position.filter(f => f.indicatorId === indicatorId).sort((a, b) => a.year - b.year);
    const last = points.at(-1)!;
    const figure = (): CardLatest => {
      const ids = new Set<string>(externalPositionSeries(section).map(series => series.id));
      const unit = unitFor(position.filter(f => ids.has(f.indicatorId)).map(f => f.value), { divisor: 1_000_000_000, label: "", decimals: 1 });
      return { value: `${formatInUnit(last.value, unit)} ${t("position.unitBnUsdShort")}`, period: last.latestPeriod ? externalPositionLatestLabel(last, presentation.messages) : String(last.year) };
    };
    return { values: new Map(points.map(f => [f.year, f.value])), min: points[0].year, max: last.year, month: last.latestPeriod ? ` (${externalPositionLatestMonth(last.periodEnd, presentation.messages)})` : "", figure };
  };
  const debt = totalOf("ext_debt.total", "foreign-debt"), reserves = totalOf("reserves.total", "reserves");
  const moneyFigure = () => {
    const model = buildMoneyTransfersModel(money, DEFAULT_MONEY_TRANSFERS_STATE, presentation);
    return amount(model.valuesByEntity[MONEY_TRANSFER_TOTAL_ID][model.range.end], model.unit, model.range.end);
  };
  const investmentFigure = () => {
    const model = buildForeignInvestmentModel(investment, DEFAULT_FOREIGN_INVESTMENT_STATE, presentation);
    return amount(model.valuesByEntity[FOREIGN_INVESTMENT_TOTAL_ID][model.range.end], model.unit, model.range.end);
  };
  const accountFigure = () => {
    const model = buildCurrentAccountModel(account, [], DEFAULT_CURRENT_ACCOUNT_STATE, presentation);
    return amount(model.endValues["ca.balance"], model.unit, model.range.end);
  };
  return [
    card("01", "money", "/explorer/external/money-from-abroad", received, min, max, "", moneyFigure),
    card("02", "investment", "/explorer/external/foreign-investment", total, totalYears[0], totalYears.at(-1)!, "", investmentFigure),
    card("03", "account", "/explorer/external/current-account", balance, balanceYears[0], balanceYears.at(-1)!, "", accountFigure),
    card("04", "debt", "/explorer/external/foreign-debt", debt.values, debt.min, debt.max, debt.month, debt.figure),
    card("05", "reserves", "/explorer/external/reserves", reserves.values, reserves.min, reserves.max, reserves.month, reserves.figure),
  ];
}
