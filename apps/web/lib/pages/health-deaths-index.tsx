import { HealthDeathsIndex } from "../../components/health/health-deaths-index";
import { loadServedHealthData, toClientHealthFact } from "../data/health/importHealth";
import { HEALTH_SECTIONS } from "../explorer/health";
import { HEALTH_DEATH_AREAS } from "../explorer/healthDeaths";
import { buildHealthDeathRateMapModel } from "../explorer/healthDeathRateMap";
import { getPresentation } from "../i18n/presentation.server";
import { message } from "../i18n/messages";
import type { Locale } from "../i18n/types";
import { renderHealthFrame } from "./health-shared";

const RATE = "health.death_rate.total";

/** The Causes of death index: the map and list whose rows open each area's page (health-deaths.tsx). */
export async function renderHealthDeathsIndex(locale: Locale) {
  const [data, presentation] = await Promise.all([loadServedHealthData(), getPresentation(locale, ["health", "regionalEconomies", "format"], HEALTH_DEATH_AREAS, HEALTH_DEATH_AREAS)]);
  // The map is built on the server; the page itself receives only Georgia's death rate.
  const served = data.facts.filter(f => f.indicatorId === RATE);
  const rates = served.map(toClientHealthFact);
  const t = (key: string) => message(presentation.messages, `health.${key}`);
  const title = t("page.causes-of-death.title");
  return renderHealthFrame({
    locale, presentation, path: HEALTH_SECTIONS.find(item => item.id === "causes-of-death")!.href, title, description: t("page.causes-of-death.summary"), crumb: title,
    facts: served, variableMeasured: [t(`series.${RATE}`)],
    children: <HealthDeathsIndex georgiaRates={rates.filter(f => f.areaId === "georgia")} regionMap={buildHealthDeathRateMapModel(rates)} />,
  });
}
