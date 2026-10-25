import { EDUCATION_GEORGIA, type ClientEducationFact } from "../data/education/types";
import type { Presentation } from "../i18n/types";
import { message } from "../i18n/messages";
import { INK } from "./colors";
import { EDUCATION_SECTIONS, educationCountLabel, educationCoverage, educationPeriodLabel, type EducationSectionId } from "./education";
import { educationPlaceCoverage } from "./educationPlaces";
import { annualSeries } from "./sparkline";
import { coverageRange } from "./coverageLabel";
import type { HubCardModel } from "./hubCards";

/** Each card's sparkline and footer follow one Georgia series: pupils, kindergarten children, university students and vocational admissions. */
const HEADLINE: Record<EducationSectionId, string> = {
  schools: "education.pupils_national.total", kindergartens: "education.kg_children.total", universities: "education.he_students.total", vocational: "education.vet_admitted.total",
};

/** What each page's line counts, the card's caption. */
const CAPTION: Record<EducationSectionId, string> = {
  schools: "groups.headline.education.schools", kindergartens: "groups.caption.kindergartenChildren", universities: "groups.headline.education.universities", vocational: "groups.caption.vocationalAdmitted",
};

/** Each card's figure and caption state its page's line, over the (school) years the page covers, Georgia's on Schools and Kindergartens. */
export function buildEducationHubCards(facts: readonly ClientEducationFact[], presentation: Presentation): HubCardModel[] {
  const t = (key: string) => message(presentation.messages, `education.${key}`);
  return EDUCATION_SECTIONS.map((section, index) => {
    const headline = facts.filter(f => f.indicatorId === HEADLINE[section.id] && f.geographyId === EDUCATION_GEORGIA).sort((a, b) => a.year - b.year);
    const last = headline.at(-1)!;
    const period = educationPeriodLabel(section.id);
    const value = educationCountLabel(last, t("unitThousand"));
    const { min, max } = section.id === "schools" || section.id === "kindergartens" ? educationPlaceCoverage(section.id, EDUCATION_GEORGIA, facts) : educationCoverage(section.id, facts);
    return {
      index: String(index + 1).padStart(2, "0"), title: message(presentation.messages, section.labelKey), description: t(`page.${section.id}.summary`),
      href: section.href, comingSoon: false,
      series: annualSeries(headline, min, max), seriesColor: INK, footer: `${period(last.year)} · ${value} · ${period(min)}–${period(max)}`,
      latest: { value, period: period(last.year), caption: message(presentation.messages, CAPTION[section.id]) }, years: coverageRange(period(min), period(max)),
    };
  });
}
