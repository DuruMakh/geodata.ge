"use client";

import { CPI_CITY_IDS } from "../../lib/data/inflation/types";
import { GEORGIA_LINE_ID } from "../../lib/explorer/inflationCities";
import { cityLineLabel, cityPlaceLabel } from "../../lib/explorer/inflationCityLabels";
import { CITIES_PATH, cityPageHref, citySlug, neighbourCities, type CityView } from "../../lib/explorer/inflationCityRoutes";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import { pageHref } from "../../lib/i18n/routes";
import { PlaceHeading } from "../explorer-shell/place-heading";
import { PickerDialog } from "../regional-economies/region-picker";

// `ინფლაცია ქალაქებში — {place} ▾`, as region and municipality pages open; the shared
// picker dialog lists საქართველო (the comparison page) first, as its "all" row. City
// pages add previous/next links in Geostat's order; the Georgia page has none.
export function InflationCityHeading({ view }: { view: CityView }) {
  const { locale, messages } = useI18n();
  const neighbours = view.kind === "city" ? neighbourCities(view.cityId) : null;
  const t = (key: string) => message(messages, `inflation.${key}`);
  const georgiaLabel = cityLineLabel(messages, GEORGIA_LINE_ID);
  return (
    <PlaceHeading
      lead={t("cityHeadingLead")}
      placeLabel={cityPlaceLabel(messages, view)}
      triggerTestId="city-picker-trigger"
      picker={(open, close) => (
        <PickerDialog
          open={open}
          onClose={close}
          options={CPI_CITY_IDS.map((cityId) => ({ id: cityId, label: cityLineLabel(messages, cityId), href: pageHref(cityPageHref(cityId), locale), searchTerms: [cityLineLabel(messages, cityId), citySlug(cityId)] }))}
          activeId={view.kind === "city" ? view.cityId : null}
          allOption={{ label: georgiaLabel, href: pageHref(CITIES_PATH, locale), searchTerms: [georgiaLabel, "georgia"], testId: "city-picker-georgia-option", current: view.kind === "georgia" }}
          text={{ title: t("cityPickerTitle"), placeholder: t("cityPickerPlaceholder"), search: t("cityPickerSearch"), results: t("cityPickerResults"), empty: t("cityPickerEmpty"), clear: t("cityPickerClear"), hint: t("cityPickerHint") }}
          testIdPrefix="city-picker"
        />
      )}
      neighbours={neighbours ? {
        testId: "city-entity-navigation",
        previous: { href: pageHref(cityPageHref(neighbours.previous), locale), label: cityLineLabel(messages, neighbours.previous) },
        next: { href: pageHref(cityPageHref(neighbours.next), locale), label: cityLineLabel(messages, neighbours.next) },
      } : undefined}
    />
  );
}
