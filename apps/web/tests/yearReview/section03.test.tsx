import { beforeAll, describe, expect, test } from "vitest";
import { WhereMoneyGoes } from "../../components/year-review/where-money-goes";
import type { Presentation } from "../../lib/i18n/types";
import { loadYearReviewData } from "../../lib/yearReview/buildYearReviewData";
import type { YearReviewData } from "../../lib/yearReview/types";
import { buysView, type Grouping } from "../../lib/yearReview/yearView";
import { renderPageMarkup } from "../helpers/render-localized";

// Section 03 (where the money goes) as static markup, on the served data. Hover and click picking are in the
// browser spec (Task 10).

const GEORGIAN = /\p{Script=Georgian}/gu;
const loaded: Partial<Record<"ka" | "en", { data: YearReviewData; presentation: Presentation }>> = {};
beforeAll(async () => {
  [loaded.ka, loaded.en] = await Promise.all([loadYearReviewData("ka"), loadYearReviewData("en")]);
});

const noop = () => {};
function section(year: number, options: { grouping?: Grouping; focus?: string | null; pin?: string | null; locale?: "ka" | "en" } = {}): string {
  const { grouping = "fields", focus = null, pin = null, locale = "ka" } = options;
  const { data, presentation } = loaded[locale]!;
  return renderPageMarkup(
    locale,
    <WhereMoneyGoes data={data} year={year} grouping={grouping} focus={focus} pin={pin} onFocus={noop} onPin={noop} onGrouping={noop} />,
    presentation.messages,
  );
}

/**
 * The categories of a grouping with a value in the chosen year: the rows the ranking lists. A zero is no value here:
 * spending.other_unclassified is kept as 0 in most years (every official row is preserved), and it has nothing to rank.
 */
function present(data: YearReviewData, grouping: Grouping, year: number) {
  const index = data.budget.years.indexOf(year);
  const categories = grouping === "fields" ? data.budget.fields : data.budget.institutions;
  return categories.filter((category) => (category.values[index] ?? 0) !== 0);
}
const rowTags = (markup: string) => [...markup.matchAll(/<button[^>]*data-rank-row="[^"]*"[^>]*>/g)].map(([tag]) => tag);
const plain = (markup: string) => markup.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

describe("Year in review section 03", () => {
  test("the last actual year: 100 cells, one ranking row per field with a value, three share buttons", () => {
    const { data } = loaded.ka!;
    const year = data.budget.defaultYear;
    const markup = section(year);
    expect(markup.match(/data-cell="/g)).toHaveLength(100);
    const fields = present(data, "fields", year);
    const rows = rowTags(markup);
    expect(rows).toHaveLength(fields.length);
    expect(rows.map((tag) => /data-rank-row="([^"]*)"/.exec(tag)![1]).sort()).toEqual(fields.map((field) => field.id).sort());
    expect(plain(markup)).toContain(`${fields.length} სფერო`);
    expect(markup.match(/data-testid="chart-share"/g)).toHaveLength(3);
    // Nothing picked: no row is focused or dimmed, none is pressed.
    expect(markup).not.toContain('data-focus=""');
    expect(markup).not.toContain('data-dim=""');
    expect(rows.every((tag) => tag.includes('aria-pressed="false"'))).toBe(true);
    // The "then" grid names its year from the data.
    expect(plain(markup)).toContain(`${data.budget.years[0]} წელს`);
  });

  test("institutions: the count line reads {n} უწყება", () => {
    const { data } = loaded.ka!;
    const year = data.budget.defaultYear;
    const markup = section(year, { grouping: "institutions" });
    const institutions = present(data, "institutions", year);
    expect(rowTags(markup)).toHaveLength(institutions.length);
    expect(plain(markup)).toContain(`${institutions.length} უწყება`);
    expect(markup).toMatch(/aria-pressed="true"[^>]*>უწყებები</);
  });

  test("a focused category: its row carries data-focus, every other row is dimmed, a pinned one is pressed", () => {
    const { data } = loaded.ka!;
    const year = data.budget.defaultYear;
    const id = "spending.debt_service";
    const markup = section(year, { focus: id, pin: id });
    const rows = rowTags(markup);
    const focused = rows.filter((tag) => tag.includes('data-focus=""'));
    expect(focused).toHaveLength(1);
    expect(focused[0]).toContain(`data-rank-row="${id}"`);
    expect(focused[0]).toContain('aria-pressed="true"');
    const others = rows.filter((tag) => !tag.includes(`data-rank-row="${id}"`));
    expect(others.length).toBe(present(data, "fields", year).length - 1);
    expect(others.every((tag) => tag.includes("data-dim"))).toBe(true);
    // The grid dims every cell but the focused category's.
    const cells = [...markup.matchAll(/<i[^>]*data-cell="([^"]*)"[^>]*>/g)];
    expect(cells.filter(([tag, cell]) => cell !== id && !tag.includes("data-dim"))).toEqual([]);
    expect(cells.filter(([tag, cell]) => cell === id && tag.includes("data-dim"))).toEqual([]);
  });

  test("the first year has nothing to compare with; the plan year says plan against actual", () => {
    const { data } = loaded.ka!;
    const [first] = data.budget.years;
    expect(plain(section(first!))).toContain(`${first} პირველი წელია მონაცემებში`);
    const planYear = data.budget.years.find((_, index) => data.budget.planned[index]);
    if (planYear === undefined) return;
    const plan = plain(section(planYear));
    expect(plan).toContain(`${planYear} — გეგმა, ${planYear - 1} — ფაქტი`);
    expect(plan).toContain(`${planYear} · სახელმწიფო ბიუჯეტი · გეგმა`);
  });

  test("the treemap labels tiles of 3% and more on the tile and lists the smaller ones under it", () => {
    const { data } = loaded.ka!;
    const year = data.budget.defaultYear;
    const markup = section(year);
    const { tiles } = buysView(data, year).value;
    const labelled = [...markup.matchAll(/data-tile="([^"]*)"[^>]*data-labelled=""/g)].map((match) => match[1]);
    // Two layouts (wide and tall), each labelling the same tiles.
    expect(labelled.sort()).toEqual(tiles.filter((tile) => tile.share >= 0.03).flatMap((tile) => [tile.id, tile.id]).sort());
    const listed = [...markup.matchAll(/data-small-tile="([^"]*)"/g)].map((match) => match[1]);
    expect(listed).toEqual(tiles.filter((tile) => tile.share < 0.03).map((tile) => tile.id));
  });

  test("in English the section has no Georgian text", () => {
    const { data } = loaded.en!;
    const markup = section(data.budget.defaultYear, { locale: "en", grouping: "institutions" });
    expect(plain(markup).match(GEORGIAN) ?? []).toEqual([]);
  });
});
