"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { MunicipalRegion } from "../../lib/data/municipal/types";
import { regionalEconomyHref } from "../../lib/explorer/regionalEconomyRoutes";
import { publicLabel } from "../../lib/i18n/labels";
import { matchesLabelQuery } from "../../lib/i18n/search";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import { pageHref } from "../../lib/i18n/routes";

/** A place the heading picker lists. `href` is already localised. */
export type PickerOption = { id: string; label: string; href: string; searchTerms: string[] };
export type PickerText = { title: string; placeholder: string; search: string; results: string; empty: string; clear: string; hint: string };
type PickerAllOption = { label: string; href: string; searchTerms: string[]; testId: string; current?: boolean };

/** The options a query keeps, in their given order; an empty query keeps all of them. */
export function filterPickerOptions(options: readonly PickerOption[], query: string): PickerOption[] {
  const needle = query.trim();
  return needle ? options.filter((option) => matchesLabelQuery(needle, option.searchTerms)) : [...options];
}

/**
 * The heading picker shared by region and city pages: a search combobox over a listbox of
 * places, with the "all" row (the index or comparison page) first. Arrow keys and Enter move
 * and open; Escape or an outside click closes and returns focus to `${testIdPrefix}-trigger`.
 */
export function PickerDialog({
  open,
  onClose,
  options,
  activeId,
  allOption,
  text,
  testIdPrefix,
}: {
  open: boolean;
  onClose: () => void;
  options: PickerOption[];
  activeId: string | null;
  allOption: PickerAllOption;
  text: PickerText;
  testIdPrefix: string;
}) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const baseId = useId();
  const needle = query.trim();
  const includeAll = !needle || matchesLabelQuery(needle, allOption.searchTerms);
  const filtered = useMemo(() => filterPickerOptions(options, needle), [needle, options]);
  const optionCount = filtered.length + (includeAll ? 1 : 0);
  const optionOffset = includeAll ? 1 : 0;

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
    const focusTrigger = () => document.querySelector<HTMLButtonElement>(`[data-testid='${testIdPrefix}-trigger']`)?.focus();
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") { onClose(); focusTrigger(); }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [onClose, open, testIdPrefix]);

  if (!open) return null;
  const focusTrigger = () => document.querySelector<HTMLButtonElement>(`[data-testid='${testIdPrefix}-trigger']`)?.focus();
  const select = (index: number) => {
    if (includeAll && index === 0) {
      window.location.href = allOption.href;
      return;
    }
    const option = filtered[index - optionOffset];
    if (!option) return;
    window.location.href = option.href;
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
    : activeIndex === 0 && includeAll
      ? `${baseId}-all`
      : `${baseId}-${filtered[activeIndex - optionOffset]?.id}`;

  return (
    <div className="relative">
      <div aria-hidden className="fixed inset-0 z-30" onClick={() => { onClose(); focusTrigger(); }} />
      <div role="dialog" aria-label={text.title} className="absolute top-1 left-0 z-40 w-[360px] max-w-[92vw] border border-[var(--control)] bg-[var(--tile)]">
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
            placeholder={text.placeholder}
            aria-label={text.search}
            className="h-[34px] w-full border border-[var(--control)] bg-[var(--paper)] px-2.5 text-[13px] outline-none"
          />
        </div>
        <div id={listboxId} role="listbox" aria-label={text.results} className="max-h-[340px] overflow-y-auto">
          {includeAll ? (
            <Link id={`${baseId}-all`} data-testid={allOption.testId} href={allOption.href} role="option" aria-selected={activeIndex === 0} aria-current={allOption.current ? "page" : undefined} tabIndex={-1} onClick={onClose} className={`block border-b border-l-2 border-b-[var(--hairline-soft)] bg-[var(--tint)] px-3 py-2 text-[12px] font-semibold text-[var(--accent)] ${activeIndex === 0 ? "border-l-[var(--ink)]" : "border-l-transparent"}`}>
              {allOption.label}
            </Link>
          ) : null}
          {filtered.map((option, index) => (
            <Link
              key={option.id}
              id={`${baseId}-${option.id}`}
              href={option.href}
              role="option"
              aria-selected={index + optionOffset === activeIndex}
              aria-current={option.id === activeId ? "page" : undefined}
              tabIndex={-1}
              data-testid={`${testIdPrefix}-option`}
              onClick={onClose}
              className={`block border-b border-l-2 border-b-[var(--row-border)] px-3 py-2 text-[13px] ${index + optionOffset === activeIndex ? "border-l-[var(--ink)] bg-[var(--tint)]" : "border-l-transparent"} ${option.id === activeId ? "font-semibold text-[var(--accent)]" : "text-[var(--body)]"}`}
            >
              {option.label}
            </Link>
          ))}
        </div>
        {optionCount === 0 ? (
          <div className="px-3 py-6 text-center text-[13px]">
            <span role="status">{text.empty}</span>
            <button type="button" onClick={() => { setQuery(""); inputRef.current?.focus(); }} className="mt-3 block w-full text-[12px] text-[var(--accent)]">{text.clear}</button>
          </div>
        ) : null}
        <div className="border-t border-[var(--hairline-soft)] px-3 py-2 text-[11px] text-[var(--faint)]">{text.hint}</div>
      </div>
    </div>
  );
}

export function RegionPicker({
  open,
  onClose,
  regions,
  activeRegionId,
  hrefForRegion = regionalEconomyHref,
  indexHref = "/explorer/economy/regions",
}: {
  open: boolean;
  onClose: () => void;
  regions: readonly MunicipalRegion[];
  activeRegionId: string;
  hrefForRegion?: (regionId: string) => string;
  indexHref?: string;
}) {
  const { locale, messages, englishLabels } = useI18n();
  // Closed, the picker renders nothing, so it builds no labels (a page may not load every place's English name).
  if (!open) return null;
  const t = (key: string) => message(messages, `regionalEconomies.${key}`);
  const allRegionsLabel = t("allRegions");
  const options = regions.map((region) => ({
    id: region.id,
    label: publicLabel(locale, region.id, region.kaLabel, englishLabels),
    href: pageHref(hrefForRegion(region.id), locale),
    searchTerms: [region.kaLabel, publicLabel("en", region.id, region.kaLabel, englishLabels)],
  }));
  return (
    <PickerDialog
      open={open}
      onClose={onClose}
      options={options}
      activeId={activeRegionId}
      allOption={{ label: allRegionsLabel, href: pageHref(indexHref, locale), searchTerms: [allRegionsLabel], testId: "region-picker-all-option" }}
      text={{ title: t("pickerTitle"), placeholder: t("pickerPlaceholder"), search: t("pickerSearch"), results: t("pickerResults"), empty: t("empty"), clear: t("clearSearch"), hint: t("pickerHint") }}
      testIdPrefix="region-picker"
    />
  );
}
