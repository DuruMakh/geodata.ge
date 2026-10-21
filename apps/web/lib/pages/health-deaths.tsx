import { notFound } from "next/navigation";
import { HealthDeathsExplorer } from "../../components/health/health-deaths-explorer";
import { loadServedHealthData, toClientHealthFact } from "../data/health/importHealth";
import { HEALTH_SECTIONS } from "../explorer/health";
import { HEALTH_DEATH_AREAS, healthDeathsAreaForSlug, healthDeathsAreaHref, healthDeathsSeries } from "../explorer/healthDeaths";
import { getPresentation } from "../i18n/presentation.server";
import { message } from "../i18n/messages";
import type { Locale } from "../i18n/types";
import { fiscalMetadata } from "../seo/metadata";
import { resolveSiteUrl } from "../siteUrl";
import { HEALTH_AREA_PAGES, healthAreaLabels, healthSources, renderHealthFrame } from "./health-shared";

const SECTION = HEALTH_SECTIONS.find(item => item.id === "causes-of-death")!;

/** Georgia and the eleven regions: the slug drops the `region.` prefix. */
export const healthDeathsAreaStaticParams = () => HEALTH_DEATH_AREAS.map(area => ({ id: healthDeathsAreaHref(area).split("/").pop()! }));

function areaForSlug(slug: string) {
  const area = healthDeathsAreaForSlug(slug);
  if (!area) notFound();
  return area;
}

export async function healthDeathsAreaPageMetadata(locale: Locale, slug: string) {
  const area = areaForSlug(slug), presentation = await getPresentation(locale, ["health"], HEALTH_DEATH_AREAS);
  const region = healthAreaLabels(presentation)[area];
  return fiscalMetadata({ locale, path: healthDeathsAreaHref(area), title: message(presentation.messages, "health.page.area.regionTitle", { region }), description: message(presentation.messages, "health.page.area.regionSummary", { region }) });
}

/** An area's causes-of-death page: its deaths by cause, 2014–2025. */
export async function renderHealthDeathsAreaPage(locale: Locale, slug: string) {
  const area = areaForSlug(slug);
  const [data, presentation] = await Promise.all([loadServedHealthData(), getPresentation(locale, ["health", "regionalEconomies", "format", "main", "workbook"], HEALTH_DEATH_AREAS, HEALTH_DEATH_AREAS)]);
  const ids = new Set<string>(healthDeathsSeries().map(series => series.id));
  const served = data.facts.filter(f => f.areaId === area && ids.has(f.indicatorId));
  const facts = served.map(toClientHealthFact);
  const t = (key: string, values?: Record<string, string>) => message(presentation.messages, `health.${key}`, values);
  const labels = Object.fromEntries([...ids].map(id => [id, t(`series.${id}`)]));
  const areaLabels = healthAreaLabels(presentation), region = areaLabels[area];
  const sectionTitle = t("page.causes-of-death.title");
  return renderHealthFrame({
    locale, presentation, path: healthDeathsAreaHref(area), title: t("page.area.regionTitle", { region }), description: t("page.area.regionSummary", { region }), crumb: region,
    section: { label: sectionTitle, path: SECTION.href, description: t("page.causes-of-death.summary") }, area: { name: region, withinGeorgia: area !== "georgia" },
    facts: served, variableMeasured: Object.values(labels),
    children: <HealthDeathsExplorer key={area} area={area} areas={HEALTH_AREA_PAGES} facts={facts} labels={labels} areaLabels={areaLabels} sources={await healthSources(locale, facts)} lastReviewedAt={served.map(f => f.lastReviewedAt).sort().at(-1)!} siteOrigin={resolveSiteUrl()} />,
  });
}
