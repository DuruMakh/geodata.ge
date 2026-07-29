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

export function parseExplorerHash(hash: string, nav: ExplorerNav): ExplorerUrlState {
  const state: ExplorerUrlState = {};

  try {
    const params = new URLSearchParams(hash.replace(/^#/, ""));

    const grouping = params.get("g");
    if (grouping === "fields" || grouping === "ministries") state.grouping = grouping;

    const mode = params.get("m");
    if (mode === "line" || mode === "table") state.chartMode = mode;

    if (params.get("sh") === "1") state.share = true;

    const analysisSide = params.get("as");
    if (analysisSide === "expenditure" || analysisSide === "revenue") state.analysisSide = analysisSide;

    const analysisGrouping = params.get("ag");
    if (analysisGrouping === "fields" || analysisGrouping === "ministries") state.analysisGrouping = analysisGrouping;

    const analysisYear = Number.parseInt(params.get("ay") ?? "", 10);
    if (!Number.isNaN(analysisYear)) state.analysisYear = analysisYear;

    const explorerNav = nav === "revenue" ? "revenue" : "expenditure";
    const scope = scopeFor(explorerNav, state.grouping ?? "fields");

    const range = params.get("r");
    if (range && /^\d{4}-\d{4}$/.test(range)) {
      const [start = 0, end = 0] = range.split("-").map(Number);
      state.range = { scope, start, end };
    }

    const selection = params.get("sel");
    if (selection !== null) state.selection = { scope, ids: selection.split(",").filter(Boolean) };
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
  params.set("m", input.chartMode);
  if (input.share) params.set("sh", "1");
  params.set("r", `${input.rangeStart}-${input.rangeEnd}`);
  params.set("sel", input.selectedIds.join(","));
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
