import { EDUCATION_GEORGIA, type ClientEducationFact } from "../data/education/types";
import type { Presentation } from "../i18n/types";
import { message } from "../i18n/messages";
import { INK } from "./colors";
import { EDUCATION_SECTIONS, educationCountLabel, educationPeriodLabel, type EducationSectionId } from "./education";
import type { HubCardModel } from "./hubCards";

/** Each card's sparkline and footer follow one Georgia series: pupils, kindergarten children, university students and vocational admissions. */
const HEADLINE: Record<EducationSectionId, string> = {
  schools: "education.pupils_national.total", kindergartens: "education.kg_children.total", universities: "education.he_students.total", vocational: "education.vet_admitted.total",
};

export function buildEducationHubCards(facts: readonly ClientEducationFact[], presentation: Presentation): HubCardModel[] {
  const t = (key: string) => message(presentation.messages, `education.${key}`);
  return EDUCATION_SECTIONS.map((section, index) => {
    const headline = facts.filter(f => f.indicatorId === HEADLINE[section.id] && f.geographyId === EDUCATION_GEORGIA).sort((a, b) => a.year - b.year);
    const last = headline.at(-1)!;
    const period = educationPeriodLabel(section.id);
    const value = educationCountLabel(last, t("unitThousand"));
    return {
      index: String(index + 1).padStart(2, "0"), title: message(presentation.messages, section.labelKey), description: t(`page.${section.id}.summary`),
      href: section.href, comingSoon: false,
      series: headline.map(f => f.value), seriesColor: INK, footer: `${period(last.year)} · ${value} · ${period(headline[0].year)}–${period(last.year)}`,
    };
  });
}
