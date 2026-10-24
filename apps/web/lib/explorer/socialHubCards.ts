import { SOCIAL_GEORGIA, type ClientSocialFact } from "../data/social/types";
import type { Presentation } from "../i18n/types";
import { message } from "../i18n/messages";
import { INK } from "./colors";
import { formatInUnit, UNIT_PERSONS } from "./format";
import { HEALTH_SECTIONS } from "./health";
import { coverageRange } from "./coverageLabel";
import type { HubCardModel } from "./hubCards";
import { SOCIAL_SECTIONS, type SocialSectionId } from "./social";

/** Each card's sparkline and footer follow one Georgia series: the payments total, pensioners, receiving families and social package recipients. */
const HEADLINE: Record<SocialSectionId, string> = {
  "social-payments": "social.payments.total.amount", pensions: "social.pension.recipients",
  "subsistence-allowance": "social.subsistence.families", "social-package": "social.social_package.total.recipients",
};

/** The four cards follow the Health hub's three, so their numbers continue from 04. */
export function buildSocialHubCards(facts: readonly ClientSocialFact[], presentation: Presentation): HubCardModel[] {
  const t = (key: string) => message(presentation.messages, `social.${key}`);
  return SOCIAL_SECTIONS.map((section, index) => {
    const headline = facts.filter(f => f.indicatorId === HEADLINE[section.id] && f.geographyId === SOCIAL_GEORGIA).sort((a, b) => a.year - b.year);
    const last = headline.at(-1)!;
    // Money is million GEL to one decimal; the others are whole counts.
    const value = section.id === "social-payments" ? `${formatInUnit(last.value, { divisor: 1, label: "", decimals: 1 })} ${t("unitMlnGel")}` : formatInUnit(last.value, UNIT_PERSONS);
    return {
      index: String(HEALTH_SECTIONS.length + index + 1).padStart(2, "0"), title: message(presentation.messages, section.labelKey), description: t(`page.${section.id}.summary`),
      href: section.href, comingSoon: false,
      series: headline.map(f => f.value), seriesColor: INK, footer: `${last.year} · ${value} · ${headline[0].year}–${last.year}`,
      latest: { value, period: String(last.year) }, years: coverageRange(headline[0].year, last.year),
    };
  });
}
