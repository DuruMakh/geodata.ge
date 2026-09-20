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

function focusTrigger() {
  document.querySelector<HTMLButtonElement>("[data-testid='region-picker-trigger']")?.focus();
}

export function RegionPicker({
  open,
  onClose,
  regions,
  activeRegionId,
}: {
  open: boolean;
  onClose: () => void;
  regions: readonly MunicipalRegion[];
  activeRegionId: string;
}) {
  const { locale, messages, englishLabels } = useI18n();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const baseId = useId();
  const allRegionsLabel = message(messages, "regionalEconomies.allRegions");
  const needle = query.trim();
  const includeAll = !needle || matchesLabelQuery(needle, [allRegionsLabel]);
  const filtered = useMemo(() => {
    return needle
      ? regions.filter((region) => matchesLabelQuery(needle, [
          region.kaLabel,
          publicLabel("en", region.id, region.kaLabel, englishLabels),
        ]))
      : [...regions];
  }, [englishLabels, needle, regions]);
  const optionCount = filtered.length + (includeAll ? 1 : 0);
  const regionOffset = includeAll ? 1 : 0;

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
    if (includeAll && index === 0) {
      window.location.href = pageHref("/explorer/economy/regions", locale);
      return;
    }
    const region = filtered[index - regionOffset];
    if (!region) return;
    window.location.href = pageHref(regionalEconomyHref(region.id), locale);
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
      : `${baseId}-${filtered[activeIndex - regionOffset]?.id}`;

  return (
    <div className="relative">
      <div aria-hidden className="fixed inset-0 z-30" onClick={() => { onClose(); focusTrigger(); }} />
      <div role="dialog" aria-label={message(messages, "regionalEconomies.pickerTitle")} className="absolute top-1 left-0 z-40 w-[360px] max-w-[92vw] border border-[var(--control)] bg-[var(--tile)]">
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
            placeholder={message(messages, "regionalEconomies.pickerPlaceholder")}
            aria-label={message(messages, "regionalEconomies.pickerSearch")}
            className="h-[34px] w-full border border-[var(--control)] bg-[var(--paper)] px-2.5 text-[13px] outline-none"
          />
        </div>
        <div id={listboxId} role="listbox" aria-label={message(messages, "regionalEconomies.pickerResults")} className="max-h-[340px] overflow-y-auto">
          {includeAll ? (
            <Link id={`${baseId}-all`} data-testid="region-picker-all-option" href={pageHref("/explorer/economy/regions", locale)} role="option" aria-selected={activeIndex === 0} tabIndex={-1} onClick={onClose} className={`block border-b border-l-2 border-b-[var(--hairline-soft)] bg-[var(--tint)] px-3 py-2 text-[12px] font-semibold text-[var(--accent)] ${activeIndex === 0 ? "border-l-[var(--ink)]" : "border-l-transparent"}`}>
              {allRegionsLabel}
            </Link>
          ) : null}
          {filtered.map((region, index) => (
            <Link
              key={region.id}
              id={`${baseId}-${region.id}`}
              href={pageHref(regionalEconomyHref(region.id), locale)}
              role="option"
              aria-selected={index + regionOffset === activeIndex}
              aria-current={region.id === activeRegionId ? "page" : undefined}
              tabIndex={-1}
              data-testid="region-picker-option"
              onClick={onClose}
              className={`block border-b border-l-2 border-b-[var(--row-border)] px-3 py-2 text-[13px] ${index + regionOffset === activeIndex ? "border-l-[var(--ink)] bg-[var(--tint)]" : "border-l-transparent"} ${region.id === activeRegionId ? "font-semibold text-[var(--accent)]" : "text-[var(--body)]"}`}
            >
              {publicLabel(locale, region.id, region.kaLabel, englishLabels)}
            </Link>
          ))}
        </div>
        {optionCount === 0 ? (
          <div className="px-3 py-6 text-center text-[13px]">
            <span role="status">{message(messages, "regionalEconomies.empty")}</span>
            <button type="button" onClick={() => { setQuery(""); inputRef.current?.focus(); }} className="mt-3 block w-full text-[12px] text-[var(--accent)]">{message(messages, "regionalEconomies.clearSearch")}</button>
          </div>
        ) : null}
        <div className="border-t border-[var(--hairline-soft)] px-3 py-2 text-[11px] text-[var(--faint)]">{message(messages, "regionalEconomies.pickerHint")}</div>
      </div>
    </div>
  );
}
