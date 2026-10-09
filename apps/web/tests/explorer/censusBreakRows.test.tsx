import { describe, expect, it, vi } from "vitest";

// The table measures its own width after it mounts, so server markup is always the year-columns layout. Here it starts at
// the width a phone column measures (350px), which turns a table of up to three series into year rows, newest first (D5).
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, useState: <S,>(initial: S) => actual.useState(initial === 0 ? (350 as S) : initial) };
});

import { ExplorerTable } from "../../components/main-explorer/explorer-table";
import { UNIT_PERSONS } from "../../lib/explorer/format";
import { renderGeorgianMarkup } from "../helpers/render-localized";

const georgia = { itemId: "country.georgia", kaLabel: "Georgia", color: "#1E1B16", valuesByYear: { 2023: 3_736_400, 2024: 3_694_608, 2025: 3_930_428, 2026: 3_941_103 } };
const adjara = { itemId: "region.adjara", kaLabel: "Adjara", color: "#B3402A", valuesByYear: { 2023: 352_000, 2024: 354_000, 2025: 413_214, 2026: 415_000 } };
const table = (years: number[], extra: { breakYears?: number[]; breakLabel?: string } = {}) =>
  renderGeorgianMarkup(
    <ExplorerTable
      caption="Population"
      rows={[adjara]}
      totalRow={georgia}
      showTotal
      totalFirst
      years={years}
      firstColumnLabel="Place"
      unit={UNIT_PERSONS}
      share={false}
      showChangeColumn={false}
      rowLabelsLocalized
      shareValueForYear={() => null}
      {...extra}
    />,
  );
const yearRow = (html: string, year: number) => new RegExp(`<tr[^>]*data-year="${year}"[^>]*>[\\s\\S]*?</tr>`).exec(html)?.[0] ?? "";
const RULE = "border-bottom:2px solid var(--ink)";

describe("ExplorerTable break in the phone year-rows layout", () => {
  it("lists one row per year, newest first", () => {
    const html = table([2023, 2024, 2025, 2026]);
    expect(html).toContain('data-layout="rows"');
    expect([...html.matchAll(/data-year="(\d{4})"/g)].map((match) => Number(match[1]))).toEqual([2026, 2025, 2024, 2023]);
  });

  it("draws a 2px rule under the 2025 row, between it and 2024, and labels the 2025 row", () => {
    const html = table([2023, 2024, 2025, 2026], { breakYears: [2025], breakLabel: "Census re-base" });
    expect(yearRow(html, 2025)).toContain(RULE);
    expect(yearRow(html, 2025)).toContain("Census re-base");
    for (const year of [2026, 2024, 2023]) {
      expect(yearRow(html, year), String(year)).not.toContain("2px solid");
      expect(yearRow(html, year), String(year)).not.toContain("Census re-base");
    }
    expect(html.match(/Census re-base/g)).toHaveLength(1);
    // The rule sits between the 2025 and the 2024 row in the order the rows are drawn.
    expect(html.indexOf(RULE)).toBeGreaterThan(html.indexOf('data-year="2026"'));
    expect(html.indexOf(RULE)).toBeLessThan(html.indexOf('data-year="2024"'));
  });

  it("is unchanged when no break year is given", () => {
    expect(table([2023, 2024, 2025, 2026])).not.toContain("2px solid");
  });

  it("ignores a break year the range does not separate (2025 as the first year)", () => {
    const html = table([2025, 2026], { breakYears: [2025], breakLabel: "Census re-base" });
    expect(html).toContain('data-layout="rows"');
    expect(html).not.toContain("2px solid");
    expect(html).not.toContain("Census re-base");
  });
});
