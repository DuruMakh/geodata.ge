"use client";

import { useId } from "react";
import { CITY_CATEGORIES } from "../../lib/explorer/inflationCities";
import { cityCategoryLabel } from "../../lib/explorer/inflationCityLabels";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";

// A labelled native select (spec §6): the editorial layer has no select control,
// and a native one is keyboard- and screen-reader-complete with no new code.
export function InflationCityCategorySelect({ value, onChange }: { value: string; onChange: (category: string) => void }) {
  const { messages } = useI18n();
  const id = useId();
  return (
    <div className="flex items-baseline gap-2">
      <label htmlFor={id} className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
        {message(messages, "inflation.cityCategoryLabel")}
      </label>
      <select
        id={id}
        data-testid="inflation-city-category"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="max-w-[260px] border-0 border-b border-[var(--control)] bg-transparent py-1 pr-1 text-[12.5px] text-[var(--ink)] outline-none focus-visible:border-[var(--ink)]"
      >
        {CITY_CATEGORIES.map((category) => (
          <option key={category} value={category}>
            {cityCategoryLabel(messages, category)}
          </option>
        ))}
      </select>
    </div>
  );
}
