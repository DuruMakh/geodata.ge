import { periodFromKey, periodKey } from "../data/inflation/periods";
import type { PeriodRange } from "./periodRange";
import type { ChartMode, ExpenditureGrouping, ExplorerNav, ExplorerScope } from "./types";

// Shareable screen state, serialized into the URL hash (DESIGN.md §6.3). The
// section lives in the route, not the hash:
//   /explorer/expenditure#g=fields&m=line&sh=1&r=2005-2025&sel=id1,id2
//   /explorer/analysis#as=expenditure&ag=ministries&ay=2024

export type ExplorerUrlState = {
  grouping?: ExpenditureGrouping;
  chartMode?: ChartMode;
  share?: boolean;
  range?: { scope: ExplorerScope; start: number; end: number };
  selection?: { scope: ExplorerScope; ids: string[] };
  analysisSide?: "expenditure" | "revenue";
  analysisGrouping?: ExpenditureGrouping;
  analysisYear?: number;
};

export function scopeFor(nav: "expenditure" | "revenue", grouping: ExpenditureGrouping): ExplorerScope {
  if (nav === "revenue") return "revenue";
  return grouping === "ministries" ? "ministries" : "fields";
}

function selectionIds(value: string): string[] {
  return [...new Set(value.split(",").filter(Boolean))];
}

// The budget explorer, the municipalities section and the debt explorer share
// four hash keys — m mode, sh share, r range, sel selection — so there is one
// vocabulary in the URL spec (DESIGN.md §6.3). All three read and write them
// through these two helpers; each adds only its own keys on top.
export type SharedHashState = {
  chartMode?: ChartMode;
  share?: boolean;
  range?: { start: number; end: number };
  selection?: string[];
};

export function parseSharedHashKeys(params: URLSearchParams): SharedHashState {
  const state: SharedHashState = {};

  const mode = params.get("m");
  if (mode === "line" || mode === "table") state.chartMode = mode;

  if (params.get("sh") === "1") state.share = true;

  const range = params.get("r");
  if (range && /^\d{4}-\d{4}$/.test(range)) {
    const [start = 0, end = 0] = range.split("-").map(Number);
    state.range = { start, end };
  }

  const selection = params.get("sel");
  if (selection !== null) state.selection = selectionIds(selection);

  return state;
}

export function writeSharedHashKeys(
  params: URLSearchParams,
  input: { chartMode: ChartMode; share: boolean; rangeStart: number; rangeEnd: number; selectedIds: string[] },
): void {
  params.set("m", input.chartMode);
  if (input.share) params.set("sh", "1");
  params.set("r", `${input.rangeStart}-${input.rangeEnd}`);
  params.set("sel", input.selectedIds.join(","));
}

// The GDP, sector and regional pages keep their range in `range=all` or a
// `start`/`end` year pair, read in either order.
export function parseYearRangeKeys(params: URLSearchParams): PeriodRange {
  const start = Number(params.get("start"));
  const end = Number(params.get("end"));
  return params.get("range") !== "all" &&
    params.has("start") &&
    params.has("end") &&
    Number.isInteger(start) &&
    Number.isInteger(end) &&
    start > 0 &&
    end > 0
    ? { kind: "manual", start: Math.min(start, end), end: Math.max(start, end) }
    : { kind: "all" };
}

export function writeYearRangeKeys(params: URLSearchParams, range: PeriodRange): void {
  if (range.kind === "all") params.set("range", "all");
  else {
    params.set("start", String(range.start));
    params.set("end", String(range.end));
  }
}

const MONTH_RANGE = /^(\d{4}-\d{2})-(\d{4}-\d{2})$/;

// The inflation pages keep a manual range in `r` as two `YYYY-MM` months, read
// in either order; "all" is the key's absence.
export function parseMonthRangeKey(params: URLSearchParams): PeriodRange {
  const match = MONTH_RANGE.exec(params.get("r") ?? "");
  if (!match) return { kind: "all" };
  try {
    const a = periodFromKey(match[1]!);
    const b = periodFromKey(match[2]!);
    return { kind: "manual", start: Math.min(a, b), end: Math.max(a, b) };
  } catch {
    return { kind: "all" };
  }
}

