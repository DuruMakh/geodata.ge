import { beforeAll, describe, expect, test, vi } from "vitest";
import { LongView } from "../../components/year-review/long-view";
import { YearReviewNotes } from "../../components/year-review/notes";
import { CountryRegions } from "../../components/year-review/per-resident";
import { updatedDate } from "../../lib/explorer/coverageLabel";
import { loadServedMunicipalData } from "../../lib/data/servedData";
import { formatPerResidentGel } from "../../lib/explorer/format";
import { buildMedianMunicipalBudgetPerResident, buildMunicipalListRows } from "../../lib/explorer/municipalData";
import type { Presentation } from "../../lib/i18n/types";
import { renderAnalysisPage } from "../../lib/pages/analysis";
import { loadYearReviewData } from "../../lib/yearReview/buildYearReviewData";
import type { YearReviewData } from "../../lib/yearReview/types";
import { longView, perResidentRows, regionsView } from "../../lib/yearReview/yearView";
import { renderPageMarkup } from "../helpers/render-localized";

// Sections 05 (country and regions), 06 (the long view) and the notes as static markup, on the served data. Hover
// and click picking are in the browser spec (Task 10). The share button stands in with its title on it.

vi.mock("../../components/explorer-shell/chart-share-button", () => ({
  ChartShareButton: ({ title, caption, source }: { title: string; caption: string; source: string }) => (
    <button type="button" data-testid="chart-share" data-title={title} data-caption={caption} data-source={source} />
  ),
}));

const GEORGIAN = /\p{Script=Georgian}/gu;
const loaded: Partial<Record<"ka" | "en", { data: YearReviewData; presentation: Presentation }>> = {};
beforeAll(async () => {
  [loaded.ka, loaded.en] = await Promise.all([loadYearReviewData("ka"), loadYearReviewData("en")]);
});

const noop = () => {};
type Options = { side?: "expenditure" | "revenue"; measure?: "share" | "gel"; focus?: string | null; locale?: "ka" | "en" };
function render(which: "05" | "06" | "notes", year: number, options: Options & { data?: YearReviewData } = {}): string {
  const { side = "expenditure", measure = "share", focus = null, locale = "ka" } = options;
  const { presentation } = loaded[locale]!;
  const data = options.data ?? loaded[locale]!.data;
  const props = { data, year, grouping: "fields" as const, side, measure, focus, pin: focus, onFocus: noop, onPin: noop, onSide: noop, onMeasure: noop };
  const node = which === "05" ? <CountryRegions {...props} /> : which === "06" ? <LongView {...props} /> : <YearReviewNotes data={data} year={year} />;
  return renderPageMarkup(locale, node, presentation.messages);
}
/** The markup of one panel: from its `data-panel` mark to the next panel's, or the end. */
function part(markup: string, id: string): string {
  const start = markup.indexOf(`data-panel="${id}"`);
  const next = markup.indexOf("data-panel=", start + 1);
  return start < 0 ? "" : markup.slice(start, next < 0 ? undefined : next);
}
const plain = (markup: string) => markup.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const marks = (markup: string, name: string) => [...markup.matchAll(new RegExp(`<[a-z]+[^>]*data-${name}="([^"]*)"[^>]*>`, "g"))];

