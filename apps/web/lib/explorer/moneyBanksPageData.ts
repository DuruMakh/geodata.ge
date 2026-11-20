import { toClientMoneyBanksFact } from "../data/moneyBanks/importMoneyBanks";
import type { ClientMoneyBanksFact, MoneyBanksFact } from "../data/moneyBanks/types";
import { message } from "../i18n/messages";
import type { Messages, Presentation } from "../i18n/types";
import { moneyBanksViewSeries, moneyBanksViews, type MoneyBanksTopicId } from "./moneyBanks";
import { moneyBanksAreaSeries, type MoneyBanksArea } from "./moneyBanksAreas";

/*
 * What the Money and banks pages hand their explorers: the observations a page shows and its series' names. Shared by
 * the pages (lib/pages/moneyBanks.tsx, money-banks-area.tsx) and the MCP snapshot build (lib/factQuery/topics/moneyBanks.ts),
 * which cannot import the pages (they pull in `server-only` and React).
 */

/** The ids of every series a money and banks page can show (Money supply's two views share theirs). */
export function moneyBanksSectionSeriesIds(section: MoneyBanksTopicId): string[] {
  return [...new Set(moneyBanksViews(section).flatMap(view => moneyBanksViewSeries(section, view).map(series => series.id)))];
}

/** Display names for every series a money and banks page can show, in the page's language. */
export function moneyBanksLabels(presentation: Presentation, section: MoneyBanksTopicId): Record<string, string> {
  return Object.fromEntries(moneyBanksSectionSeriesIds(section).map(id => [id, message(presentation.messages, `moneyBanks.series.${id}`)]));
}

/** The observations a page's views can show. */
export function moneyBanksPageFacts(facts: readonly MoneyBanksFact[], section: MoneyBanksTopicId): ClientMoneyBanksFact[] {
  const ids = new Set(moneyBanksSectionSeriesIds(section));
  return facts.map(toClientMoneyBanksFact).filter(f => ids.has(f.indicatorId));
}

/** The observations a Loans by region area page shows: its three loan rows. */
export function moneyBanksAreaFacts(facts: readonly MoneyBanksFact[], area: MoneyBanksArea): ClientMoneyBanksFact[] {
  const ids = new Set<string>(moneyBanksAreaSeries(area).map(item => item.id));
  return facts.filter(f => ids.has(f.indicatorId)).map(toClientMoneyBanksFact);
}

/** An area page's row names, without the area, which the heading names: `loans_region.<area>.<part>` reads `moneyBanks.series.loans_region.<part>`. */
export function moneyBanksAreaSeriesLabels(messages: Messages, area: MoneyBanksArea): Record<string, string> {
  return Object.fromEntries(moneyBanksAreaSeries(area).map(item => [item.id, message(messages, `moneyBanks.series.loans_region.${item.id.split(".")[2]}`)]));
}
