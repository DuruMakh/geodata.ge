import { beforeAll, expect, test } from "vitest";
import { loadServedUnemploymentData, UNEMPLOYMENT_GROUPS } from "../../lib/data/unemployment/importUnemployment";
import type { ClientUnemploymentObservation } from "../../lib/data/unemployment/types";
import { DEFAULT_UNEMPLOYMENT_STATE, changeUnemploymentBreakdown, changeUnemploymentIndicator, changeUnemploymentEducationSex, parseUnemploymentHash, serializeUnemploymentHash } from "../../lib/explorer/unemploymentState";
let facts: ClientUnemploymentObservation[];
beforeAll(async () => { facts = (await loadServedUnemploymentData()).facts; });
test("shared hash restores every setting including an explicitly empty selection", () => {
  const state = { ...DEFAULT_UNEMPLOYMENT_STATE, breakdown: "education" as const, educationSex: "women" as const, indicator: "employment_rate" as const, mode: "table" as const, range: { kind: "manual" as const, start: 2021, end: 2024 }, selectedIds: [] };
  expect(parseUnemploymentHash(serializeUnemploymentHash(state), facts, UNEMPLOYMENT_GROUPS)).toEqual(state);
});
test("invalid hash identities are removed while omitted selection defaults to the proper reference", () => {
  expect(parseUnemploymentHash("breakdown=education&sex=men", facts, UNEMPLOYMENT_GROUPS).selectedIds).toEqual(["men"]);
  expect(parseUnemploymentHash("breakdown=education&sex=men&sel=georgia,education.higher,unknown,education.higher", facts, UNEMPLOYMENT_GROUPS).selectedIds).toEqual(["education.higher"]);
});
test("switching breakdown retains compatible rates but resets the checked series", () => {
  expect(changeUnemploymentBreakdown({ ...DEFAULT_UNEMPLOYMENT_STATE, indicator: "employment_rate", selectedIds: ["georgia", "women"] }, "education", facts)).toMatchObject({ indicator: "employment_rate", selectedIds: ["georgia"] });
});
test("unsupported counts fall back to the destination unemployment-rate indicator", () => {
  expect(changeUnemploymentBreakdown({ ...DEFAULT_UNEMPLOYMENT_STATE, indicator: "employed" }, "education", facts).indicator).toBe("unemployment_rate");
  expect(changeUnemploymentBreakdown(DEFAULT_UNEMPLOYMENT_STATE, "long_term", facts).indicator).toBe("long_term_unemployment_rate");
});
test("coverage changes clamp compatible manual years and reset a disjoint range", () => {
  expect(changeUnemploymentBreakdown({ ...DEFAULT_UNEMPLOYMENT_STATE, range: { kind: "manual", start: 2018, end: 2023 } }, "education", facts).range).toEqual({ kind: "manual", start: 2020, end: 2023 });
  expect(changeUnemploymentBreakdown({ ...DEFAULT_UNEMPLOYMENT_STATE, range: { kind: "manual", start: 2010, end: 2015 } }, "education", facts).range).toEqual({ kind: "all" });
});
test("changing education sex resets to its matching published reference", () => {
  const state = changeUnemploymentEducationSex({ ...DEFAULT_UNEMPLOYMENT_STATE, breakdown: "education", selectedIds: ["education.higher"] }, "women", facts);
  expect(state.selectedIds).toEqual(["women"]); expect(state.educationSex).toBe("women");
});
test("indicator changes preserve an explicitly empty selection", () => {
  expect(changeUnemploymentIndicator({ ...DEFAULT_UNEMPLOYMENT_STATE, selectedIds: [] }, "unemployed", facts).selectedIds).toEqual([]);
});

test("each separate page restores its own comparison when the shared link omits a breakdown", () => {
  expect(parseUnemploymentHash("", facts, UNEMPLOYMENT_GROUPS, "regions")).toMatchObject({ breakdown: "region", selectedIds: ["georgia:unemployment_rate"] });
  expect(parseUnemploymentHash("", facts, UNEMPLOYMENT_GROUPS, "age")).toMatchObject({ breakdown: "age", selectedIds: ["age.15_19"] });
  expect(parseUnemploymentHash("", facts, UNEMPLOYMENT_GROUPS, "gender")).toMatchObject({ breakdown: "sex", selectedIds: ["georgia:unemployment_rate"] });
});

test("a page cannot be changed into a different main section by editing its hash", () => {
  expect(parseUnemploymentHash("breakdown=education&sex=women&indicator=long_term_unemployment_rate", facts, UNEMPLOYMENT_GROUPS, "regions")).toMatchObject({ breakdown: "region", indicator: "unemployment_rate", selectedIds: ["georgia:unemployment_rate"] });
  expect(parseUnemploymentHash("breakdown=region", facts, UNEMPLOYMENT_GROUPS, "overview").breakdown).toBe("national");
});

test("education restores its groups and years with unemployment rate as the only overview measure", () => {
  expect(parseUnemploymentHash("breakdown=education&sex=women&indicator=employment_rate&view=table&start=2021&end=2024&sel=education.higher", facts, UNEMPLOYMENT_GROUPS, "overview")).toMatchObject({ breakdown: "education", educationSex: "women", indicator: "unemployment_rate", mode: "table", range: { kind: "manual", start: 2021, end: 2024 }, selectedIds: ["education.higher"] });
});
