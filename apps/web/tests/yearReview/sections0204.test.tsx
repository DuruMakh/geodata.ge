import { beforeAll, describe, expect, test } from "vitest";
import { DebtDeficit } from "../../components/year-review/debt-deficit";
import { GivesUp } from "../../components/year-review/gives-up";
import { formatAmountParts } from "../../lib/explorer/format";
import type { Presentation } from "../../lib/i18n/types";
import { loadYearReviewData } from "../../lib/yearReview/buildYearReviewData";
import type { YearReviewData } from "../../lib/yearReview/types";
import { refundsView } from "../../lib/yearReview/yearView";
import { chartGeometry, renderPageMarkup } from "../helpers/render-localized";

// Sections 02 (what the state gives up) and 04 (deficit and debt) as static markup, on the served data.

const GEORGIAN = /\p{Script=Georgian}/gu;
const loaded: Partial<Record<"ka" | "en", { data: YearReviewData; presentation: Presentation }>> = {};
beforeAll(async () => {
  [loaded.ka, loaded.en] = await Promise.all([loadYearReviewData("ka"), loadYearReviewData("en")]);
});

function sections(year: number, locale: "ka" | "en" = "ka"): string {
  const { data, presentation } = loaded[locale]!;
  return renderPageMarkup(locale, <><GivesUp data={data} year={year} /><DebtDeficit data={data} year={year} /></>, presentation.messages);
}

/** The markup of one panel: from its `data-panel` mark to the next panel's, or the end. */
function part(markup: string, id: string): string {
  const start = markup.indexOf(`data-panel="${id}"`);
  if (start < 0) return "";
  const next = markup.indexOf("data-panel=", start + 1);
  return markup.slice(start, next < 0 ? undefined : next);
}
/** Everything from the element carrying `data-chart="<id>"` on. */
const from = (markup: string, attribute: string) => markup.slice(markup.indexOf(attribute));

describe("Year in review sections 02 and 04", () => {
  test("2025: the refunds big number, six share buttons, projection hatching only on projection years", () => {
    const { data } = loaded.ka!;
    const markup = sections(2025);
    // 2.72 მლრდ ₾ on today's data: three significant digits, as the board shows it.
    const refunds = refundsView(data, 2025);
    const big = formatAmountParts(refunds.value.value, false, "ka", true);
    expect(big.num).toBe("2.72");
    const bigLine = /data-refunds-big[^>]*>([\s\S]*?)<\/p>/.exec(markup)?.[1]?.replace(/<[^>]+>/g, "") ?? "";
    expect(bigLine).toContain(`${big.num} ${big.unit}`);
    expect(refunds.fallback).toBe(false);

    expect(markup.match(/data-testid="chart-share"/g)).toHaveLength(6);

    const projected = data.balance.years.filter((_, index) => data.balance.projection[index]);
    expect(projected).toEqual([2026, 2027, 2028, 2029, 2030, 2031]);
    const deficit = chartGeometry(from(markup, 'data-chart="deficit"'), "desktop");
    const rects = [...deficit.matchAll(/<rect[^>]*data-segment="[^"]*"[^>]*>/g)].map(([tag]) => tag);
    const hatched = rects.filter((tag) => tag.includes("data-projection"));
    expect(hatched).toHaveLength(projected.length);
    // Every hatched column stands right of every solid one: the projection is the run of years at the end.
    const x = (tag: string) => Number(/ x="([^"]+)"/.exec(tag)![1]);
    const solid = rects.filter((tag) => !tag.includes("data-projection"));
    expect(solid).toHaveLength(data.balance.years.length - projected.length);
    expect(Math.min(...hatched.map(x))).toBeGreaterThan(Math.max(...solid.map(x)));
    // The chosen year and the deepest deficit carry their values on the bars.
    const deepest = data.balance.years[data.balance.pctGdp.indexOf(Math.min(...data.balance.pctGdp.filter((value): value is number => value !== null)))]!;
    expect([...deficit.matchAll(/data-value-label="(\d+)"/g)].map((match) => Number(match[1])).sort()).toEqual([deepest, 2025].sort());

    // Refunds: the year used is the one ink column.
    const refundsSvg = chartGeometry(from(markup, 'data-panel="refunds"'), "desktop");
    expect(refundsSvg.match(/data-segment="refunds-chosen"/g)).toHaveLength(1);
    expect(refundsSvg.match(/data-segment="refunds"/g)).toHaveLength(data.refunds.years.length - 1);

    // Repayments: the peak is labelled on its bar, and its line marks it as a projection when it is one.
    const service = data.debt.service;
    const totals = service.principal.map((value, index) => value! + service.interest[index]!);
    const peak = totals.indexOf(Math.max(...totals));
    const repayments = part(markup, "repayments");
    expect(chartGeometry(repayments, "desktop")).toContain(`data-value-label="${service.years[peak]}"`);
    expect(/<h3[\s\S]*?<\/h3>/.exec(repayments)![0].includes("data-plan-tag")).toBe(service.projection[peak]);
  });

  test("2025: the tax breaks fall back to their last report year; refunds and debt do not", () => {
    const markup = sections(2025);
    expect(part(markup, "gives-up")).toContain('data-year-tag="2024"');
    expect(part(markup, "refunds")).not.toContain("data-year-tag");
    expect(part(markup, "debt")).not.toContain("data-year-tag");
  });

  test("2026 (plan year): the refunds and debt panels carry a 2025 year tag", () => {
    const markup = sections(2026);
    expect(part(markup, "refunds")).toContain('data-year-tag="2025"');
    expect(part(markup, "debt")).toContain('data-year-tag="2025"');
    // The balance for 2026 is a projection, and its line says so; 2025's is actual.
    const deficitHeading = (html: string) => /data-chart="deficit"[\s\S]*?<\/h3>/.exec(html)?.[0] ?? "";
    expect(deficitHeading(markup)).toMatch(/data-plan-tag=""[^>]*>პროგნოზი/);
    expect(deficitHeading(sections(2025))).not.toContain("data-plan-tag");
  });

  test("in English the two sections have no Georgian text", () => {
    const text = sections(2025, "en").replace(/<[^>]+>/g, " ");
    expect(text.match(GEORGIAN) ?? []).toEqual([]);
  });
});
