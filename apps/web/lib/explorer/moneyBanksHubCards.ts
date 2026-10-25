import type { ClientMoneyBanksFact, MoneyBanksIndicator } from "../data/moneyBanks/types";
import type { Presentation } from "../i18n/types";
import { message } from "../i18n/messages";
import { INK } from "./colors";
import { formatAmount, formatInUnit } from "./format";
import { coverageRange } from "./coverageLabel";
import type { HubCardModel } from "./hubCards";
import { MONEY_BANKS_SECTIONS, moneyBanksCoverage, moneyBanksViews, type MoneyBanksTopicId } from "./moneyBanks";
import { annualSeries } from "./sparkline";
import { buildMoneyBanksRegionMapModel } from "./moneyBanksRegionMap";

/**
 * Each card's sparkline and footer years follow one series: the broad money supply, total loans, all loans by borrower, the
 * National Bank rate and the bad-loans ratio. Loans by region has none, only its map's years.
 */
const HEADLINE: Record<MoneyBanksTopicId, MoneyBanksIndicator> = {
  "supply": "money.m3", "loans-deposits": "loans.total", "borrowers": "borrowers.total", "interest-rates": "rates.policy", "bank-health": "banks.npl_ratio",
};

/**
 * Each card's caption: the page line's measure, except Who borrows, whose table counts loans to resident sectors, principal
 * only (docs/data-methodology/money-banks-annual.md), so that it does not read as a second "all loans" beside Loans and deposits.
 */
const CAPTION: Record<MoneyBanksTopicId, string> = {
  "supply": "moneyBanks.latest.supply", "loans-deposits": "moneyBanks.latest.loans-deposits", "borrowers": "groups.caption.residentLoans",
  "interest-rates": "moneyBanks.latest.interest-rates", "bank-health": "moneyBanks.latest.bank-health",
};

export function buildMoneyBanksHubCards(facts: readonly ClientMoneyBanksFact[], presentation: Presentation): HubCardModel[] {
  const t = (key: string) => message(presentation.messages, `moneyBanks.${key}`);
  return MONEY_BANKS_SECTIONS.map((section, index) => {
    const card = {
      index: String(index + 1).padStart(2, "0"), title: message(presentation.messages, section.labelKey), description: t(`page.${section.id}.summary`),
      href: section.href, comingSoon: false,
    };
    if (section.id === "regions") {
      const map = buildMoneyBanksRegionMapModel(facts);
      return { ...card, series: null, seriesColor: null, footer: `${map.firstYear}–${map.year}`, years: coverageRange(map.firstYear, map.year) };
    }
    const headline = facts.filter(f => f.indicatorId === HEADLINE[section.id]).sort((a, b) => a.year - b.year);
    const last = headline.at(-1)!;
    const value = last.unit === "gel" ? formatAmount(last.value, presentation.locale)
      : `${formatInUnit(last.value, { divisor: 1, label: "", decimals: last.decimals })}${t("unitPercent")}`;
    // The years every view of the page covers. A % of GDP view divides the same facts by GDP, so it covers none they do not.
    const years = moneyBanksViews(section.id).filter(view => view !== "gdp").flatMap(view => moneyBanksCoverage(section.id, view, facts).years);
    const first = Math.min(...years), lastYear = Math.max(...years);
    return {
      ...card, series: annualSeries(headline, first, lastYear), seriesColor: INK,
      footer: `${last.year} · ${value} · ${first}–${lastYear}`,
      latest: { value, period: String(last.year), caption: message(presentation.messages, CAPTION[section.id]) }, years: coverageRange(first, lastYear),
    };
  });
}
