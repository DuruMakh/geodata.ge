import { beforeAll, describe, expect, test } from "vitest";
import type { ReactNode } from "react";
import { Glance } from "../../components/year-review/glance";
import { LongView } from "../../components/year-review/long-view";
import { YearReviewNotes } from "../../components/year-review/notes";
import { CountryRegions } from "../../components/year-review/per-resident";
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

function section(locale: "ka" | "en", render: (data: YearReviewData) => ReactNode): string {
  const { data, presentation } = loaded[locale]!;
  return renderPageMarkup(locale, render(data), presentation.messages);
}

/** Visible text with each aria-label inlined, spaces collapsed. */
const textOf = (markup: string) => markup.replace(/aria-label="([^"]*)"/g, " $1 ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

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

  test("01's computed lines: the plan against an actual year, one precision for the balance in GEL, record phrases", () => {
    expect(textOf(kpi(glance(2026, "en"), "spend"))).toContain("+11.4% · 2026 plan vs 2025 actual");
    expect(textOf(kpi(glance(2026), "spend"))).toContain("+11.4% · 2026 — გეგმა, 2025 — ფაქტი");
    expect(textOf(kpi(glance(2025, "en"), "spend"))).toContain("+6.8% · vs 2024");
    // The same −1.53 bn as section 04 (formatAmountParts with significant billions).
    expect(textOf(kpi(glance(2025, "en"), "balance"))).toContain("−1.53 bn GEL · smallest deficit since 2018");
    // 2020 is the deepest deficit of the series; 2011's nearest smaller one was a surplus.
    expect(textOf(kpi(glance(2020, "en"), "balance"))).toContain("largest deficit on record (since 1995)");
    expect(textOf(kpi(glance(2011, "en"), "balance"))).toContain("smallest deficit since the 2007 surplus");
    expect(textOf(kpi(glance(2011), "balance"))).toContain("დეფიციტი — ყველაზე მცირე 2007 წლის პროფიციტის შემდეგ");
    // Government debt, as the Debt page names debt.stock.
    expect(textOf(kpi(glance(2025, "en"), "debt"))).toContain("Government debt");
    expect(textOf(kpi(glance(2025), "debt"))).toContain("მთავრობის ვალი");
  });

  test("01's sparklines draw a plan or projection dashed even when another year is chosen, and split per resident at the census", () => {
    const markup = glance(2025);
    for (const id of ["spend", "balance", "perResident"]) expect(kpi(markup, id)).toContain('data-testid="sparkline-plan"');
    for (const id of ["tax", "debt", "breaks"]) expect(kpi(markup, id)).not.toContain("sparkline-plan");
    // Where the solid line ends and the dashed plan starts: the same point for spending; for per resident the census
    // re-basing (2025) leaves a gap, and 2025 to the 2026 plan is drawn on its own.
    const ends = (id: string) => {
      const solid = /<path d="(M[^"]*)" fill="none" stroke="[^"]*" stroke-width="1.2" stroke-linejoin="round" stroke-linecap="round"/.exec(kpi(markup, id))![1]!;
      const plan = /data-testid="sparkline-plan" d="M([\d.]+) /.exec(kpi(markup, id))![1]!;
      return { solidEnd: Number(solid.slice(solid.lastIndexOf("L") + 1).split(" ")[0]), planStart: Number(plan) };
    };
    expect(ends("spend").planStart).toBe(ends("spend").solidEnd);
    expect(ends("perResident").planStart).toBeGreaterThan(ends("perResident").solidEnd);
  });

  test("the population note says when the population was re-based, from the demography break register", () => {
    const { data } = loaded.en!;
    expect(data.budget.populationBreak).not.toBeNull();
    expect(textOf(section("en", (d) => <YearReviewNotes data={d} year={2025} />))).toContain(
      `On 1 January ${data.budget.populationBreak} Geostat re-based the population to the census, so per-resident figures before and after that date are on different bases and are not compared.`,
    );
    expect(textOf(section("ka", (d) => <YearReviewNotes data={d} year={2010} />))).toContain(`${data.budget.populationBreak} წლის 1 იანვარს საქსტატმა მოსახლეობა აღწერაზე დააფუძნა`);
    expect(textOf(section("ka", (d) => <YearReviewNotes data={d} year={2025} />))).toContain("2009 წლის ჩათვლით მშპ SNA 1993-ით");
  });

  test("a one-municipality region is named in the singular, and the long view calls a missing first year missing", () => {
    expect(section("en", (d) => <CountryRegions data={d} year={2025} />)).toMatch(/aria-label="Tbilisi: [^"]* per resident on average, 1 municipality"/);
    expect(section("en", (d) => <CountryRegions data={d} year={2025} />)).toContain("Government debt");
    const noop = () => {};
    const receipts = section("en", (d) => (
      <LongView data={d} year={2004} grouping="fields" side="revenue" measure="share" focus={null} pin={null} onFocus={noop} onPin={noop} onSide={noop} onMeasure={noop} />
    ));
    expect(receipts).toMatch(/aria-label="Composition [^"]*Increase in liabilities — → \d/);
  });

  test("a finding card with bars says their amounts in its link; the long view's label names every band and its legend is a phone-sized target", () => {
    const markup = glance(2025, "en");
    const links = [...markup.matchAll(/<a[^>]*data-finding="[^"]*"[\s\S]*?<\/a>/g)].map(([link]) => link);
    const withBars = links.filter((link) => link.includes("h-[9px]"));
    expect(withBars.length).toBeGreaterThan(0);
    for (const link of withBars) expect(link).toMatch(/<span class="sr-only">[^<]*: [\d.]+ (bn|mln)[^<]*; [^<]*: [\d.]+ (bn|mln)/);
    const noop = () => {};
    const long = section("en", (d) => (
      <LongView data={d} year={2025} grouping="institutions" side="expenditure" measure="share" focus={null} pin={null} onFocus={noop} onPin={noop} onSide={noop} onMeasure={noop} />
    ));
    const label = /<div[^>]*role="img"[^>]*aria-label="([^"]*)"/.exec(long)![1]!;
    const legend = [...long.matchAll(/<button[^>]*data-legend="[^"]*"[^>]*>/g)].map(([tag]) => tag);
    expect(label.split("; ")).toHaveLength(legend.length);
    expect(legend.length).toBeGreaterThan(6);
    for (const tag of legend) expect(tag).toMatch(/min-h-9 [\s\S]*min-\[768px\]:min-h-6/);
    // The plot is a keyboard stop for its readout.
    expect(/<div[^>]*role="img"[^>]*>/.exec(long)![0]).toContain('tabindex="0"');
  });

  test("01 in English has no Georgian text", () => {
    const text = glance(2025, "en").replace(/<[^>]+>/g, " ");
    expect(text.match(new RegExp(GEORGIAN.source, "gu")) ?? []).toEqual([]);
  });
});
