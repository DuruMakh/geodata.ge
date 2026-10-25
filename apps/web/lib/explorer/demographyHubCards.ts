import { SERIES } from "../data/demography/series";
import type { ServedDemographyObservation } from "../data/demography/types";
import { message } from "../i18n/messages";
import type { Presentation } from "../i18n/types";
import { INK } from "./colors";
import { GEORGIA_PLACE_ID } from "./demographyAreas";
import { sparkValues } from "./demographyPopulation";
import { DEMOGRAPHY_PAGES } from "./demographyRoutes";
import { formatInUnit, formatShare, UNIT_PERSONS } from "./format";
import { coverageRange } from "./coverageLabel";
import type { HubCardModel } from "./hubCards";
import { annualSeries } from "./sparkline";

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
  const births = facts
    .filter((fact) => fact.seriesId === SERIES.liveBirths && fact.geographyId === GEORGIA_PLACE_ID)
    .sort((left, right) => left.year - right.year);
  const marriages = facts
    .filter((fact) => fact.seriesId === SERIES.marriages && fact.geographyId === GEORGIA_PLACE_ID)
    .sort((left, right) => left.year - right.year);
  // Georgia's share aged 65+ on 1 January: the 65+ band over the three bands, both sexes.
  const bandsByYear = new Map<number, { all: number; old: number }>();
  for (const fact of facts) {
    if (fact.seriesId !== SERIES.populationAgeBand || fact.geographyId !== GEORGIA_PLACE_ID || fact.sex !== "total") continue;
    const year = bandsByYear.get(fact.year) ?? { all: 0, old: 0 };
    year.all += fact.value;
    if (fact.ageGroup === "band_65_plus") year.old += fact.value;
    bandsByYear.set(fact.year, year);
  }
  const shareByYear = new Map([...bandsByYear].map(([year, bands]) => [year, (bands.old / bands.all) * 100]));
  const oldShares = [...bandsByYear].sort(([left], [right]) => left - right).map(([year, bands]) => ({ year, share: (bands.old / bands.all) * 100 }));
  const signed = (value: number) => `${value > 0 ? "+" : ""}${formatInUnit(value, UNIT_PERSONS)}`;
  // What a count or share counts, the noun its footer used to carry (the headline's own label for the same figure).
  const caption = (key: string) => message(presentation.messages, key);
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
        series: annualSeries(net),
        seriesColor: INK,
        footer: t("migrationCardFooter", { year: lastNet.year, net: signed(lastNet.value), first: firstNet.year, last: lastNet.year }),
        latest: { value: signed(lastNet.value), period: String(lastNet.year), caption: caption("groups.headline.demography.migration") }, years: coverageRange(firstNet.year, lastNet.year),
      };
    }
    if (page.id === "age-sex" && page.live && oldShares.length) {
      const [firstShare, lastShare] = [oldShares[0]!, oldShares.at(-1)!];
      return {
        ...card,
        // A gap, not a join, across the 2025 census re-base (DESIGN.md section 29).
        series: sparkValues(oldShares.map((entry) => entry.year), (year) => shareByYear.get(year) ?? null),
        seriesColor: INK,
        footer: t("ageSexCardFooter", { year: lastShare.year, share: formatShare(lastShare.share / 100), first: firstShare.year, last: lastShare.year }),
        latest: { value: formatShare(lastShare.share / 100), period: String(lastShare.year), caption: caption("groups.headline.demography.age-sex") }, years: coverageRange(firstShare.year, lastShare.year),
      };
    }
    if (page.id === "births-deaths" && page.live && births.length) {
      const [firstBirths, lastBirths] = [births[0]!, births.at(-1)!];
      return {
        ...card,
        series: annualSeries(births),
        seriesColor: INK,
        footer: t("birthsCardFooter", { year: lastBirths.year, births: formatInUnit(lastBirths.value, UNIT_PERSONS), first: firstBirths.year, last: lastBirths.year }),
        latest: { value: formatInUnit(lastBirths.value, UNIT_PERSONS), period: String(lastBirths.year), caption: caption("groups.headline.demography.births-deaths") }, years: coverageRange(firstBirths.year, lastBirths.year),
      };
    }
    if (page.id === "marriages-divorces" && page.live && marriages.length) {
      const [firstMarriages, lastMarriages] = [marriages[0]!, marriages.at(-1)!];
      return {
        ...card,
        series: annualSeries(marriages),
        seriesColor: INK,
        footer: t("marriagesCardFooter", { year: lastMarriages.year, marriages: formatInUnit(lastMarriages.value, UNIT_PERSONS), first: firstMarriages.year, last: lastMarriages.year }),
        latest: { value: formatInUnit(lastMarriages.value, UNIT_PERSONS), period: String(lastMarriages.year), caption: caption("groups.caption.marriages") }, years: coverageRange(firstMarriages.year, lastMarriages.year),
      };
    }
    if (page.id !== "population" || !first || !last) return { ...card, series: null, seriesColor: null, footer: null };
    return {
      ...card,
      series: trend,
      seriesColor: INK,
      footer: t("cardFooter", { year: last.year, persons: formatInUnit(last.value, UNIT_PERSONS), first: first.year, last: last.year }),
      latest: { value: formatInUnit(last.value, UNIT_PERSONS), period: String(last.year) }, years: coverageRange(first.year, last.year),
    };
  });
}
