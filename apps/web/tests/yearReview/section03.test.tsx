import { beforeAll, describe, expect, test, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { BuysTreemap, type BuysTile } from "../../components/year-review/buys-treemap";
import { WhereMoneyGoes } from "../../components/year-review/where-money-goes";
import { fillUnderWhiteText } from "../../lib/explorer/colors";
import type { Presentation } from "../../lib/i18n/types";
import { loadYearReviewData } from "../../lib/yearReview/buildYearReviewData";
import type { YearReviewData } from "../../lib/yearReview/types";
import { buysView, type Grouping } from "../../lib/yearReview/yearView";
import { renderPageMarkup } from "../helpers/render-localized";

// Section 03 (where the money goes) as static markup, on the served data. Hover and click picking are in the
// browser spec (Task 10). The share button stands in with its title and caption on it: the real one mounts its card
// only when opened, so its caption never reaches static markup.

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
/** The markup of one panel: from its `data-panel` mark to the next panel's, or the end. */
function part(markup: string, id: string): string {
  const start = markup.indexOf(`data-panel="${id}"`);
  const next = markup.indexOf("data-panel=", start + 1);
  return start < 0 ? "" : markup.slice(start, next < 0 ? undefined : next);
}
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
    // A dimmed row's text turns muted rather than faded: only its swatch and trend line fade (contrast).
    const dimmed = /<button[^>]*data-dim=""[\s\S]*?<\/button>/.exec(markup)![0];
    expect(dimmed).toMatch(/^<button[^>]*text-\[var\(--muted\)\]/);
    expect(dimmed.match(/opacity-25/g)).toHaveLength(2);
    expect(/<span[^>]*>(?:<!-- -->)?<b[^>]*text-\[28px\]/.exec(dimmed)![0]).not.toContain("opacity-25");
  });

  test("the first year has nothing to compare with; the plan year says plan against actual", () => {
    const { data } = loaded.ka!;
    const [first] = data.budget.years;
    expect(plain(section(first!))).toContain(`${first} პირველი წელია მონაცემებში`);
    const planYear = data.budget.years.find((_, index) => data.budget.planned[index]);
    expect(planYear).toBeDefined();
    const markup = section(planYear!);
    const plan = plain(markup);
    const basis = `${planYear} — გეგმა, ${planYear! - 1} — ფაქტი`;
    expect(plan).toContain(basis);
    expect(plan).toContain(`${planYear} · სახელმწიფო ბიუჯეტი · გეგმა`);
    // The change bars' share picture says plan against actual too, and each ranking row says plan to a screen reader.
    expect(/data-caption="([^"]*)"/.exec(part(markup, "change"))?.[1]).toContain(basis);
    expect(rowTags(markup).every((tag) => /aria-label="[^"]*, გეგმა, /.test(tag))).toBe(true);
    expect(/data-caption="([^"]*)"/.exec(part(section(planYear! - 1), "change"))?.[1]).not.toContain("გეგმა");
  });

  test("a category with no value the year before has the newCat note instead of a bar", () => {
    const { data } = loaded.ka!;
    const { years } = data.budget;
    const found = (["fields", "institutions"] as const).flatMap((grouping) =>
      (grouping === "fields" ? data.budget.fields : data.budget.institutions).flatMap((category) =>
        years.flatMap((year, index) =>
          index > 0 && (category.values[index] ?? 0) !== 0 && category.values[index - 1] === null ? [{ grouping, category, year, previous: years[index - 1]! }] : [],
        ),
      ),
    )[0];
    expect(found).toBeDefined();
    const change = part(section(found!.year, { grouping: found!.grouping }), "change");
    expect(plain(change)).toContain(`${found!.category.label} — ${found!.previous} წელს მონაცემი არ არის`);
    expect(change).not.toContain(`data-change-row="${found!.category.id}"`);
  });

  test("the treemap carries a year tag when spending by type falls back to another year", () => {
    const { data } = loaded.ka!;
    const year = data.budget.years.find((target) => buysView(data, target).fallback);
    expect(year).toBeDefined();
    const used = buysView(data, year!).year;
    expect(part(section(year!), "buys")).toContain(`data-year-tag="${used}"`);
    expect(part(section(used), "buys")).not.toContain("data-year-tag");
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

  test("a treemap tile whose colour is too light for its white text is drawn darker, the others in their own colour", () => {
    const { data } = loaded.ka!;
    const markup = section(data.budget.defaultYear);
    const fill = (id: string) => new RegExp(`data-tile="${id}"[^>]*background-color:(#[0-9A-Fa-f]{6})`).exec(markup)?.[1];
    const own = (id: string) => data.spendingTypes.types.find((type) => type.id === id)!.color;
    expect(fill("spending_type.social_benefits")).toBe(own("spending_type.social_benefits"));
    expect(fill("spending_type.compensation")).toBe(fillUnderWhiteText(own("spending_type.compensation")));
    expect(fill("spending_type.compensation")).not.toBe(own("spending_type.compensation"));
  });

  test("a labelled treemap tile too short for its change line leaves it out", () => {
    const tile = (id: string, height: number): BuysTile => ({
      id, label: id, color: "#34609E", value: 1, share: 0.4, rect: [0, 0, 200, height], tall: [0, 0, 200, height], amount: `${id} amount`, change: `${id} change`,
    });
    const markup = renderToStaticMarkup(<BuysTreemap tiles={[tile("short", 90), tile("tall", 200)]} focus={null} ariaLabel="treemap" />);
    // Each tile is drawn in both layouts.
    expect(markup.match(/short amount/g)).toHaveLength(2);
    expect(markup).not.toContain("short change");
    expect(markup.match(/tall change/g)).toHaveLength(2);
  });

  test("in English the section has no Georgian text", () => {
    const { data } = loaded.en!;
    const markup = section(data.budget.defaultYear, { locale: "en", grouping: "institutions" });
    expect(plain(markup).match(GEORGIAN) ?? []).toEqual([]);
  });
});
