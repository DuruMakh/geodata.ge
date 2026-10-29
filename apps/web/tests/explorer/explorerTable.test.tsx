import { describe, expect, it } from "vitest";
import { ExplorerTable } from "../../components/main-explorer/explorer-table";
import { UNIT_PERSONS } from "../../lib/explorer/format";
import { renderGeorgianMarkup } from "../helpers/render-localized";

// Server markup is the year-columns layout (the table measures its width after it mounts).
const georgia = { itemId: "country.georgia", kaLabel: "საქართველო", color: "#1E1B16", valuesByYear: { 2024: 3_694_608, 2025: 3_930_428 }, change: 0.06 };
const adjara = { itemId: "region.adjara", kaLabel: "აჭარა", color: "#B3402A", valuesByYear: { 2024: 354_000, 2025: 413_214 }, change: 0.17 };
const imereti = { itemId: "region.imereti", kaLabel: "იმერეთი", color: "#2F5D8A", valuesByYear: { 2024: 470_000, 2025: 460_000 }, change: -0.02 };

const sameProps = {
  caption: "მოსახლეობა",
  rows: [adjara, imereti],
  totalRow: georgia,
  showTotal: true,
  years: [2024, 2025],
  firstColumnLabel: "ტერიტორია",
  unit: UNIT_PERSONS,
  share: false,
  shareColumnLabel: "წილი",
  rowLabelsLocalized: true,
  shareValueForYear: () => 0.1,
};

const html = renderGeorgianMarkup(<ExplorerTable {...sameProps} />);

describe("ExplorerTable crawl copy", () => {
  const crawl = renderGeorgianMarkup(<ExplorerTable {...sameProps} crawlCopy />);
  it("is hidden by a stylesheet class only", () => {
    expect(crawl).toMatch(/<div class="[^"]*\bhidden\b[^"]*"/);
    expect(crawl).not.toMatch(/\shidden(=|\s|>)/);
    expect(crawl).not.toMatch(/<div[^>]*aria-hidden/);
    expect(crawl).not.toMatch(/style="[^"]*display/);
  });
  it("keeps every figure and a test id of its own", () => {
    expect(crawl).toContain('data-testid="explorer-table-crawl"');
    expect(crawl).not.toContain('data-testid="explorer-table"');
    expect(crawl).not.toContain("tabindex");
    for (const year of ["2024", "2025"]) expect(crawl).toContain(`>${year}<`);
  });
  it("leaves the visible table unchanged", () => expect(renderGeorgianMarkup(<ExplorerTable {...sameProps} />)).toBe(html));
});

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
      expect(firstCell[3], label).toContain(label);
      // Year, change and share values stay data cells.
      expect(rows[index]!.match(/<td\b/g), label).toHaveLength(4);
    }
  });
});

describe("ExplorerTable planned values", () => {
  it("marks a planned year on the total row and on the other rows, and no other year", () => {
    const planned = renderGeorgianMarkup(
      <ExplorerTable
        caption="ხარჯები"
        rows={[{ ...adjara, basisByYear: { 2024: "actual", 2025: "planned" } }]}
        totalRow={{ ...georgia, basisByYear: { 2024: "actual", 2025: "planned" } }}
        showTotal
        years={[2024, 2025]}
        firstColumnLabel="ტერიტორია"
        unit={UNIT_PERSONS}
        share={false}
        rowLabelsLocalized
        shareValueForYear={() => 0.1}
      />,
      { "controls.planned": "გეგმა" },
    );
    const body = /<tbody>([\s\S]*?)<\/tbody>/.exec(planned)![1]!;
    const [seriesRow, totalRow] = [...body.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)].map((match) => [...match[1]!.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)].map((cell) => cell[1]!));
    for (const cells of [seriesRow!, totalRow!]) {
      expect(cells[0]).not.toContain("გეგმა");
      expect(cells[1]).toContain("<sup");
      expect(cells[1]).toContain("გეგმა");
    }
  });
});

