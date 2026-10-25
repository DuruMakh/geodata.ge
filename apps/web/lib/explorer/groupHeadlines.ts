import { message } from "../i18n/messages";
import type { Messages } from "../i18n/types";
import type { GroupId } from "../navigation/navTree";
import type { HubCardModel } from "./hubCards";

/**
 * Each group page's four headline numbers (spec 2026-10-24-explorer-regroup §5): the page each one links to and, where the
 * card's title is not the figure's name, its label (`groups.headline.{labelKey}`). The value and trend are that page's card's.
 */
export const GROUP_HEADLINES: Record<GroupId, readonly { page: string; labelKey?: string }[]> = {
  budget: [{ page: "/explorer/revenue" }, { page: "/explorer/expenditure" }, { page: "/explorer/debt" }, { page: "/explorer/deficit", labelKey: "deficit" }],
  economy: [
    { page: "/explorer/economy/gdp", labelKey: "economy.gdp" }, { page: "/explorer/business/sales", labelKey: "business.sales" },
    { page: "/explorer/business/jobs", labelKey: "business.jobs" }, { page: "/explorer/housing/permits" },
  ],
  prices: [{ page: "/explorer/inflation/overview", labelKey: "inflation.overview" }, { page: "/explorer/money/interest-rates" }, { page: "/explorer/money/supply" }, { page: "/explorer/money/loans-deposits" }],
  labour: [
    { page: "/explorer/unemployment/overview", labelKey: "unemployment.overview" }, { page: "/explorer/wages/overview", labelKey: "wages.overview" },
    { page: "/explorer/unemployment/industries", labelKey: "unemployment.industries" }, { page: "/explorer/unemployment/informal", labelKey: "unemployment.informal" },
  ],
  living: [{ page: "/explorer/living-standards/income" }, { page: "/explorer/living-standards/poverty" }, { page: "/explorer/living-standards/inequality" }, { page: "/explorer/health/pensions", labelKey: "health.pensions" }],
  external: [
    { page: "/explorer/trade/overview", labelKey: "trade.overview" }, { page: "/explorer/external/money-from-abroad", labelKey: "external.money-from-abroad" },
    { page: "/explorer/external/foreign-investment" }, { page: "/explorer/trade/partners", labelKey: "trade.partners" },
  ],
  demography: [
    { page: "/explorer/demography/population" }, { page: "/explorer/demography/age-sex", labelKey: "demography.age-sex" },
    { page: "/explorer/demography/births-deaths", labelKey: "demography.births-deaths" }, { page: "/explorer/demography/migration", labelKey: "demography.migration" },
  ],
  society: [
    { page: "/explorer/education/schools", labelKey: "education.schools" }, { page: "/explorer/education/universities", labelKey: "education.universities" },
    { page: "/explorer/internet/users" }, { page: "/explorer/crime/recorded" },
  ],
};

/** One headline number: its label, the page card's latest figure with its period, and the card's series as the trend. */
export type GroupHeadline = { href: string; label: string; value: string; period: string; caption: string | null; series: (number | null)[] | null };

/** A value's figure and its unit ("32.4" and "მლრდ ₾"): the text after the first space is the unit. */
export function splitValue(value: string): { figure: string; unit: string | null } {
  const space = value.indexOf(" ");
  return space < 0 ? { figure: value, unit: null } : { figure: value.slice(0, space), unit: value.slice(space + 1) };
}

/** What a headline value's figure must be, so `splitValue` cuts it in the right place: a sign, digits, separators, an optional `%`. */
const HEADLINE_FIGURE = /^[−+-]?[\d.,]+%?$/;

/**
 * The group's headline numbers, from its topics' cards. A pick without a card or a latest figure, or whose figure is not
 * one before the first space, throws, so the build fails instead of printing a gap or half a number in the unit's type.
 * The card's caption stays where the label does not already say it (`headlineCaption`: the largest partner's name alone).
 */
export function groupHeadlines(group: GroupId, cards: readonly HubCardModel[], messages: Messages): GroupHeadline[] {
  return GROUP_HEADLINES[group].map(({ page, labelKey }) => {
    const card = cards.find((candidate) => candidate.href === page);
    if (!card?.latest) throw new Error(`No latest figure for the ${group} headline ${page}`);
    const label = labelKey ? message(messages, `groups.headline.${labelKey}`) : card.title;
    const { value, period } = card.latest;
    const { figure, unit } = splitValue(value);
    // A unit that starts with a digit is the rest of a number split at a space (`1 234 ₾`).
    if (!HEADLINE_FIGURE.test(figure) || /^\d/.test(unit ?? "")) throw new Error(`The ${group} headline ${page} starts with "${figure}", not a figure: "${value}"`);
    const caption = card.latest.headlineCaption ?? card.latest.caption;
    return { href: page, label, value, period, caption: caption && caption !== label ? caption : null, series: card.series };
  });
}
