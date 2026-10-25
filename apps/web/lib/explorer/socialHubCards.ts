import { SOCIAL_GEORGIA, type ClientSocialFact } from "../data/social/types";
import type { Presentation } from "../i18n/types";
import { message } from "../i18n/messages";
import { INK } from "./colors";
import { formatInUnit, UNIT_PERSONS } from "./format";
import { HEALTH_SECTIONS } from "./health";
import { coverageRange } from "./coverageLabel";
import type { HubCardModel } from "./hubCards";
import { annualSeries } from "./sparkline";
import { SOCIAL_SECTIONS, type SocialSectionId } from "./social";

/** Each card's sparkline and footer follow one Georgia series: the payments total, pensioners, receiving families, social package recipients and the funded pension's savings. */
const HEADLINE: Record<SocialSectionId, string> = {
  "social-payments": "social.payments.total.amount", pensions: "social.pension.recipients",
  "subsistence-allowance": "social.subsistence.families", "social-package": "social.social_package.total.recipients",
  "funded-pension": "social.funded_pension.savings.amount",
};

/** Who a count counts, the card's caption: the page's line names them. The money cards' titles already say what their figure is. */
const CAPTION: Partial<Record<SocialSectionId, string>> = {
  pensions: "groups.headline.health.pensions", "subsistence-allowance": "groups.caption.allowanceFamilies", "social-package": "groups.caption.socialPackage",
};

/**
 * The five cards follow the Health hub's three, so their numbers continue from 04. Each states its page's line: money in billion GEL
 * to two decimals, as the page writes it (`6.17`), the others whole counts with what they count as the caption.
 */
export function buildSocialHubCards(facts: readonly ClientSocialFact[], presentation: Presentation): HubCardModel[] {
  const t = (key: string) => message(presentation.messages, `social.${key}`);
  return SOCIAL_SECTIONS.map((section, index) => {
    const headline = facts.filter(f => f.indicatorId === HEADLINE[section.id] && f.geographyId === SOCIAL_GEORGIA).sort((a, b) => a.year - b.year);
    const last = headline.at(-1)!;
    // Money is served in million GEL.
    const value = section.id === "social-payments" || section.id === "funded-pension"
      ? `${formatInUnit(last.value / 1000, { divisor: 1, label: "", decimals: 2 })} ${message(presentation.messages, "groups.unit.billionGel")}` : formatInUnit(last.value, UNIT_PERSONS);
    const caption = CAPTION[section.id];
    return {
      index: String(HEALTH_SECTIONS.length + index + 1).padStart(2, "0"), title: message(presentation.messages, section.labelKey), description: t(`page.${section.id}.summary`),
      href: section.href, comingSoon: false,
      series: annualSeries(headline), seriesColor: INK, footer: `${last.year} · ${value} · ${headline[0].year}–${last.year}`,
      latest: { value, period: String(last.year), ...(caption ? { caption: message(presentation.messages, caption) } : {}) }, years: coverageRange(headline[0].year, last.year),
    };
  });
}
