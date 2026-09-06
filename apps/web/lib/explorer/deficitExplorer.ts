import type { ServedGeneralGovernmentBalanceFact } from "../servedRows";
import type { Presentation } from "../i18n/types";
import { publicLabel } from "../i18n/labels";
import { INK } from "./colors";
import type { ExplorerTableRow } from "./types";

export const DEFICIT_SERIES_ID = "deficit.general_government_balance" as const;

export const DEFICIT_ITEM = {
  id: DEFICIT_SERIES_ID,
  kaLabel: "ზოგადი მთავრობის ბალანსი",
  enLabel: "General government net lending or borrowing",
  color: INK,
} as const;

export function buildDeficitExplorerModel(input: {
  facts: ServedGeneralGovernmentBalanceFact[];
  range: { start: number; end: number };
  percentage: boolean;
  selected: boolean;
}, presentation?: Presentation) {
  const activeFacts = input.facts.filter(
    (fact) => fact.year >= input.range.start && fact.year <= input.range.end,
  );
  const years = activeFacts.map((fact) => fact.year);
  const valuesByYear: Record<number, number | null> = {};
  const shareByYear: Record<number, number | null> = {};
  const basisByYear: Record<number, "actual" | "planned"> = {};

  for (const fact of activeFacts) {
    valuesByYear[fact.year] = fact.generalGovernmentBalanceGel;
    shareByYear[fact.year] = fact.generalGovernmentBalancePctGdp / 100;
    basisByYear[fact.year] = "actual";
  }

  const tableRow: ExplorerTableRow = {
    itemId: DEFICIT_ITEM.id,
    parentItemId: null,
    level: "total",
    kaLabel: DEFICIT_ITEM.kaLabel,
    enLabel: presentation ? publicLabel("en", DEFICIT_ITEM.id, DEFICIT_ITEM.kaLabel, presentation.englishLabels) : DEFICIT_ITEM.enLabel,
    color: DEFICIT_ITEM.color,
    basisByYear,
    valuesByYear,
    shareByYear,
    change: null,
  };
  const forecastStartYear = activeFacts.find((fact) => fact.status === "projection")?.year ?? null;
  const points = input.selected
    ? activeFacts.map((fact) => ({
        year: fact.year,
        value: input.percentage
          ? fact.generalGovernmentBalancePctGdp
          : fact.generalGovernmentBalanceGel,
        status: fact.status,
      }))
    : [];

  return { years, points, tableRow, forecastStartYear };
}
