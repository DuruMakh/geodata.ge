import type { ClientCurrentAccountFact } from "../data/externalFlows/importCurrentAccount";
import type { ClientForeignInvestmentData } from "../data/externalFlows/importForeignInvestment";
import type { ClientMoneyTransfersData } from "../data/externalFlows/importMoneyTransfers";
import type { ClientExternalPositionFact } from "../data/externalPosition/types";
import { FOREIGN_INVESTMENT_TOTAL_ID, MONEY_TRANSFER_TOTAL_ID } from "../data/externalFlows/types";
import type { Presentation } from "../i18n/types";
import { message } from "../i18n/messages";
import { INK } from "./colors";
import { externalPositionLatestMonth } from "./externalPosition";
import type { HubCardModel } from "./hubCards";
import { moneyTransfersCoverage } from "./moneyTransfersState";

export function buildExternalHubCards(money: ClientMoneyTransfersData, investment: ClientForeignInvestmentData, account: readonly ClientCurrentAccountFact[], position: readonly ClientExternalPositionFact[], presentation: Presentation): HubCardModel[] {
  const t = (key: string) => message(presentation.messages, `external.${key}`);
  const card = (index: string, key: string, href: string, values: Map<number, number | null>, min: number, max: number, latestMonth = ""): HubCardModel => {
    const years = Array.from({ length: max - min + 1 }, (_, i) => min + i);
    return { index, title: t(`${key}.title`), description: t(`${key}.summary`), href, comingSoon: false, series: years.map(year => values.get(year) ?? null), seriesColor: INK, footer: `${min}–${max}${latestMonth} · ${t("annual")}` };
  };
  const { min, max } = moneyTransfersCoverage(money);
  const received = new Map(money.facts.filter(f => f.entityId === MONEY_TRANSFER_TOTAL_ID && f.measure === "received").map(f => [f.year, f.valueUsd]));
  const total = new Map(investment.facts.filter(f => f.entityId === FOREIGN_INVESTMENT_TOTAL_ID).map(f => [f.year, f.valueUsd]));
  const totalYears = [...total.keys()].sort((a, b) => a - b);
  const balance = new Map(account.filter(f => f.seriesId === "ca.balance" && f.flow === "net").map(f => [f.year, f.valueUsd]));
  const balanceYears = [...balance.keys()].sort((a, b) => a - b);
  // Foreign debt and Reserves follow their page's total; the 2026 point is a mid-year amount, so the footer names its month.
  const totalOf = (indicatorId: string) => {
    const points = position.filter(f => f.indicatorId === indicatorId).sort((a, b) => a.year - b.year);
    const latest = points.at(-1)!;
    return { values: new Map(points.map(f => [f.year, f.value])), min: points[0].year, max: latest.year, month: latest.latestPeriod ? ` (${externalPositionLatestMonth(latest.periodEnd, presentation.messages)})` : "" };
  };
  const debt = totalOf("ext_debt.total"), reserves = totalOf("reserves.total");
  return [
    card("01", "money", "/explorer/external/money-from-abroad", received, min, max),
    card("02", "investment", "/explorer/external/foreign-investment", total, totalYears[0], totalYears.at(-1)!),
    card("03", "account", "/explorer/external/current-account", balance, balanceYears[0], balanceYears.at(-1)!),
    card("04", "debt", "/explorer/external/foreign-debt", debt.values, debt.min, debt.max, debt.month),
    card("05", "reserves", "/explorer/external/reserves", reserves.values, reserves.min, reserves.max, reserves.month),
  ];
}
