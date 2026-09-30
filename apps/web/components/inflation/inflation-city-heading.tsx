"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { cityLineLabel, cityPlaceLabel } from "../../lib/explorer/inflationCityLabels";
import { cityPageHref, neighbourCities, type CityView } from "../../lib/explorer/inflationCityRoutes";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import { pageHref } from "../../lib/i18n/routes";
import { CityPicker } from "./city-picker";

// `ინფლაცია ქალაქებში — {place} ▾`, as region and municipality pages open. City
// pages add previous/next links in Geostat's order; the Georgia page has none.
export function InflationCityHeading({ view }: { view: CityView }) {
  const { locale, messages } = useI18n();
  const [pickerOpen, setPickerOpen] = useState(false);
  const neighbours = view.kind === "city" ? neighbourCities(view.cityId) : null;
  return (
    <div className="relative mt-[34px] mb-3 flex flex-col gap-3 min-[768px]:flex-row min-[768px]:items-end min-[768px]:justify-between">
      <h1 className="font-[family-name:var(--font-display)] text-[30px] font-semibold leading-[1.15] tracking-[-0.01em] min-[768px]:text-[40px]">
        {message(messages, "inflation.cityHeadingLead")}{" "}
        <button
          data-testid="city-picker-trigger"
          type="button"
          aria-expanded={pickerOpen}
          onClick={() => setPickerOpen((open) => !open)}
          className="group inline-flex max-w-full cursor-pointer items-center gap-2 border-b border-dashed border-[color:color-mix(in_srgb,var(--accent)_60%,transparent)] align-bottom text-left text-[var(--accent)] transition-colors duration-100 hover:border-[var(--accent)]"
        >
          {cityPlaceLabel(messages, view)}<ChevronDown aria-hidden size={20} strokeWidth={1.5} />
        </button>
      </h1>
      <CityPicker open={pickerOpen} onClose={() => setPickerOpen(false)} view={view} />
      {neighbours ? (
        <span data-testid="city-entity-navigation" className="grid w-full min-w-0 grid-cols-2 items-center gap-4 min-[768px]:flex min-[768px]:w-auto min-[768px]:max-w-[40%] min-[768px]:shrink">
          <Link href={pageHref(cityPageHref(neighbours.previous), locale)} className="block min-w-0 truncate font-[family-name:var(--font-numeric)] text-[11.5px] text-[var(--muted)] no-underline hover:text-[var(--ink)]">
            ← {cityLineLabel(messages, neighbours.previous)}
          </Link>
          <Link href={pageHref(cityPageHref(neighbours.next), locale)} className="block min-w-0 truncate text-right font-[family-name:var(--font-numeric)] text-[11.5px] text-[var(--muted)] no-underline hover:text-[var(--ink)]">
            {cityLineLabel(messages, neighbours.next)} →
          </Link>
        </span>
      ) : null}
    </div>
  );
}