export function writeMonthRangeKey(params: URLSearchParams, range: PeriodRange): void {
  if (range.kind === "manual") params.set("r", `${periodKey(range.start)}-${periodKey(range.end)}`);
}

export function parseExplorerHash(hash: string, nav: ExplorerNav): ExplorerUrlState {
  const state: ExplorerUrlState = {};

  try {
    const params = new URLSearchParams(hash.replace(/^#/, ""));

    const grouping = params.get("g");
    if (grouping === "fields" || grouping === "ministries") state.grouping = grouping;

    const analysisSide = params.get("as");
    if (analysisSide === "expenditure" || analysisSide === "revenue") state.analysisSide = analysisSide;

    const analysisGrouping = params.get("ag");
    if (analysisGrouping === "fields" || analysisGrouping === "ministries") state.analysisGrouping = analysisGrouping;

    const analysisYear = Number.parseInt(params.get("ay") ?? "", 10);
    if (!Number.isNaN(analysisYear)) state.analysisYear = analysisYear;

    const explorerNav = nav === "revenue" ? "revenue" : "expenditure";
    const scope = scopeFor(explorerNav, state.grouping ?? "fields");

    const shared = parseSharedHashKeys(params);
    if (shared.chartMode !== undefined) state.chartMode = shared.chartMode;
    if (shared.share !== undefined) state.share = shared.share;
    if (shared.range) state.range = { scope, start: shared.range.start, end: shared.range.end };
    if (shared.selection) state.selection = { scope, ids: shared.selection };
  } catch {
    return state;
  }

  return state;
}

export type SerializeExplorerInput = {
  nav: ExplorerNav;
  grouping: ExpenditureGrouping;
  chartMode: ChartMode;
  share: boolean;
  rangeStart: number;
  rangeEnd: number;
  selectedIds: string[];
  analysisSide: "expenditure" | "revenue";
  analysisGrouping: ExpenditureGrouping;
  analysisYear: number | null;
};

export function serializeExplorerHash(input: SerializeExplorerInput): string {
  const params = new URLSearchParams();

  if (input.nav === "analysis") {
    params.set("as", input.analysisSide);
    if (input.analysisSide === "expenditure") params.set("ag", input.analysisGrouping);
    if (input.analysisYear !== null) params.set("ay", String(input.analysisYear));
    return params.toString();
  }

  if (input.nav === "expenditure") params.set("g", input.grouping);
  writeSharedHashKeys(params, input);
  return params.toString();
}

// Old links carried the section in the hash (#nav=analysis). The hub reads it
// once and redirects, so those links keep working.
export function readLegacyNav(hash: string): ExplorerNav | null {
  try {
    const nav = new URLSearchParams(hash.replace(/^#/, "")).get("nav");
    return nav === "expenditure" || nav === "revenue" || nav === "analysis" ? nav : null;
  } catch {
    return null;
  }
}

export function stripNavFromHash(hash: string): string {
  try {
    const params = new URLSearchParams(hash.replace(/^#/, ""));
    params.delete("nav");
    return params.toString();
  } catch {
    return "";
  }
}

// The municipalities section reuses the same hash keys as the budget explorer —
// m mode, sh share, r range, sel selection — so there is one vocabulary in the
// URL spec (DESIGN.md §6.3), plus lvl which exists only on the index.

export type MunicipalUrlState = SharedHashState;

export function parseMunicipalHash(hash: string): MunicipalUrlState {
  const state: MunicipalUrlState = {};

  try {
    const params = new URLSearchParams(hash.replace(/^#/, ""));
    return parseSharedHashKeys(params);
  } catch {
    return state;
  }

  return state;
}

export function serializeMunicipalHash(input: {
  chartMode: ChartMode;
  share: boolean;
  rangeStart: number;
  rangeEnd: number;
  selectedIds: string[];
}): string {
  const params = new URLSearchParams();
  writeSharedHashKeys(params, input);
  return params.toString();
}

/** Index list grain. Municipalities is the default; the map is always regions. */
export function parseMunicipalLevel(hash: string): "muni" | "region" {
  try {
    return new URLSearchParams(hash.replace(/^#/, "")).get("lvl") === "region" ? "region" : "muni";
  } catch {
    return "muni";
  }
}
