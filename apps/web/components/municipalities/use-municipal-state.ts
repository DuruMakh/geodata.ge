"use client";

import { useEffect, useRef, useState } from "react";
import type { ChartMode } from "../../lib/explorer/types";
import { MAX_MUNICIPAL_CHART_SERIES } from "../../lib/explorer/municipalData";
import { parseMunicipalHash, serializeMunicipalHash } from "../../lib/explorer/urlState";

const SERIES_LIMIT_MESSAGE = `გრაფიკზე მაქსიმუმ ${MAX_MUNICIPAL_CHART_SERIES} სერია შეიძლება. ცხრილის რეჟიმში ლიმიტი არ არის.`;

function clampYear(year: number, min: number, max: number): number {
  return Math.min(Math.max(year, min), max);
}

// Clamps AND orders (start <= end) before either value ever reaches state. This
// is the one funnel every range write — the mount-hash parse and setRange —
// goes through, so the raw start/end fields, the hash and the returned range
// can never disagree, and a later single-field patch (e.g. `{ start: ... }`
// from the start handle) can never land on what is logically the other handle.
function normalizeRange(rawStart: number, rawEnd: number, min: number, max: number): { start: number; end: number } {
  const start = clampYear(rawStart, min, max);
  const end = clampYear(rawEnd, min, max);
  return start <= end ? { start, end } : { start: end, end: start };
}

export function useMunicipalState(years: number[], defaultSelection: string[], knownIds: Set<string>) {
  const min = years[0] ?? 0;
  const max = years.at(-1) ?? 0;

  const [chartMode, setChartMode] = useState<ChartMode>("line");
  const [share, setShare] = useState(false);
  const [start, setStart] = useState(min);
  const [end, setEnd] = useState(max);
  const [selectedIds, setSelectedIds] = useState(defaultSelection);
  const [limitMessage, setLimitMessage] = useState<string | null>(null);
  const appliedRef = useRef(false);
  const writtenRef = useRef(false);

  useEffect(() => {
    if (appliedRef.current) return;
    appliedRef.current = true;
    const parsed = parseMunicipalHash(window.location.hash);

    /* eslint-disable react-hooks/set-state-in-effect */
    if (parsed.chartMode) setChartMode(parsed.chartMode);
    if (parsed.share) setShare(true);
    if (parsed.range) {
      const resolved = normalizeRange(parsed.range.start, parsed.range.end, min, max);
      setStart(resolved.start);
      setEnd(resolved.end);
    }
    if (parsed.selection) {
      const known = parsed.selection.filter((id) => knownIds.has(id));
      // A deliberately-empty shared selection restores as empty; one whose
      // ids are ALL unknown falls back to the default.
      if (known.length > 0 || parsed.selection.length === 0) setSelectedIds(known);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hash = serializeMunicipalHash({ chartMode, share, rangeStart: start, rangeEnd: end, selectedIds });

  useEffect(() => {
    if (!writtenRef.current) {
      writtenRef.current = true;
      return;
    }
    try {
      history.replaceState(null, "", `#${hash}`);
    } catch {
      // History can be unavailable in embedded contexts; the UI still works.
    }
  }, [hash]);

  function toggleSeries(itemId: string) {
    if (!selectedIds.includes(itemId) && chartMode !== "table" && selectedIds.length >= MAX_MUNICIPAL_CHART_SERIES) {
      setLimitMessage(SERIES_LIMIT_MESSAGE);
      return;
    }
    setSelectedIds((current) =>
      current.includes(itemId) ? current.filter((id) => id !== itemId) : [...current, itemId],
    );
    setLimitMessage(null);
  }

  function setRange(patch: { start?: number; end?: number }) {
    const resolved = normalizeRange(patch.start ?? start, patch.end ?? end, min, max);
    setStart(resolved.start);
    setEnd(resolved.end);
  }

  return {
    chartMode,
    setChartMode: (mode: ChartMode) => {
      setChartMode(mode);
      setLimitMessage(null);
    },
    share,
    setShare,
    range: { start, end, min, max },
    setRange,
    selectedIds,
    toggleSeries,
    setSelectedIds: (nextSelectedIds: string[]) => {
      setSelectedIds(nextSelectedIds);
      setLimitMessage(null);
    },
    limitMessage,
  };
}
