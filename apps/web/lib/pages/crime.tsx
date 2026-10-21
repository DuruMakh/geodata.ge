import { CrimeExplorer } from "../../components/crime/crime-explorer";
import { loadServedCrimeData, toClientCrimeFact } from "../data/crime/importCrime";
import { loadServedDemographyData } from "../data/demography/importDemography";
import { crimeSeries, type CrimeSectionId } from "../explorer/crime";
import { getPresentation } from "../i18n/presentation.server";
import { message } from "../i18n/messages";
import type { Locale } from "../i18n/types";
import { resolveSiteUrl } from "../siteUrl";
import { crimeSectionHref, crimeSources, renderCrimeFrame } from "./crime-shared";

/** One Crime and justice page: Georgia's counts of the section's series, and the population its per-100,000 view divides by. */
export async function renderCrimePage(locale: Locale, section: CrimeSectionId) {
  const [data, demography, presentation] = await Promise.all([loadServedCrimeData(), loadServedDemographyData(), getPresentation(locale, ["crime", "format", "main", "workbook"], [])]);
  // Each page receives only the observations its series show, and only the counting changes that touch them; the
  // model adds the census recalculation of the population itself in the per-100,000 view.
  const ids = new Set<string>(crimeSeries(section).map(series => series.id));
  const served = data.facts.filter(f => ids.has(f.indicatorId));
  const facts = served.map(toClientCrimeFact);
  const breaks = data.breaks.filter(item => item.appliesTo.some(id => ids.has(id)));
  const population = demography.facts.filter(f => f.seriesId === "demography.population_total" && f.geographyId === "country.georgia").map(f => ({ year: f.year, persons: f.value }));
  const t = (key: string) => message(presentation.messages, `crime.${key}`);
  const labels = Object.fromEntries([...ids].map(id => [id, t(`series.${id}`)]));
  const title = t(`page.${section}.title`);
  const lastReviewedAt = served.map(f => f.lastReviewedAt).sort().at(-1)!;
  return renderCrimeFrame({
    locale, presentation, path: crimeSectionHref(section), title, description: t(`page.${section}.summary`), facts: served, variableMeasured: Object.values(labels),
    children: <CrimeExplorer key={section} section={section} facts={facts} population={population} breaks={breaks} labels={labels} sources={await crimeSources(locale, facts)} lastReviewedAt={lastReviewedAt} siteOrigin={resolveSiteUrl()} />,
  });
}
