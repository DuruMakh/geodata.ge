"use client";

import { useState, type ReactNode } from "react";
import {
  GEORGIA_PLACE_ID,
  TBILISI_PLACE_ID,
  placeColor,
  placeLabel,
  type DemographyPlace,
} from "../../lib/explorer/demographyAreas";
import type { PopulationLevel } from "../../lib/explorer/demographyPopulation";
import { formatInUnit, UNIT_PERSONS } from "../../lib/explorer/format";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import { matchesLabelQuery } from "../../lib/i18n/search";
import type { TemplateValues } from "../../lib/i18n/types";
import { SeriesAside } from "../explorer-shell/series-aside";
import { SeriesSelector, SeriesSelectorRow } from "../main-explorer/series-selector";
import { TextTab } from "../ui/editorial";

/**
 * The places list: the standard series panel with the two levels as grouping tabs. Ticking a place
 * adds a line to the chart; choosing on a map replaces the selection (the explorer owns that rule).
 * Select all and clear act on the active tab only, never on the search result.
 */
export function PopulationSeriesPanel({
  places,
  listed,
  level,
  selectedIds,
  endYear,
  endValues,
  onLevelChange,
  onToggle,
  onSetTabSelection,
  downloadAction,
}: {
  places: readonly DemographyPlace[];
  listed: readonly DemographyPlace[];
  level: PopulationLevel;
  selectedIds: readonly string[];
  endYear: number;
  endValues: Readonly<Record<string, number | null>>;
  onLevelChange: (level: PopulationLevel) => void;
  onToggle: (id: string) => void;
  onSetTabSelection: (selected: boolean) => void;
  downloadAction: ReactNode;
}) {
  const { locale, messages } = useI18n();
  const t = (key: string, values?: TemplateValues) => message(messages, `demography.${key}`, values);
  const [query, setQuery] = useState("");
  const byId = new Map(places.map((place) => [place.id, place]));
  const matches = (place: DemographyPlace) => {
    const region = place.regionId === null ? undefined : byId.get(place.regionId);
    return matchesLabelQuery(query, [place.nameKa, place.nameEn, region?.nameKa ?? "", region?.nameEn ?? ""]);
  };
  const visible = listed.filter((place) => place.id === GEORGIA_PLACE_ID || matches(place));
  const selectedHere = listed.filter((place) => selectedIds.includes(place.id)).length;
  const hasSelection = selectedHere > 0;

  return (
    <SeriesAside label={message(messages, "controls.series")}>
      <p className="mb-3 text-[11px] text-[var(--muted)]">{t("rowYear", { year: endYear })}</p>
      <SeriesSelector
        controls={
          <div className="flex gap-[18px] border-b border-[var(--row-border)] pb-3">
            <TextTab label={t("tabRegions")} active={level === "regions"} onClick={() => onLevelChange("regions")} testId="population-tab-regions" />
            <TextTab label={t("tabMunicipalities")} active={level === "municipalities"} onClick={() => onLevelChange("municipalities")} testId="population-tab-municipalities" />
          </div>
        }
        query={query}
        onQueryChange={setQuery}
        searchPlaceholder={message(messages, "controls.search")}
        selectedCount={selectedHere}
        totalCount={listed.length}
        supplementalSelected={{
          label: t(level === "regions" ? "tabMunicipalities" : "tabRegions"),
          count: selectedIds.length - selectedHere,
        }}
        hasSelection={hasSelection}
        allSelected={listed.every((place) => selectedIds.includes(place.id))}
        onToggleAll={() => onSetTabSelection(!hasSelection)}
        hasVisibleMatches={listed.some(matches)}
      >
        {visible.map((place) => {
          const label = placeLabel(place, locale);
          return (
            <SeriesSelectorRow
              key={place.id}
              id={place.id}
              label={place.id === TBILISI_PLACE_ID && level === "municipalities" ? `${label} · ${t("alsoRegion")}` : label}
              color={placeColor(place)}
              value={formatInUnit(endValues[place.id] ?? null, UNIT_PERSONS)}
              selected={selectedIds.includes(place.id)}
              level={place.id === GEORGIA_PLACE_ID ? "total" : "item"}
              wrapLabel
              onToggle={() => onToggle(place.id)}
            />
          );
        })}
      </SeriesSelector>
      {downloadAction}
    </SeriesAside>
  );
}
