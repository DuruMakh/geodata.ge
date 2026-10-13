import { describe, expect, it } from "vitest";
import { ExplorerTable } from "../../components/main-explorer/explorer-table";
import { UNIT_PERSONS } from "../../lib/explorer/format";
import { renderGeorgianMarkup } from "../helpers/render-localized";

// Server markup is the year-columns layout (the table measures its width after it mounts).
const georgia = { itemId: "country.georgia", kaLabel: "საქართველო", color: "#1E1B16", valuesByYear: { 2024: 3_694_608, 2025: 3_930_428 }, change: 0.06 };
const adjara = { itemId: "region.adjara", kaLabel: "აჭარა", color: "#B3402A", valuesByYear: { 2024: 354_000, 2025: 413_214 }, change: 0.17 };
const imereti = { itemId: "region.imereti", kaLabel: "იმერეთი", color: "#2F5D8A", valuesByYear: { 2024: 470_000, 2025: 460_000 }, change: -0.02 };

const html = renderGeorgianMarkup(
  <ExplorerTable
    caption="მოსახლეობა"
    rows={[adjara, imereti]}
    totalRow={georgia}
    showTotal
    years={[2024, 2025]}
    firstColumnLabel="ტერიტორია"
    unit={UNIT_PERSONS}
    share={false}
    shareColumnLabel="წილი"
    rowLabelsLocalized
    shareValueForYear={() => 0.1}
  />,
);

describe("ExplorerTable year-columns layout", () => {
  it("column headers carry scope=col and row labels are th scope=row", () => {
    expect(html).toContain('data-layout="columns"');
    const head = /<thead>([\s\S]*?)<\/thead>/.exec(html)![1]!;
    const headCells = [...head.matchAll(/<th\b[^>]*>/g)].map((match) => match[0]);
    // Label column, two years, change, share.
    expect(headCells).toHaveLength(5);
    for (const cell of headCells) expect(cell).toContain('scope="col"');

    const body = /<tbody>([\s\S]*?)<\/tbody>/.exec(html)![1]!;
    const rows = [...body.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)].map((match) => match[1]!);
    expect(rows).toHaveLength(3);
    for (const [index, label] of ["აჭარა", "იმერეთი", "საქართველო"].entries()) {
      const firstCell = /^<(th|td)\b([^>]*)>([\s\S]*?)<\/\1>/.exec(rows[index]!)!;
      expect(firstCell[1], label).toBe("th");
      expect(firstCell[2], label).toContain('scope="row"');
      // U25-07: a year cell scrolled under the sticky label fades out behind it instead of showing half a figure.
      expect(firstCell[2], label).toContain("after:bg-[linear-gradient(to_right,var(--paper),transparent)]");
      expect(firstCell[3], label).toContain(label);
      // Year, change and share values stay data cells.
      expect(rows[index]!.match(/<td\b/g), label).toHaveLength(4);
    }
  });
});
