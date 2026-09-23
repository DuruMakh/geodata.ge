import { beforeAll, describe, expect, it } from "vitest";
import { loadServedInflationData } from "../../lib/data/inflation/importInflation";
import { sourceIdBySeriesMeasure } from "../../lib/explorer/clientData";
import { makePeriod, periodFromKey } from "../../lib/data/inflation/periods";
import type { ServedCpiFact, ServedInflationTargetRow } from "../../lib/data/inflation/types";
import {
  DEFAULT_INFLATION_STATE, buildInflationLines, changeInflationTab, effectiveTableSeries, indexInflationFacts,
  latestIndicators, panelValue, parseInflationHash, resolveInflationRange, serializeInflationHash, targetForPeriod, toggleSelection,
  type InflationIndex, type InflationState,
} from "../../lib/explorer/inflationOverview";
import { formatInflationValue, periodLabel, seriesLabel } from "../../lib/explorer/inflationLabels";
import { getMessages } from "../../lib/i18n/messages.server";

let facts: ServedCpiFact[];
let targets: ServedInflationTargetRow[];
let index: InflationIndex;
let last: number;

beforeAll(async () => {
  ({ facts, targets } = await loadServedInflationData());
  index = indexInflationFacts(facts, sourceIdBySeriesMeasure(facts));
  last = Math.max(...facts.map((fact) => periodFromKey(fact.period)));
});

const manual = (start: string, end: string): InflationState["range"] => ({ kind: "manual", start: periodFromKey(start), end: periodFromKey(end) });

describe("inflation overview state", () => {
  it("defaults to annual inflation over its full coverage with headline and target", () => {
    const range = resolveInflationRange(DEFAULT_INFLATION_STATE, index);
    expect(range).toEqual({ min: makePeriod(2004, 1), max: last, start: makePeriod(2004, 1), end: last });
    expect(DEFAULT_INFLATION_STATE.selected).toEqual(["cpi", "target"]);
    expect(resolveInflationRange({ ...DEFAULT_INFLATION_STATE, tab: "index" }, index).min).toBe(makePeriod(2000, 1));
  });

  it("keeps All, intersects a manual range and falls back when nothing overlaps", () => {
    expect(changeInflationTab(DEFAULT_INFLATION_STATE, "index", index).range).toEqual({ kind: "all" });
    const onIndex = { ...DEFAULT_INFLATION_STATE, tab: "index" as const, range: manual("2001-01", "2005-12") };
    expect(changeInflationTab(onIndex, "yoy", index).range).toEqual(manual("2004-01", "2005-12"));
    expect(changeInflationTab({ ...onIndex, range: manual("2000-01", "2002-12") }, "yoy", index).range).toEqual({ kind: "all" });
  });

  it("draws the target only on annual inflation and never draws core on the index", () => {
    const yoy = buildInflationLines(index, targets, { ...DEFAULT_INFLATION_STATE, selected: ["cpi", "core", "target"] }, resolveInflationRange(DEFAULT_INFLATION_STATE, index));
    expect(yoy.lines.map((line) => line.key)).toEqual(["cpi", "core", "target"]);
    const target = yoy.lines.find((line) => line.key === "target")!;
    expect(target.values[yoy.periods.indexOf(makePeriod(2014, 12))]).toBeNull();
    expect(target.values[yoy.periods.indexOf(makePeriod(2016, 6))]).toBe(5);
    expect(target.values.at(-1)).toBe(3);

    const indexState = { ...DEFAULT_INFLATION_STATE, tab: "index" as const, selected: ["cpi", "core", "target"] as InflationState["selected"] };
    expect(buildInflationLines(index, targets, indexState, resolveInflationRange(indexState, index)).lines.map((line) => line.key)).toEqual(["cpi"]);
    expect(panelValue(index, targets, "core", indexState, resolveInflationRange(indexState, index))).toBeNull();
  });

  it("toggles selection, keeps the table series among selected series, and round-trips the hash", () => {
    const withCore = toggleSelection(DEFAULT_INFLATION_STATE, "core");
    expect(withCore.selected).toEqual(["cpi", "core", "target"]);
    expect(toggleSelection(withCore, "cpi").selected).toEqual(["core", "target"]);
    expect(effectiveTableSeries(index, withCore)).toBe("cpi");
    expect(effectiveTableSeries(index, { ...withCore, tableSeries: "core" })).toBe("core");
    expect(effectiveTableSeries(index, { ...withCore, tab: "index", tableSeries: "core" })).toBe("cpi");

    const state: InflationState = { tab: "mom", mode: "table", range: manual("2015-03", "2019-10"), selected: ["core", "target"], tableSeries: "core" };
    expect(serializeInflationHash(state)).toBe("i=mom&m=table&r=2015-03-2019-10&sel=core%2Ctarget&t=core");
    expect(parseInflationHash(`#${serializeInflationHash(state)}`)).toEqual(state);
    expect(parseInflationHash("#i=bad&m=x&r=nope&sel=cpi,cpi,junk")).toEqual({ ...DEFAULT_INFLATION_STATE, selected: ["cpi"] });
    expect(parseInflationHash("#sel=").selected).toEqual([]);
    expect(parseInflationHash("#r=2019-10-2015-03").range).toEqual(manual("2015-03", "2019-10"));
  });

  it("reports the latest published month for the indicators, with the target in force", () => {
    const latest = latestIndicators(index, targets)!;
    expect(latest.period).toBe(last);
    expect(latest.target).toBe(targetForPeriod(targets, last));
    expect(latest.sparks.mom).toHaveLength(36);
    expect(latest.sparks.coreYoy.at(-1)).toBe(latest.coreYoy);
    expect(targetForPeriod(targets, makePeriod(2014, 12))).toBeNull();
    expect(targetForPeriod(targets, makePeriod(2017, 6))).toBe(4);
  });
});

describe("inflation labels", () => {
  it("names months, series and values in both languages", async () => {
    const ka = await getMessages("ka", ["inflation"]);
    const en = await getMessages("en", ["inflation"]);
    expect(periodLabel(ka, makePeriod(2026, 8), "long")).toBe("აგვისტო 2026");
    expect(periodLabel(en, makePeriod(2026, 8), "short")).toBe("Aug 2026");
    expect(seriesLabel(ka, "cpi", "yoy")).toBe("საერთო ინფლაცია");
    expect(seriesLabel(ka, "cpi", "index")).toBe("სამომხმარებლო ფასების ინდექსი");
    expect(seriesLabel(en, "core_ex_tobacco", "mom")).toBe("Core excluding tobacco");
    expect(formatInflationValue(5.6479, "yoy")).toBe("5.6%");
    expect(formatInflationValue(0.4049, "mom")).toBe("+0.4%");
    expect(formatInflationValue(-0.31, "mom")).toBe("−0.3%");
    expect(formatInflationValue(196.1968, "index")).toBe("196.2");
  });
});
