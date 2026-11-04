import { beforeAll, describe, expect, test } from "vitest";
import enMessages from "../../lib/i18n/messages/en/yearReview.json";
import kaMessages from "../../lib/i18n/messages/ka/yearReview.json";
import { loadYearReviewData } from "../../lib/yearReview/buildYearReviewData";
import { buildFindings } from "../../lib/yearReview/findings";
import type { YearReviewData } from "../../lib/yearReview/types";
import {
  buysView,
  changeView,
  debtView,
  givesUpView,
  glanceKpis,
  longView,
  perResidentRows,
  refundsView,
  regionsView,
  whereView,
} from "../../lib/yearReview/yearView";

// The Georgian and English pages draw the same thing: only names and text differ. Numbers, years, ids, colours and
// order must agree, so a locale-dependent bug (colours by label order, sorting by name, a locale-specific lookup)
// cannot make the English page show other figures (spec §11; replaces the old Analysis page's parity tests).

const loaded: Partial<Record<"ka" | "en", YearReviewData>> = {};
beforeAll(async () => {
  [loaded.ka, loaded.en] = await Promise.all([loadYearReviewData("ka").then(({ data }) => data), loadYearReviewData("en").then(({ data }) => data)]);
});

/** A copy without the keys that hold words: names (`label`) and the source lines. */
function withoutText(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutText);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).filter(([key]) => key !== "label" && key !== "sources").map(([key, inner]) => [key, withoutText(inner)]));
  }
  return value;
}

describe("Year in review: Georgian and English agree on everything but words", () => {
  test("the data object is identical once names and source lines are removed", () => {
    const { ka, en } = loaded as Required<typeof loaded>;
    expect(withoutText(en)).toEqual(withoutText(ka));
    // The names themselves are there in both, one per row.
    expect(en.budget.fields.map((field) => field.label).every(Boolean)).toBe(true);
    expect(Object.keys(en.sources)).toEqual(Object.keys(ka.sources));
  });

  test("every view and the findings' pictures agree for every budget year", () => {
    const { ka, en } = loaded as Required<typeof loaded>;
    const views = (data: YearReviewData, messages: typeof enMessages, locale: "ka" | "en") =>
      data.budget.years.map((year) => ({
        year,
        kpis: glanceKpis(data, year),
        where: (["fields", "institutions"] as const).map((grouping) => [whereView(data, grouping, year), changeView(data, grouping, year)]),
        buys: buysView(data, year),
        givesUp: givesUpView(data, year),
        refunds: refundsView(data, year),
        debt: debtView(data, year),
        perResident: perResidentRows(data, year),
        findings: buildFindings(data, year, messages, locale).map(({ id, yearTag, planned, visual }) => ({ id, yearTag, planned, visual })),
      }));
    expect(withoutText(views(en, enMessages, "en"))).toEqual(withoutText(views(ka, kaMessages, "ka")));
    const whole = (data: YearReviewData) => ({
      regions: regionsView(data),
      long: (["fields", "institutions"] as const).flatMap((grouping) =>
        (["expenditure", "revenue"] as const).flatMap((side) => (["share", "gel"] as const).map((measure) => longView(data, grouping, side, measure))),
      ),
    });
    expect(withoutText(whole(en))).toEqual(withoutText(whole(ka)));
  });
});
