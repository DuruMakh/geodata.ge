import { HealthExplorer } from "../../components/health/health-explorer";
import { loadServedHealthData } from "../data/health/importHealth";
import { HEALTH_SECTIONS, type HealthNationalSectionId } from "../explorer/health";
import { healthNationalPageData } from "../explorer/healthPageData";
import { getPresentation } from "../i18n/presentation.server";
import { message } from "../i18n/messages";
import type { Locale } from "../i18n/types";
import { resolveSiteUrl } from "../siteUrl";
import { healthSources, renderHealthFrame } from "./health-shared";

const sectionHref = (section: HealthNationalSectionId) => HEALTH_SECTIONS.find(item => item.id === section)!.href;

/** Doctors and hospitals or Illnesses: Georgia's figures, every view's series. */
export async function renderHealthPage(locale: Locale, section: HealthNationalSectionId) {
  const [data, presentation] = await Promise.all([loadServedHealthData(), getPresentation(locale, ["health", "format", "main", "workbook"], [])]);
  const { served, facts, breaks, labels } = healthNationalPageData(data, presentation.messages, section);
  const t = (key: string) => message(presentation.messages, `health.${key}`);
  const title = t(`page.${section}.title`);
  const lastReviewedAt = served.map(f => f.lastReviewedAt).sort().at(-1)!;
  return renderHealthFrame({
    locale, presentation, path: sectionHref(section), title, description: t(`page.${section}.summary`), crumb: title, facts: served, variableMeasured: Object.values(labels),
    children: <HealthExplorer key={section} section={section} facts={facts} breaks={breaks} labels={labels} sources={await healthSources(locale, facts)} lastReviewedAt={lastReviewedAt} siteOrigin={resolveSiteUrl()} />,
  });
}
