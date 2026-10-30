import { beforeAll, describe, expect, test } from "vitest";
import { Glance } from "../../components/year-review/glance";
import type { Presentation } from "../../lib/i18n/types";
import { renderAnalysisPage } from "../../lib/pages/analysis";
import { loadYearReviewData } from "../../lib/yearReview/buildYearReviewData";
import type { YearReviewData } from "../../lib/yearReview/types";
import { renderPageMarkup } from "../helpers/render-localized";

// Static markup only: the repo has no DOM testing library. Hash restoring and pointer or keyboard picking are in the
// browser spec (Task 10).

const GEORGIAN = /\p{Script=Georgian}/u;
const loaded: Partial<Record<"ka" | "en", { data: YearReviewData; presentation: Presentation }>> = {};
beforeAll(async () => {
  [loaded.ka, loaded.en] = await Promise.all([loadYearReviewData("ka"), loadYearReviewData("en")]);
});

function glance(year: number, locale: "ka" | "en" = "ka"): string {
  const { data, presentation } = loaded[locale]!;
  return renderPageMarkup(locale, <Glance data={data} year={year} />, presentation.messages);
}

/** The markup of one headline number, by its id. */
const kpi = (markup: string, id: string) => new RegExp(`<li[^>]*data-kpi="${id}"[\\s\\S]*?</li>`).exec(markup)?.[0] ?? "";

describe("Year in review page", () => {
  test("renders the H1, the one line under it and a ruler that opens on the last actual year", async () => {
    const { data } = loaded.ka!;
    const markup = renderPageMarkup("ka", await renderAnalysisPage("ka"));
    expect(markup).toMatch(/<h1[^>]*>წლის მიმოხილვა<\/h1>/);
    expect(markup).toContain("ერთი წელი ყველა კუთხიდან");
    const radios = [...markup.matchAll(/<button[^>]*role="radio"[^>]*>/g)].map(([tag]) => tag);
    expect(radios).toHaveLength(data.budget.years.length);
    const checked = radios.filter((tag) => tag.includes('aria-checked="true"'));
    expect(checked).toHaveLength(1);
    expect(checked[0]).toContain('data-year="2025"');
    // Roving tabindex: only the chosen year is a tab stop.
    expect(radios.filter((tag) => tag.includes('tabindex="0"'))).toEqual(checked);
    // The plan year carries its tag in the ruler.
    expect(markup).toMatch(/data-year="2026"[^>]*>[\s\S]*?გეგმა/);
    // Section 06 names the years the long view spans, from the data.
    expect(markup).toContain(`დიდი სურათი: ${data.budget.years[0]}–${data.budget.years.at(-1)}`);
  });

  test("01 for 2025 has six headline numbers and six finding links", () => {
    const markup = glance(2025);
    expect(markup.match(/data-kpi="/g)).toHaveLength(6);
    expect(markup.match(/<a[^>]*data-finding="/g)).toHaveLength(6);
    expect(markup).toContain("2025 ერთ სურათზე");
    // Only tax breaks fall back in 2025 (their report ends a year earlier); spending is an actual year.
    expect(kpi(markup, "breaks")).toContain('data-year-tag="2024"');
    expect(kpi(markup, "spend")).not.toContain("data-year-tag");
    expect(kpi(markup, "spend")).not.toContain("data-plan-tag");
  });

  test("01 for the plan year tags every number from another year, and marks planned values", () => {
    const markup = glance(2026);
    expect(kpi(markup, "breaks")).toContain('data-year-tag="2024"');
    expect(kpi(markup, "tax")).toContain('data-year-tag="2025"');
    expect(kpi(markup, "debt")).toContain('data-year-tag="2025"');
    expect(kpi(markup, "spend")).toContain("data-plan-tag");
    expect(kpi(markup, "spend")).toContain("გეგმა");
    expect(kpi(markup, "balance")).toContain("პროგნოზი");
    // A fallback year shows the section's note on nearest years.
    expect(markup).toContain("სადაც 2026 წლის მონაცემი არ არის");
  });

  test("01 in English has no Georgian text", () => {
    const text = glance(2025, "en").replace(/<[^>]+>/g, " ");
    expect(text.match(new RegExp(GEORGIAN.source, "gu")) ?? []).toEqual([]);
  });
});
