import { DEFICIT_SERIES_ID } from "./deficitExplorer";
import type { ChartMode } from "./types";

// Accept previously shared explorer links; only the published ID is written.
const LEGACY_DEFICIT_SERIES_ID = "deficit.general_government_balance";

export type DeficitUrlState = {
  chartMode?: ChartMode;
  percentage?: boolean;
  range?: { start: number; end: number };
  selected?: boolean;
};

export function parseDeficitHash(hash: string): DeficitUrlState {
  try {
    const params = new URLSearchParams(hash.replace(/^#/, ""));
    const state: DeficitUrlState = {};
    const mode = params.get("m");
    if (mode === "line" || mode === "table") state.chartMode = mode;
    if (params.get("sh") === "1") state.percentage = true;
    if (params.get("sh") === "0") state.percentage = false;

    const range = params.get("r");
    if (range && /^\d{4}-\d{4}$/.test(range)) {
      const [start = 0, end = 0] = range.split("-").map(Number);
      state.range = { start, end };
    }

    if (params.has("sel")) {
      const selection = params.get("sel") ?? "";
      if (selection === "") state.selected = false;
      if (selection.split(",").some((id) => id === DEFICIT_SERIES_ID || id === LEGACY_DEFICIT_SERIES_ID)) state.selected = true;
    }

    return state;
  } catch {
    return {};
  }
}

export function serializeDeficitHash(input: {
  chartMode: ChartMode;
  percentage: boolean;
  rangeStart: number;
  rangeEnd: number;
  selected: boolean;
}): string {
  const params = new URLSearchParams();
  params.set("m", input.chartMode);
  params.set("sh", input.percentage ? "1" : "0");
  params.set("r", `${input.rangeStart}-${input.rangeEnd}`);
  params.set("sel", input.selected ? DEFICIT_SERIES_ID : "");
  return params.toString();
}
