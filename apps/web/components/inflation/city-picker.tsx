"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { CPI_CITY_IDS, type CpiCityId } from "../../lib/data/inflation/types";
import { GEORGIA_LINE_ID } from "../../lib/explorer/inflationCities";
import { cityLineLabel } from "../../lib/explorer/inflationCityLabels";
import { CITIES_PATH, cityPageHref, citySlug, type CityView } from "../../lib/explorer/inflationCityRoutes";
import { matchesLabelQuery } from "../../lib/i18n/search";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import { pageHref } from "../../lib/i18n/routes";

// The cities heading picker (spec 2026-09-30 §3): RegionPicker's anatomy and keys,
// with საქართველო — the comparison page — first, styled as its "all" row.

function focusTrigger() {
  document.querySelector<HTMLButtonElement>("[data-testid='city-picker-trigger']")?.focus();
}

export function CityPicker({ open, onClose, view }: { open: boolean; onClose: () => void; view: CityView }) {
  const { locale, messages } = useI18n();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const baseId = useId();
  const georgiaLabel = cityLineLabel(messages, GEORGIA_LINE_ID);
  const needle = query.trim();
  const includeGeorgia = !needle || matchesLabelQuery(needle, [georgiaLabel, "georgia"]);
  const filtered = useMemo<CpiCityId[]>(
    () => (needle ? CPI_CITY_IDS.filter((cityId) => matchesLabelQuery(needle, [cityLineLabel(messages, cityId), citySlug(cityId)])) : [...CPI_CITY_IDS]),
    [messages, needle],
  );
  const optionCount = filtered.length + (includeGeorgia ? 1 : 0);
  const cityOffset = includeGeorgia ? 1 : 0;
  const activeCityId = view.kind === "city" ? view.cityId : null;

  const [previousOpen, setPreviousOpen] = useState(open);
  if (open !== previousOpen) {
    setPreviousOpen(open);
    if (open) {
      setQuery("");
      setActiveIndex(null);
    }
  }

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") { onClose(); focusTrigger(); }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [onClose, open]);

  if (!open) return null;
  const select = (index: number) => {
    if (includeGeorgia && index === 0) {
      window.location.href = pageHref(CITIES_PATH, locale);
      return;
    }
    const cityId = filtered[index - cityOffset];
    if (!cityId) return;
    window.location.href = pageHref(cityPageHref(cityId), locale);
  };
  const move = (delta: 1 | -1) => {
    if (!optionCount) return;
    const next = activeIndex === null
      ? delta === 1 ? 0 : optionCount - 1
      : (activeIndex + delta + optionCount) % optionCount;
    setActiveIndex(next);
  };
  const listboxId = `${baseId}-listbox`;
  const activeOptionId = activeIndex === null
    ? undefined
    : activeIndex === 0 && includeGeorgia
      ? `${baseId}-georgia`
      : `${baseId}-${filtered[activeIndex - cityOffset]}`;

  return (
    <div className="relative">
      <div aria-hidden className="fixed inset-0 z-30" onClick={() => { onClose(); focusTrigger(); }} />
      <div role="dialog" aria-label={message(messages, "inflation.cityPickerTitle")} className="absolute top-1 left-0 z-40 w-[360px] max-w-[92vw] border border-[var(--control)] bg-[var(--tile)]">
        <div className="border-b border-[var(--hairline-soft)] p-3">
          <input
            ref={inputRef}
            role="combobox"
            aria-expanded="true"
            aria-controls={listboxId}
            aria-autocomplete="list"
            aria-activedescendant={activeOptionId}
            value={query}
            onChange={(event) => { setQuery(event.target.value); setActiveIndex(null); }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") { event.preventDefault(); move(1); }
              else if (event.key === "ArrowUp") { event.preventDefault(); move(-1); }
              else if (event.key === "Enter" && activeIndex !== null) { event.preventDefault(); select(activeIndex); }
              else if (event.key === "Tab") onClose();
            }}
            placeholder={message(messages, "inflation.cityPickerPlaceholder")}
            aria-label={message(messages, "inflation.cityPickerSearch")}
            className="h-[34px] w-full border border-[var(--control)] bg-[var(--paper)] px-2.5 text-[13px] outline-none"
          />
        </div>
        <div id={listboxId} role="listbox" aria-label={message(messages, "inflation.cityPickerResults")} className="max-h-[340px] overflow-y-auto">
          {includeGeorgia ? (
            <Link
              id={`${baseId}-georgia`}
              data-testid="city-picker-georgia-option"
              href={pageHref(CITIES_PATH, locale)}
              role="option"
              aria-selected={activeIndex === 0}
              aria-current={view.kind === "georgia" ? "page" : undefined}
              tabIndex={-1}
              onClick={onClose}
              className={`block border-b border-l-2 border-b-[var(--hairline-soft)] bg-[var(--tint)] px-3 py-2 text-[12px] font-semibold text-[var(--accent)] ${activeIndex === 0 ? "border-l-[var(--ink)]" : "border-l-transparent"}`}
            >
              {georgiaLabel}
            </Link>
          ) : null}
          {filtered.map((cityId, index) => (
            <Link
              key={cityId}
              id={`${baseId}-${cityId}`}
              href={pageHref(cityPageHref(cityId), locale)}
              role="option"
              aria-selected={index + cityOffset === activeIndex}
              aria-current={cityId === activeCityId ? "page" : undefined}
              tabIndex={-1}
              data-testid="city-picker-option"
              onClick={onClose}
              className={`block border-b border-l-2 border-b-[var(--row-border)] px-3 py-2 text-[13px] ${index + cityOffset === activeIndex ? "border-l-[var(--ink)] bg-[var(--tint)]" : "border-l-transparent"} ${cityId === activeCityId ? "font-semibold text-[var(--accent)]" : "text-[var(--body)]"}`}
            >
              {cityLineLabel(messages, cityId)}
            </Link>
          ))}
        </div>
        {optionCount === 0 ? (
          <div className="px-3 py-6 text-center text-[13px]">
            <span role="status">{message(messages, "inflation.cityPickerEmpty")}</span>
            <button type="button" onClick={() => { setQuery(""); inputRef.current?.focus(); }} className="mt-3 block w-full text-[12px] text-[var(--accent)]">{message(messages, "inflation.cityPickerClear")}</button>
          </div>
        ) : null}
        <div className="border-t border-[var(--hairline-soft)] px-3 py-2 text-[11px] text-[var(--faint)]">{message(messages, "inflation.cityPickerHint")}</div>
      </div>
    </div>
  );
}
