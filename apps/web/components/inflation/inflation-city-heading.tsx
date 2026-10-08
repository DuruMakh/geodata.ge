"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { cityLineLabel, cityPlaceLabel } from "../../lib/explorer/inflationCityLabels";
import { cityPageHref, neighbourCities, type CityView } from "../../lib/explorer/inflationCityRoutes";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import { pageHref } from "../../lib/i18n/routes";
import { EntityNeighbourLinks } from "../explorer-shell/entity-neighbour-links";
import { CityPicker } from "./city-picker";

// `ინფლაცია ქალაქებში — {place} ▾`, as region and municipality pages open. City
// pages add previous/next links in Geostat's order; the Georgia page has none.
export function InflationCityHeading({ view }: { view: CityView }) {
  const { locale, messages } = useI18n();
  const [pickerOpen, setPickerOpen] = useState(false);
  const neighbours = view.kind === "city" ? neighbourCities(view.cityId) : null;
  return (
    <div className="relative mt-[34px] mb-3 flex flex-col gap-3 min-[768px]:flex-row min-[768px]:items-end min-[768px]:justify-between">
      {/* The heading and its picker share one column, so the dialog opens under the
          heading (as on municipal pages) and the previous/next links stay the row's
          second flex child. The popover is a sibling of the h1, not a child. */}
      <div className="min-w-0 min-[768px]:flex-1">
        <h1 className="font-[family-name:var(--font-display)] text-[30px] font-semibold leading-[1.15] tracking-[-0.01em] min-[768px]:text-[40px]">
          {message(messages, "inflation.cityHeadingLead")}{" "}
          <button
            data-testid="city-picker-trigger"
            type="button"
            aria-expanded={pickerOpen}
            aria-haspopup="dialog"
            onClick={() => setPickerOpen((open) => !open)}
            className="group inline-flex max-w-full cursor-pointer items-center gap-2 border-b border-dashed border-[color:color-mix(in_srgb,var(--accent)_60%,transparent)] align-bottom text-left text-[var(--accent)] transition-colors duration-100 hover:border-[var(--accent)]"
          >
            {cityPlaceLabel(messages, view)}<ChevronDown aria-hidden size={20} strokeWidth={1.5} />
          </button>
        </h1>
        <CityPicker open={pickerOpen} onClose={() => setPickerOpen(false)} view={view} />
      </div>
      {neighbours ? (
        <EntityNeighbourLinks
          testId="city-entity-navigation"
          previous={{ href: pageHref(cityPageHref(neighbours.previous), locale), label: cityLineLabel(messages, neighbours.previous) }}
          next={{ href: pageHref(cityPageHref(neighbours.next), locale), label: cityLineLabel(messages, neighbours.next) }}
        />
      ) : null}
    </div>
  );
}