describe("Year in review section 05", () => {
  test("six ledger rows, a row per region and a dot per municipality, as many as the data has", () => {
    const { data } = loaded.ka!;
    const markup = render("05", data.budget.defaultYear);
    expect(marks(markup, "ledger-row").map(([, id]) => id)).toEqual(["spend", "tax", "debt", "svc", "soc", "mun"]);
    const regions = regionsView(data).regions;
    expect(marks(markup, "region-row")).toHaveLength(regions.length);
    expect(marks(markup, "dot")).toHaveLength(data.municipal.places.length);
    // Today's data: eleven regions, sixty-four municipalities.
    expect(regions).toHaveLength(11);
    expect(data.municipal.places).toHaveLength(64);
    // The screen-reader list names every municipality.
    const list = /<ol[^>]*data-municipal-list[^>]*>([\s\S]*?)<\/ol>/.exec(markup)?.[1] ?? "";
    expect(list.match(/<li/g)).toHaveLength(data.municipal.places.length);
    expect(plain(markup)).toContain(`ერთ მცხოვრებზე · ${data.municipal.places.length} მუნიციპალიტეტი`);
    expect(markup.match(/data-testid="chart-share"/g)).toHaveLength(2);
  });

  test("the median label is the Municipalities page's own median of the per-resident values", async () => {
    const { data } = loaded.ka!;
    const municipal = await loadServedMunicipalData();
    const list = buildMunicipalListRows({
      municipalities: municipal.municipalities,
      regionLabels: new Map(municipal.regions.map((region) => [region.id, region.kaLabel])),
      totalFacts: municipal.totalFacts,
      populationFacts: municipal.populationFacts,
      adjaraBudgetAdjustments: municipal.adjaraBudgetAdjustments,
      year: data.municipal.year,
    });
    const pageMedian = buildMedianMunicipalBudgetPerResident(list.municipalities);
    const values = data.municipal.places.map((place) => place.perResidentGel).sort((left, right) => left - right);
    const middle = values.length >> 1;
    const median = values.length % 2 ? values[middle]! : (values[middle - 1]! + values[middle]!) / 2;
    expect(median).toBe(pageMedian);
    expect(regionsView(data).median).toBe(pageMedian);
    const markup = render("05", data.budget.defaultYear);
    expect(plain(/data-median-label[^>]*>([\s\S]*?)<\/p>/.exec(markup)?.[1] ?? "").trim()).toBe(`მედიანა ${formatPerResidentGel(pageMedian, "ka")}`);
    // The ledger's municipal row is the same median.
    expect(plain(/<li[^>]*data-ledger-row="mun"[\s\S]*?<\/li>/.exec(markup)![0])).toContain(formatPerResidentGel(pageMedian, "ka"));
  });

  test("a row from another year carries its year tag; the first year tags debt and municipalities", () => {
    const { data } = loaded.ka!;
    const [first] = data.budget.years;
    const markup = render("05", first!);
    const row = (id: string) => /<li[^>]*data-ledger-row="ID"[\s\S]*?<\/li>/.source.replace("ID", id);
    for (const ledger of perResidentRows(data, first!)) {
      const tag = new RegExp(row(ledger.id)).exec(markup)![0];
      if (ledger.fallback) expect(tag).toContain(`data-year-tag="${ledger.year}"`);
      else expect(tag).not.toContain("data-year-tag");
    }
    expect(perResidentRows(data, first!).find((ledger) => ledger.id === "debt")!.fallback).toBe(true);
    expect(new RegExp(row("mun")).exec(markup)![0]).toContain(`data-year-tag="${data.municipal.year}"`);
  });
  test("the dot plot's share picture cites the Municipalities page's source, and its heading tags another year", () => {
    const { data, presentation } = loaded.ka!;
    const markup = render("05", data.budget.defaultYear);
    const regions = part(markup, "regions");
    const source = /data-source="([^"]*)"/.exec(regions)?.[1];
    expect(source).toBe(`${data.sources.municipal} ${presentation.messages["yearReview.mpNote"]}`);
    expect(source).toContain("ფინანსთა სამინისტრო");
    expect(regions.slice(0, regions.indexOf("</h3>"))).not.toContain("data-year-tag");
    const planYear = data.budget.years.find((_, index) => data.budget.planned[index])!;
    expect(planYear).not.toBe(data.municipal.year);
    const planRegions = part(render("05", planYear), "regions");
    expect(planRegions.slice(0, planRegions.indexOf("</h3>"))).toContain(`data-year-tag="${data.municipal.year}"`);
  });
});

