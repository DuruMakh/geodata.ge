import { beforeAll, describe, expect, it } from "vitest";
import { loadServedHealthData } from "../../../lib/data/health/importHealth";
import type { HealthFact, HealthIndicator } from "../../../lib/data/health/types";
import { getMessages } from "../../../lib/i18n/messages.server";
import type { Messages } from "../../../lib/i18n/types";
import { buildDeathsChapter, oneInN } from "../../../lib/landing/chapters/deaths";
import type { DeathsChapter } from "../../../lib/landing/chapters/types";

let facts: HealthFact[];
let messages: Messages;
let chapter: DeathsChapter;

beforeAll(async () => {
  facts = (await loadServedHealthData()).facts;
  messages = await getMessages("ka", ["health", "landing"]);
  chapter = buildDeathsChapter(facts, messages);
}, 60_000);

const fact = (indicator: string, year: number, value: number, areaId = "georgia"): HealthFact => ({
  year, indicatorId: indicator as HealthIndicator, areaId: areaId as HealthFact["areaId"], value: String(value), publishedValue: String(value), unit: "persons", basis: "actual", valueStatus: "published",
  sourceId: "geostat_deaths_by_cause_region", sourceSheet: "1", sourceCell: "A1", sourceNumberFormat: "#,##0", lastReviewedAt: "2026-10-01",
});
const deaths = (year: number, counts: Record<string, number>): HealthFact[] => [
  fact("health.deaths.total", year, Object.values(counts).reduce((a, b) => a + b, 0) + 100),
  ...Object.entries(counts).map(([id, count]) => fact(`health.deaths.${id}`, year, count)),
];

describe("buildDeathsChapter", () => {
  it("2025, Georgia: total 44319; groups are the five largest causes then other", () => {
    expect(chapter.year).toBe(2025);
    expect(chapter.total).toBe(44319);
    expect(chapter.groups.map((group) => group.id)).toEqual(["circulatory", "ill_defined", "cancer", "respiratory", "external", "other"]);
    expect(chapter.groups.find((group) => group.id === "other")?.count).toBe(5836);
    expect(chapter.groups.reduce((sum, group) => sum + group.count, 0)).toBe(44319);
    expect(chapter.groups[0].label).toBe(messages["health.series.health.deaths.circulatory"]);
    expect(chapter.groups[5].label).toBe(messages["landing.deaths.other"]);
  });

  it("kinds", () => {
    const kinds = Object.fromEntries(chapter.groups.map((group) => [group.id, group.kind]));
    expect(kinds).toEqual({ circulatory: "top", ill_defined: "unknown", cancer: "established", respiratory: "established", external: "established", other: "other" });
  });

  it("top and unknown shares", () => {
    expect(chapter.top.id).toBe("circulatory");
    expect(chapter.top.share).toBeCloseTo(0.377, 3);
    expect(chapter.unknownShare).toBeCloseTo(0.212, 3);
  });

  it("ill-defined largest → top is the largest established cause", () => {
    const result = buildDeathsChapter(deaths(2025, { ill_defined: 500, cancer: 300, circulatory: 200, external: 50, digestive: 40, skin: 30, blood: 20 }), messages);
    expect(result.groups.map((group) => [group.id, group.kind])).toEqual([
      ["ill_defined", "unknown"], ["cancer", "top"], ["circulatory", "established"], ["external", "established"], ["digestive", "established"], ["other", "other"],
    ]);
    expect(result.top.id).toBe("cancer");
    expect(result.groups.at(-1)?.count).toBe(30 + 20 + 100);
  });

  it("zero-count causes never rank", () => {
    const result = buildDeathsChapter(deaths(2025, { circulatory: 90, cancer: 60, ear: 0, eye: 0, covid19: 0 }), messages);
    expect(result.groups.map((group) => group.id)).toEqual(["circulatory", "cancer", "other"]);
    expect(result.unknownShare).toBe(0);
  });

  it("reads Georgia in the latest year with a total", () => {
    const result = buildDeathsChapter([...deaths(2024, { circulatory: 10 }), ...deaths(2025, { cancer: 7 }), fact("health.deaths.circulatory", 2025, 999, "tbilisi")], messages);
    expect(result.year).toBe(2025);
    expect(result.groups.map((group) => group.id)).toEqual(["cancer", "other"]);
  });

  it("fails clearly without a total", () => {
    expect(() => buildDeathsChapter([], messages)).toThrow(/Deaths chapter/);
  });
});

describe("oneInN", () => {
  it("rounds 1/share within 2..10, else null", () => {
    expect(oneInN(0.212)).toBe(5);
    expect(oneInN(0.04)).toBeNull();
    expect(oneInN(0.6)).toBe(2);
  });
});
