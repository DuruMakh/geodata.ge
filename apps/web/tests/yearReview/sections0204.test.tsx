import { beforeAll, describe, expect, test, vi } from "vitest";
import { DebtDeficit } from "../../components/year-review/debt-deficit";
import { GivesUp } from "../../components/year-review/gives-up";
import { formatAmountParts } from "../../lib/explorer/format";
import type { Presentation } from "../../lib/i18n/types";
import { loadYearReviewData } from "../../lib/yearReview/buildYearReviewData";
import type { YearReviewData } from "../../lib/yearReview/types";
import { refundsView } from "../../lib/yearReview/yearView";
import { chartGeometry, renderPageMarkup } from "../helpers/render-localized";

// Sections 02 (what the state gives up) and 04 (deficit and debt) as static markup, on the served data. The share
// button stands in with its title and caption on it, as in section03.test.tsx: the real one mounts its card only
// when opened, so its caption never reaches static markup.

vi.mock("../../components/explorer-shell/chart-share-button", () => ({
  ChartShareButton: ({ title, caption }: { title: string; caption: string }) => (
    <button type="button" data-testid="chart-share" data-title={title} data-caption={caption} />
  ),
}));

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

  test("the deficit and repayments share pictures name their projection years", () => {
    for (const locale of ["ka", "en"] as const) {
      const { data, presentation } = loaded[locale]!;
      const projection = presentation.messages["yearReview.proj"]!;
      const markup = sections(2025, locale);
      const caption = (html: string) => /data-caption="([^"]*)"/.exec(html)?.[1] ?? "";
      const span = (years: number[], projected: boolean[]) => {
        const hatched = years.filter((_, index) => projected[index]);
        return `${hatched[0]}–${hatched.at(-1)}`;
      };
      const { balance, debt } = data;
      expect(caption(from(markup, 'data-chart="deficit"'))).toBe(
        `${presentation.messages["main.percentGdp"]} · ${balance.years[0]}–${balance.years.at(-1)} · ${projection} ${span(balance.years, balance.projection)}`,
      );
      expect(caption(part(markup, "repayments"))).toMatch(new RegExp(` · ${projection} ${span(debt.service.years, debt.service.projection)}$`));
      // The debt stock has no projection, and its caption names none.
      expect(caption(from(markup, 'data-chart="debt-stock"'))).not.toContain(projection);
    }
  });

  test("refunds and debt by year label the chosen year's value, and the captions say which year each value is for", () => {
    const { data } = loaded.en!;
    const markup = sections(2025, "en");
    expect(chartGeometry(part(markup, "refunds"), "desktop")).toContain(`data-value-label="${refundsView(data, 2025).year}"`);
    expect(chartGeometry(from(markup, 'data-chart="debt-stock"'), "desktop")).toContain('data-value-label="2025"');
    // Every caption line of the four column charts reads `name · year: value`; refunds names its two years.
    const lines = [...markup.matchAll(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/g)].flatMap((match) =>
      [...match[1]!.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((item) => item[1]!.replace(/<!-- -->/g, "")),
    );
    expect(lines.length).toBeGreaterThanOrEqual(8);
    for (const line of lines) expect(line).toMatch(/ · \d{4}: /);
    const refunds = /<figcaption[^>]*>([\s\S]*?)<\/figcaption>/.exec(part(markup, "refunds"))![1]!.replace(/<!-- -->/g, "");
    expect(refunds).toContain("Tax refunds · 2024: ");
    expect(refunds).toContain("Tax refunds · 2025: ");
  });

  test("the ice chart names its year once, and the sub-chart titles are headings", () => {
    const year = (html: string) => (/<p[^>]*>([\s\S]*?)<\/p>/.exec(part(html, "gives-up"))![1]!.replace(/<span class="sr-only">[^<]*<\/span>/g, "").replace(/<[^>]+>/g, "").match(/2024/g) ?? []).length;
    // On screen: the fallback year in its tag, or the chosen year in the line (the tag's screen-reader words aside).
    expect(year(sections(2025))).toBe(1);
    expect(year(sections(2024))).toBe(1);
    const markup = sections(2025, "en");
    expect(markup).toMatch(/<h3[^>]*>Tax refunds<\/h3>/);
    expect(markup).toMatch(/<h4[^>]*>Average interest rate<\/h4>/);
    expect(markup).toMatch(/<h3[^>]*>Debt by year<\/h3>/);
  });

  test("in English the two sections have no Georgian text", () => {
    const text = sections(2025, "en").replace(/<[^>]+>/g, " ");
    expect(text.match(GEORGIAN) ?? []).toEqual([]);
  });
});
