import { SERIES } from "../data/demography/series";
import type { ServedDemographyObservation } from "../data/demography/types";
import { message } from "../i18n/messages";
import type { Presentation } from "../i18n/types";
import { INK } from "./colors";
import { GEORGIA_PLACE_ID } from "./demographyAreas";
import { sparkValues } from "./demographyPopulation";
import { DEMOGRAPHY_PAGES } from "./demographyRoutes";
import { formatInUnit, UNIT_PERSONS } from "./format";
import type { HubCardModel } from "./hubCards";

// Every figure is read from the served facts at build time, so the hub can never drift from the pages
// behind it (DESIGN.md section 6.7).
export function buildDemographyHubCards(
  facts: readonly ServedDemographyObservation[],
  presentation: Presentation,
): HubCardModel[] {
  const t = (key: string, values?: Record<string, string | number>) => message(presentation.messages, `demography.${key}`, values);
  const georgia = facts
    .filter((fact) => fact.seriesId === SERIES.populationTotal && fact.geographyId === GEORGIA_PLACE_ID)
    .sort((left, right) => left.year - right.year);
  const first = georgia[0];
  const last = georgia.at(-1);
  const span = first && last ? Array.from({ length: last.year - first.year + 1 }, (_, index) => first.year + index) : [];
  const trend = sparkValues(span, (year) => georgia.find((fact) => fact.year === year)?.value ?? null);
  const net = facts.filter((fact) => fact.seriesId === SERIES.netMigration).sort((left, right) => left.year - right.year);
  const signed = (value: number) => `${value > 0 ? "+" : ""}${formatInUnit(value, UNIT_PERSONS)}`;
  return DEMOGRAPHY_PAGES.map((page, index) => {
    const card = {
      index: String(index + 1).padStart(2, "0"),
      title: t(page.titleKey),
      description: t(page.descriptionKey),
      href: page.live ? page.path : null,
      comingSoon: !page.live,
    };
    if (page.id === "migration" && page.live && net.length) {
      const [firstNet, lastNet] = [net[0]!, net.at(-1)!];
      return {
        ...card,
        series: net.map((fact) => fact.value),
        seriesColor: INK,
        footer: t("migrationCardFooter", { year: lastNet.year, net: signed(lastNet.value), first: firstNet.year, last: lastNet.year }),
      };
    }
    if (page.id !== "population" || !first || !last) return { ...card, series: null, seriesColor: null, footer: null };
    return {
      ...card,
      series: trend,
      seriesColor: INK,
      footer: t("cardFooter", { year: last.year, persons: formatInUnit(last.value, UNIT_PERSONS), first: first.year, last: last.year }),
    };
  });
}
