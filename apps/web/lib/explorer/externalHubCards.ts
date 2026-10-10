import type { ClientForeignInvestmentData } from "../data/externalFlows/importForeignInvestment";
import type { ClientMoneyTransfersData } from "../data/externalFlows/importMoneyTransfers";
import { FOREIGN_INVESTMENT_TOTAL_ID, MONEY_TRANSFER_TOTAL_ID } from "../data/externalFlows/types";
import type { Presentation } from "../i18n/types";
import { message } from "../i18n/messages";
import { INK } from "./colors";
import type { HubCardModel } from "./hubCards";
import { moneyTransfersCoverage } from "./moneyTransfersState";

// Current account stays non-clickable until it has its own approved design.
export function buildExternalHubCards(money: ClientMoneyTransfersData, investment: ClientForeignInvestmentData, presentation: Presentation): HubCardModel[] {
  const t = (key: string) => message(presentation.messages, `external.${key}`);
  const card = (index: string, key: string, href: string, values: Map<number, number | null>, min: number, max: number): HubCardModel => {
    const years = Array.from({ length: max - min + 1 }, (_, i) => min + i);
    return { index, title: t(`${key}.title`), description: t(`${key}.summary`), href, comingSoon: false, series: years.map(year => values.get(year) ?? null), seriesColor: INK, footer: `${min}–${max} · ${t("annual")}` };
  };
  const { min, max } = moneyTransfersCoverage(money);
  const received = new Map(money.facts.filter(f => f.entityId === MONEY_TRANSFER_TOTAL_ID && f.measure === "received").map(f => [f.year, f.valueUsd]));
  const total = new Map(investment.facts.filter(f => f.entityId === FOREIGN_INVESTMENT_TOTAL_ID).map(f => [f.year, f.valueUsd]));
  const totalYears = [...total.keys()].sort((a, b) => a - b);
  return [
    card("01", "money", "/explorer/external/money-from-abroad", received, min, max),
    card("02", "investment", "/explorer/external/foreign-investment", total, totalYears[0], totalYears.at(-1)!),
    { index: "03", title: t("account.title"), description: t("account.summary"), href: null, comingSoon: true, series: null, seriesColor: null, footer: null },
  ];
}
