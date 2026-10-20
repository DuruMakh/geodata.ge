"use client";
import { ENVIRONMENT_CITIES, type EnvironmentCity } from "../../lib/data/environment/types";
import type { MunicipalRegion } from "../../lib/data/municipal/types";
import { AIR_QUALITY_PATH, environmentCityHref, neighbourEnvironmentCities } from "../../lib/explorer/environmentCities";
import { environmentAreaIndexHref, environmentAreaRoutes, environmentAreaSelectionHash, type EnvironmentArea, type EnvironmentAreaTopic } from "../../lib/explorer/environmentAreas";
import { publicLabel } from "../../lib/i18n/labels";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import { pageHref } from "../../lib/i18n/routes";
import { PlaceHeading } from "../explorer-shell/place-heading";
import { PickerDialog, RegionPicker } from "../regional-economies/region-picker";

/** `Air quality — {city} ▾`: the nine cities in Geostat's order, "All cities" opening the index, and previous/next links. */
export function EnvironmentCityHeading({ city }: { city: EnvironmentCity }) {
  const { locale, messages } = useI18n();
  const t = (key: string) => message(messages, `environment.${key}`);
  const name = (id: EnvironmentCity) => t(`city.${id}`);
  const neighbours = neighbourEnvironmentCities(city);
  const allLabel = t("cityPickerAll");
  return <PlaceHeading lead={t("page.city.headingLead")} placeLabel={name(city)} triggerTestId="city-picker-trigger"
    picker={(open, close, id) => <PickerDialog id={id} open={open} onClose={close} activeId={city} testIdPrefix="city-picker"
      options={ENVIRONMENT_CITIES.map(option => ({ id: option, label: name(option), href: pageHref(environmentCityHref(option), locale), searchTerms: [name(option), option] }))}
      allOption={{ label: allLabel, href: pageHref(AIR_QUALITY_PATH, locale), searchTerms: [allLabel], testId: "city-picker-all-option" }}
      text={{ title: t("cityPickerTitle"), placeholder: t("cityPickerPlaceholder"), search: t("cityPickerSearch"), results: t("cityPickerResults"), empty: t("cityPickerEmpty"), clear: t("cityPickerClear"), hint: t("cityPickerHint") }} />}
    neighbours={{
      testId: "city-entity-navigation",
      previous: { href: pageHref(environmentCityHref(neighbours.previous), locale), label: name(neighbours.previous) },
      next: { href: pageHref(environmentCityHref(neighbours.next), locale), label: name(neighbours.next) },
    }} />;
}

/**
 * `Waste — {area} ▾` or `Forests — {area} ▾`: Georgia and the eleven regions, the index as "all regions", and previous/next
 * links. Links to another area carry the selection, moved to that area.
 */
export function EnvironmentAreaHeading({ topic, area, areas, selectedIds }: { topic: EnvironmentAreaTopic; area: EnvironmentArea; areas: readonly MunicipalRegion[]; selectedIds: readonly string[] }) {
  const { locale, messages, englishLabels } = useI18n();
  const routes = environmentAreaRoutes(topic);
  const nameOf = (region: MunicipalRegion) => region.id === "georgia" ? message(messages, "environment.area.georgia") : publicLabel(locale, region.id, region.kaLabel, englishLabels);
  const hrefOf = (id: string) => `${routes.regionHref(id)}${environmentAreaSelectionHash(topic, selectedIds, routes.areaOfMapId(id))}`;
  const index = areas.findIndex(item => item.id === routes.mapId(area));
  const previous = areas[(index - 1 + areas.length) % areas.length]!, next = areas[(index + 1) % areas.length]!;
  return <PlaceHeading lead={message(messages, `environment.page.area.${topic}.headingLead`)} placeLabel={nameOf(areas[index]!)} triggerTestId="region-picker-trigger"
    picker={(open, close, id) => <RegionPicker id={id} open={open} onClose={close} regions={areas} activeRegionId={routes.mapId(area)} hrefForRegion={hrefOf} indexHref={environmentAreaIndexHref(topic)} />}
    neighbours={{
      testId: "environment-region-navigation",
      previous: { href: pageHref(hrefOf(previous.id), locale), label: nameOf(previous) },
      next: { href: pageHref(hrefOf(next.id), locale), label: nameOf(next) },
    }} />;
}