describe("Year in review section 06", () => {
  test("shares: one path per category, the top axis label is 100%, one share button", () => {
    const { data } = loaded.ka!;
    const markup = render("06", data.budget.defaultYear);
    const view = longView(data, "fields", "expenditure", "share");
    expect(marks(markup, "band").map(([, id]) => id)).toEqual(view.bands.map((band) => band.id));
    expect(view.bands).toHaveLength(data.budget.fields.length);
    expect([...markup.matchAll(/data-y-tick="[^"]*"[^>]*>([^<]*)</g)].map((match) => match[1]).at(-1)).toBe("100%");
    expect(plain(markup)).toContain(`დიდი სურათი: ${view.years[0]}–${view.years.at(-1)}`);
    expect(markup.match(/data-testid="chart-share"/g)).toHaveLength(1);
    // The two facts name the largest share gain and loss.
    expect(plain(markup)).toContain(data.budget.fields.find((field) => field.id === view.gain!.id)!.label);
    expect(plain(markup)).toContain(data.budget.fields.find((field) => field.id === view.loss!.id)!.label);
    // The chosen year's line carries its label.
    expect(/data-chosen-label[^>]*>([^<]*)</.exec(markup)?.[1]).toBe(String(data.budget.defaultYear));
  });

  test("GEL: the top axis label is in billions, not 100%", () => {
    const { data } = loaded.ka!;
    const markup = render("06", data.budget.defaultYear, { measure: "gel" });
    const labels = [...markup.matchAll(/data-y-tick="[^"]*"[^>]*>([^<]*)</g)].map((match) => match[1]);
    expect(labels.at(-1)).toMatch(/მლრდ$/);
    expect(markup).toMatch(/aria-pressed="true"[^>]*>ლარში</);
  });

  test("receipts: the legend lists every receipt", () => {
    const { data } = loaded.ka!;
    const markup = render("06", data.budget.defaultYear, { side: "revenue" });
    expect(marks(markup, "legend").map(([, id]) => id)).toEqual(longView(data, "fields", "revenue", "share").bands.map((band) => band.id));
    expect(marks(markup, "legend").map(([, id]) => id).sort()).toEqual(data.budget.receipts.map((receipt) => receipt.id).sort());
    expect(markup).toMatch(/aria-pressed="true"[^>]*>შემოსავლები</);
  });

  test("a focused band dims the others; a category of another set dims none", () => {
    const { data } = loaded.ka!;
    const id = "spending.debt_service";
    const markup = render("06", data.budget.defaultYear, { focus: id });
    const bands = marks(markup, "band");
    expect(bands.filter(([tag]) => tag.includes('data-focus=""')).map(([, band]) => band)).toEqual([id]);
    expect(bands.filter(([tag, band]) => band !== id && !tag.includes('data-dim=""'))).toEqual([]);
    const other = render("06", data.budget.defaultYear, { focus: "spending_type.social_benefits" });
    expect(other).not.toContain('data-dim=""');
  });

  test("the plan year is hatched and named in the legend", () => {
    const { data } = loaded.ka!;
    const planYear = data.budget.years.find((_, index) => data.budget.planned[index])!;
    const markup = render("06", planYear);
    expect(markup).toContain("data-plan-hatch");
    expect(plain(markup)).toContain(`გეგმა · ${planYear}`);
    expect(/data-chosen-label[^>]*>([^<]*)</.exec(markup)?.[1]).toBe(`${planYear} · გეგმა`);
  });

  test("right-edge labels sit at least 14px apart", () => {
    const { data } = loaded.ka!;
    for (const side of ["expenditure", "revenue"] as const) {
      const markup = render("06", data.budget.defaultYear, { side });
      const tops = [...markup.matchAll(/data-edge-label="[^"]*"[^>]*style="top:([\d.]+)px/g)].map((match) => Number(match[1]));
      expect(tops.length).toBeGreaterThan(0);
      const sorted = [...tops].sort((left, right) => left - right);
      sorted.slice(1).forEach((top, index) => expect(top - sorted[index]!).toBeGreaterThanOrEqual(14 - 1e-9));
    }
  });
});

describe("Year in review notes", () => {
  test("the notes fill their dates, years and population from the data, then link to the source pages", () => {
    const { data } = loaded.ka!;
    const year = data.budget.defaultYear;
    const markup = render("notes", year);
    const text = plain(markup);
    expect(text).toContain(updatedDate(data.updatedAt, "ka"));
    const population = data.budget.population[data.budget.years.indexOf(year)]!;
    expect(text).toContain(`(${year} — ${population.toLocaleString("en-US")})`);
    expect(text).toContain(`მუნიციპალიტეტები: ${data.municipal.year} წლის ფაქტი`);
    const links = [...markup.matchAll(/<a[^>]*href="([^"]*)"/g)].map((match) => match[1]);
    expect(links).toEqual([
      "/explorer/expenditure",
      "/explorer/expenditure-types",
      "/explorer/revenue",
      "/explorer/tax-breaks-refunds",
      "/explorer/municipalities",
      "/explorer/deficit",
      "/explorer/debt",
      "/methodology",
    ]);
    const english = render("notes", year, { locale: "en" });
    expect([...english.matchAll(/<a[^>]*href="([^"]*)"/g)].every((match) => match[1]!.startsWith("/en/"))).toBe(true);
  });

  test("without a plan year or a negative other-taxes year, the budget and receipts notes keep their ranges", () => {
    const { data } = loaded.ka!;
    const stripped: YearReviewData = {
      ...data,
      budget: {
        ...data.budget,
        planned: data.budget.planned.map(() => false),
        receipts: data.budget.receipts.map((receipt) => ({ ...receipt, values: receipt.values.map((value) => (value === null ? null : Math.abs(value))) })),
      },
    };
    const text = plain(render("notes", data.budget.defaultYear, { data: stripped }));
    const spendYears = data.budget.years.filter((_, index) => data.budget.fields.some((field) => field.values[index] !== null));
    expect(text).toContain(`სახელმწიფო ბიუჯეტი: ${spendYears[0]}–${spendYears.at(-1)} — 12-თვიანი ფაქტობრივი შესრულება.`);
    expect(text).not.toContain("დამტკიცებული გეგმა");
    expect(text).toMatch(/შემოსავლები: \d{4}–\d{4} ფაქტი\./);
    expect(text).not.toContain("„სხვა გადასახადები“");
  });
});

describe("Year in review page, sections 05 to the notes", () => {
  test("no footer line anywhere, and three share buttons in sections 05 and 06", async () => {
    const markup = renderPageMarkup("ka", await renderAnalysisPage("ka"));
    expect(markup).not.toContain("©");
    expect(markup).not.toContain("© 2026");
    const start = markup.indexOf('id="year-review-country"');
    expect(start).toBeGreaterThan(0);
    expect(markup.slice(start).match(/data-testid="chart-share"/g)).toHaveLength(3);
    expect(markup).toContain('id="year-review-notes"');
  });

  test("in English sections 05, 06 and the notes have no Georgian text", () => {
    const { data } = loaded.en!;
    const year = data.budget.defaultYear;
    for (const which of ["05", "06", "notes"] as const) {
      for (const side of ["expenditure", "revenue"] as const) {
        expect(plain(render(which, year, { locale: "en", side })).match(GEORGIAN) ?? []).toEqual([]);
      }
    }
  });
});
