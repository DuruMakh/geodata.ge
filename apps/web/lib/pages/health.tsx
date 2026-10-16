import { HealthExplorer } from "../../components/health/health-explorer";
import { loadServedHealthData, toClientHealthFact } from "../data/health/importHealth";
import { HEALTH_SECTIONS, healthViews, healthViewSeries, type HealthNationalSectionId } from "../explorer/health";
import { getPresentation } from "../i18n/presentation.server";
import { message } from "../i18n/messages";
import type { Locale } from "../i18n/types";
import { resolveSiteUrl } from "../siteUrl";
import { healthSources, renderHealthFrame } from "./health-shared";

const sectionHref = (section: HealthNationalSectionId) => HEALTH_SECTIONS.find(item => item.id === section)!.href;

/** Doctors and hospitals or Illnesses: Georgia's figures, every view's series. */
export async function renderHealthPage(locale: Locale, section: HealthNationalSectionId) {
  const [data, presentation] = await Promise.all([loadServedHealthData(), getPresentation(locale, ["health", "format", "main", "workbook"], [])]);
  // Each page receives only the observations its series show, and only the counting changes that touch them.
  const ids = new Set<string>(healthViews(section).flatMap(view => healthViewSeries(section, view).map(series => series.id)));
  const served = data.facts.filter(f => f.areaId === "georgia" && ids.has(f.indicatorId));
  const facts = served.map(toClientHealthFact);
  const breaks = data.breaks.filter(item => item.appliesTo.some(id => ids.has(id)));
  const t = (key: string) => message(presentation.messages, `health.${key}`);
  const labels = Object.fromEntries([...ids].map(id => [id, t(`series.${id}`)]));
  const title = t(`page.${section}.title`);
  const lastReviewedAt = served.map(f => f.lastReviewedAt).sort().at(-1)!;
  return renderHealthFrame({
    locale, presentation, path: sectionHref(section), title, description: t(`page.${section}.summary`), crumb: title, facts: served, variableMeasured: Object.values(labels),
    children: <HealthExplorer key={section} section={section} facts={facts} breaks={breaks} labels={labels} sources={await healthSources(locale, facts)} lastReviewedAt={lastReviewedAt} siteOrigin={resolveSiteUrl()} />,
  });
}
