import type { ClientMoneyTransfersData } from "../data/externalFlows/importMoneyTransfers";
import { MONEY_TRANSFER_TOTAL_ID } from "../data/externalFlows/types";
import type { Presentation } from "../i18n/types";
import { message } from "../i18n/messages";
import { INK } from "./colors";
import type { HubCardModel } from "./hubCards";
import { moneyTransfersCoverage } from "./moneyTransfersState";

// Foreign investment and Current account stay non-clickable until each has its own approved design.
export function buildExternalHubCards(data: ClientMoneyTransfersData, presentation: Presentation): HubCardModel[] {
  const t = (key: string) => message(presentation.messages, `external.${key}`);
  const { min, max } = moneyTransfersCoverage(data), years = Array.from({ length: max - min + 1 }, (_, index) => min + index);
  const received = new Map(data.facts.filter(f => f.entityId === MONEY_TRANSFER_TOTAL_ID && f.measure === "received").map(f => [f.year, f.valueUsd]));
  const soon = (index: string, key: string): HubCardModel => ({ index, title: t(`${key}.title`), description: t(`${key}.summary`), href: null, comingSoon: true, series: null, seriesColor: null, footer: null });
  return [
    { index: "01", title: t("money.title"), description: t("money.summary"), href: "/explorer/external/money-from-abroad", comingSoon: false, series: years.map(year => received.get(year) ?? null), seriesColor: INK, footer: `${min}–${max} · ${t("annual")}` },
    soon("02", "investment"),
    soon("03", "account"),
  ];
}
